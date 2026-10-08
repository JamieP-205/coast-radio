// Pages. Every page lives in this one file and only one is shown at a time,
// so the music keeps playing while listeners move around the site.

document.documentElement.classList.add('has-js');

const pages = document.querySelectorAll('[data-page]');
const navLinks = document.querySelectorAll('.nav a');
let firstPageShown = true;

function showPage() {
  const requested = location.hash.slice(1) || 'home';
  const page = document.querySelector(`[data-page="${requested}"]`);

  // Links such as "Skip to content" aren't pages, so leave the page as it is.
  if (!page) {
    if (firstPageShown) {
      firstPageShown = false;
      history.replaceState(null, '', '#home');
      showPage();
    }
    return;
  }

  pages.forEach((section) => {
    section.hidden = section !== page;
  });
  navLinks.forEach((link) => {
    if (link.getAttribute('href') === `#${requested}`) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  document.title = page.dataset.title;

  // Moving focus to the new page's heading tells screen readers it changed.
  if (!firstPageShown) {
    window.scrollTo(0, 0);
    page.querySelector('h1').focus();
  }
  firstPageShown = false;
}

window.addEventListener('hashchange', showPage);
showPage();

// Phone menu

const menuButton = document.querySelector('.menu-button');
const mainNav = document.getElementById('main-nav');

menuButton.hidden = false;
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  mainNav.classList.toggle('is-open', !open);
});

mainNav.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    menuButton.setAttribute('aria-expanded', 'false');
    mainNav.classList.remove('is-open');
  }
});

// Listening

const STREAM_URL = 'https://coast-stream.jamieparr05.workers.dev/stream';

const audio = document.getElementById('stream');
const controls = document.querySelector('.player-controls');
const playButtons = document.querySelectorAll('[data-play]');
const playLabels = document.querySelectorAll('[data-play-label]');
const volumeSliders = document.querySelectorAll('[data-volume]');
const statusText = document.getElementById('player-status');

let isPlaying = false;

// The browser's own player stays as a fallback if this script never runs.
audio.controls = false;
audio.hidden = true;
controls.hidden = false;
audio.volume = 0.8;

function showPlaying(playing) {
  isPlaying = playing;
  document.body.classList.toggle('is-playing', playing);
  playLabels.forEach((label) => {
    label.textContent = playing ? 'Pause' : 'Listen live';
  });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }
}

function startListening() {
  // A live stream can't be resumed from where it paused, so reconnect to
  // get the station as it is now.
  audio.src = STREAM_URL;
  statusText.textContent = 'Connecting to the station…';
  audio.play().catch(() => {
    statusText.textContent = "The station couldn't be reached. Please try again in a minute.";
    showPlaying(false);
  });
}

function stopListening() {
  audio.pause();
  // Removing the source stops the stream downloading in the background.
  audio.removeAttribute('src');
  audio.load();
  statusText.textContent = 'Paused.';
  showPlaying(false);
}

playButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (isPlaying) {
      stopListening();
    } else {
      startListening();
    }
  });
});

audio.addEventListener('playing', () => {
  statusText.textContent = 'Playing live.';
  showPlaying(true);
});

audio.addEventListener('waiting', () => {
  statusText.textContent = 'Buffering…';
});

// If the connection drops while someone is listening, say so and reset the
// buttons, rather than showing Pause while nothing plays.
['error', 'ended'].forEach((type) => {
  audio.addEventListener(type, () => {
    if (!isPlaying) return;
    statusText.textContent = 'The stream stopped. Press play to reconnect.';
    showPlaying(false);
  });
});

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', startListening);
  navigator.mediaSession.setActionHandler('pause', stopListening);
}

// iPhones and iPads only let the side buttons change the volume, so the
// sliders are shown only where they work, and a note is shown instead.
function volumeCanChange() {
  const test = new Audio();
  test.volume = 0.5;
  return test.volume === 0.5;
}

const canChangeVolume = volumeCanChange();
document.querySelectorAll('[data-volume-control]').forEach((control) => {
  control.hidden = !canChangeVolume;
});
document.querySelectorAll('[data-volume-note]').forEach((note) => {
  note.hidden = canChangeVolume;
});

// The thin sliders fill up to their value, and all of them move together.
function paintSlider(slider) {
  slider.style.setProperty('--fill', `${slider.value}%`);
}

volumeSliders.forEach((slider) => {
  paintSlider(slider);
  slider.addEventListener('input', () => {
    audio.volume = slider.value / 100;
    volumeSliders.forEach((other) => {
      other.value = slider.value;
      paintSlider(other);
    });
  });
});

// What's playing, with album covers

const METADATA_URL = 'https://coast-metadata.jamieparr05.workers.dev/';
const ARTWORK_URL = 'https://itunes.apple.com/search';
const FALLBACK_ART = 'images/no-cover.svg';
const TRACK_REFRESH_MS = 15000;
const CHANGE_MS = 280;

const nowArt = document.getElementById('now-art');
const nowSong = document.getElementById('now-song');
const nowArtist = document.getElementById('now-artist');
const barArt = document.getElementById('bar-art');
const barSong = document.getElementById('bar-song');
const barArtist = document.getElementById('bar-artist');
const fullArt = document.getElementById('full-art');
const fullSong = document.getElementById('full-song');
const fullArtist = document.getElementById('full-artist');
const nextArt = document.getElementById('next-art');
const comingUpTexts = document.querySelectorAll('[data-coming-up]');
const previouslyPlayed = document.getElementById('previously-played');
const nowPlayingBlocks = document.querySelectorAll('.now, .bar-open, .full-now');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let currentTitle = '';
let currentNext = '';

// Tracks arrive as "Artist - Song (02:51)". Some of the station's files also
// have "MP3" in their names, which listeners don't need to see.
function tidyName(text) {
  return text.replace(/[\s._-]*\bmp3\b/gi, '').trim();
}

function splitTrack(text) {
  const clean = text.replace(/\s*\(\d+:\d+\)\s*$/, '');
  const dash = clean.indexOf(' - ');
  if (dash === -1) return { artist: '', song: tidyName(clean) };
  return { artist: tidyName(clean.slice(0, dash)), song: tidyName(clean.slice(dash + 3)) };
}

// Album covers come from Apple's free iTunes search. Each song is only
// looked up once.
const artworkCache = new Map();
const COMMON_WORDS = new Set(['the', 'and', 'for', 'you', 'your', 'with', 'from', 'that', 'this']);

function words(text) {
  return (text.toLowerCase().match(/[a-z]{3,}/g) || []).filter((word) => !COMMON_WORDS.has(word));
}

function shareAWord(ours, theirs) {
  const theirWords = words(theirs);
  return words(ours).some((word) => theirWords.includes(word));
}

function searchArtwork(term, entity, accept) {
  return fetch(`${ARTWORK_URL}?term=${encodeURIComponent(term)}&entity=${entity}&limit=5&country=gb`)
    .then((response) => (response.ok ? response.json() : { results: [] }))
    .then((data) => data.results.find(accept)?.artworkUrl100 || '')
    .catch(() => '');
}

// Look for the song, checking the artist and title both match so nobody sees
// the wrong cover. If it isn't there, use an album by the same artist, and
// only fall back to the Coast artwork if the artist isn't found either.
// Some files have no dash between artist and song, such as "Adios Larry
// Cunningham", so then the whole name is checked against both.
function findArtwork(track, size) {
  const key = `${track.artist} ${track.song}`.trim();
  if (!artworkCache.has(key)) {
    const artist = track.artist || track.song;
    const isMatch = (result) => shareAWord(artist, result.artistName)
      && shareAWord(track.song, result.trackName);
    const sameArtist = (result) => shareAWord(artist, result.artistName);
    artworkCache.set(key, searchArtwork(key, 'song', isMatch)
      .then((url) => url || searchArtwork(artist, 'album', sameArtist)));
  }
  return artworkCache.get(key)
    .then((url) => (url ? url.replace('100x100bb', `${size}x${size}bb`) : FALLBACK_ART));
}

// Load a cover before showing it, so a change never flashes empty.
function preload(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = url;
  });
}

// The old song slides up and out, then the new one rises into place.
function changeSmoothly(update) {
  if (reduceMotion.matches) {
    update();
    return;
  }
  nowPlayingBlocks.forEach((block) => block.classList.add('is-leaving'));
  setTimeout(() => {
    update();
    nowPlayingBlocks.forEach((block) => block.classList.replace('is-leaving', 'is-entering'));
    setTimeout(() => {
      nowPlayingBlocks.forEach((block) => block.classList.remove('is-entering'));
    }, CHANGE_MS + 100);
  }, CHANGE_MS);
}

async function showNowPlaying(track) {
  const art = await findArtwork(track, 600);
  await preload(art);

  changeSmoothly(() => {
    [nowSong, barSong, fullSong].forEach((element) => {
      element.textContent = track.song;
    });
    [nowArtist, barArtist, fullArtist].forEach((element) => {
      element.textContent = track.artist;
    });
    [nowArt, barArt, fullArt].forEach((image) => {
      image.src = art;
    });
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.song,
      artist: track.artist,
      album: 'Coast Internet Radio',
      artwork: [{ src: art === FALLBACK_ART ? 'images/jim-studio.webp' : art, sizes: '600x600' }],
    });
  }
}

async function showComingUp(track) {
  const art = await findArtwork(track, 100);
  await preload(art);
  comingUpTexts.forEach((element) => {
    element.textContent = track.artist ? `${track.song} by ${track.artist}` : track.song;
  });
  nextArt.src = art;
}

// Just played. Songs already in the list keep their place in the page, so
// when a new one arrives they can slide along one spot instead of jumping.
const playedItems = new Map();

function playedItem(text) {
  if (playedItems.has(text)) return playedItems.get(text);

  const track = splitTrack(text);
  const item = document.createElement('li');
  const art = document.createElement('img');
  art.className = 'art';
  art.src = FALLBACK_ART;
  art.alt = '';
  art.width = 300;
  art.height = 300;
  findArtwork(track, 300).then((url) => {
    art.src = url;
  });

  const details = document.createElement('span');
  const song = document.createElement('span');
  song.className = 'played-song';
  song.textContent = track.song;
  const artist = document.createElement('span');
  artist.className = 'played-artist';
  artist.textContent = track.artist;
  details.append(song, artist);

  item.append(art, details);
  playedItems.set(text, item);
  return item;
}

function showJustPlayed(list) {
  const before = new Map([...previouslyPlayed.children].map((item) => [item, item.getBoundingClientRect()]));
  const items = list.map(playedItem);
  previouslyPlayed.replaceChildren(...items);

  playedItems.forEach((item, text) => {
    if (!list.includes(text)) playedItems.delete(text);
  });

  if (reduceMotion.matches || !before.size) return;

  // Each song glides from where it was to its new place; the one that just
  // finished drops in at the front.
  items.forEach((item) => {
    const was = before.get(item);
    if (was) {
      const now = item.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (dx || dy) {
        item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
          { duration: 500, easing: 'ease-in-out' });
      }
    } else {
      item.animate([{ opacity: 0, transform: 'translateY(-1rem)' }, { opacity: 1, transform: 'none' }],
        { duration: 500, easing: 'ease-out' });
    }
  });
}

async function updateTracks() {
  try {
    const response = await fetch(`${METADATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();

    if (data.title && data.title !== currentTitle) {
      currentTitle = data.title;
      showNowPlaying(splitTrack(data.title));
      if (Array.isArray(data.previous) && data.previous.length) showJustPlayed(data.previous);
    }

    if (data.comingUp && data.comingUp !== currentNext) {
      currentNext = data.comingUp;
      showComingUp(splitTrack(data.comingUp));
    }
  } catch {
    // Keep showing the last known tracks if the update fails.
  }
}

updateTracks();
setInterval(updateTracks, TRACK_REFRESH_MS);

// Jim live, or the 24-hour playlist. Worked out from the show times table so
// the times are only written down once. Times are UK time, wherever the
// listener is.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const onAirTags = document.querySelectorAll('[data-on-air]');
const nextShowTexts = document.querySelectorAll('[data-next-show]');
const shows = [...document.querySelectorAll('[data-day]')].map((row) => ({
  row,
  day: Number(row.dataset.day),
  start: Number(row.dataset.start),
  end: Number(row.dataset.end),
}));

function formatHour(hour) {
  if (hour === 12) return '12 noon';
  return hour > 12 ? `${hour - 12}pm` : `${hour}am`;
}

function ukNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return { day: DAYS.indexOf(value('weekday')), minutes: Number(value('hour')) * 60 + Number(value('minute')) };
}

function nextShowMessage(now) {
  for (let ahead = 0; ahead < 7; ahead += 1) {
    const day = (now.day + ahead) % 7;
    const next = shows.find((show) => show.day === day && (ahead > 0 || show.start * 60 > now.minutes));
    if (next) {
      const when = ahead === 0 ? 'Today' : ahead === 1 ? 'Tomorrow' : DAYS[day];
      return `Next live show: ${when} at ${formatHour(next.start)}.`;
    }
  }
  return 'See the show times.';
}

function updateLiveShow() {
  const now = ukNow();
  const live = shows.find((show) => show.day === now.day
    && now.minutes >= show.start * 60 && now.minutes < show.end * 60);

  shows.forEach((show) => {
    show.row.classList.toggle('is-today', show.day === now.day && show !== live);
    show.row.classList.toggle('is-live', show === live);
  });

  onAirTags.forEach((tag) => {
    tag.textContent = live ? 'Jim is live' : '24-hour playlist';
    tag.classList.toggle('is-live', Boolean(live));
  });

  const message = live ? `Jim is live now, until ${formatHour(live.end)}.` : nextShowMessage(now);
  nextShowTexts.forEach((text) => {
    text.textContent = message;
  });
}

updateLiveShow();
setInterval(updateLiveShow, 60000);

// The player bar and the full-screen player

const playerBar = document.querySelector('.player-bar');
const playerView = document.getElementById('player-view');
const muteButtons = document.querySelectorAll('[data-mute]');

playerBar.hidden = false;

// The bar shows whenever the main Listen button isn't on screen: on every
// other page, and on the home page once it scrolls away.
const mainButtonWatcher = new IntersectionObserver(([entry]) => {
  playerBar.classList.toggle('is-shown', !entry.isIntersecting);
});
mainButtonWatcher.observe(controls);

document.querySelectorAll('[data-open-player]').forEach((button) => {
  button.addEventListener('click', () => playerView.showModal());
});
playerView.querySelector('[data-close-player]').addEventListener('click', () => playerView.close());

function showMuted() {
  document.body.classList.toggle('is-muted', audio.muted);
  muteButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(audio.muted));
  });
}

muteButtons.forEach((button) => {
  button.addEventListener('click', () => {
    audio.muted = !audio.muted;
    showMuted();
  });
});

// Moving a volume slider unmutes, like Spotify.
volumeSliders.forEach((slider) => {
  slider.addEventListener('input', () => {
    if (audio.muted && slider.value > 0) {
      audio.muted = false;
      showMuted();
    }
  });
});

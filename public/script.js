// Pages. Every page lives in this one file and only one is shown at a time,
// so the music keeps playing while listeners move around the site.

document.documentElement.classList.add('has-js');

// Inside the editor, the website is shown in a frame with ?preview added.
const isPreview = new URLSearchParams(location.search).has('preview') && window.parent !== window;

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
  // Not in the editor's preview, where Jim is typing in the editor itself.
  if (!firstPageShown) {
    window.scrollTo(0, 0);
    if (!isPreview) page.querySelector('h1').focus();
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
// listener is. Jim can also switch it by hand from the editor, for a show
// that isn't on the list or one he can't do.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const onAirTags = document.querySelectorAll('[data-on-air]');
const nextShowTexts = document.querySelectorAll('[data-next-show]');
const showsTable = document.querySelector('[data-shows]');

function readShows() {
  return [...showsTable.querySelectorAll('[data-day]')].map((row) => ({
    row,
    day: Number(row.dataset.day),
    start: Number(row.dataset.start),
    end: Number(row.dataset.end),
  }));
}

let shows = readShows();
let liveOverride = { mode: 'auto' };

function formatHour(hour) {
  if (hour === 0 || hour === 24) return 'midnight';
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

function nextShowMessage(now, notToday = false) {
  for (let ahead = notToday ? 1 : 0; ahead < 8; ahead += 1) {
    const day = (now.day + ahead) % 7;
    const next = shows.find((show) => show.day === day && (ahead > 0 || show.start * 60 > now.minutes));
    if (next) {
      const when = ahead === 0 ? 'Today' : ahead === 1 ? 'Tomorrow' : DAYS[day];
      return `Next live show: ${when} at ${formatHour(next.start)}.`;
    }
  }
  return 'See the show times.';
}

// The switch only lasts until the time Jim chose, then the show times
// take over again.
function liveSwitch() {
  const { mode, until } = liveOverride;
  return mode !== 'auto' && Date.now() < Date.parse(until) ? mode : 'auto';
}

function liveMessage(now, live, override) {
  if (override === 'on') return 'Jim is live now.';
  if (live) return `Jim is live now, until ${formatHour(live.end)}.`;
  if (override === 'off') return `No live show today. ${nextShowMessage(now, true)}`;
  return nextShowMessage(now);
}

function updateLiveShow() {
  const now = ukNow();
  const override = liveSwitch();
  const live = override === 'off' ? undefined : shows.find((show) => show.day === now.day
    && now.minutes >= show.start * 60 && now.minutes < show.end * 60);
  const isLive = override === 'on' || Boolean(live);

  shows.forEach((show) => {
    show.row.classList.toggle('is-today', show.day === now.day && show !== live);
    show.row.classList.toggle('is-live', show === live);
  });

  onAirTags.forEach((tag) => {
    tag.textContent = isLive ? 'Jim is live' : '24-hour playlist';
    tag.classList.toggle('is-live', isLive);
  });

  const message = liveMessage(now, live, override);
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

// Text size and dark mode, remembered on this device

const readingTools = document.querySelector('.reading-tools');
const sizeButtons = document.querySelectorAll('[data-size]');
const darkToggle = document.querySelector('.dark-toggle');
const deviceDark = window.matchMedia('(prefers-color-scheme: dark)');

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The choice still applies until the page is closed.
  }
}

function recall(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSize(size) {
  if (size === 'standard') {
    delete document.documentElement.dataset.size;
  } else {
    document.documentElement.dataset.size = size;
  }
  sizeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.size === size));
  });
}

// Until someone chooses, the site follows the device's own light or dark setting.
function setTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  const dark = theme ? theme === 'dark' : deviceDark.matches;
  darkToggle.setAttribute('aria-pressed', String(dark));
}

readingTools.hidden = false;
setSize(recall('coast-text-size') || 'standard');
setTheme(recall('coast-theme'));

sizeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setSize(button.dataset.size);
    remember('coast-text-size', button.dataset.size);
  });
});

darkToggle.addEventListener('click', () => {
  const theme = darkToggle.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark';
  setTheme(theme);
  remember('coast-theme', theme);
});

deviceDark.addEventListener('change', () => setTheme(recall('coast-theme')));

// Requests and feedback are sent to Netlify Forms, which emails them on.

document.querySelectorAll('[data-form]').forEach((form) => {
  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.classList.remove('is-error');
    status.textContent = 'Sending…';

    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!response.ok) throw new Error(response.statusText);
      form.reset();
      status.textContent = form.dataset.success;
    } catch {
      status.classList.add('is-error');
      status.textContent = "That didn't send. Please try again, or email coastradio@hotmail.com.";
    } finally {
      submit.disabled = false;
    }
  });
});

// Content from the editor. The page is built with Jim's words already in it,
// so it works on its own; anything he has published since is laid on top.
// The last version is remembered on this device so returning listeners
// don't see the old words flash up first.

const CONTENT_URL = '/api/content';
const homePage = document.querySelector('[data-page="home"]');
const homeSections = new Map([...homePage.querySelectorAll('[data-section]')]
  .map((section) => [section.dataset.section, section]));
const announcement = document.querySelector('[data-announcement]');
const announcementLink = announcement.querySelector('[data-announcement-link]');

function tidyText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// Phone numbers are shown as written, and texted in international form.
function textLink(phone) {
  const digits = phone.replace(/[^0-9+]/g, '');
  return `sms:${digits.startsWith('0') ? `+44${digits.slice(1)}` : digits}`;
}

// The website as it was built, before any changes from the editor.
function readContent() {
  const text = {};
  document.querySelectorAll('[data-edit]').forEach((element) => {
    text[element.dataset.edit] ??= tidyText(element.textContent);
  });

  const photos = {};
  document.querySelectorAll('[data-edit-photo]').forEach((image) => {
    photos[image.dataset.editPhoto] = { src: image.getAttribute('src'), alt: image.alt };
  });

  const link = (name) => document.querySelector(`[data-contact="${name}"]`).href;
  const contacts = {
    phone: tidyText(document.querySelector('[data-contact="phone"]').textContent),
    email: new URL(link('email')).pathname,
    facebook: link('facebook'),
    x: link('x'),
    donate: link('donate'),
  };

  return {
    colours: 'navy',
    text,
    photos,
    contacts,
    announcement: { show: false, text: '', link: '' },
    news: { title: '', date: '', text: '' },
    home: [...homeSections.keys()].map((id) => ({ id, show: id !== 'news' })),
    shows: shows.map(({ day, start, end }) => ({ day, start, end })),
    live: { mode: 'auto' },
  };
}

function applyColours(colours) {
  if (colours && colours !== 'navy') {
    document.documentElement.dataset.colours = colours;
  } else {
    delete document.documentElement.dataset.colours;
  }
}

function applyText(text) {
  document.querySelectorAll('[data-edit]').forEach((element) => {
    const value = text[element.dataset.edit];
    if (value) element.textContent = value;
  });
}

function applyPhotos(photos) {
  document.querySelectorAll('[data-edit-photo]').forEach((image) => {
    const photo = photos[image.dataset.editPhoto];
    if (!photo) return;
    if (image.getAttribute('src') !== photo.src) image.src = photo.src;
    image.alt = photo.alt;
  });
}

function applyContacts(contacts) {
  document.querySelectorAll('[data-contact]').forEach((link) => {
    const name = link.dataset.contact;
    if (name === 'phone') {
      link.href = textLink(contacts.phone);
      link.textContent = contacts.phone;
    } else if (name === 'email') {
      // Keep any subject line, such as the one on the requests page.
      link.href = `mailto:${contacts.email}${new URL(link.href).search}`;
      link.textContent = contacts.email;
    } else if (contacts[name]) {
      link.href = contacts[name];
    }
  });
}

function applyAnnouncement({ show, text, link }) {
  announcement.hidden = !(show && text);
  announcement.querySelector('[data-announcement-text]').textContent = text;
  announcementLink.hidden = !link;
  if (link) announcementLink.href = link;
}

function applyNews(news) {
  const section = homeSections.get('news');
  section.querySelector('[data-news-title]').textContent = news.title;
  const date = section.querySelector('[data-news-date]');
  date.textContent = news.date;
  date.hidden = !news.date;
  section.querySelector('[data-news-text]').textContent = news.text;
}

function applyHome(home, news) {
  const hasNews = Boolean(news.title || news.text);
  home.forEach(({ id, show }) => {
    const section = homeSections.get(id);
    if (!section) return;
    homePage.append(section);
    section.hidden = !show || (id === 'news' && !hasNews);
  });
}

function applyShows(list) {
  // Monday first, like a printed schedule.
  const weekOrder = (day) => (day + 6) % 7;
  const rows = [...list]
    .sort((a, b) => weekOrder(a.day) - weekOrder(b.day) || a.start - b.start)
    .map(({ day, start, end }) => {
      const row = document.createElement('tr');
      Object.assign(row.dataset, { day, start, end });
      const dayCell = document.createElement('th');
      dayCell.scope = 'row';
      dayCell.textContent = DAYS[day];
      const timeCell = document.createElement('td');
      timeCell.textContent = `${formatHour(start)} to ${formatHour(end)}`;
      row.append(dayCell, timeCell);
      return row;
    });
  showsTable.replaceChildren(...rows);
  shows = readShows();
}

function applyContent(content) {
  applyColours(content.colours);
  applyText(content.text || {});
  applyPhotos(content.photos || {});
  if (content.contacts) applyContacts(content.contacts);
  if (content.announcement) applyAnnouncement(content.announcement);
  if (content.news) applyNews(content.news);
  if (content.home) applyHome(content.home, content.news || {});
  if (content.shows) applyShows(content.shows);
  liveOverride = content.live || { mode: 'auto' };
  updateLiveShow();
}

async function loadPublishedContent() {
  const remembered = recall('coast-content');
  if (remembered) {
    try {
      applyContent(JSON.parse(remembered));
    } catch {
      // Ignore a damaged copy; the fresh one below replaces it.
    }
  }

  try {
    const response = await fetch(CONTENT_URL);
    if (response.status === 204) {
      // Nothing is published, or Jim undid everything, so the page as built
      // is right. Reload once if an older version was laid over it.
      remember('coast-content', '');
      if (remembered) location.reload();
      return;
    }
    if (!response.ok) return;
    const text = await response.text();
    if (text !== remembered) {
      applyContent(JSON.parse(text));
      remember('coast-content', text);
    }
  } catch {
    // Keep what's showing if the content can't be fetched.
  }
}

// The editor shows the website in a frame with ?preview on the end. There,
// the page shows Jim's unpublished changes and tells the editor what he
// clicks on, instead of following links.

const EDITABLE = '[data-edit], [data-edit-photo], [data-announcement], [data-section="news"], .schedule';

function editFor(element) {
  if (element.dataset.edit) return { kind: 'text', key: element.dataset.edit };
  if (element.dataset.editPhoto) return { kind: 'photo', key: element.dataset.editPhoto };
  if (element.matches('[data-announcement]')) return { kind: 'announcement' };
  if (element.matches('[data-section="news"]')) return { kind: 'news' };
  return { kind: 'shows' };
}

function startPreview() {
  const editor = window.parent;
  const defaults = readContent();
  document.documentElement.classList.add('is-preview');

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== editor) return;
    const { type, content, page } = event.data || {};
    if (type === 'content') applyContent(content);
    if (type === 'go' && document.querySelector(`[data-page="${CSS.escape(page)}"]`)) location.hash = page;
  });

  document.addEventListener('click', (event) => {
    const editable = event.target.closest(EDITABLE);
    const link = event.target.closest('a');
    if (editable) {
      event.preventDefault();
      event.stopPropagation();
      editor.postMessage({ type: 'edit', ...editFor(editable) }, location.origin);
    } else if (link && !link.getAttribute('href')?.startsWith('#')) {
      event.preventDefault();
      if (link.dataset.contact) editor.postMessage({ type: 'edit', kind: 'contacts' }, location.origin);
    }
  }, true);

  document.addEventListener('submit', (event) => event.preventDefault(), true);
  editor.postMessage({ type: 'ready', defaults }, location.origin);
}

if (isPreview) {
  startPreview();
} else {
  loadPublishedContent();
}

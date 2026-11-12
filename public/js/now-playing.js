// What's playing now, what's next and what just played, with album covers.

const METADATA_URL = 'https://coast-metadata.jamieparr05.workers.dev/';
const ARTWORK_URL = 'https://itunes.apple.com/search';
const FALLBACK_ART = 'images/no-cover.svg';
const TRACK_REFRESH_MS = 15000;
const HIDDEN_REFRESH_MS = 60000;
const CHANGE_MS = 280;
const ARTWORK_WAIT_MS = 5000;
const METADATA_WAIT_MS = 8000;

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
const upNextLines = document.querySelectorAll('[data-up-next]');
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

// Gives up on a request that hangs, so a slow service can't hold things up.
// Older browsers without AbortSignal.timeout simply wait as before.
function giveUpAfter(ms) {
  return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;
}

function searchArtwork(term, entity, accept) {
  return fetch(`${ARTWORK_URL}?term=${encodeURIComponent(term)}&entity=${entity}&limit=5&country=gb`,
    { signal: giveUpAfter(ARTWORK_WAIT_MS) })
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
      .then((url) => url || searchArtwork(artist, 'album', sameArtist))
      .then((url) => {
        // Don't remember a miss: the search may only have been busy, and
        // the cover can be found the next time the song comes round.
        if (!url) artworkCache.delete(key);
        return url;
      }));
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
      artwork: art === FALLBACK_ART
        ? [{ src: 'images/jim-studio.webp', sizes: '830x826', type: 'image/webp' }]
        : [{ src: art, sizes: '600x600' }],
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
  // The Up next lines stay hidden until there is something to show.
  upNextLines.forEach((line) => {
    line.hidden = false;
  });
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
    const response = await fetch(`${METADATA_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: giveUpAfter(METADATA_WAIT_MS),
    });
    if (!response.ok) return;
    const data = await response.json();

    if (data.title && data.title !== currentTitle) {
      currentTitle = data.title;
      showNowPlaying(splitTrack(data.title));
      if (Array.isArray(data.previous) && data.previous.length) showJustPlayed(data.previous.slice(0, 5));
    }

    if (data.comingUp && data.comingUp !== currentNext) {
      currentNext = data.comingUp;
      showComingUp(splitTrack(data.comingUp));
    }
  } catch {
    // Keep showing the last known tracks if the update fails.
  }
}

// Check often while the page is on screen or the station is playing (the
// phone's lock screen shows the song too). With the page in the background
// and nothing playing, check once a minute to save battery and data.
let refreshTimer;

function keepUpToDate() {
  clearTimeout(refreshTimer);
  const resting = document.hidden && !document.body.classList.contains('is-playing');
  refreshTimer = setTimeout(async () => {
    await updateTracks();
    keepUpToDate();
  }, resting ? HIDDEN_REFRESH_MS : TRACK_REFRESH_MS);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateTracks();
  keepUpToDate();
});

updateTracks();
keepUpToDate();

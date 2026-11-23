// The Songs page: everything Coast has played, recorded by the coast-history
// Worker. The song list is searched in the browser, so results appear at once.

import { recall, remember } from './shared.js';

const HISTORY_URL = 'https://coast-history.jamieparr05.workers.dev';
const SAVED_KEY = 'coast-saved-songs';
const BATCH = 60;
const REFRESH_MS = 45000;

const page = document.querySelector('[data-page="songs"]');
const search = document.getElementById('song-search');
const viewButtons = page.querySelectorAll('[data-song-view]');
const list = document.getElementById('song-list');
const more = document.getElementById('song-more');
const message = document.getElementById('song-message');
const requestForm = document.forms['song-request'];
const requestLink = document.querySelector('.nav a[href="/requests"]');

const songs = new Map();
const dayPlays = new Map();
let days = [];
let shows = [];
let saved = readSaved();
let view = 'recent';
let items = [];
let shown = 0;
let nextDay = 0;
let loaded = false;
let loading = false;
let searchTimer;
let refreshTimer;

const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: true });
const longDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });

function readSaved() {
  try {
    const ids = JSON.parse(recall(SAVED_KEY) || '[]');
    return new Set(Array.isArray(ids) ? ids.filter(Number.isInteger) : []);
  } catch {
    return new Set();
  }
}

const toDate = (key) => new Date(`${key}T12:00:00Z`);
const today = () => dayKey.format(new Date());
const yesterday = () => dayKey.format(new Date(Date.now() - 86400000));
const timeOf = (seconds) => clock.format(new Date(seconds * 1000)).replace(/\s/g, '').replace(':00', '').toLowerCase();

function dayName(key) {
  if (key === today()) return 'Today';
  if (key === yesterday()) return 'Yesterday';
  return longDate.format(toDate(key)).replace(',', '');
}

function lastPlayed(seconds) {
  const key = dayKey.format(new Date(seconds * 1000));
  if (key === today()) return 'Today';
  if (key === yesterday()) return 'Yesterday';
  return shortDate.format(toDate(key));
}

function lengthOf(seconds) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (!hours) return `${minutes} min`;
  return minutes % 60 ? `${hours} hr ${minutes % 60} min` : `${hours} hr`;
}

const plain = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

function addSong([id, artist, title, plays, first, last]) {
  const text = plain(`${title} ${artist}`);
  songs.set(id, { id, artist, title, plays, first, last, text, joined: text.replace(/ /g, ''), name: plain(title) });
}

async function getJson(path) {
  const response = await fetch(`${HISTORY_URL}${path}`);
  if (!response.ok) throw new Error(response.statusText);
  return response.json();
}

function searchResults(query) {
  const words = plain(query).split(' ').filter(Boolean);
  const phrase = words.join(' ');
  // "O Donnell" finds O'Donnell, and "McBride" finds Mc Bride.
  return [...songs.values()]
    .filter((song) => words.every((word) => song.joined.includes(word)) || song.joined.includes(words.join('')))
    .sort((a, b) => Number(b.name.startsWith(phrase)) - Number(a.name.startsWith(phrase)) || b.plays - a.plays);
}

const songItem = (song, side) => ({ type: 'song', song, side });

function buildItems() {
  const query = search.value.trim();
  if (query) return searchResults(query).map((song) => songItem(song, lastPlayed(song.last)));

  const all = [...songs.values()];
  if (view === 'popular') {
    return all.sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name))
      .map((song) => songItem(song, `${song.plays} ${song.plays === 1 ? 'play' : 'plays'}`));
  }
  if (view === 'az') {
    return all.sort((a, b) => a.name.localeCompare(b.name)).map((song) => songItem(song, lastPlayed(song.last)));
  }
  if (view === 'saved') {
    return all.filter((song) => saved.has(song.id)).sort((a, b) => a.name.localeCompare(b.name))
      .map((song) => songItem(song, lastPlayed(song.last)));
  }
  if (view === 'live' || view === 'repeat') {
    return shows.filter((show) => show[0] === view).map((show) => ({ type: 'show', show }));
  }
  return recentItems();
}

function recentItems() {
  const result = [];
  days.slice(0, nextDay).forEach((key) => {
    const plays = (dayPlays.get(key) || []).filter(([, id]) => songs.has(id));
    if (!plays.length) return;
    result.push({ type: 'day', label: dayName(key) });
    plays.forEach(([at, id]) => result.push(songItem(songs.get(id), timeOf(at))));
  });
  return result;
}

function heart() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 20.5 4.6 13a4.9 4.9 0 0 1 7-7l.4.5.4-.5a4.9 4.9 0 0 1 7 7z');
  svg.append(path);
  return svg;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function outLink(label, url) {
  const link = element('a', 'song-link', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.append(element('span', 'visually-hidden', ' (opens in a new tab)'));
  return link;
}

function requestSong(song) {
  requestForm.elements.song.value = song.title;
  requestForm.elements.artist.value = song.artist;
  requestLink.click();
}

function songActions(song) {
  const term = encodeURIComponent(`${song.artist} ${song.title}`.trim());
  const actions = element('div', 'song-actions');
  const request = element('button', 'song-link song-request', 'Request');
  request.type = 'button';
  request.addEventListener('click', () => requestSong(song));
  actions.append(
    request,
    outLink('Spotify', `https://open.spotify.com/search/${term}`),
    outLink('YouTube', `https://www.youtube.com/results?search_query=${term}`),
    outLink('Apple', `https://music.apple.com/gb/search?term=${term}`),
  );
  // Phones show the shorter "Apple" so all four buttons fit on one line.
  actions.lastChild.firstChild.after(element('span', 'song-link-extra', ' Music'));
  return actions;
}

function toggleRow(row, main, song) {
  const open = main.getAttribute('aria-expanded') === 'true';
  list.querySelectorAll('.song-main[aria-expanded="true"]').forEach((other) => {
    other.setAttribute('aria-expanded', 'false');
    other.closest('.song-row').querySelector('.song-actions')?.remove();
  });
  if (!open) {
    main.setAttribute('aria-expanded', 'true');
    row.append(songActions(song));
  }
}

function songRow({ song, side }) {
  const row = element('li', 'song-row');
  const main = element('button', 'song-main');
  main.type = 'button';
  main.setAttribute('aria-expanded', 'false');
  const words = element('span', 'song-words');
  words.append(element('span', 'song-name', song.title));
  if (song.artist) words.append(element('span', 'song-artist', song.artist));
  main.append(words, element('span', 'song-side', side));
  main.addEventListener('click', () => toggleRow(row, main, song));

  const save = element('button', 'song-save');
  save.type = 'button';
  save.setAttribute('aria-label', `Save ${song.title}`);
  save.setAttribute('aria-pressed', String(saved.has(song.id)));
  save.append(heart());
  save.addEventListener('click', () => {
    if (saved.has(song.id)) saved.delete(song.id);
    else saved.add(song.id);
    remember(SAVED_KEY, JSON.stringify([...saved]));
    save.setAttribute('aria-pressed', String(saved.has(song.id)));
    if (view === 'saved' && !search.value.trim()) render();
  });
  row.append(main, save);
  return row;
}

function showRow({ show: [kind, start, end, seconds, original] }) {
  const row = element('li', 'song-row show-row');
  const date = dayKey.format(new Date(start * 1000));
  const words = element('span', 'song-words');
  words.append(element('span', 'song-name', dayName(date)));
  let detail = end ? `${timeOf(start)} to ${timeOf(end)}` : `From ${timeOf(start)}`;
  if (kind === 'repeat') {
    detail = original && original !== date ? `${timeOf(start)}, first aired ${longDate.format(toDate(original)).replace(',', '')}` : timeOf(start);
  }
  words.append(element('span', 'song-artist', detail));
  const length = seconds || (end ? end - start : null);
  row.append(words, element('span', 'song-side', length ? lengthOf(length) : 'On air'));
  return row;
}

function addBatch() {
  const fragment = document.createDocumentFragment();
  items.slice(shown, shown + BATCH).forEach((item) => {
    if (item.type === 'day') fragment.append(element('li', 'song-day', item.label));
    else if (item.type === 'show') fragment.append(showRow(item));
    else fragment.append(songRow(item));
  });
  list.append(fragment);
  shown = Math.min(shown + BATCH, items.length);
}

function emptyMessage() {
  const query = search.value.trim();
  if (query) return `No songs match "${query}".`;
  if (view === 'saved') return 'Tap the heart on any song to save it here.';
  return 'Nothing here yet.';
}

function render() {
  items = buildItems();
  shown = 0;
  list.replaceChildren();
  addBatch();
  message.hidden = items.length > 0 || (view === 'recent' && !search.value.trim() && nextDay < days.length);
  if (!items.length) message.textContent = emptyMessage();
  requestAnimationFrame(keepFilling);
}

async function loadDay(index) {
  const key = days[index];
  if (key && !dayPlays.has(key)) dayPlays.set(key, await getJson(`/day/${key}`));
}

async function loadMoreDays() {
  if (loading || nextDay >= days.length) return;
  loading = true;
  try {
    await loadDay(nextDay);
    nextDay += 1;
    const before = shown;
    items = recentItems();
    shown = before;
    addBatch();
  } catch {
    // The next scroll tries again.
    return;
  } finally {
    loading = false;
  }
  keepFilling();
}

// Adds more until the list reaches past the bottom of the screen.
function keepFilling() {
  if (!loaded || page.hidden || more.getBoundingClientRect().top > window.innerHeight + 600) return;
  if (shown < items.length) {
    addBatch();
    requestAnimationFrame(keepFilling);
  } else if (view === 'recent' && !search.value.trim()) {
    loadMoreDays();
  }
}

async function refresh() {
  if (page.hidden || !days.length) return;
  try {
    const key = today();
    const plays = await getJson(`/day/${key}`);
    if (!days.includes(key)) days.unshift(key);
    const previous = dayPlays.get(key) || [];
    if (plays.length === previous.length) return;
    dayPlays.set(key, plays);
    if (plays.some(([, id]) => !songs.has(id))) {
      const { songs: latest } = await getJson('/catalogue');
      latest.forEach(addSong);
      setPlaceholder();
    }
    if (view === 'recent' && !search.value.trim() && window.scrollY < 300) render();
  } catch {
    // Keep showing what's there until the next check.
  }
}

function setPlaceholder() {
  search.placeholder = `Search ${songs.size.toLocaleString('en-GB')} songs`;
}

async function load() {
  if (loaded || loading) return;
  loading = true;
  message.hidden = false;
  message.textContent = 'Loading songs…';
  try {
    const [catalogue, dayList, showList] = await Promise.all([getJson('/catalogue'), getJson('/days'), getJson('/shows')]);
    catalogue.songs.forEach(addSong);
    days = dayList;
    // A few minutes of the live marker is a studio glitch, not a show.
    shows = showList.filter(([kind, start, end]) => kind !== 'live' || !end || end - start >= 600);
    if (days.length) await loadDay(0);
    nextDay = days.length ? 1 : 0;
    loaded = true;
    setPlaceholder();
    render();
    refreshTimer ??= setInterval(refresh, REFRESH_MS);
  } catch {
    message.textContent = "Songs couldn't load. Check your connection and open this page again.";
  } finally {
    loading = false;
  }
}

function setView(next) {
  view = next;
  search.value = '';
  viewButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.songView === view)));
  render();
  window.scrollTo(0, 0);
}

viewButtons.forEach((button) => button.addEventListener('click', () => setView(button.dataset.songView)));

search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const searching = Boolean(search.value.trim());
    viewButtons.forEach((button) => button.setAttribute('aria-pressed', String(!searching && button.dataset.songView === view)));
    render();
  }, 90);
});

new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) keepFilling();
}, { rootMargin: '600px' }).observe(more);

window.addEventListener('coast:page', (event) => {
  if (event.detail !== 'songs') return;
  load();
  requestAnimationFrame(keepFilling);
});
if (!page.hidden) load();

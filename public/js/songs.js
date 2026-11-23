// The Songs page: everything Coast has played, recorded by the coast-history
// Worker. The song list is searched in the browser, so results appear at once.

import { recall, remember } from './shared.js';

const HISTORY_URL = 'https://coast-history.jamieparr05.workers.dev';
const SAVED_KEY = 'coast-saved-songs';
const PAGE_SIZE = 50;
const REFRESH_MS = 45000;
const phone = window.matchMedia('(max-width: 30rem)');

const page = document.querySelector('[data-page="songs"]');
const search = document.getElementById('song-search');
const viewButtons = page.querySelectorAll('[data-song-view]');
const list = document.getElementById('song-list');
const pager = document.getElementById('song-pages');
const message = document.getElementById('song-message');
const requestForm = document.forms['song-request'];
const requestLink = document.querySelector('.nav a[href="/requests"]');

const songs = new Map();
const dayPlays = new Map();
let dayCounts = [];
let saved = readSaved();
let view = 'recent';
let pageNumber = 1;
let loaded = false;
let loading = false;
let renderCount = 0;
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
const isRecent = () => view === 'recent' && !search.value.trim();

function listItems() {
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
  return all.filter((song) => saved.has(song.id)).sort((a, b) => a.name.localeCompare(b.name))
    .map((song) => songItem(song, lastPlayed(song.last)));
}

const recentTotal = () => dayCounts.reduce((total, [, plays]) => total + plays, 0);

// Finds which days hold this page, and loads only those.
async function recentItems(number) {
  const start = (number - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const parts = [];
  let offset = 0;
  for (const [key, plays] of dayCounts) {
    if (offset >= end) break;
    if (offset + plays > start) parts.push({ key, from: Math.max(start - offset, 0), to: Math.min(end - offset, plays) });
    offset += plays;
  }
  await Promise.all(parts.map(async ({ key }) => {
    if (!dayPlays.has(key) || key === today()) dayPlays.set(key, await getJson(`/day/${key}`));
  }));

  return parts.flatMap(({ key, from, to }) => {
    const rows = dayPlays.get(key).slice(from, to).filter(([, id]) => songs.has(id))
      .map(([at, id]) => songItem(songs.get(id), timeOf(at)));
    return rows.length ? [{ type: 'day', label: dayName(key) }, ...rows] : [];
  });
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

function rowFor(item) {
  return item.type === 'day' ? element('li', 'song-day', item.label) : songRow(item);
}

function goToPage(number) {
  pageNumber = number;
  render();
  list.focus({ preventScroll: true });
  window.scrollTo(0, Math.max(0, page.querySelector('.songs').getBoundingClientRect().top + window.scrollY - 8));
}

function pagerButton(label, number, current, accessibleName) {
  const button = element('button', 'song-page', label);
  button.type = 'button';
  if (accessibleName) button.setAttribute('aria-label', accessibleName);
  if (current) button.setAttribute('aria-current', 'page');
  if (number === null) button.disabled = true;
  else button.addEventListener('click', () => goToPage(number));
  return button;
}

function renderPager(last) {
  pager.hidden = last <= 1;
  if (last <= 1) {
    pager.replaceChildren();
    return;
  }
  // Phones show fewer numbers so the pages always fit on one line.
  const nearby = phone.matches ? [pageNumber] : [pageNumber - 1, pageNumber, pageNumber + 1];
  const numbers = [...new Set([1, ...nearby, last])]
    .filter((number) => number >= 1 && number <= last)
    .sort((a, b) => a - b);
  const parts = [pagerButton('‹', pageNumber > 1 ? pageNumber - 1 : null, false, 'Previous page')];
  numbers.forEach((number, index) => {
    if (index && number - numbers[index - 1] > 1) parts.push(element('span', 'song-gap', '…'));
    parts.push(pagerButton(number.toLocaleString('en-GB'), number, number === pageNumber, `Page ${number}`));
  });
  parts.push(pagerButton('›', pageNumber < last ? pageNumber + 1 : null, false, 'Next page'));
  pager.replaceChildren(...parts);
}

function emptyMessage() {
  const query = search.value.trim();
  if (query) return `No songs match "${query}".`;
  if (view === 'saved') return 'Tap the heart on any song to save it here.';
  return 'Nothing here yet.';
}

async function render() {
  renderCount += 1;
  const thisRender = renderCount;
  let items;
  let total;
  try {
    if (isRecent()) {
      total = recentTotal();
      pageNumber = Math.min(pageNumber, Math.max(1, Math.ceil(total / PAGE_SIZE)));
      items = await recentItems(pageNumber);
    } else {
      const all = listItems();
      total = all.length;
      pageNumber = Math.min(pageNumber, Math.max(1, Math.ceil(total / PAGE_SIZE)));
      items = all.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE);
    }
  } catch {
    if (thisRender !== renderCount) return;
    message.hidden = false;
    message.textContent = "That page couldn't load. Check your connection and try again.";
    return;
  }
  if (thisRender !== renderCount) return;

  list.replaceChildren(...items.map(rowFor));
  message.hidden = items.length > 0;
  if (!items.length) message.textContent = emptyMessage();
  renderPager(Math.ceil(total / PAGE_SIZE));
}

async function refresh() {
  if (page.hidden || !loaded) return;
  try {
    const before = recentTotal();
    dayCounts = await getJson('/day-counts');
    if (recentTotal() === before) return;
    const latest = await getJson(`/day/${today()}`);
    dayPlays.set(today(), latest);
    if (latest.some(([, id]) => !songs.has(id))) {
      const { songs: catalogue } = await getJson('/catalogue');
      catalogue.forEach(addSong);
      setPlaceholder();
    }
    if (isRecent() && pageNumber === 1 && window.scrollY < 300) render();
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
    const [catalogue, counts] = await Promise.all([getJson('/catalogue'), getJson('/day-counts')]);
    catalogue.songs.forEach(addSong);
    dayCounts = counts;
    loaded = true;
    setPlaceholder();
    await render();
    refreshTimer ??= setInterval(refresh, REFRESH_MS);
  } catch {
    message.hidden = false;
    message.textContent = "Songs couldn't load. Check your connection and open this page again.";
  } finally {
    loading = false;
  }
}

function setView(next) {
  view = next;
  pageNumber = 1;
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
    pageNumber = 1;
    viewButtons.forEach((button) => button.setAttribute('aria-pressed', String(!searching && button.dataset.songView === view)));
    render();
  }, 90);
});

phone.addEventListener('change', () => {
  if (loaded) render();
});

window.addEventListener('coast:page', (event) => {
  if (event.detail === 'songs') load();
});
if (!page.hidden) load();

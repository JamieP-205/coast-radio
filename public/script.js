// The website's script. The smaller parts live in js/ and set themselves
// up when they're imported; the rest is below.

import { DAYS, formatHour, recall, remember } from './js/shared.js';
import { isPreview } from './js/pages.js';
import './js/reading.js';
import './js/forms.js';
import './js/player.js';
import './js/now-playing.js';

// Jim live, or the 24-hour playlist. Worked out from the show times table so
// the times are only written down once. Times are UK time, wherever the
// listener is. Jim can also switch it by hand from the editor, for a show
// that isn't on the list or one he can't do.

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

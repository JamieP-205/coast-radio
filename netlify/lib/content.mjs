// What the editor is allowed to change, and the checks every draft passes
// before it's saved. Anything not listed here is dropped, so the website only
// ever receives content it knows how to show.

export const TEXT_FIELDS = {
  heroTitle: { name: 'The headline at the top of the home page', max: 90 },
  welcomeTitle: { name: 'The welcome heading', max: 60 },
  welcomeText: { name: 'The welcome message', max: 600 },
  signOff: { name: 'Your sign-off', max: 60 },
  aboutLead: { name: 'The first paragraph about you', max: 600 },
  aboutText: { name: 'The second paragraph about you', max: 600 },
  supportLead: { name: 'The support message', max: 300 },
  supportNote: { name: 'The support slogan', max: 120 },
  showsLead: { name: 'The show times introduction', max: 300 },
  requestsLead: { name: 'The requests introduction', max: 300 },
  footerTagline: { name: 'The line at the bottom of every page', max: 160 },
};

export const PHOTO_KEYS = ['studio', 'about'];
export const HOME_SECTIONS = ['played', 'news', 'welcome'];
export const COLOURS = ['navy', 'sea', 'heather', 'charcoal'];
export const LIVE_MODES = ['auto', 'on', 'off'];
const MAX_SHOWS = 14;

const PHOTO_SOURCE = /^(images\/[a-z0-9-]+\.(webp|jpg|png)|\/api\/photos\/[0-9a-f-]{36})$/;
const PHONE = /^[0-9 +()]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function isWebLink(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function checkText(input, errors) {
  const text = {};
  for (const [key, { name, max }] of Object.entries(TEXT_FIELDS)) {
    const raw = input?.[key];
    if (typeof raw === 'string' && raw.trim().length > max) {
      errors.push(`${name} is too long. Please keep it under ${max} letters.`);
    }
    text[key] = cleanText(raw, max);
    if (!text[key]) errors.push(`${name} can't be empty.`);
  }
  return text;
}

function checkPhotos(input, errors) {
  const photos = {};
  for (const key of PHOTO_KEYS) {
    const src = input?.[key]?.src;
    const alt = cleanText(input?.[key]?.alt, 200);
    if (typeof src !== 'string' || !PHOTO_SOURCE.test(src)) errors.push('One of the photos is missing.');
    if (!alt) errors.push('Please describe each photo for people who can\'t see it.');
    photos[key] = { src, alt };
  }
  return photos;
}

function checkContacts(input, errors) {
  const contacts = {
    phone: cleanText(input?.phone, 20),
    email: cleanText(input?.email, 100),
    facebook: cleanText(input?.facebook, 300),
    x: cleanText(input?.x, 300),
    donate: cleanText(input?.donate, 300),
  };
  if (!PHONE.test(contacts.phone)) errors.push('The phone number should only have numbers and spaces.');
  if (!EMAIL.test(contacts.email)) errors.push('The email address doesn\'t look right.');
  for (const [key, name] of [['facebook', 'Facebook'], ['x', 'X'], ['donate', 'donate']]) {
    if (!isWebLink(contacts[key])) errors.push(`The ${name} link should start with https://`);
  }
  return contacts;
}

function checkAnnouncement(input, errors) {
  const announcement = {
    show: input?.show === true,
    text: cleanText(input?.text, 200),
    link: cleanText(input?.link, 300),
  };
  if (announcement.show && !announcement.text) errors.push('The announcement needs some words.');
  if (announcement.link && !isWebLink(announcement.link)) errors.push('The announcement link should start with https://');
  return announcement;
}

function checkNews(input) {
  return {
    title: cleanText(input?.title, 100),
    date: cleanText(input?.date, 40),
    text: cleanText(input?.text, 1000),
  };
}

function checkHome(input, errors) {
  const list = Array.isArray(input) ? input : [];
  const ids = list.map((section) => section?.id);
  const complete = ids.length === HOME_SECTIONS.length && HOME_SECTIONS.every((id) => ids.includes(id));
  if (!complete) {
    errors.push('The home page sections are muddled. Please reload the editor.');
    return HOME_SECTIONS.map((id) => ({ id, show: true }));
  }
  return list.map(({ id, show }) => ({ id, show: show === true }));
}

function checkShows(input, errors) {
  const list = Array.isArray(input) ? input.slice(0, MAX_SHOWS) : [];
  return list.filter((show) => {
    const { day, start, end } = show || {};
    const valid = [day, start, end].every(Number.isInteger)
      && day >= 0 && day <= 6 && start >= 0 && end <= 24 && end > start;
    if (!valid) errors.push('Each show needs to finish after it starts.');
    return valid;
  }).map(({ day, start, end }) => ({ day, start, end }));
}

function checkLive(input, errors) {
  const mode = LIVE_MODES.includes(input?.mode) ? input.mode : 'auto';
  if (mode === 'auto') return { mode };
  const until = Date.parse(input?.until);
  if (Number.isNaN(until)) {
    errors.push('The live switch is missing its end time.');
    return { mode: 'auto' };
  }
  return { mode, until: new Date(until).toISOString() };
}

// Returns { content } when everything is fine, or { errors } with messages
// written for Jim.
export function validateContent(input) {
  const data = input && typeof input === 'object' ? input : {};
  const errors = [];
  const content = {
    colours: COLOURS.includes(data.colours) ? data.colours : 'navy',
    text: checkText(data.text, errors),
    photos: checkPhotos(data.photos, errors),
    contacts: checkContacts(data.contacts, errors),
    announcement: checkAnnouncement(data.announcement, errors),
    news: checkNews(data.news),
    home: checkHome(data.home, errors),
    shows: checkShows(data.shows, errors),
    live: checkLive(data.live, errors),
  };
  return errors.length ? { errors: [...new Set(errors)] } : { content };
}

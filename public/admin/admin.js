// The editor for Coast Internet Radio. Jim makes changes on the left and sees
// them straight away in the preview on the right. Changes are saved as a
// draft as he goes, and listeners only see them when he presses Publish.

const SAVE_DELAY_MS = 800;
const PHOTO_LONGEST_SIDE = 1600;
const LIVE_HOURS = 3;

// Every piece of text Jim can change, grouped by the page it's on. The
// limits match the checks in netlify/lib/content.mjs.
const WORDS = [
  { page: 'home', name: 'Home page', fields: [
    { key: 'heroTitle', label: 'Headline at the top', max: 90 },
    { key: 'welcomeTitle', label: 'Welcome heading', max: 60 },
    { key: 'welcomeText', label: 'Welcome message', max: 600 },
    { key: 'signOff', label: 'Your sign-off', max: 60, help: 'Also used on the About Jim page.' },
  ] },
  { page: 'shows', name: 'Show times page', fields: [
    { key: 'showsLead', label: 'Introduction', max: 300 },
  ] },
  { page: 'about', name: 'About Jim page', fields: [
    { key: 'aboutLead', label: 'First paragraph', max: 600 },
    { key: 'aboutText', label: 'Second paragraph', max: 600 },
    { key: 'supportLead', label: 'Support message', max: 300 },
    { key: 'supportNote', label: 'Support slogan', max: 120 },
  ] },
  { page: 'requests', name: 'Requests page', fields: [
    { key: 'requestsLead', label: 'Introduction', max: 300 },
  ] },
  { page: null, name: 'Bottom of every page', fields: [
    { key: 'footerTagline', label: 'Line under the logo', max: 160 },
  ] },
];

const SECTION_NAMES = {
  played: { name: 'Just played', note: 'The last five songs, with their covers' },
  news: { name: 'News from Coast', note: 'Your news story, if you have one' },
  welcome: { name: 'Welcome message', note: 'Your welcome and sign-off' },
};

const PANEL_PAGES = { photos: 'home', colours: 'home', home: 'home', announcement: 'home', news: 'home', shows: 'shows', contacts: 'requests' };
const PHOTO_PAGES = { studio: 'home', about: 'about' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

let defaults = null; // the website as it was built
let content = null; // the draft Jim is working on
let published = null; // what listeners can see, or null if nothing is published yet
let saveTimer = 0;
let saveQueue = Promise.resolve();
let previewIsReady;
let focusFromPreview = false;

const preview = document.getElementById('preview');
const saveStatus = document.getElementById('save-status');
const publishButton = document.getElementById('publish-button');
const undoButton = document.getElementById('undo-button');
const toastText = document.getElementById('toast');

// Screens and messages

function showScreen(name) {
  document.querySelectorAll('[data-screen]').forEach((screen) => {
    screen.hidden = screen.dataset.screen !== name;
  });
}

function setStatus(text, problem = false) {
  saveStatus.textContent = text;
  saveStatus.classList.toggle('is-problem', problem);
}

let toastTimer = 0;
function toast(text, problem = false) {
  clearTimeout(toastTimer);
  toastText.textContent = text;
  toastText.classList.toggle('is-problem', problem);
  toastTimer = setTimeout(() => {
    toastText.textContent = '';
  }, 6000);
}

// Asks a yes or no question in a dialog, and resolves to true for yes.
function confirmAction({ title, text, yes }) {
  const dialog = document.getElementById('confirm');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  document.getElementById('confirm-yes').textContent = yes;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
  });
}

// Talking to the website's functions. Problems come back as messages that
// can be shown to Jim as they are.

async function api(path, { method = 'GET', body } = {}) {
  const options = { method, headers: {} };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.body = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`/api/${path}`, options);
  } catch {
    throw new Error('The editor couldn\'t reach the website. Check your internet connection and try again.');
  }

  if (response.status === 401 && path !== 'login') {
    signInAgain();
    throw new Error('Please sign in again.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Something went wrong. Please try again in a minute.');
  }
  return response.status === 204 ? null : response.json();
}

// Signing in and out

const signInForm = document.getElementById('sign-in-form');
const signInMessage = document.getElementById('sign-in-message');
const passwordInput = document.getElementById('password');
const showPassword = document.getElementById('show-password');

function showSignIn(message = '') {
  showScreen('sign-in');
  signInMessage.textContent = message;
  document.getElementById('username').focus();
}

// If the 30-day sign-in runs out while Jim is working, his draft stays in
// this page and is saved again once he's signed back in.
function signInAgain() {
  clearTimeout(saveTimer);
  showSignIn('You were signed out. Please sign in again. Your changes are still here.');
}

showPassword.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  showPassword.textContent = showing ? 'Show' : 'Hide';
  showPassword.setAttribute('aria-pressed', String(!showing));
});

signInForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = signInForm.username.value.trim();
  const password = passwordInput.value;
  if (!username || !password) {
    signInMessage.textContent = 'Please type your username and password.';
    return;
  }

  const button = signInForm.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = 'Signing in…';
  try {
    await api('login', { method: 'POST', body: { username, password } });
    passwordInput.value = '';
    if (content) {
      showScreen('editor');
      saveSoon();
    } else {
      await openEditor();
    }
  } catch (error) {
    signInMessage.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in';
  }
});

document.getElementById('sign-out-button').addEventListener('click', async () => {
  await flushSave();
  await api('logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

// The preview is the real website in a frame. It sends a "ready" message
// with its original content, then shows whatever content it's sent.

function sendToPreview(message) {
  preview.contentWindow?.postMessage(message, location.origin);
}

function showInPreview(page) {
  if (page) sendToPreview({ type: 'go', page });
}

function updatePreview() {
  sendToPreview({ type: 'content', content });
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== preview.contentWindow) return;
  const { type } = event.data || {};
  if (type === 'ready') {
    previewIsReady?.(event.data.defaults);
    if (content) updatePreview();
  }
  if (type === 'edit') openEditFor(event.data);
});

function loadPreview() {
  return new Promise((resolve) => {
    previewIsReady = resolve;
    preview.src = '/?preview#home';
  });
}

document.querySelectorAll('[data-preview-size]').forEach((button) => {
  button.addEventListener('click', () => {
    const phone = button.dataset.previewSize === 'phone';
    preview.parentElement.classList.toggle('is-phone', phone);
    document.querySelectorAll('[data-preview-size]').forEach((other) => {
      other.setAttribute('aria-pressed', String(other === button));
    });
  });
});

// Opening the editor

function withoutDate(version) {
  if (!version) return null;
  const { publishedAt, ...rest } = version;
  return rest;
}

// Older drafts might be missing something added to the editor later, so
// anything missing comes from the website as it was built.
function complete(version) {
  return {
    ...defaults,
    ...version,
    text: { ...defaults.text, ...version.text },
    photos: { ...defaults.photos, ...version.photos },
    contacts: { ...defaults.contacts, ...version.contacts },
  };
}

async function loadVersions() {
  const { draft, published: live } = await api('draft');
  published = live ? complete(withoutDate(live)) : null;
  content = structuredClone(draft ? complete(draft) : published || defaults);
  fillPanels();
  updatePreview();
  updatePublishState();
}

async function openEditor() {
  showScreen('editor');
  setStatus('Opening…');
  try {
    defaults = defaults || await loadPreview();
    await loadVersions();
    setStatus('All changes saved');
  } catch (error) {
    setStatus(error.message, true);
  }
}

// Saving the draft. Changes are saved a moment after Jim stops typing, one
// at a time so an older save never lands after a newer one.

function saveDraft() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  const version = structuredClone(content);
  saveQueue = saveQueue.then(async () => {
    try {
      await api('draft', { method: 'PUT', body: version });
      if (!saveTimer) setStatus('All changes saved');
    } catch (error) {
      setStatus(`Not saved yet. ${error.message}`, true);
    }
  });
  return saveQueue;
}

function saveSoon() {
  setStatus('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, SAVE_DELAY_MS);
}

function flushSave() {
  return saveTimer ? saveDraft() : saveQueue;
}

// Every change goes through here: update the draft, show it, save it.
function change(update) {
  update(content);
  updatePreview();
  updatePublishState();
  saveSoon();
}

window.addEventListener('beforeunload', (event) => {
  if (saveTimer) event.preventDefault();
});

// Publish, undo and throwing changes away

// Compares two versions whatever order their properties are in.
function sameVersion(a, b) {
  const sorted = (value) => {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
    }
    return value;
  };
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

function updatePublishState() {
  const changed = !sameVersion(content, published || defaults);
  publishButton.disabled = !changed;
  undoButton.disabled = !published;
  document.getElementById('publish-state').classList.toggle('has-changes', changed);
  document.getElementById('publish-state-text').textContent = changed
    ? 'You have changes that aren\'t on the website yet. Press Publish changes when you\'re happy.'
    : 'The website is up to date.';
  document.getElementById('discard-button').hidden = !changed;
}

publishButton.addEventListener('click', async () => {
  const sure = await confirmAction({
    title: 'Put your changes on the website?',
    text: 'Listeners will see them within a few minutes. You can undo this afterwards.',
    yes: 'Publish',
  });
  if (!sure) return;

  clearTimeout(saveTimer);
  saveTimer = 0;
  publishButton.disabled = true;
  publishButton.textContent = 'Publishing…';
  try {
    await saveQueue;
    await api('publish', { method: 'POST', body: content });
    published = structuredClone(content);
    setStatus('All changes saved');
    toast('Published. Your changes are on the website.');
  } catch (error) {
    toast(error.message, true);
  } finally {
    publishButton.textContent = 'Publish changes';
    updatePublishState();
  }
});

undoButton.addEventListener('click', async () => {
  const sure = await confirmAction({
    title: 'Undo your last publish?',
    text: 'The website will go back to how it looked before you last pressed Publish. Any changes you haven\'t published will be lost.',
    yes: 'Undo',
  });
  if (!sure) return;

  clearTimeout(saveTimer);
  saveTimer = 0;
  undoButton.disabled = true;
  try {
    await saveQueue;
    const { restored } = await api('undo', { method: 'POST' });
    await loadVersions();
    setStatus('All changes saved');
    toast(restored === 'original'
      ? 'Done. The website is back to how it was first built.'
      : 'Done. The website is back to how it was before.');
  } catch (error) {
    toast(error.message, true);
    updatePublishState();
  }
});

document.getElementById('discard-button').addEventListener('click', async () => {
  const sure = await confirmAction({
    title: 'Throw away your changes?',
    text: 'Everything you\'ve changed since you last published will go back to how it is on the website now.',
    yes: 'Throw them away',
  });
  if (!sure) return;
  change((draft) => Object.assign(draft, structuredClone(published || defaults)));
  fillPanels();
});

// Moving between the list and the panels

function openPanel(name, focus = true) {
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
  document.querySelector('.side').scrollTop = 0;
  window.scrollTo(0, 0);
  if (focus) document.querySelector(`[data-panel="${name}"] h1`).focus();
  showInPreview(PANEL_PAGES[name]);
}

document.querySelectorAll('[data-open]').forEach((button) => {
  button.addEventListener('click', () => openPanel(button.dataset.open));
});

document.querySelectorAll('[data-back]').forEach((button) => {
  button.addEventListener('click', () => {
    openPanel('menu');
    showInPreview('home');
  });
});

// When Jim clicks something in the preview, open the right panel and put
// him straight in the right box.
function openEditFor({ kind, key }) {
  if (kind === 'text') {
    openPanel('words', false);
    const field = document.querySelector(`[data-word="${CSS.escape(key)}"]`);
    if (!field) return;
    document.querySelectorAll('.field.is-highlighted').forEach((other) => other.classList.remove('is-highlighted'));
    field.closest('.field').classList.add('is-highlighted');
    field.scrollIntoView({ block: 'center' });
    // Jim clicked this on the page he's looking at, so stay on that page.
    focusFromPreview = true;
    field.focus({ preventScroll: true });
    focusFromPreview = false;
    return;
  }
  if (kind === 'photo') {
    openPanel('photos', false);
    const card = document.querySelector(`[data-photo="${CSS.escape(key)}"]`);
    card?.scrollIntoView({ block: 'center' });
    card?.querySelector('input[type="file"]').focus({ preventScroll: true });
    showInPreview(PHOTO_PAGES[key]);
    return;
  }
  if (['announcement', 'news', 'shows', 'contacts'].includes(kind)) {
    openPanel(kind, false);
    document.querySelector(`[data-panel="${kind}"] input, [data-panel="${kind}"] select`)?.focus();
  }
}

// Filling the panels with the draft. Called when the editor opens, and again
// after Undo or throwing changes away.

function fillPanels() {
  fillWords();
  fillPhotos();
  fillColours();
  fillHome();
  fillAnnouncement();
  fillNews();
  fillShows();
  fillLive();
  fillContacts();
}

// Words

const wordFields = document.getElementById('word-fields');

function buildWords() {
  WORDS.forEach((group) => {
    const section = document.createElement('section');
    section.className = 'word-group';
    const heading = document.createElement('h2');
    heading.textContent = group.name;
    section.append(heading);

    group.fields.forEach(({ key, label, max, help }) => {
      const field = document.createElement('div');
      field.className = 'field';
      const id = `word-${key}`;

      const labelElement = document.createElement('label');
      labelElement.htmlFor = id;
      labelElement.textContent = label;

      const input = document.createElement(max > 120 ? 'textarea' : 'input');
      input.id = id;
      input.maxLength = max;
      input.dataset.word = key;
      if (max > 120) input.rows = max > 300 ? 6 : 4;

      const problem = document.createElement('p');
      problem.className = 'field-problem';
      problem.id = `${id}-problem`;

      const count = document.createElement('p');
      count.className = 'count';
      count.id = `${id}-count`;

      const describedBy = [problem.id, count.id];
      field.append(labelElement);
      if (help) {
        const helpText = document.createElement('p');
        helpText.className = 'help';
        helpText.id = `${id}-help`;
        helpText.textContent = help;
        field.append(helpText);
        describedBy.unshift(helpText.id);
      }
      input.setAttribute('aria-describedby', describedBy.join(' '));
      field.append(input, problem, count);
      section.append(field);

      input.addEventListener('focus', () => {
        if (!focusFromPreview) showInPreview(group.page);
      });
      input.addEventListener('input', () => {
        showWordState(input);
        // An empty box can't be saved, so the website keeps the last words
        // until Jim types something.
        if (input.value.trim()) change((draft) => {
          draft.text[key] = input.value;
        });
      });
    });
    wordFields.append(section);
  });
}

function showWordState(input) {
  const empty = !input.value.trim();
  input.setAttribute('aria-invalid', String(empty));
  document.getElementById(`${input.id}-problem`).textContent = empty ? 'This can\'t be empty.' : '';
  document.getElementById(`${input.id}-count`).textContent = `${input.value.length} of ${input.maxLength} letters`;
}

function fillWords() {
  wordFields.querySelectorAll('[data-word]').forEach((input) => {
    input.value = content.text[input.dataset.word] || '';
    showWordState(input);
  });
}

// Photos. Photos from phones and cameras are often huge, so they're made
// smaller here before they're sent.

function shrinkPhoto(file) {
  return createImageBitmap(file).then((bitmap) => {
    const scale = Math.min(1, PHOTO_LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('That photo couldn\'t be read.'))), 'image/jpeg', 0.85);
    });
  });
}

document.querySelectorAll('[data-photo]').forEach((card) => {
  const key = card.dataset.photo;
  const status = card.querySelector('.photo-status');
  const fileInput = card.querySelector('input[type="file"]');
  const altInput = card.querySelector('[data-photo-alt]');

  const showProblem = (text) => {
    status.textContent = text;
    status.classList.add('is-problem');
  };

  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files;
    fileInput.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showProblem('That file isn\'t a photo. Please choose a photo.');
      return;
    }

    status.classList.remove('is-problem');
    status.textContent = 'Adding your photo…';
    showInPreview(PHOTO_PAGES[key]);
    try {
      const form = new FormData();
      form.append('photo', await shrinkPhoto(file).catch(() => {
        throw new Error('That photo couldn\'t be read. Please try a JPG or PNG photo.');
      }), 'photo.jpg');
      const { src } = await api('photos', { method: 'POST', body: form });
      change((draft) => {
        draft.photos[key] = { ...draft.photos[key], src };
      });
      fillPhotos();
      status.textContent = 'Photo added. Remember to describe it below.';
      altInput.focus();
      altInput.select();
    } catch (error) {
      showProblem(error.message);
    }
  });

  card.querySelector('[data-photo-reset]').addEventListener('click', () => {
    change((draft) => {
      draft.photos[key] = { ...defaults.photos[key] };
    });
    fillPhotos();
    status.classList.remove('is-problem');
    status.textContent = 'The original photo is back.';
  });

  altInput.addEventListener('input', () => {
    if (altInput.value.trim()) change((draft) => {
      draft.photos[key].alt = altInput.value;
    });
  });
});

// Photos the editor added are served from /api/photos, and the original
// photos from the website's own folder, one level up from /admin/.
function photoAddress(src) {
  return src.startsWith('/') ? src : `../${src}`;
}

function fillPhotos() {
  document.querySelectorAll('[data-photo]').forEach((card) => {
    const photo = content.photos[card.dataset.photo];
    card.querySelector('.photo-thumb').src = photoAddress(photo.src);
    card.querySelector('[data-photo-alt]').value = photo.alt;
    card.querySelector('[data-photo-reset]').hidden = photo.src === defaults.photos[card.dataset.photo].src;
  });
}

// Colours

const colourChoices = document.querySelectorAll('[name="colours"]');

colourChoices.forEach((choice) => {
  choice.addEventListener('change', () => change((draft) => {
    draft.colours = choice.value;
  }));
});

function fillColours() {
  colourChoices.forEach((choice) => {
    choice.checked = choice.value === content.colours;
  });
}

// Home page layout. Arrow buttons rather than dragging, because they're
// easier to hit and work with a keyboard too.

const arrangeList = document.getElementById('arrange-list');
const ARROWS = {
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
};

function moveButton(direction, index, label) {
  const button = document.createElement('button');
  button.type = 'button';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ARROWS[direction]);
  svg.append(path);
  const text = document.createElement('span');
  text.className = 'visually-hidden';
  text.textContent = `Move ${label} ${direction}`;
  button.append(svg, text);

  const to = direction === 'up' ? index - 1 : index + 1;
  button.disabled = to < 0 || to >= content.home.length;
  button.addEventListener('click', () => {
    change((draft) => {
      const [moved] = draft.home.splice(index, 1);
      draft.home.splice(to, 0, moved);
    });
    fillHome();
    // Keep focus on the same button of the section that moved, if it can
    // still go that way.
    const buttons = arrangeList.children[to].querySelectorAll('.arrange-moves button');
    const same = buttons[direction === 'up' ? 0 : 1];
    (same.disabled ? buttons[direction === 'up' ? 1 : 0] : same).focus();
  });
  return button;
}

function fillHome() {
  arrangeList.replaceChildren(...content.home.map(({ id, show }, index) => {
    const { name, note } = SECTION_NAMES[id];
    const item = document.createElement('li');
    item.classList.toggle('is-hidden', !show);

    const label = document.createElement('p');
    label.className = 'arrange-name';
    label.textContent = name;
    const small = document.createElement('small');
    small.textContent = note;
    label.append(small);

    const moves = document.createElement('div');
    moves.className = 'arrange-moves';
    moves.append(moveButton('up', index, name), moveButton('down', index, name));

    const toggle = document.createElement('label');
    toggle.className = 'switch';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = show;
    checkbox.addEventListener('change', () => {
      change((draft) => {
        draft.home[index].show = checkbox.checked;
      });
      item.classList.toggle('is-hidden', !checkbox.checked);
      fillNews();
    });
    toggle.append(checkbox, ' Show on the home page');

    item.append(label, moves, toggle);
    return item;
  }));
}

// Announcement

const announcementShow = document.getElementById('announcement-show');
const announcementText = document.getElementById('announcement-text');
const announcementLink = document.getElementById('announcement-link');

function isWebLink(text) {
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

announcementShow.addEventListener('change', () => change((draft) => {
  draft.announcement.show = announcementShow.checked;
}));

announcementText.addEventListener('input', () => {
  change((draft) => {
    draft.announcement.text = announcementText.value;
    // Typing a message turns it on, which is almost always what's wanted.
    if (announcementText.value.trim() && !announcementShow.checked) {
      announcementShow.checked = true;
      draft.announcement.show = true;
    }
  });
});

announcementLink.addEventListener('input', () => {
  const link = announcementLink.value.trim();
  announcementLink.setAttribute('aria-invalid', String(Boolean(link) && !isWebLink(link)));
  if (!link || isWebLink(link)) change((draft) => {
    draft.announcement.link = link;
  });
});

function fillAnnouncement() {
  announcementShow.checked = content.announcement.show;
  announcementText.value = content.announcement.text;
  announcementLink.value = content.announcement.link;
}

// News. Whether it shows is part of the home page layout, so the switch here
// and the one in Home page layout are the same setting.

const newsShow = document.getElementById('news-show');
const newsFields = {
  title: document.getElementById('news-title'),
  date: document.getElementById('news-date'),
  text: document.getElementById('news-text'),
};

function newsSection(draft) {
  return draft.home.find((section) => section.id === 'news');
}

newsShow.addEventListener('change', () => {
  change((draft) => {
    newsSection(draft).show = newsShow.checked;
  });
  fillHome();
});

Object.entries(newsFields).forEach(([name, input]) => {
  input.addEventListener('input', () => {
    change((draft) => {
      draft.news[name] = input.value;
      if (input.value.trim() && !newsShow.checked) {
        newsShow.checked = true;
        newsSection(draft).show = true;
        fillHome();
      }
    });
  });
});

document.getElementById('news-today').addEventListener('click', () => {
  newsFields.date.value = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  newsFields.date.dispatchEvent(new Event('input'));
});

function fillNews() {
  newsShow.checked = newsSection(content).show;
  Object.entries(newsFields).forEach(([name, input]) => {
    input.value = content.news[name];
  });
}

// Show times

const showList = document.getElementById('show-list');

function formatHour(hour) {
  if (hour === 0 || hour === 24) return 'midnight';
  if (hour === 12) return '12 noon';
  return hour > 12 ? `${hour - 12}pm` : `${hour}am`;
}

function select(label, options, value, onChange) {
  const wrapper = document.createElement('label');
  wrapper.textContent = label;
  const list = document.createElement('select');
  options.forEach(([optionValue, text]) => list.add(new Option(text, optionValue, false, optionValue === value)));
  list.addEventListener('change', () => onChange(Number(list.value)));
  wrapper.append(list);
  return wrapper;
}

const hours = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => [from + i, formatHour(from + i)]);

function fillShows() {
  showList.replaceChildren(...content.shows.map((show, index) => {
    const row = document.createElement('li');
    row.className = 'show-row';

    const update = (field) => (value) => {
      change((draft) => {
        const edited = draft.shows[index];
        edited[field] = value;
        // Keep the end after the start, so the show always makes sense.
        if (edited.end <= edited.start) edited.end = Math.min(24, edited.start + 1);
        if (edited.start >= edited.end) edited.start = edited.end - 1;
      });
      fillShows();
      showList.children[index]?.querySelectorAll('select')[['day', 'start', 'end'].indexOf(field)].focus();
    };

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'link-button';
    remove.textContent = `Remove the ${DAYS[show.day]} show`;
    remove.addEventListener('click', () => {
      change((draft) => {
        draft.shows.splice(index, 1);
      });
      fillShows();
      document.getElementById('add-show').focus();
    });

    row.append(
      select('Day', WEEK.map((day) => [day, DAYS[day]]), show.day, update('day')),
      select('Starts', hours(0, 23), show.start, update('start')),
      select('Ends', hours(1, 24), show.end, update('end')),
      remove,
    );
    return row;
  }));
  document.getElementById('add-show').disabled = content.shows.length >= 14;
}

document.getElementById('add-show').addEventListener('click', () => {
  change((draft) => {
    draft.shows.push({ day: 1, start: 10, end: 12 });
  });
  fillShows();
  showList.lastElementChild.querySelector('select').focus();
});

// Going live. "I'm live now" lasts a few hours and "No live show today" lasts
// until midnight in the UK, so neither can be left on by mistake.

const liveChoices = document.querySelectorAll('[name="live"]');
const liveUntil = document.getElementById('live-until');

function minutesUntilUkMidnight() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  return 24 * 60 - (value('hour') * 60 + value('minute'));
}

function liveEnd(mode) {
  const minutes = mode === 'on' ? LIVE_HOURS * 60 : minutesUntilUkMidnight();
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function activeLiveMode() {
  const { mode, until } = content.live;
  return mode !== 'auto' && Date.now() < Date.parse(until) ? mode : 'auto';
}

liveChoices.forEach((choice) => {
  choice.addEventListener('change', () => {
    change((draft) => {
      draft.live = choice.value === 'auto' ? { mode: 'auto' } : { mode: choice.value, until: liveEnd(choice.value) };
    });
    fillLive();
  });
});

function fillLive() {
  const mode = activeLiveMode();
  liveChoices.forEach((choice) => {
    choice.checked = choice.value === mode;
  });
  const time = mode === 'auto' ? '' : new Date(content.live.until)
    .toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: true });
  liveUntil.textContent = mode === 'on' ? `The website will say you're live until ${time}.` : '';
}

// Contact details. Checked with the same rules as netlify/lib/content.mjs,
// so anything that looks right here will also save.

const contactFields = document.querySelectorAll('[data-contact-field]');
const CONTACT_CHECKS = {
  phone: (value) => /^[0-9 +()]{7,20}$/.test(value),
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
};

contactFields.forEach((input) => {
  const name = input.dataset.contactField;
  const check = CONTACT_CHECKS[name] || isWebLink;
  input.addEventListener('input', () => {
    const value = input.value.trim();
    const ok = check(value);
    input.setAttribute('aria-invalid', String(!ok));
    if (ok) change((draft) => {
      draft.contacts[name] = value;
    });
  });
});

function fillContacts() {
  contactFields.forEach((input) => {
    input.value = content.contacts[input.dataset.contactField];
    input.removeAttribute('aria-invalid');
  });
}

// Start

buildWords();

api('session')
  .then(({ signedIn }) => (signedIn ? openEditor() : showSignIn()))
  .catch((error) => showSignIn(error.message));

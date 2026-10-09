// Jim's draft: the version he's working on, the version listeners can see,
// and the website as it was built. Every change goes through change(), which
// shows it in the preview and saves it a moment later.

import { api } from './api.js';
import { setStatus } from './messages.js';
import { updatePreview } from './preview.js';

const SAVE_DELAY_MS = 800;

export let defaults = null; // the website as it was built
export let content = null; // the draft Jim is working on
export let published = null; // what listeners can see, or null if nothing is published yet

let saveTimer = 0;
let saveQueue = Promise.resolve();

const publishButton = document.getElementById('publish-button');
const undoButton = document.getElementById('undo-button');

export function setDefaults(built) {
  defaults = built;
}

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

export async function loadVersions() {
  const { draft, published: live } = await api('draft');
  published = live ? complete(withoutDate(live)) : null;
  content = structuredClone(draft ? complete(draft) : published || defaults);
  updatePreview(content);
  updatePublishState();
}

// Saving. Changes are saved a moment after Jim stops typing, one at a time
// so an older save never lands after a newer one.

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

export function saveSoon() {
  setStatus('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, SAVE_DELAY_MS);
}

export function flushSave() {
  return saveTimer ? saveDraft() : saveQueue;
}

// Cancels the waiting save, for when publishing or undoing takes over, and
// resolves once any save already sending has finished.
export function holdSaves() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  return saveQueue;
}

export function hasWaitingSave() {
  return Boolean(saveTimer);
}

export function change(update) {
  update(content);
  updatePreview(content);
  updatePublishState();
  saveSoon();
}

window.addEventListener('beforeunload', (event) => {
  if (saveTimer) event.preventDefault();
});

// Whether there's anything to publish

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

export function updatePublishState() {
  const changed = !sameVersion(content, published || defaults);
  publishButton.disabled = !changed;
  undoButton.disabled = !published;
  document.getElementById('publish-state').classList.toggle('has-changes', changed);
  document.getElementById('publish-state-text').textContent = changed
    ? 'You have changes that aren\'t on the website yet. Press Publish changes when you\'re happy.'
    : 'The website is up to date.';
  document.getElementById('discard-button').hidden = !changed;
}

export function markPublished(version) {
  published = version;
  updatePublishState();
}

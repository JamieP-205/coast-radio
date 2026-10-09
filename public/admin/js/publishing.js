// Publish, Undo, and throwing away changes that haven't been published.

import { api } from './api.js';
import {
  change, defaults, content, hasWaitingSave, holdSaves, loadVersions, markPublished, published,
  saveSoon, updatePublishState,
} from './draft.js';
import { confirmAction, setStatus, toast } from './messages.js';
import { fillPanels } from './panels.js';

const publishButton = document.getElementById('publish-button');
const undoButton = document.getElementById('undo-button');

publishButton.addEventListener('click', async () => {
  const sure = await confirmAction({
    title: 'Put your changes on the website?',
    text: 'Listeners will see them within a few minutes. You can undo this afterwards.',
    yes: 'Publish',
  });
  if (!sure) return;

  const saving = holdSaves();
  publishButton.disabled = true;
  publishButton.textContent = 'Publishing…';
  // Publish a copy, so anything Jim types while this is sending stays
  // marked as not published yet.
  const version = structuredClone(content);
  try {
    await saving;
    await api('publish', { method: 'POST', body: version });
    markPublished(version);
    if (!hasWaitingSave()) setStatus('All changes saved');
    toast('Published. Your changes are on the website.');
  } catch (error) {
    toast(error.message, true);
    // The waiting save was cancelled above, so save the draft now instead.
    saveSoon();
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

  const saving = holdSaves();
  undoButton.disabled = true;
  try {
    await saving;
    const { restored } = await api('undo', { method: 'POST' });
    await loadVersions();
    fillPanels();
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

// The editor for Coast Internet Radio. Jim makes changes on the left and sees
// them straight away in the preview on the right. Changes are saved as a
// draft as he goes, and listeners only see them when he presses Publish.
//
// Each part of the editor is in its own file in this folder. This one opens
// the editor and connects the parts that need to call each other.

import { api, onSignedOut } from './api.js';
import { content, defaults, holdSaves, loadVersions, saveSoon, setDefaults } from './draft.js';
import { setStatus, showScreen } from './messages.js';
import { fillPanels, openEditFor } from './panels.js';
import { loadPreview, onPreviewClick } from './preview.js';
import { onSignedIn, showSignIn } from './sign-in.js';
import './publishing.js';

async function openEditor() {
  showScreen('editor');
  setStatus('Opening…');
  try {
    if (!defaults) setDefaults(await loadPreview());
    await loadVersions();
    fillPanels();
    setStatus('All changes saved');
  } catch (error) {
    setStatus(error.message, true);
  }
}

// If the 30-day sign-in runs out while Jim is working, his draft stays in
// this page and is saved again once he's signed back in.
onSignedOut(() => {
  holdSaves();
  showSignIn('You were signed out. Please sign in again. Your changes are still here.');
});

onSignedIn(async () => {
  if (content) {
    showScreen('editor');
    saveSoon();
  } else {
    await openEditor();
  }
});

onPreviewClick(openEditFor);

api('session')
  .then(({ signedIn }) => (signedIn ? openEditor() : showSignIn()))
  .catch((error) => showSignIn(error.message));

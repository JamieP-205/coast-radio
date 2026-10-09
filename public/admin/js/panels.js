// Moving between the list of things Jim can change and the panel for each.
// A panel is filled in from the draft every time it opens, so it always
// shows the latest changes, even ones made in another panel.

import { showInPreview } from './preview.js';
import { fillAnnouncement } from './panels/announcement.js';
import { fillColours } from './panels/colours.js';
import { fillContacts } from './panels/contacts.js';
import { fillHome } from './panels/home.js';
import { fillNews } from './panels/news.js';
import { fillPhotos, focusPhoto } from './panels/photos.js';
import { fillShows } from './panels/shows.js';
import { fillWords, focusWord } from './panels/words.js';

const PANELS = {
  words: { fill: fillWords },
  photos: { fill: fillPhotos, page: 'home' },
  colours: { fill: fillColours, page: 'home' },
  home: { fill: fillHome, page: 'home' },
  announcement: { fill: fillAnnouncement, page: 'home' },
  news: { fill: fillNews, page: 'home' },
  shows: { fill: fillShows, page: 'shows' },
  contacts: { fill: fillContacts, page: 'requests' },
};

// Called when the editor opens, and again after Undo or throwing changes away.
export function fillPanels() {
  Object.values(PANELS).forEach(({ fill }) => fill());
}

function openPanel(name, focus = true) {
  PANELS[name]?.fill();
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
  document.querySelector('.side').scrollTop = 0;
  window.scrollTo(0, 0);
  if (focus) document.querySelector(`[data-panel="${name}"] h1`).focus();
  showInPreview(PANELS[name]?.page);
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
export function openEditFor({ kind, key }) {
  if (kind === 'text') {
    openPanel('words', false);
    focusWord(key);
  } else if (kind === 'photo') {
    openPanel('photos', false);
    focusPhoto(key);
  } else if (['announcement', 'news', 'shows', 'contacts'].includes(kind)) {
    openPanel(kind, false);
    document.querySelector(`[data-panel="${kind}"] input, [data-panel="${kind}"] select`)?.focus();
  }
}

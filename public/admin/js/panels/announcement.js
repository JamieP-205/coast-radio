// Announcement: a message across the top of every page.

import { isWebLink } from '../checks.js';
import { change, content, showSaveState } from '../draft.js';

const announcementShow = document.getElementById('announcement-show');
const announcementText = document.getElementById('announcement-text');
const announcementLink = document.getElementById('announcement-link');
const announcementLinkProblem = document.getElementById('announcement-link-problem');

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
  const ok = !link || isWebLink(link);
  announcementLink.setAttribute('aria-invalid', String(!ok));
  announcementLinkProblem.textContent = ok ? '' : 'Not saved yet. Paste the whole link, starting with https://';
  if (ok) {
    change((draft) => {
      draft.announcement.link = link;
    });
  } else {
    showSaveState();
  }
});

export function fillAnnouncement() {
  announcementShow.checked = content.announcement.show;
  announcementText.value = content.announcement.text;
  announcementLink.value = content.announcement.link;
  announcementLink.removeAttribute('aria-invalid');
  announcementLinkProblem.textContent = '';
}

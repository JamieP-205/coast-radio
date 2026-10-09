// Announcement: a message across the top of every page.

import { isWebLink } from '../checks.js';
import { change, content } from '../draft.js';

const announcementShow = document.getElementById('announcement-show');
const announcementText = document.getElementById('announcement-text');
const announcementLink = document.getElementById('announcement-link');

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

export function fillAnnouncement() {
  announcementShow.checked = content.announcement.show;
  announcementText.value = content.announcement.text;
  announcementLink.value = content.announcement.link;
  announcementLink.removeAttribute('aria-invalid');
}

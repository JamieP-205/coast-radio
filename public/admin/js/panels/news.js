// News. Whether it shows is part of the home page layout, so the switch here
// and the one in Home page layout are the same setting.

import { change, content } from '../draft.js';

const newsShow = document.getElementById('news-show');
const newsFields = {
  title: document.getElementById('news-title'),
  date: document.getElementById('news-date'),
  text: document.getElementById('news-text'),
};

function newsSection(draft) {
  return draft.home.find((section) => section.id === 'news');
}

newsShow.addEventListener('change', () => change((draft) => {
  newsSection(draft).show = newsShow.checked;
}));

Object.entries(newsFields).forEach(([name, input]) => {
  input.addEventListener('input', () => {
    change((draft) => {
      draft.news[name] = input.value;
      // Writing news turns it on, which is almost always what's wanted.
      if (input.value.trim() && !newsShow.checked) {
        newsShow.checked = true;
        newsSection(draft).show = true;
      }
    });
  });
});

document.getElementById('news-today').addEventListener('click', () => {
  newsFields.date.value = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  newsFields.date.dispatchEvent(new Event('input'));
});

export function fillNews() {
  newsShow.checked = newsSection(content).show;
  Object.entries(newsFields).forEach(([name, input]) => {
    input.value = content.news[name];
  });
}

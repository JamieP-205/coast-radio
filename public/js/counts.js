// Anonymous counts for the editor's Visitors and listeners view: one count
// per visit (with the site it came from), each page viewed, the first Listen
// press and each song request sent. No cookies, and nothing that identifies
// the visitor or what they requested is sent.

import { isPreview } from './pages.js';

const COUNT_URL = 'https://coast-history.jamieparr05.workers.dev/hit';

function send(data) {
  try {
    navigator.sendBeacon?.(COUNT_URL, JSON.stringify(data));
  } catch {
    // Counting must never get in the way of the website.
  }
}

function firstTimeThisVisit(key) {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    // Private browsing can block this; counting once per page load is fine then.
  }
  return true;
}

function pageNow() {
  const id = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '').slice(1);
  return id || 'home';
}

// The editor's preview and automated browsers aren't real visitors.
if (!isPreview && !navigator.webdriver) {
  if (firstTimeThisVisit('coast-visit')) {
    let from = '';
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer && referrer.host !== location.host) from = referrer.host;
    } catch {
      from = '';
    }
    send({ type: 'visit', from, facebook: new URLSearchParams(location.search).has('fbclid') });
  }

  send({ type: 'view', page: pageNow() });
  window.addEventListener('coast:page', ({ detail }) => {
    if (detail !== pageNow()) return;
    send({ type: 'view', page: detail });
  });

  // A song request was sent. Only that it happened: never what was in it.
  window.addEventListener('coast:request-sent', () => send({ type: 'request' }));

  // Listen presses: once per visit, so stopping and starting again isn't counted twice.
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-play]') && !document.body.classList.contains('is-playing')
      && firstTimeThisVisit('coast-listen')) {
      send({ type: 'listen' });
    }
  });
}

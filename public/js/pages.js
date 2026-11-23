// Pages. Every page lives in index.html and only one is shown at a time, so
// the music keeps playing while listeners move around the site. Each page
// also has its own address (/shows, /about and so on), built by
// scripts/build-pages.mjs, so search engines can list them separately.

// Inside the editor, the website is shown in a frame with ?preview added.
// The frame stays on one address and uses #page to move between pages.
export const isPreview = new URLSearchParams(location.search).has('preview') && window.parent !== window;

const pages = document.querySelectorAll('[data-page]');
const navLinks = document.querySelectorAll('.nav a');
let currentPage = null;

const pageExists = (id) => Boolean(id) && Boolean(document.querySelector(`[data-page="${CSS.escape(id)}"]`));
const addressOf = (id) => (id === 'home' ? '/' : `/${id}`);

// The page a link inside the site goes to, or null for any other link.
export function pageForLink(link) {
  const href = link.getAttribute('href') || '';
  if (link.target || !href.startsWith('/')) return null;
  const id = href === '/' ? 'home' : href.slice(1);
  return pageExists(id) ? id : null;
}

function pageFromAddress() {
  const id = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '').slice(1);
  return pageExists(id) ? id : 'home';
}

function showPage(id) {
  if (id === currentPage) return;
  const isFirstPage = currentPage === null;
  const page = document.querySelector(`[data-page="${CSS.escape(id)}"]`);
  currentPage = id;

  pages.forEach((section) => {
    section.hidden = section !== page;
  });
  navLinks.forEach((link) => {
    if (pageForLink(link) === id) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  document.title = page.dataset.title;

  // Moving focus to the new page's heading tells screen readers it changed.
  // Not in the editor's preview, where Jim is typing in the editor itself.
  if (!isFirstPage) {
    window.scrollTo(0, 0);
    if (!isPreview) page.querySelector('h1').focus();
  }
}

// Follows the address bar. Old links such as /#shows still work and are
// tidied to /shows. Other # links, like "Skip to content", aren't pages.
function followAddress() {
  const hash = location.hash.slice(1);
  if (pageExists(hash)) {
    if (!isPreview) history.replaceState(null, '', addressOf(hash));
    showPage(hash);
  } else if (isPreview) {
    showPage(currentPage ?? 'home');
  } else {
    showPage(pageFromAddress());
  }
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a');
  const id = link && pageForLink(link);
  if (!id) return;

  event.preventDefault();
  if (isPreview) {
    location.hash = id;
  } else {
    if (id !== currentPage) history.pushState(null, '', addressOf(id));
    showPage(id);
  }
});

window.addEventListener('popstate', followAddress);
window.addEventListener('hashchange', followAddress);
followAddress();

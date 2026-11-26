// Pages. The music keeps playing while listeners move around the site because
// the browser never loads a new document. Each page also has its own address
// (/shows, /about and so on), built by scripts/build-pages.mjs. Only the page
// being read is kept in the document, so search engines see one page per
// address; the others wait in memory until they're opened.

// Inside the editor, the website is shown in a frame with ?preview added.
// The frame stays on one address and uses #page to move between pages.
export const isPreview = new URLSearchParams(location.search).has('preview') && window.parent !== window;

// The built pages keep the others in <template> tags. Every script expects
// the whole website while it sets up, so unpack them first.
document.querySelectorAll('template[data-stored-page]').forEach((template) => {
  template.replaceWith(template.content);
});

const main = document.getElementById('main');
const pages = new Map([...document.querySelectorAll('[data-page]')].map((page) => [page.dataset.page, page]));
const navLinks = document.querySelectorAll('.nav a');
let currentPage = null;
let keepingOnePage = false;

const pageExists = (id) => pages.has(id);
const addressOf = (id) => (id === 'home' ? '/' : `/${id}`);

// The page a link inside the site goes to, or null for any other link.
export function pageForLink(link) {
  const href = link.getAttribute('href') || '';
  if (link.target || !href.startsWith('/')) return null;
  const id = href === '/' ? 'home' : href.slice(1);
  return pageExists(id) ? id : null;
}

// A link to another website. Email, text and phone links aren't, nor are
// links that already choose where they open.
function isOutsideLink(link) {
  if (link.target || link.hasAttribute('download')) return false;
  const url = new URL(link.href, location.href);
  return /^https?:$/.test(url.protocol) && url.host !== location.host;
}

function pageFromAddress() {
  const id = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '').slice(1);
  return pageExists(id) ? id : 'home';
}

function keepOnlyCurrentPage() {
  pages.forEach((page, id) => {
    if (id !== currentPage) page.remove();
  });
  const page = pages.get(currentPage);
  if (!page.isConnected) main.append(page);
}

function showPage(id) {
  if (id === currentPage) return;
  const isFirstPage = currentPage === null;
  const page = pages.get(id);
  currentPage = id;

  pages.forEach((section) => {
    section.hidden = section !== page;
  });
  if (keepingOnePage) keepOnlyCurrentPage();
  navLinks.forEach((link) => {
    if (pageForLink(link) === id) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  document.title = page.dataset.title;
  window.dispatchEvent(new CustomEvent('coast:page', { detail: id }));

  // Moving focus to the new page's heading tells screen readers it changed.
  // Not in the editor's preview, where Jim is typing in the editor itself.
  if (!isFirstPage) {
    window.scrollTo(0, 0);
    if (!isPreview) page.querySelector('h1').focus();
  }
}

// Runs once every script has set up. The audio moves out of the home page
// first, because a browser stops any audio that leaves the document.
export function keepOnePageInDocument() {
  if (isPreview) return;
  document.body.append(document.getElementById('stream'));
  keepingOnePage = true;
  keepOnlyCurrentPage();
}

// Jim's published changes can touch any page, so they're applied with every
// page briefly back in the document. This happens before the screen redraws.
export function withAllPages(update) {
  if (keepingOnePage) pages.forEach((page) => main.append(page));
  try {
    update();
  } finally {
    if (keepingOnePage) keepOnlyCurrentPage();
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
  if (link && isOutsideLink(link)) {
    // Other websites open in a new tab, so the music keeps playing here.
    event.preventDefault();
    window.open(link.href, '_blank', 'noopener');
    return;
  }
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

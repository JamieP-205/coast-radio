// Pages. Every page lives in this one file and only one is shown at a time,
// so the music keeps playing while listeners move around the site.

document.documentElement.classList.add('has-js');

const pages = document.querySelectorAll('[data-page]');
const navLinks = document.querySelectorAll('.nav a');
let firstPageShown = true;

function showPage() {
  const requested = location.hash.slice(1) || 'home';
  const page = document.querySelector(`[data-page="${requested}"]`);

  // Links such as "Skip to content" aren't pages, so leave the page as it is.
  if (!page) {
    if (firstPageShown) {
      firstPageShown = false;
      history.replaceState(null, '', '#home');
      showPage();
    }
    return;
  }

  pages.forEach((section) => {
    section.hidden = section !== page;
  });
  navLinks.forEach((link) => {
    if (link.getAttribute('href') === `#${requested}`) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  document.title = page.dataset.title;

  // Moving focus to the new page's heading tells screen readers it changed.
  if (!firstPageShown) {
    window.scrollTo(0, 0);
    page.querySelector('h1').focus();
  }
  firstPageShown = false;
}

window.addEventListener('hashchange', showPage);
showPage();

// Phone menu

const menuButton = document.querySelector('.menu-button');
const mainNav = document.getElementById('main-nav');

menuButton.hidden = false;
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  mainNav.classList.toggle('is-open', !open);
});

mainNav.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    menuButton.setAttribute('aria-expanded', 'false');
    mainNav.classList.remove('is-open');
  }
});

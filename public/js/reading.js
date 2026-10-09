// Text size and dark mode, remembered on this device.

import { recall, remember } from './shared.js';

const readingTools = document.querySelector('.reading-tools');
const sizeButtons = document.querySelectorAll('[data-size]');
const darkToggle = document.querySelector('.dark-toggle');
const deviceDark = window.matchMedia('(prefers-color-scheme: dark)');

function setSize(size) {
  if (size === 'standard') {
    delete document.documentElement.dataset.size;
  } else {
    document.documentElement.dataset.size = size;
  }
  sizeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.size === size));
  });
}

// Until someone chooses, the site follows the device's own light or dark setting.
function setTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  const dark = theme ? theme === 'dark' : deviceDark.matches;
  darkToggle.setAttribute('aria-pressed', String(dark));
}

readingTools.hidden = false;
setSize(recall('coast-text-size') || 'standard');
setTheme(recall('coast-theme'));

sizeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setSize(button.dataset.size);
    remember('coast-text-size', button.dataset.size);
  });
});

darkToggle.addEventListener('click', () => {
  const theme = darkToggle.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark';
  setTheme(theme);
  remember('coast-theme', theme);
});

deviceDark.addEventListener('change', () => setTheme(recall('coast-theme')));

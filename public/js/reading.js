// Text size and dark mode, in the Settings menu and remembered on this device.

import { recall, remember } from './shared.js';

const readingTools = document.querySelector('.reading-tools');
const sizeButtons = document.querySelectorAll('.text-size [data-size]');
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
const savedSize = recall('coast-text-size');
setSize(savedSize === 'large' || savedSize === 'largest' ? savedSize : 'standard');
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

// The menu closes when you click elsewhere or press Escape.
document.addEventListener('click', (event) => {
  if (readingTools.open && !readingTools.contains(event.target)) readingTools.open = false;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && readingTools.open) {
    readingTools.open = false;
    readingTools.querySelector('summary').focus();
  }
});

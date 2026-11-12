// Runs before the page is drawn, so a listener who chose bigger text or dark
// mode never sees the page flash up in the standard size or the wrong colours.
// reading.js looks after the buttons once the rest of the page has loaded.

(function () {
  try {
    var size = localStorage.getItem('coast-text-size');
    var theme = localStorage.getItem('coast-theme');
    if (size === 'large' || size === 'largest') document.documentElement.setAttribute('data-size', size);
    if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);
  } catch (error) {
    // Some browsers block saved choices, for example in private browsing.
  }
}());

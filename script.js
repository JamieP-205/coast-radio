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

// Listening

const STREAM_URL = 'https://coast-stream.jamieparr05.workers.dev/stream';

const audio = document.getElementById('stream');
const controls = document.querySelector('.player-controls');
const playButtons = document.querySelectorAll('[data-play]');
const playLabels = document.querySelectorAll('[data-play-label]');
const volumeSliders = document.querySelectorAll('[data-volume]');
const statusText = document.getElementById('player-status');

let isPlaying = false;

// The browser's own player stays as a fallback if this script never runs.
audio.controls = false;
audio.hidden = true;
controls.hidden = false;
audio.volume = 0.8;

function showPlaying(playing) {
  isPlaying = playing;
  document.body.classList.toggle('is-playing', playing);
  playLabels.forEach((label) => {
    label.textContent = playing ? 'Pause' : 'Listen live';
  });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }
}

function startListening() {
  // A live stream can't be resumed from where it paused, so reconnect to
  // get the station as it is now.
  audio.src = STREAM_URL;
  statusText.textContent = 'Connecting to the station…';
  audio.play().catch(() => {
    statusText.textContent = "The station couldn't be reached. Please try again in a minute.";
    showPlaying(false);
  });
}

function stopListening() {
  audio.pause();
  // Removing the source stops the stream downloading in the background.
  audio.removeAttribute('src');
  audio.load();
  statusText.textContent = 'Paused.';
  showPlaying(false);
}

playButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (isPlaying) {
      stopListening();
    } else {
      startListening();
    }
  });
});

audio.addEventListener('playing', () => {
  statusText.textContent = 'Playing live.';
  showPlaying(true);
});

audio.addEventListener('waiting', () => {
  statusText.textContent = 'Buffering…';
});

// If the connection drops while someone is listening, say so and reset the
// buttons, rather than showing Pause while nothing plays.
['error', 'ended'].forEach((type) => {
  audio.addEventListener(type, () => {
    if (!isPlaying) return;
    statusText.textContent = 'The stream stopped. Press play to reconnect.';
    showPlaying(false);
  });
});

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', startListening);
  navigator.mediaSession.setActionHandler('pause', stopListening);
}

// iPhones and iPads only let the side buttons change the volume, so the
// sliders are shown only where they work, and a note is shown instead.
function volumeCanChange() {
  const test = new Audio();
  test.volume = 0.5;
  return test.volume === 0.5;
}

const canChangeVolume = volumeCanChange();
document.querySelectorAll('[data-volume-control]').forEach((control) => {
  control.hidden = !canChangeVolume;
});
document.querySelectorAll('[data-volume-note]').forEach((note) => {
  note.hidden = canChangeVolume;
});

// The thin sliders fill up to their value, and all of them move together.
function paintSlider(slider) {
  slider.style.setProperty('--fill', `${slider.value}%`);
}

volumeSliders.forEach((slider) => {
  paintSlider(slider);
  slider.addEventListener('input', () => {
    audio.volume = slider.value / 100;
    volumeSliders.forEach((other) => {
      other.value = slider.value;
      paintSlider(other);
    });
  });
});

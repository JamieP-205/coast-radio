// The player: Listen live, volume and mute, the bar at the bottom of every
// page, and the full-screen player.

import { retryDelay } from './shared.js';

const STREAM_URL = 'https://coast-stream.jamieparr05.workers.dev/stream';

const audio = document.getElementById('stream');
const controls = document.querySelector('.player-controls');
const playButtons = document.querySelectorAll('[data-play]');
const playLabels = document.querySelectorAll('[data-play-label]');
const volumeSliders = document.querySelectorAll('[data-volume]');
const statusText = document.getElementById('player-status');

// wantsToListen is true from the moment someone presses Listen live until
// they press Stop, even while the stream is still connecting or has dropped.
let wantsToListen = false;
let retries = 0;
let retryTimer;
let slowTimer;
let waitingToRetry = false;

// The browser's own player stays as a fallback if this script never runs.
audio.controls = false;
audio.hidden = true;
controls.hidden = false;
audio.volume = 0.8;

// is-playing turns the buttons into Stop. is-connecting shows the turning
// ring until sound is actually coming out.
function showListening(listening, connecting) {
  document.body.classList.toggle('is-playing', listening);
  document.body.classList.toggle('is-connecting', Boolean(listening && connecting));
  playLabels.forEach((label) => {
    label.textContent = listening ? 'Stop' : 'Listen live';
  });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = listening ? 'playing' : 'paused';
  }
}

function giveUp(message) {
  wantsToListen = false;
  waitingToRetry = false;
  clearTimeout(retryTimer);
  clearTimeout(slowTimer);
  statusText.textContent = message;
  showListening(false);
}

// One failure can be reported twice, by the error event and by play()
// itself, so a retry that is already waiting isn't counted again.
function tryAgainSoon() {
  if (!wantsToListen || waitingToRetry) return;
  clearTimeout(retryTimer);
  clearTimeout(slowTimer);
  const delay = retryDelay(retries);
  retries += 1;
  if (delay === null) {
    giveUp("The station couldn't be reached. Please try again in a minute.");
    return;
  }
  showListening(true, true);
  statusText.textContent = 'The connection dropped. Reconnecting…';
  waitingToRetry = true;
  retryTimer = setTimeout(connect, delay);
}

function connect() {
  waitingToRetry = false;
  clearTimeout(retryTimer);
  clearTimeout(slowTimer);
  // A live stream can't be resumed from where it stopped, so connect afresh
  // to get the station as it is now.
  audio.src = STREAM_URL;
  showListening(true, true);
  audio.play().catch((error) => {
    // AbortError only means a newer attempt has replaced this one.
    if (error.name === 'AbortError') return;
    if (error.name === 'NotAllowedError') {
      giveUp('Press Listen live to start the station.');
    } else {
      tryAgainSoon();
    }
  });
}

function startListening() {
  wantsToListen = true;
  retries = 0;
  statusText.textContent = 'Connecting to the station…';
  connect();
}

function stopListening() {
  wantsToListen = false;
  waitingToRetry = false;
  clearTimeout(retryTimer);
  clearTimeout(slowTimer);
  audio.pause();
  // Removing the source stops the stream downloading in the background.
  audio.removeAttribute('src');
  audio.load();
  statusText.textContent = 'Stopped.';
  showListening(false);
}

playButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (wantsToListen) {
      stopListening();
    } else {
      startListening();
    }
  });
});

audio.addEventListener('playing', () => {
  if (!wantsToListen) return;
  clearTimeout(slowTimer);
  retries = 0;
  statusText.textContent = 'Playing live.';
  showListening(true, false);
});

// A short wait for more sound is normal. A long one means the connection
// has gone, so start again rather than leave the listener in silence.
audio.addEventListener('waiting', () => {
  if (!wantsToListen) return;
  statusText.textContent = 'Buffering…';
  clearTimeout(slowTimer);
  slowTimer = setTimeout(tryAgainSoon, 10000);
});

['error', 'ended'].forEach((type) => {
  audio.addEventListener(type, tryAgainSoon);
});

// When the phone or computer comes back online, don't wait for the timer.
window.addEventListener('online', () => {
  if (wantsToListen && waitingToRetry) connect();
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

// The sliders fill up to their value, and all of them move together.
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

// The player bar and the full-screen player

const playerBar = document.querySelector('.player-bar');
const playerView = document.getElementById('player-view');
const muteButtons = document.querySelectorAll('[data-mute]');

playerBar.hidden = false;

// The bar shows whenever the main Listen button isn't on screen: on every
// other page, and on the home page once it scrolls away.
const mainButtonWatcher = new IntersectionObserver(([entry]) => {
  playerBar.classList.toggle('is-shown', !entry.isIntersecting);
});
mainButtonWatcher.observe(controls);

document.querySelectorAll('[data-open-player]').forEach((button) => {
  button.addEventListener('click', () => playerView.showModal());
});
playerView.querySelector('[data-close-player]').addEventListener('click', () => playerView.close());

function showMuted() {
  document.body.classList.toggle('is-muted', audio.muted);
  muteButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(audio.muted));
  });
}

muteButtons.forEach((button) => {
  button.addEventListener('click', () => {
    audio.muted = !audio.muted;
    showMuted();
  });
});

// Moving a volume slider unmutes.
volumeSliders.forEach((slider) => {
  slider.addEventListener('input', () => {
    if (audio.muted && slider.value > 0) {
      audio.muted = false;
      showMuted();
    }
  });
});

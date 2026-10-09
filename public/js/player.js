// The player: Listen live, volume and mute, the bar at the bottom of every
// page, and the full-screen player.

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

// Moving a volume slider unmutes, like Spotify.
volumeSliders.forEach((slider) => {
  slider.addEventListener('input', () => {
    if (audio.muted && slider.value > 0) {
      audio.muted = false;
      showMuted();
    }
  });
});

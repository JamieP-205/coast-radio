// The preview is the real website in a frame. It sends a "ready" message
// with its original content, then shows whatever content it's sent, and
// tells the editor when Jim clicks something he can change.

const preview = document.getElementById('preview');
let previewIsReady;
let lastContent = null;
let whenClicked = () => {};

function sendToPreview(message) {
  preview.contentWindow?.postMessage(message, location.origin);
}

export function showInPreview(page) {
  if (page) sendToPreview({ type: 'go', page });
}

export function updatePreview(content) {
  lastContent = content;
  sendToPreview({ type: 'content', content });
}

// Sets what happens when Jim clicks something in the preview.
export function onPreviewClick(handler) {
  whenClicked = handler;
}

// Loads the preview and resolves with the website's original content.
export function loadPreview() {
  return new Promise((resolve) => {
    previewIsReady = resolve;
    preview.src = '/?preview#home';
  });
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== preview.contentWindow) return;
  const { type } = event.data || {};
  if (type === 'ready') {
    previewIsReady?.(event.data.defaults);
    if (lastContent) updatePreview(lastContent);
  }
  if (type === 'edit') whenClicked(event.data);
});

document.querySelectorAll('[data-preview-size]').forEach((button) => {
  button.addEventListener('click', () => {
    const phone = button.dataset.previewSize === 'phone';
    preview.parentElement.classList.toggle('is-phone', phone);
    document.querySelectorAll('[data-preview-size]').forEach((other) => {
      other.setAttribute('aria-pressed', String(other === button));
    });
  });
});

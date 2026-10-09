// Screens, the save status in the top bar, short messages and questions.

const saveStatus = document.getElementById('save-status');
const toastText = document.getElementById('toast');

export function showScreen(name) {
  document.querySelectorAll('[data-screen]').forEach((screen) => {
    screen.hidden = screen.dataset.screen !== name;
  });
}

export function setStatus(text, problem = false) {
  saveStatus.textContent = text;
  saveStatus.classList.toggle('is-problem', problem);
}

let toastTimer = 0;
export function toast(text, problem = false) {
  clearTimeout(toastTimer);
  toastText.textContent = text;
  toastText.classList.toggle('is-problem', problem);
  toastTimer = setTimeout(() => {
    toastText.textContent = '';
  }, 6000);
}

// Asks a yes or no question in a dialog, and resolves to true for yes.
export function confirmAction({ title, text, yes }) {
  const dialog = document.getElementById('confirm');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  document.getElementById('confirm-yes').textContent = yes;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
  });
}

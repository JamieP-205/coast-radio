// Signing in and out.

import { api } from './api.js';
import { flushSave } from './draft.js';
import { showScreen } from './messages.js';

const signInForm = document.getElementById('sign-in-form');
const signInMessage = document.getElementById('sign-in-message');
const passwordInput = document.getElementById('password');
const showPassword = document.getElementById('show-password');
let whenSignedIn = async () => {};

export function showSignIn(message = '') {
  showScreen('sign-in');
  signInMessage.textContent = message;
  document.getElementById('username').focus();
}

// Sets what happens once Jim has signed in.
export function onSignedIn(handler) {
  whenSignedIn = handler;
}

showPassword.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  showPassword.textContent = showing ? 'Show' : 'Hide';
  showPassword.setAttribute('aria-pressed', String(!showing));
});

signInForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = signInForm.username.value.trim();
  const password = passwordInput.value;
  if (!username || !password) {
    signInMessage.textContent = 'Please type your username and password.';
    return;
  }

  const button = signInForm.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = 'Signing in…';
  try {
    await api('login', { method: 'POST', body: { username, password } });
    passwordInput.value = '';
    await whenSignedIn();
  } catch (error) {
    signInMessage.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in';
  }
});

document.getElementById('sign-out-button').addEventListener('click', async () => {
  await flushSave();
  await api('logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

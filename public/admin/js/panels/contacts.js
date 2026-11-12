// Contact details: the phone number, email and links shown on the website.

import { isEmail, isPhone, isWebLink } from '../checks.js';
import { change, content, showSaveState } from '../draft.js';

const contactFields = document.querySelectorAll('[data-contact-field]');
const CHECKS = { phone: isPhone, email: isEmail };
const PROBLEMS = {
  phone: 'Not saved yet. Use at least 7 numbers, with only spaces, + and brackets in between.',
  email: 'Not saved yet. Type the whole email address, like name@example.com',
};
const LINK_PROBLEM = 'Not saved yet. Paste the whole link, starting with https://';

contactFields.forEach((input) => {
  const name = input.dataset.contactField;
  const check = CHECKS[name] || isWebLink;
  const problem = document.getElementById(`${input.id}-problem`);
  input.addEventListener('input', () => {
    const value = input.value.trim();
    const ok = check(value);
    input.setAttribute('aria-invalid', String(!ok));
    problem.textContent = ok ? '' : PROBLEMS[name] || LINK_PROBLEM;
    if (ok) {
      change((draft) => {
        draft.contacts[name] = value;
      });
    } else {
      showSaveState();
    }
  });
});

export function fillContacts() {
  contactFields.forEach((input) => {
    input.value = content.contacts[input.dataset.contactField];
    input.removeAttribute('aria-invalid');
    document.getElementById(`${input.id}-problem`).textContent = '';
  });
}

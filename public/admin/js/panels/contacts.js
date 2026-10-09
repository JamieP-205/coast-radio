// Contact details: the phone number, email and links shown on the website.

import { isEmail, isPhone, isWebLink } from '../checks.js';
import { change, content } from '../draft.js';

const contactFields = document.querySelectorAll('[data-contact-field]');
const CHECKS = { phone: isPhone, email: isEmail };

contactFields.forEach((input) => {
  const name = input.dataset.contactField;
  const check = CHECKS[name] || isWebLink;
  input.addEventListener('input', () => {
    const value = input.value.trim();
    const ok = check(value);
    input.setAttribute('aria-invalid', String(!ok));
    if (ok) change((draft) => {
      draft.contacts[name] = value;
    });
  });
});

export function fillContacts() {
  contactFields.forEach((input) => {
    input.value = content.contacts[input.dataset.contactField];
    input.removeAttribute('aria-invalid');
  });
}

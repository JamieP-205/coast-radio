// Words: every piece of text Jim can change, grouped by the page it's on.

import { change, content } from '../draft.js';
import { showInPreview } from '../preview.js';

// The limits match the checks in netlify/lib/content.mjs.
const WORDS = [
  { page: 'home', name: 'Home page', fields: [
    { key: 'heroTitle', label: 'Headline at the top', max: 90 },
    { key: 'welcomeTitle', label: 'Welcome heading', max: 60 },
    { key: 'welcomeText', label: 'Welcome message', max: 600 },
    { key: 'signOff', label: 'Your sign-off', max: 60, help: 'Also used on the About Jim page.' },
  ] },
  { page: 'shows', name: 'Show times page', fields: [
    { key: 'showsLead', label: 'Introduction', max: 300 },
  ] },
  { page: 'about', name: 'About Jim page', fields: [
    { key: 'aboutLead', label: 'First paragraph', max: 600 },
    { key: 'aboutText', label: 'Second paragraph', max: 600 },
    { key: 'supportLead', label: 'Support message', max: 300 },
    { key: 'supportNote', label: 'Support slogan', max: 120 },
  ] },
  { page: 'requests', name: 'Requests page', fields: [
    { key: 'requestsLead', label: 'Introduction', max: 300 },
  ] },
  { page: null, name: 'Bottom of every page', fields: [
    { key: 'footerTagline', label: 'Line under the logo', max: 160 },
  ] },
];

const wordFields = document.getElementById('word-fields');
let focusFromPreview = false;

function showWordState(input) {
  const empty = !input.value.trim();
  input.setAttribute('aria-invalid', String(empty));
  document.getElementById(`${input.id}-problem`).textContent = empty ? 'This can\'t be empty.' : '';
  document.getElementById(`${input.id}-count`).textContent = `${input.value.length} of ${input.maxLength} letters`;
}

function paragraph(className, id, text = '') {
  const element = document.createElement('p');
  element.className = className;
  element.id = id;
  element.textContent = text;
  return element;
}

function wordField(group, { key, label, max, help }) {
  const field = document.createElement('div');
  field.className = 'field';
  const id = `word-${key}`;

  const labelElement = document.createElement('label');
  labelElement.htmlFor = id;
  labelElement.textContent = label;

  const input = document.createElement(max > 120 ? 'textarea' : 'input');
  input.id = id;
  input.maxLength = max;
  input.dataset.word = key;
  if (max > 120) input.rows = max > 300 ? 6 : 4;

  const problem = paragraph('field-problem', `${id}-problem`);
  const count = paragraph('count', `${id}-count`);
  const describedBy = [problem.id, count.id];

  field.append(labelElement);
  if (help) {
    const helpText = paragraph('help', `${id}-help`, help);
    field.append(helpText);
    describedBy.unshift(helpText.id);
  }
  input.setAttribute('aria-describedby', describedBy.join(' '));
  field.append(input, problem, count);

  input.addEventListener('focus', () => {
    if (!focusFromPreview) showInPreview(group.page);
  });
  input.addEventListener('input', () => {
    showWordState(input);
    // An empty box can't be saved, so the website keeps the last words
    // until Jim types something.
    if (input.value.trim()) change((draft) => {
      draft.text[key] = input.value;
    });
  });
  return field;
}

WORDS.forEach((group) => {
  const section = document.createElement('section');
  section.className = 'word-group';
  const heading = document.createElement('h2');
  heading.textContent = group.name;
  section.append(heading, ...group.fields.map((field) => wordField(group, field)));
  wordFields.append(section);
});

export function fillWords() {
  wordFields.querySelectorAll('[data-word]').forEach((input) => {
    input.value = content.text[input.dataset.word] || '';
    showWordState(input);
  });
}

// Jim clicked this text on the page he's looking at, so highlight its box
// and stay on that page.
export function focusWord(key) {
  const field = document.querySelector(`[data-word="${CSS.escape(key)}"]`);
  if (!field) return;
  document.querySelectorAll('.field.is-highlighted').forEach((other) => other.classList.remove('is-highlighted'));
  field.closest('.field').classList.add('is-highlighted');
  field.scrollIntoView({ block: 'center' });
  focusFromPreview = true;
  field.focus({ preventScroll: true });
  focusFromPreview = false;
}

// Colours: the main colour of the website.

import { change, content } from '../draft.js';

const colourChoices = document.querySelectorAll('[name="colours"]');

colourChoices.forEach((choice) => {
  choice.addEventListener('change', () => change((draft) => {
    draft.colours = choice.value;
  }));
});

export function fillColours() {
  colourChoices.forEach((choice) => {
    choice.checked = choice.value === content.colours;
  });
}

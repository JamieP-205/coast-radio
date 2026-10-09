// Home page layout. Arrow buttons rather than dragging, because they're
// easier to hit and work with a keyboard too.

import { change, content } from '../draft.js';

const SECTION_NAMES = {
  played: { name: 'Just played', note: 'The last five songs, with their covers' },
  news: { name: 'News from Coast', note: 'Your news story, if you have one' },
  welcome: { name: 'Welcome message', note: 'Your welcome and sign-off' },
};

const ARROWS = {
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
};

const arrangeList = document.getElementById('arrange-list');

function moveButton(direction, index, label) {
  const button = document.createElement('button');
  button.type = 'button';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ARROWS[direction]);
  svg.append(path);
  const text = document.createElement('span');
  text.className = 'visually-hidden';
  text.textContent = `Move ${label} ${direction}`;
  button.append(svg, text);

  const to = direction === 'up' ? index - 1 : index + 1;
  button.disabled = to < 0 || to >= content.home.length;
  button.addEventListener('click', () => {
    change((draft) => {
      const [moved] = draft.home.splice(index, 1);
      draft.home.splice(to, 0, moved);
    });
    fillHome();
    // Keep focus on the same button of the section that moved, if it can
    // still go that way.
    const buttons = arrangeList.children[to].querySelectorAll('.arrange-moves button');
    const same = buttons[direction === 'up' ? 0 : 1];
    (same.disabled ? buttons[direction === 'up' ? 1 : 0] : same).focus();
  });
  return button;
}

export function fillHome() {
  arrangeList.replaceChildren(...content.home.map(({ id, show }, index) => {
    const { name, note } = SECTION_NAMES[id];
    const item = document.createElement('li');
    item.classList.toggle('is-hidden', !show);

    const label = document.createElement('p');
    label.className = 'arrange-name';
    label.textContent = name;
    const small = document.createElement('small');
    small.textContent = note;
    label.append(small);

    const moves = document.createElement('div');
    moves.className = 'arrange-moves';
    moves.append(moveButton('up', index, name), moveButton('down', index, name));

    const toggle = document.createElement('label');
    toggle.className = 'switch';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = show;
    checkbox.addEventListener('change', () => {
      change((draft) => {
        draft.home[index].show = checkbox.checked;
      });
      item.classList.toggle('is-hidden', !checkbox.checked);
    });
    toggle.append(checkbox, ' Show on the home page');

    item.append(label, moves, toggle);
    return item;
  }));
}

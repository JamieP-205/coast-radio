// Show times and going live. "I'm live now" lasts a few hours and "No live
// show today" lasts until midnight in the UK, so neither can be left on by
// mistake.

import { DAYS, formatHour, liveSwitchMode } from '/js/shared.js';
import { change, content } from '../draft.js';

const LIVE_HOURS = 3;
const MAX_SHOWS = 14;
const WEEK = [1, 2, 3, 4, 5, 6, 0];

const showList = document.getElementById('show-list');
const addShow = document.getElementById('add-show');
const liveChoices = document.querySelectorAll('[name="live"]');
const liveUntil = document.getElementById('live-until');

// Weekly shows

function select(label, options, value, onChange) {
  const wrapper = document.createElement('label');
  wrapper.textContent = label;
  const list = document.createElement('select');
  options.forEach(([optionValue, text]) => list.add(new Option(text, optionValue, false, optionValue === value)));
  list.addEventListener('change', () => onChange(Number(list.value)));
  wrapper.append(list);
  return wrapper;
}

const hours = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => [from + i, formatHour(from + i)]);

function fillShowList() {
  showList.replaceChildren(...content.shows.map((show, index) => {
    const row = document.createElement('li');
    row.className = 'show-row';

    const update = (field) => (value) => {
      change((draft) => {
        const edited = draft.shows[index];
        edited[field] = value;
        // Keep the end after the start, so the show always makes sense.
        if (edited.end <= edited.start) edited.end = Math.min(24, edited.start + 1);
        if (edited.start >= edited.end) edited.start = edited.end - 1;
      });
      fillShowList();
      showList.children[index]?.querySelectorAll('select')[['day', 'start', 'end'].indexOf(field)].focus();
    };

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'link-button';
    remove.textContent = `Remove the ${DAYS[show.day]} show`;
    remove.addEventListener('click', () => {
      change((draft) => {
        draft.shows.splice(index, 1);
      });
      fillShowList();
      addShow.focus();
    });

    row.append(
      select('Day', WEEK.map((day) => [day, DAYS[day]]), show.day, update('day')),
      select('Starts', hours(0, 23), show.start, update('start')),
      select('Ends', hours(1, 24), show.end, update('end')),
      remove,
    );
    return row;
  }));
  addShow.disabled = content.shows.length >= MAX_SHOWS;
}

addShow.addEventListener('click', () => {
  change((draft) => {
    draft.shows.push({ day: 1, start: 10, end: 12 });
  });
  fillShowList();
  showList.lastElementChild.querySelector('select').focus();
});

// Going live

function minutesUntilUkMidnight() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  return 24 * 60 - (value('hour') * 60 + value('minute'));
}

function liveEnd(mode) {
  const minutes = mode === 'on' ? LIVE_HOURS * 60 : minutesUntilUkMidnight();
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function fillLive() {
  const mode = liveSwitchMode(content.live);
  liveChoices.forEach((choice) => {
    choice.checked = choice.value === mode;
  });
  const time = mode === 'auto' ? '' : new Date(content.live.until)
    .toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: true });
  liveUntil.textContent = mode === 'on' ? `The website will say you're live until ${time}.` : '';
}

liveChoices.forEach((choice) => {
  choice.addEventListener('change', () => {
    change((draft) => {
      draft.live = choice.value === 'auto' ? { mode: 'auto' } : { mode: choice.value, until: liveEnd(choice.value) };
    });
    fillLive();
  });
});

export function fillShows() {
  fillShowList();
  fillLive();
}

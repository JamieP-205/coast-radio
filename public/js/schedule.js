// Show times, and whether Jim is live or the 24-hour playlist is on.

import { DAYS, formatHour, liveSwitchMode } from './shared.js';

// Jim live, or the 24-hour playlist. Worked out from the show times table so
// the times are only written down once. Times are UK time, wherever the
// listener is. Jim can also switch it by hand from the editor, for a show
// that isn't on the list or one he can't do.

const onAirTags = document.querySelectorAll('[data-on-air]');
const nextShowTexts = document.querySelectorAll('[data-next-show]');
const showsTable = document.querySelector('[data-shows]');

function readShows() {
  return [...showsTable.querySelectorAll('[data-day]')].map((row) => ({
    row,
    day: Number(row.dataset.day),
    start: Number(row.dataset.start),
    end: Number(row.dataset.end),
  }));
}

let shows = readShows();
let liveOverride = { mode: 'auto' };

function ukNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return { day: DAYS.indexOf(value('weekday')), minutes: Number(value('hour')) * 60 + Number(value('minute')) };
}

function nextShowMessage(now, notToday = false) {
  for (let ahead = notToday ? 1 : 0; ahead < 8; ahead += 1) {
    const day = (now.day + ahead) % 7;
    const next = shows.find((show) => show.day === day && (ahead > 0 || show.start * 60 > now.minutes));
    if (next) {
      const when = ahead === 0 ? 'Today' : ahead === 1 ? 'Tomorrow' : DAYS[day];
      return `Next live show: ${when} at ${formatHour(next.start)}.`;
    }
  }
  return 'See the show times.';
}

function liveMessage(now, live, override) {
  if (override === 'on') return 'Jim is live now.';
  if (live) return `Jim is live now, until ${formatHour(live.end)}.`;
  if (override === 'off') return `No live show today. ${nextShowMessage(now, true)}`;
  return nextShowMessage(now);
}

function updateLiveShow() {
  const now = ukNow();
  const override = liveSwitchMode(liveOverride);
  const live = override === 'off' ? undefined : shows.find((show) => show.day === now.day
    && now.minutes >= show.start * 60 && now.minutes < show.end * 60);
  const isLive = override === 'on' || Boolean(live);

  shows.forEach((show) => {
    show.row.classList.toggle('is-today', show.day === now.day && show !== live);
    show.row.classList.toggle('is-live', show === live);
  });

  onAirTags.forEach((tag) => {
    tag.textContent = isLive ? 'Jim is live' : '24-hour playlist';
    tag.classList.toggle('is-live', isLive);
  });

  const message = liveMessage(now, live, override);
  nextShowTexts.forEach((text) => {
    text.textContent = message;
  });
}

updateLiveShow();
setInterval(updateLiveShow, 60000);

// For the editor's content: the show times as they are now, and changing
// them or the live switch.

export function showTimes() {
  return shows.map(({ day, start, end }) => ({ day, start, end }));
}

export function setShowTimes(list) {
  // Monday first, like a printed schedule.
  const weekOrder = (day) => (day + 6) % 7;
  const rows = [...list]
    .sort((a, b) => weekOrder(a.day) - weekOrder(b.day) || a.start - b.start)
    .map(({ day, start, end }) => {
      const row = document.createElement('tr');
      Object.assign(row.dataset, { day, start, end });
      const dayCell = document.createElement('th');
      dayCell.scope = 'row';
      dayCell.textContent = DAYS[day];
      const timeCell = document.createElement('td');
      timeCell.textContent = `${formatHour(start)} to ${formatHour(end)}`;
      row.append(dayCell, timeCell);
      return row;
    });
  showsTable.replaceChildren(...rows);
  shows = readShows();
  updateLiveShow();
}

export function setLiveSwitch(live) {
  liveOverride = live || { mode: 'auto' };
  updateLiveShow();
}

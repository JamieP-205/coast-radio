// Visitors and listeners: anonymous daily counts from the song tracker, drawn
// as simple charts. Visits and Listen presses come from the website; listener
// numbers come from the stream, checked once a minute.

const STATS_URL = 'https://coast-history.jamieparr05.workers.dev/stats';
const SVG = 'http://www.w3.org/2000/svg';
const DAY_MS = 86400000;

const panel = document.querySelector('[data-panel="stats"]');
const tip = panel.querySelector('.chart-tip');
let data = null;
let range = 30;

const dateOf = (iso) => new Date(`${iso}T12:00:00Z`);
const isoOf = (date) => date.toISOString().slice(0, 10);
const short = (iso) => dateOf(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const long = (iso) => dateOf(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const plural = (n, word) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`;

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
}

// One row per day in the chosen range, including quiet days with no visits.
function daysInRange() {
  const byDate = new Map(data.days.map((row) => [row[0], row]));
  const first = data.days[0][0];
  const end = dateOf(todayIso());
  const start = range ? new Date(Math.max(dateOf(first), end - (range - 1) * DAY_MS)) : dateOf(first);
  const rows = [];
  for (let at = start; at <= end; at = new Date(at.getTime() + DAY_MS)) {
    const iso = isoOf(at);
    const [, visits = 0, views = 0, listens = 0, peak = null, average = null, requests = 0] = byDate.get(iso) || [];
    rows.push({ iso, visits, views, listens, peak, average, requests });
  }
  return rows;
}

function niceMax(value) {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].map((m) => m * step).find((n) => n >= value);
}

function el(name, attributes = {}, parent) {
  const node = document.createElementNS(SVG, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  parent?.append(node);
  return node;
}

function showTip(event, text) {
  tip.textContent = text;
  tip.hidden = false;
  const box = panel.getBoundingClientRect();
  const x = Math.min(event.clientX - box.left + 12, box.width - tip.offsetWidth - 8);
  tip.style.left = `${Math.max(8, x)}px`;
  tip.style.top = `${event.clientY - box.top - tip.offsetHeight - 12 + panel.scrollTop}px`;
}

function hideTip() {
  tip.hidden = true;
}

// A bar or line chart over days, with a hover label for each day and a
// hidden table for screen readers.
function drawChart(holder, rows, value, { kind, describe }) {
  // Drawn at the space available, so text stays the same size on any screen.
  const W = Math.max(300, Math.round(holder.clientWidth || 640));
  const H = 190;
  const left = 34;
  const bottom = 24;
  const top = 8;
  const innerW = W - left - 6;
  const innerH = H - top - bottom;
  const values = rows.map(value);
  const max = niceMax(Math.max(0, ...values.filter((v) => v !== null)));
  const y = (v) => top + innerH - (v / max) * innerH;
  const slot = innerW / rows.length;

  holder.replaceChildren();
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'chart' }, holder);

  [0, max / 2, max].forEach((tick) => {
    el('line', { x1: left, x2: W - 6, y1: y(tick), y2: y(tick), class: 'chart-grid' }, svg);
    const label = el('text', { x: left - 8, y: y(tick) + 4, class: 'chart-axis', 'text-anchor': 'end' }, svg);
    label.textContent = Number.isInteger(tick) ? tick : tick.toFixed(1);
  });

  const marks = [];
  if (kind === 'bars') {
    const width = Math.max(2, slot - 2);
    rows.forEach((row, i) => {
      const v = values[i];
      const x = left + i * slot + (slot - width) / 2;
      const h = Math.max(0, (v / max) * innerH);
      const r = Math.min(4, width / 2, h);
      const base = top + innerH;
      const d = h > 0
        ? `M${x},${base}V${base - h + r}Q${x},${base - h} ${x + r},${base - h}H${x + width - r}Q${x + width},${base - h} ${x + width},${base - h + r}V${base}Z`
        : '';
      marks.push(d ? el('path', { d, class: 'chart-bar' }, svg) : null);
    });
  } else {
    let d = '';
    rows.forEach((row, i) => {
      const v = values[i];
      if (v === null) return;
      const command = d && values[i - 1] !== null ? 'L' : 'M';
      d += `${command}${left + i * slot + slot / 2},${y(v)}`;
    });
    el('path', { d, class: 'chart-line' }, svg);
    rows.forEach((row, i) => {
      const v = values[i];
      marks.push(v === null ? null : el('circle', { cx: left + i * slot + slot / 2, cy: y(v), r: 4, class: 'chart-dot' }, svg));
    });
  }

  const labelAt = [0, Math.floor((rows.length - 1) / 2), rows.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  labelAt.forEach((i) => {
    const anchor = i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle';
    const x = i === 0 ? left : i === rows.length - 1 ? W - 6 : left + i * slot + slot / 2;
    const text = el('text', { x, y: H - 6, class: 'chart-axis', 'text-anchor': anchor }, svg);
    text.textContent = short(rows[i].iso);
  });

  // Hover areas the full height of each day, wider than the marks themselves.
  rows.forEach((row, i) => {
    const hit = el('rect', { x: left + i * slot, y: top, width: slot, height: innerH, class: 'chart-hit' }, svg);
    hit.addEventListener('pointermove', (event) => {
      marks.forEach((mark, j) => mark?.classList.toggle('is-active', j === i));
      showTip(event, `${long(row.iso)}: ${describe(row)}`);
    });
    hit.addEventListener('pointerleave', () => {
      marks.forEach((mark) => mark?.classList.remove('is-active'));
      hideTip();
    });
  });

  const table = document.createElement('table');
  table.className = 'visually-hidden';
  table.innerHTML = '<tr><th>Day</th><th>Count</th></tr>';
  rows.forEach((row) => {
    const tr = table.insertRow();
    tr.insertCell().textContent = long(row.iso);
    tr.insertCell().textContent = describe(row);
  });
  holder.append(table);
}

// Ranked bars with the name and number written beside each one.
function drawRanking(list, rows) {
  list.replaceChildren();
  const top = Math.max(1, ...rows.map(([, n]) => n));
  rows.forEach(([label, n]) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'rank-name';
    name.textContent = label;
    const count = document.createElement('span');
    count.className = 'rank-count';
    count.textContent = n.toLocaleString('en-GB');
    const bar = document.createElement('span');
    bar.className = 'rank-bar';
    bar.style.setProperty('--share', `${(n / top) * 100}%`);
    item.append(name, count, bar);
    list.append(item);
  });
  if (!rows.length) list.innerHTML = '<li class="rank-empty">Nothing yet</li>';
}

function totals(entries, from) {
  const counts = new Map();
  entries.filter(([, date]) => date >= from).forEach(([label, , n]) => counts.set(label, (counts.get(label) || 0) + n));
  return [...counts].sort((a, b) => b[1] - a[1]);
}

const PAGE_NAMES = { home: 'Home', shows: 'Show times', songs: 'Songs', about: 'About Jim', requests: 'Requests', help: 'Help', privacy: 'Privacy' };

function render() {
  const empty = panel.querySelector('[data-stats-empty]');
  const body = panel.querySelector('[data-stats-body]');
  if (!data?.days.length) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;

  const rows = daysInRange();
  const from = rows[0].iso;
  const sum = (key) => rows.reduce((n, row) => n + (row[key] || 0), 0);
  const peaks = rows.map((row) => row.peak).filter((v) => v !== null);

  panel.querySelector('[data-tile="visits"]').textContent = sum('visits').toLocaleString('en-GB');
  panel.querySelector('[data-tile="listens"]').textContent = sum('listens').toLocaleString('en-GB');
  panel.querySelector('[data-tile="requests"]').textContent = sum('requests').toLocaleString('en-GB');
  panel.querySelector('[data-tile="peak"]').textContent = peaks.length ? Math.max(...peaks) : '–';
  panel.querySelector('[data-stats-since]').textContent = `Counting since ${short(data.days[0][0])}`;

  drawChart(panel.querySelector('[data-chart="visits"]'), rows, (row) => row.visits,
    { kind: 'bars', describe: (row) => `${plural(row.visits, 'visit')}, ${plural(row.views, 'page')} viewed${row.requests ? `, ${plural(row.requests, 'request')}` : ''}` });
  drawChart(panel.querySelector('[data-chart="listeners"]'), rows, (row) => row.peak,
    { kind: 'line', describe: (row) => (row.peak === null ? 'not counted yet' : `${row.peak} at most, ${row.average} on average`) });
  drawRanking(panel.querySelector('[data-rank="sources"]'), totals(data.sources, from));
  drawRanking(panel.querySelector('[data-rank="pages"]'), totals(data.pages, from).map(([page, n]) => [PAGE_NAMES[page] || page, n]));
}

// Redraw at the new width when the window changes size.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!panel.hidden) render();
  }, 150);
});

panel.querySelectorAll('[data-range]').forEach((button) => {
  button.addEventListener('click', () => {
    range = Number(button.dataset.range);
    panel.querySelectorAll('[data-range]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    render();
  });
});

export async function fillStats() {
  const status = panel.querySelector('[data-stats-status]');
  status.textContent = data ? '' : 'Loading…';
  try {
    const response = await fetch(STATS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    data = await response.json();
    status.textContent = '';
  } catch {
    status.textContent = data ? '' : "The numbers couldn't be loaded. Try again in a minute.";
  }
  render();
}

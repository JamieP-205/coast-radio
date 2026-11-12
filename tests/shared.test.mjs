import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatHour, liveSwitchMode, retryDelay } from '../public/js/shared.js';

test('hours are written the way the station says them', () => {
  assert.equal(formatHour(0), 'midnight');
  assert.equal(formatHour(10), '10am');
  assert.equal(formatHour(12), '12 noon');
  assert.equal(formatHour(13), '1pm');
  assert.equal(formatHour(24), 'midnight');
});

test('the live switch follows the show times unless Jim set it', () => {
  assert.equal(liveSwitchMode({ mode: 'auto' }), 'auto');
});

test('the live switch lasts until the time Jim chose, then turns itself off', () => {
  const inAnHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  assert.equal(liveSwitchMode({ mode: 'on', until: inAnHour }), 'on');
  assert.equal(liveSwitchMode({ mode: 'off', until: inAnHour }), 'off');
  assert.equal(liveSwitchMode({ mode: 'on', until: anHourAgo }), 'auto');
});

// Every wait the player makes before it gives up, in seconds.
function allRetryWaits() {
  const waits = [];
  for (let attempt = 0; retryDelay(attempt) !== null; attempt += 1) {
    waits.push(retryDelay(attempt) / 1000);
    assert.ok(attempt < 100, 'the player never stops trying');
  }
  return waits;
}

test('a dropped stream is tried again after two seconds', () => {
  assert.equal(retryDelay(0), 2000);
});

test('the waits between retries never get shorter and never pass thirty seconds', () => {
  const waits = allRetryWaits();
  assert.ok(waits.length > 1);
  waits.forEach((wait, index) => {
    assert.ok(wait <= 30, `wait ${index + 1} is ${wait} seconds`);
    if (index > 0) assert.ok(wait >= waits[index - 1], `wait ${index + 1} is shorter than the one before`);
  });
});

test('the player stops retrying after the last attempt so it can ask the listener', () => {
  const tries = allRetryWaits().length;
  assert.equal(retryDelay(tries), null);
  assert.equal(retryDelay(tries + 10), null);
});

test('the player gives up after between two and three minutes of trying', () => {
  const total = allRetryWaits().reduce((sum, wait) => sum + wait, 0);
  assert.ok(total >= 120 && total <= 180, `total wait is ${total} seconds`);
});

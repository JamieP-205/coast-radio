import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatHour, liveSwitchMode } from '../public/js/shared.js';

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

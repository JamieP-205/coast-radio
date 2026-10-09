import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TEXT_FIELDS, validateContent } from '../netlify/lib/content.mjs';

function goodContent() {
  return {
    colours: 'sea',
    text: Object.fromEntries(Object.keys(TEXT_FIELDS).map((key) => [key, `Some ${key} words`])),
    photos: {
      studio: { src: 'images/jim-studio.webp', alt: 'Jim at the microphone' },
      about: { src: '/api/photos/0f8fad5b-d9cb-469f-a165-70867728950e', alt: 'Jim with his dog' },
    },
    contacts: {
      phone: '07935 889228',
      email: 'coastradio@hotmail.com',
      facebook: 'https://www.facebook.com/share/1aN1Jtus5Y/',
      x: 'https://x.com/coast_radio',
      donate: 'https://www.paypal.com/donate/?hosted_button_id=QYFZXU895WSE8',
    },
    announcement: { show: true, text: 'No show this Friday', link: '' },
    news: { title: 'New studio', date: 'October 2026', text: 'Jim has a new microphone.' },
    home: [{ id: 'news', show: true }, { id: 'played', show: true }, { id: 'welcome', show: false }],
    shows: [{ day: 1, start: 10, end: 12 }, { day: 0, start: 10, end: 13 }],
    live: { mode: 'on', until: '2026-10-09T13:00:00.000Z' },
  };
}

test('good content passes and keeps its order and choices', () => {
  const { content, errors } = validateContent(goodContent());
  assert.equal(errors, undefined);
  assert.equal(content.colours, 'sea');
  assert.deepEqual(content.home.map((section) => section.id), ['news', 'played', 'welcome']);
  assert.equal(content.live.mode, 'on');
});

test('unknown fields are dropped', () => {
  const input = goodContent();
  input.script = '<script>alert(1)</script>';
  input.text.somethingElse = 'not allowed';
  const { content } = validateContent(input);
  assert.equal('script' in content, false);
  assert.equal('somethingElse' in content.text, false);
});

test('an empty heading is refused with a message Jim can understand', () => {
  const input = goodContent();
  input.text.welcomeTitle = '   ';
  const { errors } = validateContent(input);
  assert.ok(errors.includes('The welcome heading can\'t be empty.'));
});

test('text that is too long is refused', () => {
  const input = goodContent();
  input.text.heroTitle = 'x'.repeat(200);
  const { errors } = validateContent(input);
  assert.match(errors[0], /too long/);
});

test('links must be https and photos must come from the site', () => {
  const input = goodContent();
  input.contacts.donate = 'javascript:alert(1)';
  input.photos.studio.src = 'https://elsewhere.example/photo.jpg';
  const { errors } = validateContent(input);
  assert.ok(errors.some((error) => error.includes('donate link')));
  assert.ok(errors.includes('One of the photos is missing.'));
});

test('a show that ends before it starts is refused', () => {
  const input = goodContent();
  input.shows.push({ day: 2, start: 12, end: 10 });
  const { errors } = validateContent(input);
  assert.ok(errors.includes('Each show needs to finish after it starts.'));
});

test('the home page must keep all three sections', () => {
  const input = goodContent();
  input.home.pop();
  const { errors } = validateContent(input);
  assert.ok(errors.some((error) => error.includes('home page sections')));
});

test('a shown announcement needs words', () => {
  const input = goodContent();
  input.announcement.text = '';
  const { errors } = validateContent(input);
  assert.ok(errors.includes('The announcement needs some words.'));
});

test('an unknown colour theme falls back to navy', () => {
  const input = goodContent();
  input.colours = 'neon';
  assert.equal(validateContent(input).content.colours, 'navy');
});

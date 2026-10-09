import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksLikePhoto } from '../netlify/functions/upload.mjs';

const bytes = (...values) => new Uint8Array(values);
const text = (value) => new Uint8Array([...value].map((letter) => letter.charCodeAt(0)));

test('real JPG, PNG and WebP photos are accepted', () => {
  assert.equal(looksLikePhoto('image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)), true);
  assert.equal(looksLikePhoto('image/png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a)), true);
  assert.equal(looksLikePhoto('image/webp', text('RIFF\0\0\0\0WEBP')), true);
});

test('a file that only claims to be a photo is refused', () => {
  assert.equal(looksLikePhoto('image/png', text('<!doctype html>')), false);
  assert.equal(looksLikePhoto('image/jpeg', bytes(0x89, 0x50, 0x4e, 0x47)), false);
});

test('other kinds of file are refused', () => {
  assert.equal(looksLikePhoto('image/svg+xml', text('<svg>')), false);
  assert.equal(looksLikePhoto('text/html', text('<html>')), false);
});

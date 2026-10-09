import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkPassword,
  hashPassword,
  isSameOrigin,
  isValidSessionToken,
  makeSessionToken,
  readCookie,
  sameText,
} from '../netlify/lib/auth.mjs';

const SECRET = 'a'.repeat(64);

test('the right password matches its hash and a wrong one does not', () => {
  const stored = hashPassword('correct horse battery');
  assert.equal(checkPassword('correct horse battery', stored), true);
  assert.equal(checkPassword('correct horse batterz', stored), false);
});

test('the same password hashes differently each time', () => {
  assert.notEqual(hashPassword('same password here'), hashPassword('same password here'));
});

test('a broken stored hash never lets anyone in', () => {
  assert.equal(checkPassword('anything', ''), false);
  assert.equal(checkPassword('anything', 'no-colon'), false);
  assert.equal(checkPassword('anything', 'salt:not-hex'), false);
});

test('usernames are compared exactly', () => {
  assert.equal(sameText('jim', 'jim'), true);
  assert.equal(sameText('jim', 'Jim'), false);
});

test('a session token is valid until it expires', () => {
  const now = Date.now();
  const token = makeSessionToken(SECRET, now);
  assert.equal(isValidSessionToken(token, SECRET, now), true);
  assert.equal(isValidSessionToken(token, SECRET, now + 31 * 24 * 60 * 60 * 1000), false);
});

test('a session token can\'t be stretched or signed with another secret', () => {
  const token = makeSessionToken(SECRET);
  const [expires, signature] = token.split('.');
  assert.equal(isValidSessionToken(`${Number(expires) + 1000}.${signature}`, SECRET), false);
  assert.equal(isValidSessionToken(token, 'b'.repeat(64)), false);
  assert.equal(isValidSessionToken('rubbish', SECRET), false);
  assert.equal(isValidSessionToken('', SECRET), false);
});

test('cookies are read by name', () => {
  const req = new Request('https://example.com', { headers: { cookie: 'a=1; coast_session=abc.def; b=2' } });
  assert.equal(readCookie(req, 'coast_session'), 'abc.def');
  assert.equal(readCookie(req, 'missing'), '');
});

test('only requests from the same website count as same-origin', () => {
  const ours = new Request('https://coastinternetradio.com/api/draft', { headers: { origin: 'https://coastinternetradio.com' } });
  const theirs = new Request('https://coastinternetradio.com/api/draft', { headers: { origin: 'https://evil.example' } });
  const none = new Request('https://coastinternetradio.com/api/draft');
  assert.equal(isSameOrigin(ours), true);
  assert.equal(isSameOrigin(theirs), false);
  assert.equal(isSameOrigin(none), false);
});

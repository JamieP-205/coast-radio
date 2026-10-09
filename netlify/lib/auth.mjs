// Sign-in for the website editor.
//
// The password is never stored. Netlify keeps a scrypt hash of it in the
// ADMIN_PASSWORD_HASH environment variable, made with
// `npm run hash-password`. After signing in, the browser gets a cookie that
// holds an expiry time signed with SESSION_SECRET, so it can't be forged or
// stretched.

import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'coast_session';
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const attempt = scryptSync(String(password), salt, expected.length || 32);
  return expected.length === attempt.length && timingSafeEqual(attempt, expected);
}

// Compares two strings in constant time, so the time taken doesn't hint at
// how much of a guessed username was right.
export function sameText(a, b) {
  const digest = (value) => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function makeSessionToken(secret, now = Date.now()) {
  const expires = String(now + SESSION_MS);
  return `${expires}.${sign(expires, secret)}`;
}

export function isValidSessionToken(token, secret, now = Date.now()) {
  if (!token || !secret) return false;
  const [expires, signature] = String(token).split('.');
  if (!expires || !signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = Buffer.from(sign(expires, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  return timingSafeEqual(expected, given) && Number(expires) > now;
}

export function readCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  const match = header.split(/;\s*/).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/api; Max-Age=${SESSION_MS / 1000}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function isSignedIn(req) {
  return isValidSessionToken(readCookie(req, SESSION_COOKIE), process.env.SESSION_SECRET);
}

// Changes must come from the editor on this website, not from another site
// the browser happens to have open.
export function isSameOrigin(req) {
  const origin = req.headers.get('origin');
  return Boolean(origin) && origin === new URL(req.url).origin;
}

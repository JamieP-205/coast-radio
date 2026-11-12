// The sign-in and publish functions, run against a local copy of Netlify
// Blobs. BlobsServer comes with @netlify/blobs and keeps everything in a
// temporary folder on this computer, so nothing reaches the real website.

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { getStore } from '@netlify/blobs';
import { BlobsServer } from '@netlify/blobs/server';
import { hashPassword, makeSessionToken, SESSION_COOKIE } from '../netlify/lib/auth.mjs';
import { TEXT_FIELDS } from '../netlify/lib/content.mjs';
import login from '../netlify/functions/login.mjs';
import publish from '../netlify/functions/publish.mjs';

const SITE = 'https://coast.example';
const SECRET = 'a'.repeat(64);
const TOKEN = 'test-token';

let server;
let folder;

before(async () => {
  folder = await mkdtemp(join(tmpdir(), 'coast-blobs-'));
  server = new BlobsServer({ directory: folder, token: TOKEN });
  const { port } = await server.start();
  const url = `http://localhost:${port}`;
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({
    siteID: 'test-site', token: TOKEN, edgeURL: url, uncachedEdgeURL: url,
  })).toString('base64');
  process.env.ADMIN_USERNAME = 'jim';
  process.env.ADMIN_PASSWORD_HASH = hashPassword('the right password');
  process.env.SESSION_SECRET = SECRET;
});

after(async () => {
  await server.stop();
  await rm(folder, { recursive: true, force: true });
});

function signIn(body, origin = SITE) {
  return new Request(`${SITE}/api/login`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function triesFrom(ip) {
  const store = getStore({ name: 'coast-site', consistency: 'strong' });
  const tries = await store.get(`login-tries/${encodeURIComponent(ip)}`, { type: 'json' });
  return tries?.count ?? 0;
}

test('a wrong password is refused and counted', async () => {
  const ip = '192.0.2.1';
  const response = await login(signIn({ username: 'jim', password: 'wrong' }), { ip });
  assert.equal(response.status, 401);
  assert.equal(await triesFrom(ip), 1);
  await login(signIn({ username: 'nobody', password: 'wrong' }), { ip });
  assert.equal(await triesFrom(ip), 2);
});

test('after five wrong tries, signing in is paused even with the right password', async () => {
  const ip = '192.0.2.2';
  for (let i = 0; i < 5; i += 1) {
    const response = await login(signIn({ username: 'jim', password: 'wrong' }), { ip });
    assert.equal(response.status, 401);
  }
  const response = await login(signIn({ username: 'jim', password: 'the right password' }), { ip });
  assert.equal(response.status, 429);
});

test('the right username and password give a locked-down session cookie', async () => {
  const response = await login(signIn({ username: 'jim', password: 'the right password' }), { ip: '192.0.2.3' });
  assert.equal(response.status, 204);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=`));
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict']) {
    assert.ok(cookie.split('; ').includes(flag), `cookie is missing ${flag}`);
  }
});

function publishRequest({ signedIn, origin }) {
  const headers = { origin, 'content-type': 'application/json' };
  if (signedIn) headers.cookie = `${SESSION_COOKIE}=${makeSessionToken(SECRET)}`;
  return new Request(`${SITE}/api/publish`, { method: 'POST', headers, body: '{}' });
}

test('publishing needs a session', async () => {
  const response = await publish(publishRequest({ signedIn: false, origin: SITE }));
  assert.equal(response.status, 401);
});

test('publishing is refused when the request comes from another site', async () => {
  const response = await publish(publishRequest({ signedIn: true, origin: 'https://elsewhere.example' }));
  assert.equal(response.status, 403);
});

// The editor's letter limits are typed out again in words.js, which touches
// `document`, so it is read as text.
test('the editor and the server use the same letter limits', async () => {
  const words = await readFile(new URL('../public/admin/js/panels/words.js', import.meta.url), 'utf8');
  const inEditor = Object.fromEntries(
    [...words.matchAll(/key: '(\w+)'.*?max: (\d+)/g)].map(([, key, max]) => [key, Number(max)]),
  );
  const onServer = Object.fromEntries(Object.entries(TEXT_FIELDS).map(([key, { max }]) => [key, max]));
  assert.deepEqual(inEditor, onServer);
});

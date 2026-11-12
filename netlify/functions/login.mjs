// POST /api/login: checks the username and password and, if they're right,
// gives the browser a signed session cookie. After five wrong tries from the
// same connection, signing in is paused for 15 minutes.

import { checkPassword, isSameOrigin, makeSessionToken, sameText, sessionCookie } from '../lib/auth.mjs';
import { message, siteStore } from '../lib/store.mjs';

const MAX_TRIES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export default async (req, context) => {
  if (!isSameOrigin(req)) return message('That request came from somewhere else.', 403);

  const { ADMIN_USERNAME, ADMIN_PASSWORD_HASH, SESSION_SECRET } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !SESSION_SECRET) {
    return message('The editor hasn\'t been set up yet.', 500);
  }

  const store = siteStore();
  const triesKey = `login-tries/${encodeURIComponent(context.ip)}`;
  const tries = (await store.get(triesKey, { type: 'json' })) || { count: 0, since: Date.now() };
  const lockedOut = tries.count >= MAX_TRIES && Date.now() - tries.since < LOCKOUT_MS;
  if (lockedOut) return message('Too many wrong tries. Please wait 15 minutes and try again.', 429);

  const { username = '', password = '' } = await req.json().catch(() => ({}));
  // Both checks always run, so a wrong username takes as long as a wrong password.
  const usernameRight = sameText(String(username).trim(), ADMIN_USERNAME);
  const passwordRight = checkPassword(password, ADMIN_PASSWORD_HASH);
  const correct = usernameRight && passwordRight;

  if (!correct) {
    const fresh = Date.now() - tries.since >= LOCKOUT_MS;
    await store.setJSON(triesKey, { count: fresh ? 1 : tries.count + 1, since: fresh ? Date.now() : tries.since });
    return message('That username or password isn\'t right.', 401);
  }

  await store.delete(triesKey);
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': sessionCookie(makeSessionToken(SESSION_SECRET)), 'Cache-Control': 'no-store' },
  });
};

export const config = {
  path: '/api/login',
  method: 'POST',
  // Netlify turns away more than 10 sign-in attempts a minute from one
  // connection before this function runs, so many tries sent at once can't
  // slip past the count above.
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

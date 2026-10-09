// POST /api/logout: removes the session cookie.

import { clearedSessionCookie } from '../lib/auth.mjs';

export default async () => new Response(null, {
  status: 204,
  headers: { 'Set-Cookie': clearedSessionCookie(), 'Cache-Control': 'no-store' },
});

export const config = {
  path: '/api/logout',
  method: 'POST',
};

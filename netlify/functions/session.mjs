// GET /api/session: tells the editor page whether this browser is signed in.

import { isSignedIn } from '../lib/auth.mjs';

export default async (req) => Response.json(
  { signedIn: isSignedIn(req) },
  { headers: { 'Cache-Control': 'no-store' } },
);

export const config = {
  path: '/api/session',
  method: 'GET',
};

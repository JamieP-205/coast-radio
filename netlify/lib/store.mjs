// Where the editor keeps things, in Netlify Blobs.
//
// coast-site holds the draft Jim is working on, the published version that
// listeners see, and the last few published versions so Undo can go back.
// coast-photos holds the photos Jim uploads.

import { getStore } from '@netlify/blobs';
import { purgeCache } from '@netlify/functions';
import { isSameOrigin, isSignedIn } from './auth.mjs';

export const HISTORY_LENGTH = 10;

export function siteStore() {
  return getStore({ name: 'coast-site', consistency: 'strong' });
}

export function photoStore() {
  return getStore({ name: 'coast-photos', consistency: 'strong' });
}

// Clears listeners' cached copy of the website's content. If it can't (for
// example when testing on a computer), the copy refreshes itself within five
// minutes anyway, so publishing still counts as done.
export async function refreshListenerCopy() {
  try {
    await purgeCache({ tags: ['content'] });
  } catch (error) {
    console.error('Could not clear the cached content:', error.message);
  }
}

export function message(text, status) {
  return Response.json({ message: text }, { status, headers: { 'Cache-Control': 'no-store' } });
}

// Every editor request must be signed in, and anything that changes the
// website must also come from this website's own editor page.
export function refuseUnlessEditor(req, { changesSomething = false } = {}) {
  if (!isSignedIn(req)) return message('Please sign in again.', 401);
  if (changesSomething && !isSameOrigin(req)) return message('That request came from somewhere else.', 403);
  return null;
}

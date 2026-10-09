// GET /api/content: the version of the website Jim last published.
//
// Netlify's CDN keeps a copy for up to five minutes, so listeners don't run
// this function on every visit. Publishing clears that copy straight away
// using the "content" cache tag; the five minutes is only a safety net.

import { siteStore } from '../lib/store.mjs';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': 'public, durable, max-age=300',
  'Netlify-Cache-Tag': 'content',
};

export default async () => {
  const published = await siteStore().get('published', { type: 'json' });
  if (!published) return new Response(null, { status: 204, headers: CACHE_HEADERS });
  return Response.json(published, { headers: CACHE_HEADERS });
};

export const config = {
  path: '/api/content',
  method: 'GET',
};

// GET /api/photos/:key: a photo Jim uploaded. Each upload gets a new key and
// never changes, so browsers and the CDN can keep it for a year.

import { photoStore } from '../lib/store.mjs';

const KEY = /^[0-9a-f-]{36}$/;

export default async (req, context) => {
  const { key } = context.params;
  if (!KEY.test(key)) return new Response('Not found', { status: 404 });

  const photo = await photoStore().getWithMetadata(key, { type: 'arrayBuffer' });
  if (!photo) return new Response('Not found', { status: 404 });

  return new Response(photo.data, {
    headers: {
      'Content-Type': photo.metadata.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

export const config = {
  path: '/api/photos/:key',
  method: 'GET',
};

// GET /api/draft: the draft Jim is working on, plus what's currently live.
// PUT /api/draft: saves the draft after checking it. Nothing here changes
// the website listeners see; that only happens when Jim publishes.

import { validateContent } from '../lib/content.mjs';
import { refuseUnlessEditor, siteStore } from '../lib/store.mjs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export default async (req) => {
  const refused = refuseUnlessEditor(req, { changesSomething: req.method === 'PUT' });
  if (refused) return refused;

  const store = siteStore();

  if (req.method === 'GET') {
    const [draft, published] = await Promise.all([
      store.get('draft', { type: 'json' }),
      store.get('published', { type: 'json' }),
    ]);
    return Response.json({ draft, published }, { headers: NO_STORE });
  }

  const { content, errors } = validateContent(await req.json().catch(() => null));
  if (errors) return Response.json({ message: errors[0], errors }, { status: 422, headers: NO_STORE });

  await store.setJSON('draft', content);
  return Response.json({ content }, { headers: NO_STORE });
};

export const config = {
  path: '/api/draft',
  method: ['GET', 'PUT'],
};

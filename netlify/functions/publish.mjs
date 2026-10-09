// POST /api/publish: puts Jim's changes on the website. The version that was
// live is kept, so Undo can bring it back.

import { validateContent } from '../lib/content.mjs';
import { HISTORY_LENGTH, refreshListenerCopy, refuseUnlessEditor, siteStore } from '../lib/store.mjs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export default async (req) => {
  const refused = refuseUnlessEditor(req, { changesSomething: true });
  if (refused) return refused;

  const { content, errors } = validateContent(await req.json().catch(() => null));
  if (errors) return Response.json({ message: errors[0], errors }, { status: 422, headers: NO_STORE });

  const store = siteStore();
  const previous = await store.get('published', { type: 'json' });
  if (previous) {
    const history = (await store.get('history', { type: 'json' })) || [];
    history.unshift(previous);
    await store.setJSON('history', history.slice(0, HISTORY_LENGTH));
  }

  const publishedAt = new Date().toISOString();
  await store.setJSON('published', { ...content, publishedAt });
  await store.setJSON('draft', content);
  await refreshListenerCopy();

  return Response.json({ publishedAt }, { headers: NO_STORE });
};

export const config = {
  path: '/api/publish',
  method: 'POST',
};

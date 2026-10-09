// POST /api/undo: puts back the version that was live before the last
// publish. Undoing the very first publish takes the website back to how it
// was built, before the editor was ever used.

import { message, refreshListenerCopy, refuseUnlessEditor, siteStore } from '../lib/store.mjs';

export default async (req) => {
  const refused = refuseUnlessEditor(req, { changesSomething: true });
  if (refused) return refused;

  const store = siteStore();
  const published = await store.get('published', { type: 'json' });
  if (!published) return message('There\'s nothing to undo yet.', 409);

  const history = (await store.get('history', { type: 'json' })) || [];
  const [previous, ...older] = history;

  if (previous) {
    await store.setJSON('published', { ...previous, publishedAt: new Date().toISOString() });
    const { publishedAt, ...draft } = previous;
    await store.setJSON('draft', draft);
    await store.setJSON('history', older);
  } else {
    await store.delete('published');
    await store.delete('draft');
  }
  await refreshListenerCopy();

  return Response.json({ restored: previous ? 'earlier' : 'original' }, { headers: { 'Cache-Control': 'no-store' } });
};

export const config = {
  path: '/api/undo',
  method: 'POST',
};

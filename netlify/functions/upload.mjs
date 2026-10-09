// POST /api/photos: stores a photo Jim has chosen. The editor shrinks photos
// before sending them, so this only needs to check they're a sensible size
// and really are images.

import { photoStore, refuseUnlessEditor } from '../lib/store.mjs';

const MAX_BYTES = 4 * 1024 * 1024;

// The first few bytes of each kind of photo the website accepts, so a file
// can't claim to be a photo when it's something else.
const SIGNATURES = {
  'image/jpeg': (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) => [0x89, 0x50, 0x4e, 0x47].every((byte, i) => bytes[i] === byte),
  'image/webp': (bytes) => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP',
};

export function looksLikePhoto(type, bytes) {
  return Boolean(SIGNATURES[type]?.(bytes));
}

function refuse(text, status) {
  return Response.json({ message: text }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default async (req) => {
  const refused = refuseUnlessEditor(req, { changesSomething: true });
  if (refused) return refused;

  const form = await req.formData().catch(() => null);
  const photo = form?.get('photo');
  if (!(photo instanceof File)) return refuse('Please choose a photo.', 400);
  if (photo.size > MAX_BYTES) return refuse('That photo is too big. Please choose a smaller one.', 413);

  const data = await photo.arrayBuffer();
  if (!looksLikePhoto(photo.type, new Uint8Array(data.slice(0, 12)))) return refuse('That file isn\'t a photo the website can use. Please choose a JPG or PNG.', 415);

  const key = crypto.randomUUID();
  await photoStore().set(key, data, { metadata: { type: photo.type } });
  return Response.json({ src: `/api/photos/${key}` }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
};

export const config = {
  path: '/api/photos',
  method: 'POST',
};

// Checks for what Jim types, using the same rules as netlify/lib/content.mjs,
// so anything that looks right here will also save.

export function isWebLink(text) {
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

export const isPhone = (value) => /^[0-9 +()]{7,20}$/.test(value);

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

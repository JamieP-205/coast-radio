// Checks for what Jim types, using the same rules as netlify/lib/content.mjs,
// so anything that looks right here will also save.

export function isWebLink(text) {
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

// Each contact link may only go to its own site, so a stolen sign-in can't
// point listeners somewhere harmful.
export const LINK_SITES = {
  facebook: ['facebook.com'],
  x: ['x.com', 'twitter.com'],
  donate: ['paypal.com', 'paypal.me'],
};

export function isLinkTo(text, sites) {
  if (!isWebLink(text)) return false;
  const host = new URL(text).hostname.toLowerCase();
  return sites.some((site) => host === site || host.endsWith(`.${site}`));
}

export const isPhone = (value) => /^[0-9 +()]{7,20}$/.test(value);

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

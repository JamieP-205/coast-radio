// Run on every deploy, before the tests. Makes shows.html, about.html,
// requests.html and help.html from index.html, so each page has its own
// address, title and description for search engines. They are the same
// website with a different page showing, so index.html stays the only file
// to edit. The copies are not kept in git.

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SITE = 'https://coastinternetradio.com';
export const EXTRA_PAGES = ['shows', 'about', 'requests', 'help'];

function pageAttribute(html, id, name) {
  const tag = html.match(new RegExp(`<div[^>]*data-page="${id}"[^>]*>`))?.[0];
  const value = tag?.match(new RegExp(`${name}="([^"]*)"`))?.[1];
  if (!value) throw new Error(`The ${id} page has no ${name}`);
  return value;
}

function setTag(html, pattern, replacement) {
  if (!pattern.test(html)) throw new Error(`index.html is missing ${pattern}`);
  return html.replace(pattern, replacement);
}

export function buildPage(index, id) {
  const title = pageAttribute(index, id, 'data-title');
  const description = pageAttribute(index, id, 'data-description');
  const address = `${SITE}/${id}`;

  let html = index;
  html = setTag(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = setTag(html, /(<meta name="description" content=")[^"]*/, `$1${description}`);
  html = setTag(html, /(<link rel="canonical" href=")[^"]*/, `$1${address}`);
  html = setTag(html, /(<meta property="og:url" content=")[^"]*/, `$1${address}`);
  html = setTag(html, /(<meta property="og:title" content=")[^"]*/, `$1${title}`);
  html = setTag(html, /(<meta property="og:description" content=")[^"]*/, `$1${description}`);

  // The station's details belong to the home page alone.
  html = setTag(html, /\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');

  // Show this page and hide the others.
  html = html.replace(/<div class="page" data-page="(\w+)"( hidden)?/g, (_, page) => (
    `<div class="page" data-page="${page}"${page === id ? '' : ' hidden'}`
  ));

  // Netlify registers each form from index.html. forms.js posts to / either way.
  return html.replace(/ data-netlify="true" netlify-honeypot="bot-field"/g, '');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = (name) => new URL(`../public/${name}`, import.meta.url);
  const index = readFileSync(file('index.html'), 'utf8');
  for (const id of EXTRA_PAGES) writeFileSync(file(`${id}.html`), buildPage(index, id));
  console.log(`Built ${EXTRA_PAGES.length} pages`);
}

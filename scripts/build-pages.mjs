// Run on every deploy, before the tests. Makes shows.html, about.html,
// songs.html, requests.html, help.html and privacy.html from index.html, so each page has its own
// address, title and description for search engines. They are the same
// website with a different page showing, so index.html stays the only file
// to edit. The copies are not kept in git.

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SITE = 'https://coastinternetradio.com';
export const EXTRA_PAGES = ['shows', 'songs', 'about', 'requests', 'help', 'privacy'];

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

  return showOnly(html, id);
}

// Show this page. The others go in <template> tags, which browsers and
// search engines don't treat as part of the page; pages.js unpacks them.
function showOnly(source, id) {
  const html = source.replace(/<div class="page" data-page="(\w+)"( hidden)?[\s\S]*?\n    <\/div>(?=\n\n    <!--|\n  <\/main>)/g, (block, page) => {
    if (page === id) return block.replace(`data-page="${page}" hidden`, `data-page="${page}"`);
    const stored = block.replace(`data-page="${page}"${block.includes(`data-page="${page}" hidden`) ? ' hidden' : ''}`, `data-page="${page}" hidden`);
    return `<template data-stored-page="${page}">${stored}</template>`;
  });

  // Netlify registers the forms from form-definitions.html, so every page posts to /.
  return html
    .replace(/ data-netlify="true" netlify-honeypot="bot-field"/g, '')
    .replace(/<form class="form" name=/g, '<form class="form" action="/" name=');
}

export function buildHome(index) {
  return showOnly(index, 'home');
}

// A private page holding the forms exactly as written, for Netlify to detect.
export function buildFormDefinitions(index) {
  const forms = index.match(/<form class="form"[\s\S]*?<\/form>/g) ?? [];
  if (forms.length !== 2) throw new Error(`Expected 2 forms in index.html, found ${forms.length}`);
  return `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Coast Internet Radio forms</title></head>
<body hidden>
${forms.join('\n')}
</body>
</html>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = (name) => new URL(`../public/${name}`, import.meta.url);
  const index = readFileSync(file('index.html'), 'utf8');
  if (process.argv.includes('--home')) {
    // Last deploy step, after the tests, because they read the full index.html.
    writeFileSync(file('form-definitions.html'), buildFormDefinitions(index));
    writeFileSync(file('index.html'), buildHome(index));
    console.log('Built the home page and form definitions');
  } else {
    for (const id of EXTRA_PAGES) writeFileSync(file(`${id}.html`), buildPage(index, id));
    console.log(`Built ${EXTRA_PAGES.length} pages`);
  }
}

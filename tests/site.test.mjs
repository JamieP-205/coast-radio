// Contract tests: the page, the editor and Netlify all depend on details of
// public/index.html. These fail if an edit to the page quietly breaks one.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { COLOURS, HOME_SECTIONS, PHOTO_KEYS, TEXT_FIELDS } from '../netlify/lib/content.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../public/${path}`, import.meta.url));

const index = read('public/index.html').replace(/<!--[\s\S]*?-->/g, '');
const notFound = read('public/404.html').replace(/<!--[\s\S]*?-->/g, '');
const css = read('public/style.css');
const headers = read('public/_headers');
const serverSource = read('netlify/lib/content.mjs');
const scripts = Object.fromEntries(
  readdirSync(new URL('../public/js/', import.meta.url)).map((file) => [file, read(`public/js/${file}`)]),
);

// Every opening tag in some HTML, as { name, attrs }. Attributes without a value become ''.
function tagsIn(html) {
  const tagPattern = /<([a-zA-Z][\w-]*)((?:\s+[^\s>"'=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*\/?>/g;
  return [...html.matchAll(tagPattern)].map(([, name, rest]) => {
    const attrs = {};
    for (const [, key, double, single] of rest.matchAll(/([^\s"'=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) {
      attrs[key] = double ?? single ?? '';
    }
    return { name: name.toLowerCase(), attrs };
  });
}

// Opening tags of one kind, optionally only those that carry a given attribute.
function find(html, name, attribute) {
  return tagsIn(html).filter((tag) => tag.name === name && (!attribute || attribute in tag.attrs));
}

// Every tag that carries the attribute, whatever it is.
const withAttr = (html, attribute) => tagsIn(html).filter((tag) => attribute in tag.attrs);

// The text between <tag ...> and </tag> for each element that has the attribute, with its value.
function elementsWith(html, attribute) {
  const pattern = new RegExp(`<(\\w+)[^>]*\\s${attribute}="([^"]*)"[^>]*>([\\s\\S]*?)</\\1>`, 'g');
  return [...html.matchAll(pattern)].map(([, tag, value, inner]) => ({ tag, value, inner }));
}

// Plain text as a reader sees it: entities decoded, runs of whitespace collapsed.
function visibleText(html) {
  const entities = { amp: '&', copy: '©', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return html
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&(\w+);/g, (whole, name) => entities[name] ?? whole)
    .replace(/\s+/g, ' ')
    .trim();
}

// A regular expression the server keeps private, rebuilt from the server file.
function serverPattern(name) {
  const [, body] = serverSource.match(new RegExp(`const ${name} = /(.*)/;`));
  return new RegExp(body);
}

// The part of a page between one data-page marker and the next (or the end of <main>).
function pageSection(id) {
  const start = index.indexOf(`data-page="${id}"`);
  assert.notEqual(start, -1, `page ${id} is missing`);
  const rest = index.slice(start + 1);
  const next = rest.search(/data-page="|<\/main>/);
  return rest.slice(0, next);
}

// The sources listed for one directive in the Content-Security-Policy.
function policy(directive) {
  const line = headers.split('\n').find((text) => text.includes('Content-Security-Policy'));
  const part = line.split(';').map((text) => text.trim()).find((text) => text.startsWith(`${directive} `));
  return part ? part.split(/\s+/).slice(1) : [];
}

// Whether a URL's origin is allowed by a list of CSP sources (wildcard subdomains included).
function allowedBy(sources, url) {
  const { origin } = new URL(url);
  return sources.some((source) => {
    if (!source.startsWith('https://')) return false;
    const pattern = source.replace(/[.]/g, '\\.').replace('*', '[^.]+');
    return new RegExp(`^${pattern}$`).test(origin);
  });
}

const ids = new Set(withAttr(index, 'id').map((tag) => tag.attrs.id));
const dataKeys = elementsWith(index, 'data-edit').map((element) => element.value);

// The keys in the editor's WORDS list. The file touches `document`, so it is read as text.
function editorWordKeys() {
  const words = read('public/admin/js/panels/words.js');
  const list = words.slice(words.indexOf('const WORDS'), words.indexOf('const wordFields'));
  return [...list.matchAll(/key: '(\w+)'/g)].map(([, key]) => key);
}

test('the page, the server and the editor all know the same text fields', () => {
  const onPage = new Set(dataKeys);
  const onServer = Object.keys(TEXT_FIELDS);
  const inEditor = editorWordKeys();
  assert.deepEqual([...onPage].filter((key) => !onServer.includes(key)), [], 'on the page but not on the server');
  assert.deepEqual(onServer.filter((key) => !onPage.has(key)), [], 'on the server but not on the page');
  assert.deepEqual(inEditor.filter((key) => !onServer.includes(key)), [], 'in the editor but not on the server');
  assert.deepEqual(onServer.filter((key) => !inEditor.includes(key)), [], 'on the server but not in the editor');
});

test('every editable piece of text is plain, not empty and short enough to publish', () => {
  for (const { tag, value, inner } of elementsWith(index, 'data-edit')) {
    assert.ok(!inner.includes('<'), `${value} has tags inside it`);
    const text = visibleText(inner);
    assert.ok(text.length > 0, `${value} is empty`);
    const max = TEXT_FIELDS[value]?.max;
    assert.ok(text.length <= max, `${value} (${tag}) is ${text.length} letters but the limit is ${max}`);
  }
});

test('both editable photos use a source the server accepts and have a short description', () => {
  const photoSource = serverPattern('PHOTO_SOURCE');
  const photos = find(index, 'img', 'data-edit-photo');
  assert.deepEqual(photos.map((tag) => tag.attrs['data-edit-photo']).sort(), [...PHOTO_KEYS].sort());
  for (const { attrs } of photos) {
    assert.match(attrs.src, photoSource, `${attrs['data-edit-photo']} photo source`);
    assert.ok(attrs.alt.trim().length > 0 && attrs.alt.length <= 200, `${attrs['data-edit-photo']} alt text`);
  }
});

test('all five contact links exist and look the way the server expects', () => {
  const phoneRule = serverPattern('PHONE');
  const contacts = (kind) => elementsWith(index, 'data-contact').filter((item) => item.value === kind);
  for (const kind of ['phone', 'email', 'facebook', 'x', 'donate']) {
    assert.ok(contacts(kind).length > 0, `no ${kind} link`);
  }
  for (const tag of find(index, 'a', 'data-contact')) {
    const { 'data-contact': kind, href } = tag.attrs;
    if (['facebook', 'x', 'donate'].includes(kind)) assert.ok(href.startsWith('https://'), `${kind} link is ${href}`);
    if (kind === 'phone') assert.match(href, /^sms:\+44\d+$/);
    if (kind === 'email') assert.ok(href.startsWith('mailto:'), `email link is ${href}`);
  }
  for (const { inner } of contacts('phone')) assert.match(visibleText(inner), phoneRule);
});

test('the home page has the three sections the editor can reorder', () => {
  const sections = find(pageSection('home'), 'section', 'data-section').map((tag) => tag.attrs['data-section']);
  assert.deepEqual([...sections].sort(), [...HOME_SECTIONS].sort());
  assert.equal(withAttr(index, 'data-section').length, HOME_SECTIONS.length);
});

test('every row in the show times table has a day and a start and end time', () => {
  assert.equal(find(index, 'tbody', 'data-shows').length, 1);
  const body = index.match(/<tbody[^>]*data-shows[^>]*>([\s\S]*?)<\/tbody>/)[1];
  const rows = find(body, 'tr');
  assert.ok(rows.length > 0);
  for (const { attrs } of rows) {
    const [day, start, end] = [attrs['data-day'], attrs['data-start'], attrs['data-end']];
    for (const number of [day, start, end]) assert.match(number, /^\d+$/);
    assert.ok(Number(day) >= 0 && Number(day) <= 6, `day ${day}`);
    assert.ok(Number(end) > Number(start), `show ends at ${end} but starts at ${start}`);
  }
});

// Checks one Netlify form: its name, honeypot, hidden field, exact fields and the hooks forms.js uses.
function checkForm(name, fieldNames, required) {
  const [, attributes, inside] = index.match(new RegExp(`<form([^>]*name="${name}"[^>]*)>([\\s\\S]*?)</form>`));
  const form = tagsIn(`<form${attributes}>`)[0].attrs;
  assert.equal(form.method.toUpperCase(), 'POST');
  assert.equal(form['data-netlify'], 'true');
  assert.equal(form['netlify-honeypot'], 'bot-field');
  assert.ok('data-form' in form, 'data-form is missing');
  assert.ok(form['data-success'].trim().length > 0, 'data-success message is missing');

  const hidden = find(inside, 'input').find((tag) => tag.attrs.type === 'hidden');
  assert.deepEqual([hidden.attrs.name, hidden.attrs.value], ['form-name', name]);

  const fields = tagsIn(inside).filter((tag) => ['input', 'select', 'textarea'].includes(tag.name) && tag.attrs.type !== 'hidden');
  assert.deepEqual(fields.map((tag) => tag.attrs.name).sort(), [...fieldNames].sort());
  for (const field of fields) {
    assert.equal('required' in field.attrs, required.includes(field.attrs.name), `required on ${field.attrs.name}`);
  }
  assert.equal(find(inside, 'p', 'data-form-status').length, 1, 'status element');
  assert.ok(find(inside, 'button').some((tag) => tag.attrs.type === 'submit'), 'submit button');
}

test('the song request form matches what Netlify and the request receiver expect', () => {
  checkForm('song-request', ['bot-field', 'song', 'artist', 'name', 'message'], ['song', 'artist']);
});

test('the feedback form matches what Netlify expects', () => {
  checkForm('feedback', ['bot-field', 'type', 'message', 'name', 'contact'], ['message']);
});

test('no input asks for type="text", because the stylesheet styles inputs with no type', () => {
  assert.deepEqual(find(index, 'input').filter((tag) => tag.attrs.type === 'text'), []);
  assert.ok(css.includes('input:not([type])'));
});

test('every hook the scripts look for is in the page', () => {
  const idList = ['stream', 'player-status', 'now-art', 'now-song', 'now-artist', 'bar-art', 'bar-song', 'bar-artist',
    'full-art', 'full-song', 'full-artist', 'next-art', 'previously-played', 'player-view', 'volume', 'bar-volume', 'full-volume'];
  for (const id of idList) assert.ok(ids.has(id), `id ${id} is missing`);

  const attributes = ['data-open-player', 'data-close-player', 'data-on-air', 'data-next-show', 'data-coming-up', 'data-up-next',
    'data-volume-control', 'data-volume-note', 'data-mute', 'data-announcement', 'data-announcement-text',
    'data-announcement-link', 'data-news-title', 'data-news-date', 'data-news-text'];
  for (const attribute of attributes) assert.ok(withAttr(index, attribute).length > 0, `${attribute} is missing`);
  assert.equal(withAttr(index, 'data-play').length, 3, 'data-play buttons');
  assert.equal(withAttr(index, 'data-play-label').length, 3, 'data-play-label labels');

  const classes = new Set(tagsIn(index).flatMap((tag) => (tag.attrs.class ?? '').split(/\s+/)));
  for (const name of ['player-controls', 'player-bar', 'reading-tools', 'dark-toggle', 'nav']) {
    assert.ok(classes.has(name), `class ${name} is missing`);
  }
  const sizes = withAttr(index, 'data-size').map((tag) => tag.attrs['data-size']);
  assert.deepEqual(sizes.sort(), ['largest', 'large', 'standard'].sort());
});

test('the five pages each have a title, one focusable heading and a link in the menu', () => {
  const pages = ['home', 'shows', 'about', 'requests', 'help'];
  assert.deepEqual(withAttr(index, 'data-page').map((tag) => tag.attrs['data-page']), pages);
  const nav = index.match(/<ul class="nav">([\s\S]*?)<\/ul>/)[1];
  const links = find(nav, 'a').map((tag) => tag.attrs.href);
  for (const id of pages) {
    const page = find(index, 'div', 'data-page').find((tag) => tag.attrs['data-page'] === id);
    assert.ok(page.attrs['data-title']?.trim(), `${id} has no data-title`);
    const headings = find(pageSection(id), 'h1');
    assert.equal(headings.length, 1, `${id} should have one h1`);
    assert.equal(headings[0].attrs.tabindex, '-1', `${id} h1 needs tabindex="-1"`);
    assert.ok(links.includes(`#${id}`), `the menu has no link to #${id}`);
  }
});

test('the pages follow the Content-Security-Policy: no inline styles, scripts or handlers', () => {
  for (const [name, html] of [['index.html', index], ['404.html', notFound]]) {
    const tags = tagsIn(html);
    assert.deepEqual(tags.filter((tag) => 'style' in tag.attrs || tag.name === 'style'), [], `${name} has inline style`);
    assert.deepEqual(tags.filter((tag) => Object.keys(tag.attrs).some((key) => /^on/i.test(key))), [], `${name} has an event handler`);
    for (const { attrs } of tags.filter((tag) => tag.name === 'script')) {
      const local = attrs.src && !/^[a-z]+:|^\/\//i.test(attrs.src);
      assert.ok(local || attrs.type === 'application/ld+json', `${name} has a script that is neither local nor structured data`);
    }
  }
});

test('the structured data block is valid JSON', () => {
  const [, json] = index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.doesNotThrow(() => JSON.parse(json));
});

test('every outside file the pages load comes from a host the policy allows', () => {
  const directives = { audio: 'media-src', source: 'media-src', img: 'img-src', script: 'script-src', iframe: 'frame-src' };
  for (const html of [index, notFound]) {
    for (const { name, attrs } of tagsIn(html)) {
      const url = attrs.src ?? (name === 'link' ? attrs.href : undefined);
      if (!url?.startsWith('https://') || attrs.rel === 'canonical') continue;
      const directive = directives[name] ?? (attrs.rel === 'stylesheet' ? 'style-src' : attrs.as === 'font' ? 'font-src' : 'img-src');
      assert.ok(allowedBy(policy(directive), url), `${url} is not allowed by ${directive}`);
    }
  }
  assert.equal(find(index, 'audio').length, 1);
  assert.ok(allowedBy(policy('media-src'), find(index, 'audio')[0].attrs.src));
});

test('every address the scripts fetch is on a host the policy allows', () => {
  const allowed = [...policy('connect-src'), ...policy('media-src'), ...policy('img-src')];
  const found = Object.entries(scripts).flatMap(([file, code]) => [...code.matchAll(/https:\/\/[^'"`\s)]+/g)].map(([url]) => ({ file, url })));
  assert.ok(found.length >= 3, 'expected the stream, metadata and artwork addresses');
  for (const { file, url } of found) assert.ok(allowedBy(allowed, url), `${file} uses ${url}, which the policy does not allow`);
});

test('every local file the pages point at exists', () => {
  for (const html of [index, notFound]) {
    for (const { attrs } of tagsIn(html)) {
      for (const url of [attrs.src, attrs.href]) {
        if (!url || /^(https?:|#|mailto:|sms:|\/$)/.test(url)) continue;
        const file = url.replace(/[?#].*$/, '').replace(/^\//, '');
        assert.ok(exists(file), `${url} does not exist under public/`);
      }
    }
  }
});

test('every image and font the stylesheet points at exists', () => {
  const urls = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(([, url]) => url);
  assert.ok(urls.length > 0);
  for (const url of urls) assert.ok(exists(url.replace(/^\//, '')), `${url} does not exist under public/`);
});

test('each colour theme the editor offers has a rule in the stylesheet', () => {
  for (const name of COLOURS.filter((colour) => colour !== 'navy')) {
    assert.ok(css.includes(`:root[data-colours="${name}"]`), `no rule for ${name}`);
  }
});

test('first.js is a plain script that reads the choices reading.js saves', () => {
  assert.doesNotMatch(scripts['first.js'], /^\s*(import|export)\s/m);
  for (const key of ['coast-text-size', 'coast-theme']) {
    assert.ok(scripts['first.js'].includes(`'${key}'`), `first.js does not read ${key}`);
    assert.ok(scripts['reading.js'].includes(`'${key}'`), `reading.js does not save ${key}`);
  }
});

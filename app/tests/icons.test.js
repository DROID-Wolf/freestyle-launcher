import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileHtml, colorClass, escapeHtml, withPictures, hasVisiblePixels } from '../js/icons.js';

test('withPictures keeps only apps that have a picture', () => {
  const list = [
    { id: 'a', name: 'A', icon: 'data:image/png;base64,xx' },
    { id: 'b', name: 'B', icon: null, iconError: 'no icon' },
    { id: 'c', name: 'C', icon: null, iconError: 'image did not load' },
  ];
  assert.deepEqual(withPictures(list), { apps: [list[0]], note: '' });
});

test('withPictures shows everything, with the reason, when no picture loaded at all', () => {
  const list = [
    { id: 'b', name: 'B', icon: null, iconError: 'no icon' },
    { id: 'c', name: 'C', icon: null, iconError: 'SecurityError' },
  ];
  assert.deepEqual(withPictures(list), { apps: list, note: "App pictures couldn't be loaded (SecurityError)." });
});

test('withPictures hides apps sharing a placeholder picture (3+ apps with the identical image)', () => {
  const tizen = 'data:image/png;base64,TIZEN';
  const list = [
    { id: 'netflix', name: 'Netflix', icon: 'data:image/png;base64,N' },
    { id: 's1', name: 'Service 1', icon: tizen },
    { id: 'yt', name: 'YouTube', icon: 'data:image/png;base64,Y' },
    { id: 's2', name: 'Service 2', icon: tizen },
    { id: 's3', name: 'Service 3', icon: tizen },
  ];
  assert.deepEqual(withPictures(list).apps.map((a) => a.id), ['netflix', 'yt']);
});

test('two apps sharing a picture (e.g. a TV and a Kids variant) are kept', () => {
  const same = 'data:image/png;base64,SAME';
  const list = [{ id: 'a', name: 'A', icon: same }, { id: 'b', name: 'B', icon: same }];
  assert.equal(withPictures(list).apps.length, 2);
});

test('withPictures leaves the desktop mock (no icons, no errors) alone', () => {
  const list = [{ id: 'netflix', name: 'Netflix', icon: null }];
  assert.deepEqual(withPictures(list), { apps: list, note: '' });
});

test('colorClass is stable and within c1..c12', () => {
  for (const id of ['netflix', 'youtube', '11101200001', 'org.tizen.browser', '']) {
    const c = colorClass(id);
    assert.match(c, /^c([1-9]|1[0-2])$/);
    assert.equal(colorClass(id), c);
  }
});

test('colorClass spreads ids across several colors', () => {
  const ids = ['netflix', 'youtube', 'disney', 'spotify', 'prime', 'plex', 'hulu', 'max', 'twitch', 'tubi', 'apple', 'browser'];
  assert.ok(new Set(ids.map(colorClass)).size >= 5);
});

test('letter tile without icon uses the first letter and color class', () => {
  const html = tileHtml({ id: 'netflix', name: 'netflix', icon: null });
  assert.match(html, new RegExp(`class="tile ${colorClass('netflix')}`));
  assert.match(html, />N</);
  assert.ok(!html.includes('<img'));
  assert.match(html, /<span class="tip">netflix<\/span>/);
});

test('letter skips leading non-alphanumerics', () => {
  assert.match(tileHtml({ id: 'x', name: '+Plus', icon: null }), />P</);
});

test('extraClass is appended', () => {
  assert.match(tileHtml({ id: 'a', name: 'A', icon: null }, 'focus'), /class="tile c\d+ focus"/);
});

test('icon tile shows only the picture; the letter is a hidden fallback (icons are often transparent)', () => {
  const html = tileHtml({ id: 'a', name: 'App', icon: '/opt/icons/a.png' });
  assert.match(html, /<img src="\/opt\/icons\/a.png"/);
  assert.match(html, /class="tile c\d+ img"/);
  assert.match(html, /<span class="ltr">A<\/span>/);
});

test('letter tile has no img class', () => {
  assert.ok(!/\bimg\b/.test(tileHtml({ id: 'a', name: 'App', icon: null }).match(/class="[^"]*"/)[0]));
});

test('hasVisiblePixels rejects fully transparent pictures', () => {
  const blank = new Uint8ClampedArray(16 * 16 * 4); // all zero alpha
  assert.equal(hasVisiblePixels(blank), false);
  const logo = new Uint8ClampedArray(16 * 16 * 4);
  logo[4 * 37 + 3] = 255; // one opaque pixel
  assert.equal(hasVisiblePixels(logo), true);
});

test('names and icon URLs are escaped', () => {
  const html = tileHtml({ id: 'a"b', name: '<script>', icon: 'x" onload="alert(1)' });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('x" onload'));
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

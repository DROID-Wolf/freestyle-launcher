import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileHtml, colorClass, escapeHtml } from '../js/icons.js';

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

test('icon renders an img over the letter fallback', () => {
  const html = tileHtml({ id: 'a', name: 'App', icon: '/opt/icons/a.png' });
  assert.match(html, /<img src="\/opt\/icons\/a.png"/);
  assert.match(html, />A</);
});

test('names and icon URLs are escaped', () => {
  const html = tileHtml({ id: 'a"b', name: '<script>', icon: 'x" onload="alert(1)' });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('x" onload'));
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileHtml, colorClass, escapeHtml, withPictures, hasVisiblePixels, brandIcon } from '../js/icons.js';

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

test('withPictures hides the placeholder picture (shared by 6+ apps)', () => {
  const tizen = 'data:image/png;base64,TIZEN';
  const services = Array.from({ length: 6 }, (_, i) => ({ id: `svc${i}`, name: `Service ${i}`, icon: tizen }));
  const list = [{ id: 'netflix', name: 'Netflix', icon: 'data:image/png;base64,N' }, ...services];
  assert.deepEqual(withPictures(list).apps.map((a) => a.id), ['netflix']);
});

test('a few apps sharing one picture are one app: keep one, preferring the store app id', () => {
  const yt = 'data:image/png;base64,YT';
  const list = [
    { id: 'com.samsung.tv.cobalt-yt', name: 'Youtube', icon: yt },
    { id: 'org.tizen.netflix-app', name: 'Netflix', icon: 'data:image/png;base64,N' },
    { id: 'com.samsung.tv.cobalt-app-1566', name: 'YouTubeTestSuite', icon: yt },
    { id: '9Ur5IzDKqV.TizenYouTube', name: 'YouTube', icon: yt },
  ];
  assert.deepEqual(withPictures(list).apps.map((a) => a.id), ['org.tizen.netflix-app', '9Ur5IzDKqV.TizenYouTube']);
});

// Seen on the projector: store apps (YouTube, YouTube TV, …) report one generic picture shared by
// 14 apps; the device has no local copy of their real logo.
test('known services behind a placeholder picture are kept with their real logo from the web', () => {
  const generic = 'data:image/png;base64,GENERIC';
  const others = Array.from({ length: 12 }, (_, i) => ({ id: `Abcdefghi${i}.Thing${i}`, name: `Thing ${i}`, icon: generic }));
  const list = [
    { id: '9Ur5IzDKqV.TizenYouTube', name: 'YouTube', icon: generic },
    { id: 'PvWgqxV3Xa.YouTubeTV', name: 'YouTube TV', icon: generic },
    ...others,
    { id: 'com.samsung.tv.cobalt-yt', name: 'Youtube', icon: null, iconError: 'no icon' },
  ];
  const apps = withPictures(list).apps;
  assert.deepEqual(apps.map((a) => a.id), ['9Ur5IzDKqV.TizenYouTube', 'PvWgqxV3Xa.YouTubeTV']);
  assert.match(apps[0].icon, /^https:\/\/.*youtube\.com/);
  assert.match(apps[1].icon, /tv\.youtube\.com/);
});

test('rescued brand apps carry their brand colour so the tile can be filled', () => {
  const generic = 'data:image/png;base64,GENERIC';
  const list = Array.from({ length: 6 }, (_, i) => ({ id: `Abcdefghi${i}.T${i}`, name: `Thing ${i}`, icon: generic }));
  list.push({ id: '9Ur5IzDKqV.TizenYouTube', name: 'YouTube', icon: generic });
  const [yt] = withPictures(list).apps;
  assert.equal(yt.iconBg, '#ff0000');
});

test('a tile with iconBg is a filled brand tile with that background', () => {
  const html = tileHtml({ id: 'yt', name: 'YouTube', icon: 'https://x/y.png', iconBg: '#ff0000' });
  assert.match(html, /class="tile c\d+ img brand"/);
  assert.match(html, /style="background:#ff0000"/);
});

test('the picture is clipped inside its own wrapper, so the name label above the tile still shows', () => {
  const html = tileHtml({ id: 'yt', name: 'YouTube', icon: 'https://x/y.png', iconBg: '#ff0000' });
  assert.match(html, /<span class="face"><img [^>]*><\/span><span class="tip">YouTube<\/span>/);
});

test('iconBg that is not a plain hex colour is ignored', () => {
  const html = tileHtml({ id: 'a', name: 'A', icon: 'https://x/y.png', iconBg: 'red;position:fixed' });
  assert.ok(!html.includes('style='));
  assert.ok(!/class="[^"]*\bbrand\b/.test(html));
});

test('brandIcon knows common services and nothing else', () => {
  assert.match(brandIcon('Netflix'), /netflix\.com/);
  assert.match(brandIcon('Prime Video'), /primevideo\.com/);
  assert.match(brandIcon('Disney+'), /disneyplus\.com/);
  assert.match(brandIcon('YouTube Kids'), /youtubekids\.com/);
  assert.equal(brandIcon('HealthMdeSetting'), null);
});

test('without a store id, the duplicate kept is the first that is not a test/debug entry', () => {
  const same = 'data:image/png;base64,S';
  const list = [
    { id: 'x.test', name: 'Thing TestSuite', icon: same },
    { id: 'x.main', name: 'Thing', icon: same },
  ];
  assert.deepEqual(withPictures(list).apps.map((a) => a.id), ['x.main']);
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { THEMES, CLIPS, ROOM_FILES, ROOM_SPILL, themeById, defaultOptions, cleanThemePrefs, liveView, sceneKey, resolveScene } from '../js/themes.js';

const RISE = 444;
const SET = 1111;
const ctx = (icon, nowMin) => ({ icon, nowMin, riseMin: RISE, setMin: SET });

test('themes come in the approved order with unique ids', () => {
  assert.deepEqual(THEMES.map((t) => t.id), ['aurora', 'window', 'fireplace', 'cafe', 'aquarium', 'cabin']);
});

test('every option default is one of its values', () => {
  for (const t of THEMES) for (const o of t.options) assert.ok(o.values.some((v) => v.id === o.default), `${t.id}.${o.key}`);
});

test('window offers 7 clearable styles and 6 views (3 rain styles); fireplace stone/brick', () => {
  const w = themeById('window');
  const style = w.options.find((o) => o.key === 'style');
  const view = w.options.find((o) => o.key === 'view');
  assert.deepEqual(style.values.map((v) => v.id), ['desk', 'loft', 'train', 'attic', 'highrise', 'sunroom', 'porch']);
  assert.equal(style.allowNone, true);
  assert.equal(style.default, 'desk');
  assert.deepEqual(view.values.map((v) => [v.id, v.label]), [
    ['live', 'Live'], ['city-rain', 'Rainy night'], ['rain-heavy', 'Heavy rain'], ['rain-storm', 'Storm'],
    ['snowy-forest', 'Snowy forest'], ['beach', 'Beach'],
  ]);
  assert.equal(view.allowNone, false);
  assert.equal(view.default, 'live');
  assert.deepEqual(themeById('fireplace').options.map((o) => [o.key, o.default, o.values.map((v) => v.id)]), [['hearth', 'stone', ['stone', 'brick']]]);
  assert.deepEqual(defaultOptions('window'), { style: 'desk', view: 'live' });
  assert.deepEqual(defaultOptions('aurora'), {});
});

test('clips have a video and a poster under media/', () => {
  assert.deepEqual(Object.keys(CLIPS).sort(), ['aquarium', 'beach', 'city-night', 'city-rain', 'fire', 'rain-heavy', 'rain-storm', 'snowy-forest']);
  assert.deepEqual(CLIPS['city-rain'], { video: 'media/video/city-rain.mp4', poster: 'media/posters/city-rain.jpg' });
});

test('liveView: storms get Storm; rain is Heavy rain by day and Rainy night after dark', () => {
  assert.equal(liveView('storm', 600, RISE, SET), 'rain-storm');
  assert.equal(liveView('storm', 1300, RISE, SET), 'rain-storm');
  assert.equal(liveView('rain', 600, RISE, SET), 'rain-heavy');
  assert.equal(liveView('rain', 1300, RISE, SET), 'city-rain');
});

test('liveView: weather first, then day or night', () => {
  assert.equal(liveView('snow', 1300, RISE, SET), 'snowy-forest');
  assert.equal(liveView('clear', 1300, RISE, SET), 'city-night');
  assert.equal(liveView('cloudy', 600, RISE, SET), 'beach');
  assert.equal(liveView('fog', 600, RISE, SET), 'beach');
});

test('liveView boundaries: sunset minute is night, sunrise minute is day', () => {
  assert.equal(liveView('clear', SET, RISE, SET), 'city-night');
  assert.equal(liveView('clear', RISE, RISE, SET), 'beach');
});

test('liveView without weather uses only day or night', () => {
  assert.equal(liveView(null, 1300, RISE, SET), 'city-night');
  assert.equal(liveView(null, 600, RISE, SET), 'beach');
});

test('resolveScene: window with a style frames the view in that room', () => {
  assert.deepEqual(resolveScene('window', { window: { style: 'desk', view: 'live' } }, ctx('rain', 720)), {
    room: 'media/rooms/desk.jpg', videos: [{ slot: 'view', clip: 'rain-heavy' }], layout: 'window-desk',
  });
  assert.deepEqual(resolveScene('window', { window: { style: 'desk', view: 'rain-storm' } }, ctx('clear', 720)).videos,
    [{ slot: 'view', clip: 'rain-storm' }]);
});

test('room files: the Canva rooms are .jpg, the user-made ones are .webp', () => {
  assert.equal(ROOM_FILES.desk, 'media/rooms/desk.jpg');
  assert.equal(ROOM_FILES.highrise, 'media/rooms/highrise.jpg');
  assert.equal(ROOM_FILES['hearth-brick'], 'media/rooms/hearth-brick.webp');
  assert.equal(ROOM_FILES.sunroom, 'media/rooms/sunroom.webp');
  assert.equal(ROOM_FILES.porch, 'media/rooms/porch.webp');
  assert.equal(ROOM_FILES.cafe, 'media/rooms/cafe.webp');
  assert.equal(ROOM_FILES.aquarium, 'media/rooms/aquarium.webp');
  assert.equal(ROOM_FILES.cabin, 'media/rooms/cabin.webp');
  assert.equal(Object.keys(ROOM_FILES).length, 12);
});

test('theme cards use a real still from their scene (Aurora draws its own)', () => {
  assert.deepEqual(Object.fromEntries(THEMES.map((t) => [t.id, t.thumb])), {
    aurora: null,
    window: 'media/posters/city-night.jpg',
    fireplace: 'media/posters/fire.jpg',
    cafe: 'media/posters/city-rain.jpg',
    aquarium: 'media/posters/aquarium.jpg',
    cabin: 'media/posters/snowy-forest.jpg',
  });
});

test('every media file the themes can use exists under app/', () => {
  const paths = new Set();
  for (const t of THEMES) {
    if (t.thumb) paths.add(t.thumb);
    const combos = [{}];
    for (const o of t.options) {
      const values = o.values.map((v) => v.id).concat(o.allowNone ? [null] : []);
      const next = [];
      for (const c of combos) for (const v of values) next.push({ ...c, [o.key]: v });
      combos.splice(0, combos.length, ...next);
    }
    for (const opts of combos) {
      for (const icon of ['rain', 'snow', 'clear', null]) {
        for (const nowMin of [300, 720]) {
          const spec = resolveScene(t.id, { [t.id]: opts }, { icon, nowMin, riseMin: 444, setMin: 1111 });
          if (spec.room) paths.add(spec.room);
          for (const v of spec.videos) { paths.add(CLIPS[v.clip].video); paths.add(CLIPS[v.clip].poster); }
        }
      }
    }
  }
  const missing = [...paths].filter((p) => !existsSync(new URL(`../${p}`, import.meta.url)));
  assert.deepEqual(missing, []);
  assert.ok(paths.size >= 6 + 6 + 12, `checked ${paths.size} files`);
});

test('only the high-rise (no plants, heavy green spill) removes all spill', () => {
  assert.deepEqual(ROOM_SPILL, { [ROOM_FILES.highrise]: 'all' });
});

test('resolveScene: window with the style cleared is the full-screen view', () => {
  assert.deepEqual(resolveScene('window', { window: { style: null, view: 'beach' } }, ctx('rain', 720)), {
    room: null, videos: [{ slot: 'view', clip: 'beach' }], layout: 'window-full',
  });
});

test('resolveScene: the other themes', () => {
  const c = ctx('clear', 720);
  assert.deepEqual(resolveScene('fireplace', { fireplace: { hearth: 'brick' } }, c),
    { room: 'media/rooms/hearth-brick.webp', videos: [{ slot: 'fire', clip: 'fire' }], layout: 'fireplace' });
  assert.deepEqual(resolveScene('cafe', {}, c), { room: 'media/rooms/cafe.webp', videos: [{ slot: 'view', clip: 'city-rain' }], layout: 'cafe' });
  assert.deepEqual(resolveScene('aquarium', {}, c), { room: 'media/rooms/aquarium.webp', videos: [{ slot: 'tank', clip: 'aquarium' }], layout: 'aquarium' });
  assert.deepEqual(resolveScene('cabin', {}, c), {
    room: 'media/rooms/cabin.webp', videos: [{ slot: 'view', clip: 'snowy-forest' }, { slot: 'fire', clip: 'fire' }], layout: 'cabin',
  });
  assert.deepEqual(resolveScene('aurora', {}, c), { room: null, videos: [], layout: 'aurora' });
});

test('cleanThemePrefs: unknown theme falls back to aurora', () => {
  assert.equal(cleanThemePrefs('nope', {}).theme, 'aurora');
  assert.equal(cleanThemePrefs(42, {}).theme, 'aurora');
});

test('cleanThemePrefs: bad values become defaults, unknown keys are dropped', () => {
  assert.deepEqual(cleanThemePrefs('window', { window: { style: 'castle', view: 'beach', x: 1 } }).themeOptions,
    { window: { style: 'desk', view: 'beach' } });
});

test('cleanThemePrefs: null is kept only where the option can be cleared', () => {
  assert.equal(cleanThemePrefs('window', { window: { style: null } }).themeOptions.window.style, null);
  assert.equal(cleanThemePrefs('fireplace', { fireplace: { hearth: null } }).themeOptions.fireplace.hearth, 'stone');
});

test('cleanThemePrefs keeps other themes’ options so switching back restores them', () => {
  const r = cleanThemePrefs('aurora', { window: { style: null, view: 'beach' } });
  assert.deepEqual(r, { theme: 'aurora', themeOptions: { window: { style: null, view: 'beach' } } });
});

test('cleanThemePrefs: non-object options become {}', () => {
  assert.deepEqual(cleanThemePrefs('window', 'junk').themeOptions, {});
  assert.deepEqual(cleanThemePrefs('window', [1, 2]).themeOptions, {});
  assert.deepEqual(cleanThemePrefs('window', { window: 'junk', zzz: {} }).themeOptions, {});
});

test('sceneKey: equal for equal scenes, different when the clip changes', () => {
  const a = resolveScene('window', {}, ctx('rain', 720));
  const b = resolveScene('window', {}, ctx('rain', 730));
  const c = resolveScene('window', {}, ctx('snow', 720));
  const d = resolveScene('window', {}, ctx('storm', 720));
  assert.equal(sceneKey(a), sceneKey(b));
  assert.notEqual(sceneKey(a), sceneKey(c));
  assert.notEqual(sceneKey(a), sceneKey(d));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyGreen, assignSlots } from '../js/chroma.js';

test('assignSlots: one video covers every opening (e.g. all 12 loft panes)', () => {
  const panes = [{ x: 10, y: 10, w: 10, h: 10 }, { x: 30, y: 10, w: 10, h: 10 }, { x: 10, y: 30, w: 10, h: 10 }];
  assert.deepEqual(assignSlots(panes, 1), [{ x: 10, y: 10, w: 30, h: 30 }]);
});

test('assignSlots: several videos take the openings left to right (cabin window, then firebox)', () => {
  const r = [{ x: 0, y: 0, w: 5, h: 5 }, { x: 20, y: 10, w: 8, h: 4 }];
  assert.deepEqual(assignSlots(r, 2), r);
});

test('assignSlots: more videos than openings share the whole area; no openings gives null', () => {
  const one = [{ x: 4, y: 4, w: 8, h: 8 }];
  assert.deepEqual(assignSlots(one, 2), [one[0], one[0]]);
  assert.equal(assignSlots([], 1), null);
});

// Build a w×h RGBA image filled with a wall colour, with green rectangles painted in.
function image(w, h, rects) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set([120, 80, 50, 255], i * 4);
  for (const [x0, y0, rw, rh] of rects) {
    for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) d.set([0, 255, 0, 255], (y * w + x) * 4);
  }
  return d;
}
const px = (d, w, x, y) => Array.from(d.slice((y * w + x) * 4, (y * w + x) * 4 + 4));

test('green pixels become transparent, everything else is untouched', () => {
  const d = image(16, 8, [[4, 2, 6, 4]]);
  keyGreen(d, 16, 8, 2);
  assert.equal(px(d, 16, 6, 3)[3], 0);
  assert.deepEqual(px(d, 16, 0, 0), [120, 80, 50, 255]);
  assert.deepEqual(px(d, 16, 15, 7), [120, 80, 50, 255]);
});

test('each separate green opening is found as a region, left to right', () => {
  // cabin-like: a window on the left, a firebox on the right
  const d = image(64, 32, [[36, 14, 20, 12], [4, 4, 16, 16]]);
  const { regions } = keyGreen(d, 64, 32, 4);
  assert.equal(regions.length, 2);
  assert.ok(regions[0].x < regions[1].x);
  const [win, fire] = regions;
  assert.ok(Math.abs(win.x - 4) <= 4 && Math.abs(win.w - 16) <= 4 && Math.abs(win.y - 4) <= 4 && Math.abs(win.h - 16) <= 4);
  assert.ok(Math.abs(fire.x - 36) <= 4 && Math.abs(fire.w - 20) <= 4);
});

test('tiny green specks are not openings', () => {
  const d = image(64, 32, [[4, 4, 16, 16], [50, 2, 1, 1]]);
  assert.equal(keyGreen(d, 64, 32, 4).regions.length, 1);
});

test('a green-tinted edge pixel next to an opening is softened and loses its green cast', () => {
  const d = image(32, 16, [[8, 4, 12, 8]]);
  d.set([90, 200, 60, 255], (8 * 32 + 7) * 4); // anti-aliased edge just left of the opening
  keyGreen(d, 32, 16, 2);
  const [r, g, b, a] = px(d, 32, 7, 8);
  assert.ok(a < 255, 'partly transparent');
  assert.ok(g <= Math.max(r, b), 'no green spill');
});

// Seen on the high-rise room: green glow on the ceiling and green reflections on the floor.
test('green glow or reflections away from the openings stay solid (just de-greened)', () => {
  const d = image(64, 32, [[16, 8, 32, 12]]);
  for (let x = 20; x < 40; x++) d.set([30, 200, 40, 255], (29 * 64 + x) * 4); // floor reflection streak
  d.set([20, 70, 25, 255], (1 * 64 + 2) * 4); // dim green tint on the ceiling
  keyGreen(d, 64, 32, 4);
  const refl = px(d, 64, 30, 29);
  const tint = px(d, 64, 2, 1);
  assert.equal(refl[3], 255);
  assert.ok(refl[1] <= Math.max(refl[0], refl[2]));
  assert.equal(tint[3], 255);
  assert.ok(tint[1] <= Math.max(tint[0], tint[2]));
  assert.equal(px(d, 64, 30, 12)[3], 0, 'the opening itself is still cut out');
});

test('even a faint green cast (spill from the green screen) is removed', () => {
  const d = image(16, 8, []);
  d.set([40, 55, 42, 255], 0); // barely green wall
  keyGreen(d, 16, 8, 2);
  const [r, g, b, a] = px(d, 16, 0, 0);
  assert.ok(g <= Math.max(r, b));
  assert.equal(a, 255);
});

// Seen on the café room: de-greening everything turned the potted plant's leaves olive.
test('real foliage away from the openings keeps its green', () => {
  const d = image(64, 32, [[16, 8, 32, 12]]);
  d.set([110, 140, 50, 255], (30 * 64 + 2) * 4); // a warm-lit leaf in the corner
  d.set([60, 120, 20, 255], (30 * 64 + 4) * 4); // a darker leaf
  keyGreen(d, 64, 32, 4);
  assert.deepEqual(px(d, 64, 2, 30), [110, 140, 50, 255]);
  assert.deepEqual(px(d, 64, 4, 30), [60, 120, 20, 255]);
});

// Seen on the high-rise room: warm-lit spill on the ceiling/floor has the same hue as leaves.
test('spill: "all" de-greens warm-tinted surfaces too (for rooms without plants)', () => {
  const d = image(64, 32, [[16, 8, 32, 12]]);
  d.set([33, 50, 14, 255], (1 * 64 + 2) * 4); // warm ceiling with green spill
  keyGreen(d, 64, 32, 4, { spill: 'all' });
  const [r, g, b, a] = px(d, 64, 2, 1);
  assert.ok(g <= Math.max(r, b));
  assert.equal(a, 255);
});

// Seen on the sunroom room: a fiddle-leaf plant stands in front of the green window.
test('a leaf overlapping an opening keeps its colour and stays solid', () => {
  const d = image(64, 32, [[16, 8, 32, 12]]);
  d.set([70, 130, 30, 255], (12 * 64 + 20) * 4); // leaf pixel inside the window area
  keyGreen(d, 64, 32, 4);
  assert.deepEqual(px(d, 64, 20, 12), [70, 130, 30, 255]);
});

test('a green speck is not cut out', () => {
  const d = image(64, 32, [[4, 4, 16, 16], [50, 2, 1, 1]]);
  keyGreen(d, 64, 32, 4);
  assert.equal(px(d, 64, 50, 2)[3], 255);
});

test('an image with no green has no regions', () => {
  const d = image(16, 8, []);
  assert.deepEqual(keyGreen(d, 16, 8, 2).regions, []);
});

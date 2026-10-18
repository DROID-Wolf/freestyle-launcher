import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createSceneRenderer } from '../js/scene.js';

// Just enough DOM for scene.js: elements with classList/style/children, Image, and a canvas
// whose 2D context records what was painted (or, with canvasOK false, can't draw at all, so
// the renderer takes its plain-picture path).
let canvasOK = false;
const makeCtx = () => ({
  ops: [], fillStyle: '', globalCompositeOperation: 'source-over',
  drawImage() {}, clearRect() {},
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData() { this.ops.push(['put']); },
  fillRect() { this.ops.push(['fill', this.fillStyle, this.globalCompositeOperation]); },
});
class El {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.className = ''; this.listeners = {}; }
  appendChild(c) { this.children.push(c); return c; }
  set innerHTML(_) { this.children = []; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  emit(type) { this.listeners[type]?.(); }
  getContext() { if (!canvasOK) throw new Error('no canvas'); return this.ctx || (this.ctx = makeCtx()); }
  querySelectorAll() { return []; }
  removeAttribute(a) { delete this[a]; }
  pause() { this.paused = true; }
  load() { this.reloaded = true; }
}
const images = [];
globalThis.document = { createElement: (t) => new El(t) };
globalThis.Image = class extends El { constructor() { super('img'); this.naturalWidth = 1920; this.naturalHeight = 1080; images.push(this); } };

function setup(canDraw = false) {
  canvasOK = canDraw;
  images.length = 0;
  const host = new El('div');
  const cls = new Set();
  const screen = {
    classList: { add: (...c) => c.forEach((x) => cls.add(x)), remove: (c) => cls.delete(c), [Symbol.iterator]: () => cls.values() },
    querySelector: () => host,
  };
  const r = createSceneRenderer(screen, { mediaUrl: (p) => p, timeoutMs: 100 });
  const videos = () => host.children.filter((c) => c.tag === 'div').map((s) => s.children[0]);
  const room = () => host.children.find((c) => c.className === 'room');
  return { r, cls, videos, room };
}

// The last paint over the room: [fill colour, blend mode] or null if it was just redrawn plain.
const lastDim = (canvas) => {
  const ops = canvas.ctx.ops;
  const i = ops.map((o) => o[0]).lastIndexOf('put');
  const fill = ops.slice(i + 1).find((o) => o[0] === 'fill');
  return fill ? fill.slice(1) : null;
};

const cabin = { room: 'media/rooms/cabin.webp', videos: [{ slot: 'view', clip: 'snowy-forest' }, { slot: 'fire', clip: 'fire' }], layout: 'cabin' };
const full = { room: null, videos: [{ slot: 'view', clip: 'beach' }], layout: 'window-full' };

test('a slow video does not hide a scene whose room has loaded (it shows its poster)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { r, cls } = setup();
    r.apply('cabin', cabin);
    images[0].onload();
    mock.timers.tick(500);
    assert.equal(cls.has('scene-fallback'), false);
  } finally { mock.timers.reset(); }
});

test('a room picture that never loads falls back to Aurora', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { r, cls } = setup();
    r.apply('cabin', cabin);
    mock.timers.tick(500);
    assert.equal(cls.has('scene-fallback'), true);
  } finally { mock.timers.reset(); }
});

test('a scene without a room still falls back when its video never starts', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { r, cls } = setup();
    r.apply('window', full);
    mock.timers.tick(500);
    assert.equal(cls.has('scene-fallback'), true);
  } finally { mock.timers.reset(); }
});

test('a broken room picture falls back at once', () => {
  const { r, cls } = setup();
  r.apply('cabin', cabin);
  images[0].onerror();
  assert.equal(cls.has('scene-fallback'), true);
});

test('dimming darkens only the room picture: black painted on top of its opaque pixels', () => {
  const { r, room, videos } = setup(true);
  r.apply('cabin', cabin);
  images[0].onload();
  r.setDim(40);
  assert.deepEqual(lastDim(room()), ['rgba(0,0,0,0.4)', 'source-atop']);
  assert.ok(videos().every((v) => !v.style.filter && v.style.opacity === undefined));
  r.setDim(0);
  assert.equal(lastDim(room()), null);
});

test('a dim set before the room loads is applied when it arrives, and kept for the next scene', () => {
  const { r, room } = setup(true);
  r.setDim(30);
  r.apply('cabin', cabin);
  images[0].onload();
  assert.deepEqual(lastDim(room()), ['rgba(0,0,0,0.3)', 'source-atop']);
  r.apply('cafe', { room: 'media/rooms/cafe.webp', videos: [{ slot: 'view', clip: 'city-rain' }], layout: 'cafe' });
  images[1].onload();
  assert.deepEqual(lastDim(room()), ['rgba(0,0,0,0.3)', 'source-atop']);
});

test('without a canvas the plain room picture is dimmed with a brightness filter', () => {
  const { r, room } = setup(false);
  r.apply('cabin', cabin);
  images[0].onload();
  r.setDim(50);
  assert.equal(room().style.filter, 'brightness(0.5)');
  r.setDim(0);
  assert.equal(room().style.filter, '');
});

test('a room that arrives after the timeout still shows (the fallback is lifted)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { r, cls } = setup();
    r.apply('cabin', cabin);
    mock.timers.tick(500);
    assert.equal(cls.has('scene-fallback'), true);
    images[0].onload();
    assert.equal(cls.has('scene-fallback'), false);
  } finally { mock.timers.reset(); }
});

test('a room-less video that starts after the timeout still shows', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { r, cls, videos } = setup();
    r.apply('window', full);
    mock.timers.tick(500);
    videos()[0].emit('loadeddata');
    assert.equal(cls.has('scene-fallback'), false);
  } finally { mock.timers.reset(); }
});

test('a broken video keeps its room on screen (the poster shows); without a room it falls back', () => {
  const a = setup();
  a.r.apply('cabin', cabin);
  images[0].onload();
  a.videos()[0].emit('error');
  assert.equal(a.cls.has('scene-fallback'), false);
  const b = setup();
  b.r.apply('window', full);
  b.videos()[0].emit('error');
  assert.equal(b.cls.has('scene-fallback'), true);
});

test('leaving a scene unloads its videos so the TV frees their decoders', () => {
  const { r, videos } = setup();
  r.apply('cabin', cabin);
  const old = videos();
  r.apply('window', full);
  assert.equal(old.length, 2);
  for (const v of old) {
    assert.equal(v.paused, true);
    assert.equal('src' in v, false);
    assert.equal(v.reloaded, true);
  }
});

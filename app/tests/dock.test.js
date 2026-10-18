import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DOCK, toggleApp, pruneDock, loadDock, saveDock } from '../js/dock.js';

const memStorage = (init = {}) => {
  const s = { ...init };
  return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, raw: s };
};

test('MAX_DOCK is 6', () => assert.equal(MAX_DOCK, 6));
test('toggleApp adds then removes', () => {
  const a = toggleApp([], 'netflix');
  assert.deepEqual(a, { dock: ['netflix'], full: false });
  assert.deepEqual(toggleApp(a.dock, 'netflix'), { dock: [], full: false });
});
test('toggleApp keeps selection order', () => {
  let d = [];
  for (const id of ['c', 'a', 'b']) d = toggleApp(d, id).dock;
  assert.deepEqual(d, ['c', 'a', 'b']);
});
test('toggleApp refuses a 7th app without changing dock', () => {
  const six = ['1', '2', '3', '4', '5', '6'];
  const r = toggleApp(six, '7');
  assert.deepEqual(r, { dock: six, full: true });
});
test('toggleApp does not mutate input', () => {
  const d = ['a'];
  toggleApp(d, 'b');
  assert.deepEqual(d, ['a']);
});
test('pruneDock drops uninstalled apps', () => {
  assert.deepEqual(pruneDock(['a', 'x', 'b'], ['a', 'b']), ['a', 'b']);
});
test('loadDock returns null for missing or corrupt data', () => {
  assert.equal(loadDock(memStorage()), null);
  assert.equal(loadDock(memStorage({ 'fl.dock': '{nope' })), null);
});
test('loadDock keeps strings only and caps at 6', () => {
  const st = memStorage({ 'fl.dock': JSON.stringify(['a', 3, 'b', 'c', 'd', 'e', 'f', 'g']) });
  assert.deepEqual(loadDock(st), ['a', 'b', 'c', 'd', 'e', 'f']);
});
test('saveDock then loadDock round-trips', () => {
  const st = memStorage();
  saveDock(st, ['x', 'y']);
  assert.deepEqual(loadDock(st), ['x', 'y']);
});
test('storage that throws does not crash', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(loadDock(bad), null);
  assert.doesNotThrow(() => saveDock(bad, ['a']));
});

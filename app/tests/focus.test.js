import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigate } from '../js/focus.js';

const L = { dockCount: 6, pickerCount: 12, pickerCols: 6 };
const nav = (zone, index, key) => navigate({ zone, index }, key, L);

test('dock: Right stops at last tile', () => {
  assert.deepEqual(nav('dock', 5, 'ArrowRight').state, { zone: 'dock', index: 5 });
  assert.deepEqual(nav('dock', 2, 'ArrowRight').state, { zone: 'dock', index: 3 });
});
test('dock: Left stops at 0', () => {
  assert.deepEqual(nav('dock', 0, 'ArrowLeft').state, { zone: 'dock', index: 0 });
});
test('Up from dock goes to top button, Down returns to dock start', () => {
  assert.deepEqual(nav('dock', 3, 'ArrowUp').state, { zone: 'top', index: 0 });
  assert.deepEqual(nav('top', 0, 'ArrowDown').state, { zone: 'dock', index: 0 });
});
test('Enter activates', () => {
  assert.equal(nav('dock', 1, 'Enter').action, 'activate');
  assert.equal(nav('top', 0, 'Enter').action, 'activate');
});
test('Escape on main screen does nothing', () => {
  assert.deepEqual(nav('dock', 2, 'Escape'), { state: { zone: 'dock', index: 2 }, action: 'none' });
  assert.deepEqual(nav('top', 0, 'Escape'), { state: { zone: 'top', index: 0 }, action: 'none' });
});
test('picker grid vertical movement and Done button', () => {
  assert.equal(nav('picker', 2, 'ArrowDown').state.index, 8);
  assert.equal(nav('picker', 8, 'ArrowDown').state.index, 12);
  assert.equal(nav('picker', 12, 'ArrowUp').state.index, 11);
  assert.equal(nav('picker', 3, 'ArrowUp').state.index, 3);
});
test('picker horizontal movement is clamped to 0..pickerCount', () => {
  assert.equal(nav('picker', 0, 'ArrowLeft').state.index, 0);
  assert.equal(nav('picker', 12, 'ArrowRight').state.index, 12);
});
test('picker Escape closes', () => {
  assert.equal(nav('picker', 4, 'Escape').action, 'close');
});
test('top: Left/Right move across topCount buttons, clamped', () => {
  const T = { ...L, topCount: 3 };
  const t = (index, key) => navigate({ zone: 'top', index }, key, T).state;
  assert.deepEqual(t(0, 'ArrowRight'), { zone: 'top', index: 1 });
  assert.deepEqual(t(2, 'ArrowRight'), { zone: 'top', index: 2 });
  assert.deepEqual(t(1, 'ArrowLeft'), { zone: 'top', index: 0 });
  assert.deepEqual(t(0, 'ArrowLeft'), { zone: 'top', index: 0 });
  assert.deepEqual(t(2, 'ArrowDown'), { zone: 'dock', index: 0 });
});
test('top: without topCount, Left/Right stay on the only button', () => {
  assert.deepEqual(nav('top', 0, 'ArrowRight').state, { zone: 'top', index: 0 });
});
test('unknown key is ignored', () => {
  assert.deepEqual(nav('dock', 1, 'x'), { state: { zone: 'dock', index: 1 }, action: 'none' });
});

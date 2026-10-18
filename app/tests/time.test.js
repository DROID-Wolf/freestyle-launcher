import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, formatDate, greeting, dayProgress } from '../js/time.js';

test('formatTime shows 12 AM just after midnight', () => {
  assert.deepEqual(formatTime(new Date(2026, 9, 17, 0, 5), false), { h: '12', m: '05', ampm: 'AM' });
});
test('formatTime shows 12 PM at half past noon', () => {
  assert.deepEqual(formatTime(new Date(2026, 9, 17, 12, 30), false), { h: '12', m: '30', ampm: 'PM' });
});
test('formatTime 24h has no am/pm', () => {
  assert.deepEqual(formatTime(new Date(2026, 9, 17, 21, 41), true), { h: '21', m: '41', ampm: '' });
});
test('formatDate is weekday, month day', () => {
  assert.equal(formatDate(new Date(2026, 9, 17, 12)), 'Saturday, October 17');
});
test('greeting boundaries', () => {
  const cases = [[4, 'Good night'], [5, 'Good morning'], [11, 'Good morning'], [12, 'Good afternoon'], [17, 'Good evening'], [21, 'Good night']];
  for (const [h, g] of cases) assert.equal(greeting(h), g, `hour ${h}`);
});
test('dayProgress mid-day', () => {
  assert.deepEqual(dayProgress(600, 444, 1111), { pct: 23, label: 'Day 23% done' });
});
test('dayProgress before sunrise', () => {
  assert.deepEqual(dayProgress(300, 444, 1111), { pct: 0, label: 'Before sunrise' });
});
test('dayProgress after sunset', () => {
  assert.deepEqual(dayProgress(1200, 444, 1111), { pct: 100, label: 'Sun has set' });
});

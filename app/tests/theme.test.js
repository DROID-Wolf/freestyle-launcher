import { test } from 'node:test';
import assert from 'node:assert/strict';
import { themeFor } from '../js/theme.js';

test('themeFor picks theme by time relative to sun', () => {
  const cases = [[450, 'morning'], [700, 'day'], [1050, 'evening'], [1300, 'night'], [200, 'night']];
  for (const [m, t] of cases) assert.equal(themeFor(m, 444, 1111), t, `minute ${m}`);
});

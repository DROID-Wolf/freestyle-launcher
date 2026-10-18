import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFS, loadPrefs, savePrefs, loadWeather, saveWeather } from '../js/store.js';

const memStorage = (init = {}) => {
  const s = { ...init };
  return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, raw: s };
};

test('loadPrefs returns defaults when missing or corrupt', () => {
  assert.deepEqual(loadPrefs(memStorage()), DEFAULT_PREFS);
  assert.deepEqual(loadPrefs(memStorage({ 'fl.prefs': '{nope' })), DEFAULT_PREFS);
  assert.deepEqual(loadPrefs(memStorage({ 'fl.prefs': '[1,2]' })), DEFAULT_PREFS);
});

test('loadPrefs keeps valid fields and drops wrongly typed ones', () => {
  const s = memStorage({ 'fl.prefs': JSON.stringify({ name: 'Nick', city: 3, lat: 40.8, lon: 'x', hour24: true, extra: 1 }) });
  assert.deepEqual(loadPrefs(s), { ...DEFAULT_PREFS, name: 'Nick', lat: 40.8, hour24: true });
});

test('savePrefs round-trips and survives a throwing storage', () => {
  const s = memStorage();
  const p = { ...DEFAULT_PREFS, city: 'State College', lat: 40.79, lon: -77.86 };
  savePrefs(s, p);
  assert.deepEqual(loadPrefs(s), p);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.doesNotThrow(() => savePrefs(bad, p));
  assert.deepEqual(loadPrefs(bad), DEFAULT_PREFS);
});

test('weather cache round-trips; corrupt or shapeless cache is null', () => {
  const s = memStorage();
  assert.equal(loadWeather(s), null);
  saveWeather(s, { fetchedAt: 123, data: { temp: 50 } });
  assert.deepEqual(loadWeather(s), { fetchedAt: 123, data: { temp: 50 } });
  assert.equal(loadWeather(memStorage({ 'fl.weather': '{"data":{}}' })), null);
  assert.equal(loadWeather(memStorage({ 'fl.weather': 'garbage' })), null);
});

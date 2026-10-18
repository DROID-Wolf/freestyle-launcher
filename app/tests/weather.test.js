import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { forecastUrl, geocodeUrl, parseForecast, parseGeocode, describeCode, weatherView } from '../js/weather.js';
import { tickerText } from '../js/ticker.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/open-meteo.json', import.meta.url)));
const geo = JSON.parse(readFileSync(new URL('./fixtures/geocode.json', import.meta.url)));
const NOW = new Date(2026, 9, 17, 20, 45);
const clone = (o) => JSON.parse(JSON.stringify(o));

test('forecastUrl includes coords, fahrenheit and needed fields', () => {
  const u = forecastUrl(40.71, -74.01);
  assert.ok(u.startsWith('https://api.open-meteo.com/v1/forecast?'));
  for (const part of ['latitude=40.71', 'longitude=-74.01', 'temperature_unit=fahrenheit', 'timezone=auto', 'forecast_days=2', 'sunrise', 'sunset', 'weather_code'])
    assert.ok(u.includes(part), part);
});
test('geocodeUrl encodes the city', () => {
  assert.equal(geocodeUrl('State College'), 'https://geocoding-api.open-meteo.com/v1/search?name=State%20College&count=1');
});
test('parseForecast reads current, daily and 4 upcoming hours', () => {
  const w = parseForecast(fx, NOW);
  assert.equal(w.temp, 58);
  assert.equal(w.hi, 63);
  assert.equal(w.lo, 44);
  assert.equal(w.cond, 'Partly cloudy');
  assert.equal(w.riseMin, 7 * 60 + 24);
  assert.equal(w.setMin, 18 * 60 + 31);
  assert.ok(w.riseMin < w.setMin);
  assert.equal(w.hours.length, 4);
  assert.deepEqual(w.hours.map((h) => h.label), ['9 PM', '11 PM', '1 AM', '3 AM']);
  for (const h of w.hours) assert.equal(typeof h.temp, 'number');
});
test('parseForecast returns null for malformed json', () => {
  assert.equal(parseForecast({}, NOW), null);
});
test('parseGeocode', () => {
  assert.deepEqual(parseGeocode(geo), { lat: 40.71427, lon: -74.00597, name: 'New York' });
  assert.equal(parseGeocode({}), null);
});
test('describeCode groups WMO codes', () => {
  assert.equal(describeCode(0).icon, 'clear');
  assert.equal(describeCode(3).icon, 'cloudy');
  assert.equal(describeCode(45).icon, 'fog');
  assert.equal(describeCode(63).icon, 'rain');
  assert.equal(describeCode(81).icon, 'rain');
  assert.equal(describeCode(73).icon, 'snow');
  assert.equal(describeCode(95).icon, 'storm');
});
test('weatherView hides with no cache or bad data', () => {
  assert.deepEqual(weatherView(null, NOW), { show: false, stale: '' });
  assert.deepEqual(weatherView({ fetchedAt: NOW.getTime(), data: { temp: NaN } }, NOW), { show: false, stale: '' });
});
test('weatherView marks stale data', () => {
  const data = parseForecast(fx, NOW);
  assert.deepEqual(weatherView({ fetchedAt: NOW.getTime() - 3 * 3600e3, data }, NOW), { show: true, stale: 'updated 3h ago' });
  assert.deepEqual(weatherView({ fetchedAt: NOW.getTime() - 45 * 60e3, data }, NOW), { show: true, stale: 'updated 45m ago' });
  assert.deepEqual(weatherView({ fetchedAt: NOW.getTime() - 5 * 60e3, data }, NOW), { show: true, stale: '' });
});
test('ticker warns about rain first', () => {
  assert.equal(tickerText(parseForecast(fx, NOW), NOW), 'Rain likely around 3 AM');
});
test('ticker shows sunset time before sunset', () => {
  const dry = clone(fx); dry.hourly.weather_code = dry.hourly.weather_code.map(() => 2);
  const afternoon = new Date(2026, 9, 17, 15, 10);
  assert.equal(tickerText(parseForecast(dry, afternoon), afternoon), 'Sunset at 6:31 PM');
});
test('ticker mentions clear skies after sunset', () => {
  const clear = clone(fx); clear.hourly.weather_code = clear.hourly.weather_code.map(() => 0); clear.current.weather_code = 0;
  assert.match(tickerText(parseForecast(clear, NOW), NOW), /Clear skies/);
});
test('ticker is empty with no data', () => {
  assert.equal(tickerText(null, NOW), '');
});

// localStorage helpers for preferences (fl.prefs) and the weather cache (fl.weather).
const PREFS = 'fl.prefs';
const WEATHER = 'fl.weather';

export const DEFAULT_PREFS = { name: '', city: '', lat: null, lon: null, hour24: false, reduceMotion: false };
const TYPES = { name: 'string', city: 'string', lat: 'number', lon: 'number', hour24: 'boolean', reduceMotion: 'boolean' };

const read = (storage, key) => {
  try {
    return JSON.parse(storage.getItem(key));
  } catch (e) {
    return null;
  }
};
const write = (storage, key, value) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage unavailable: value just won't persist */
  }
};

export function loadPrefs(storage) {
  const raw = read(storage, PREFS);
  const prefs = { ...DEFAULT_PREFS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return prefs;
  for (const k of Object.keys(TYPES)) {
    if (typeof raw[k] === TYPES[k] && (TYPES[k] !== 'number' || Number.isFinite(raw[k]))) prefs[k] = raw[k];
  }
  return prefs;
}

export const savePrefs = (storage, prefs) => write(storage, PREFS, prefs);

export function loadWeather(storage) {
  const raw = read(storage, WEATHER);
  if (!raw || !Number.isFinite(raw.fetchedAt) || !raw.data || typeof raw.data !== 'object') return null;
  return raw;
}

export const saveWeather = (storage, cache) => write(storage, WEATHER, cache);

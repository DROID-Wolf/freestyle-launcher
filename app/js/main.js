// Wires the pure modules to the DOM: clock, theme, weather, dock, remote keys and overlays.
import { formatTime, formatDate, greeting, dayProgress } from './time.js';
import { themeFor } from './theme.js';
import { loadDock, saveDock, pruneDock } from './dock.js';
import { navigate } from './focus.js';
import { forecastUrl, geocodeUrl, parseForecast, parseGeocode, weatherView } from './weather.js';
import { tickerText } from './ticker.js';
import { pickBridge } from './bridge.js';
import { tileHtml } from './icons.js';
import { openPicker, openAppGrid } from './picker.js';
import { loadPrefs, savePrefs, loadWeather, saveWeather } from './store.js';

const WEATHER_EVERY = 15 * 60 * 1000;
const FETCH_TIMEOUT = 10000;
const DEFAULT_SUN = { rise: 7 * 60, set: 19 * 60 }; // until we have a forecast
const HOUR_ICON = { clear: '☀', partly: '⛅', cloudy: '☁', fog: '🌫', rain: '🌧', snow: '❄', storm: '⛈' };
const DROPS = { rain: '💧💧', snow: '❄❄', storm: '⚡' };
const NAV_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'];
const TIZEN_BACK = 10009;

const $ = (id) => document.getElementById(id);
const screen = $('screen');
const memStorage = () => {
  const s = {};
  return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); } };
};
let storage;
try {
  storage = window.localStorage;
} catch (e) {
  storage = memStorage();
}

const bridge = pickBridge(window);
let prefs = loadPrefs(storage);
let savedDock = loadDock(storage);
let dock = savedDock || [];
let apps = null; // null until the bridge answers; [] if it failed
let cache = loadWeather(storage);
let focus = { zone: 'dock', index: 0 };
let overlay = null;
let toastTimer = 0;
let lastMinute = -1;

const topButtons = [$('editBtn'), $('inputsBtn'), $('settingsBtn')];
const nowMin = (d) => d.getHours() * 60 + d.getMinutes();
const fmt = (t) => `${t.h}:${t.m}${t.ampm ? ' ' + t.ampm : ''}`;
const fmtMin = (min) => fmt(formatTime(new Date(2000, 0, 1, Math.floor(min / 60), min % 60), prefs.hour24));
const deg = (n) => (Number.isFinite(n) ? `${n}°` : '–');

function sun() {
  const d = cache && cache.data;
  return d && Number.isFinite(d.riseMin) && Number.isFinite(d.setMin) ? { rise: d.riseMin, set: d.setMin } : DEFAULT_SUN;
}

// ---- layout ----
function fit() {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const x = (window.innerWidth - 1920 * s) / 2;
  const y = (window.innerHeight - 1080 * s) / 2;
  screen.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}

// ---- clock, greeting, daylight bar, theme ----
function tick() {
  const now = new Date();
  const t = formatTime(now, prefs.hour24);
  $('hh').textContent = t.h;
  $('mm').textContent = t.m;
  $('ap').textContent = t.ampm;
  $('date').textContent = formatDate(now);
  $('greet').textContent = greeting(now.getHours());
  $('nameWrap').hidden = !prefs.name;
  $('name').textContent = prefs.name;

  const m = nowMin(now);
  if (m === lastMinute) return;
  lastMinute = m;
  const { rise, set } = sun();
  const p = dayProgress(m, rise, set);
  $('fill').style.transform = `scaleX(${p.pct / 100})`;
  $('daypct').textContent = p.label;
  $('rise').textContent = `☀ ${fmtMin(rise)}`;
  $('set').textContent = `☾ ${fmtMin(set)}`;
  screen.dataset.t = themeFor(m, rise, set);
  renderWeather();
}
const retick = () => {
  lastMinute = -1;
  tick();
};

// ---- weather ----
const to24 = (label) => {
  const m = /^(\d+) (AM|PM)$/.exec(label);
  return m ? `${String((Number(m[1]) % 12) + (m[2] === 'PM' ? 12 : 0)).padStart(2, '0')}:00` : label;
};

function renderWeather() {
  const now = new Date();
  const v = weatherView(cache, now);
  $('wx').hidden = !v.show;
  if (!v.show) {
    $('quote').hidden = true;
    return;
  }
  const d = cache.data;
  const m = nowMin(now);
  const { rise, set } = sun();
  $('deg').textContent = deg(d.temp);
  $('cond').textContent = d.cond || '';
  $('hl').textContent = [`H ${deg(d.hi)}`, `L ${deg(d.lo)}`, prefs.city, v.stale].filter(Boolean).join(' · ');
  const sunEl = $('sun');
  sunEl.dataset.icon = d.icon || 'cloudy';
  if (m < rise || m >= set) sunEl.dataset.night = '';
  else delete sunEl.dataset.night;
  $('drops').textContent = DROPS[d.icon] || '';
  const hours = [{ label: 'Now', temp: d.temp, icon: d.icon }].concat(Array.isArray(d.hours) ? d.hours : []);
  const isNight = (label) => {
    const hm = label === 'Now' ? m : Number(to24(label).slice(0, 2)) * 60;
    return hm < rise || hm >= set;
  };
  const icon = (h) => (h.icon === 'clear' && isNight(h.label) ? '🌙' : HOUR_ICON[h.icon] || '☁');
  $('hours').innerHTML = hours.map((h) =>
    `<div>${prefs.hour24 ? to24(h.label) : h.label}<em>${icon(h)}</em><span>${deg(h.temp)}</span></div>`).join('');

  const text = tickerText(d, now);
  $('quote').hidden = !text;
  $('quoteLbl').textContent = m < set ? 'Today' : 'Tonight';
  $('quoteTxt').textContent = text;
}

function fetchJson(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT);
  return fetch(url, { signal: ac.signal })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .finally(() => clearTimeout(timer));
}

function refreshWeather() {
  if (!Number.isFinite(prefs.lat) || !Number.isFinite(prefs.lon)) return;
  const lat = prefs.lat;
  const lon = prefs.lon;
  fetchJson(forecastUrl(lat, lon))
    .then((json) => {
      const data = parseForecast(json, new Date());
      if (!data || lat !== prefs.lat || lon !== prefs.lon) return; // bad data, or city changed meanwhile
      cache = { fetchedAt: Date.now(), data };
      saveWeather(storage, cache);
      retick();
    })
    .catch(() => renderWeather()); // offline: keep showing the cache with its age
}

const findCity = (q) => fetchJson(geocodeUrl(q)).then(parseGeocode);

// ---- dock and focus ----
const appById = (id) => (apps && apps.find((a) => a.id === id)) || { id, name: id, icon: null };

function renderDock() {
  focus.index = focus.zone === 'dock' ? Math.min(focus.index, dock.length) : focus.index;
  const tiles = dock.map((id, i) => tileHtml(appById(id)).replace('class="tile', `data-dock="${i}" class="tile`));
  $('dock').innerHTML = tiles.join('') + (dock.length ? '<div class="sep"></div>' : '') +
    `<div class="tile c8" data-dock="${dock.length}">⋯<span class="tip">All apps</span></div>`;
  renderFocus();
}

function renderFocus() {
  const onMain = !overlay;
  $('dock').querySelectorAll('.tile').forEach((t, i) => t.classList.toggle('focus', onMain && focus.zone === 'dock' && focus.index === i));
  topButtons.forEach((b, i) => b.classList.toggle('focus', onMain && focus.zone === 'top' && focus.index === i));
}

const layout = () => ({ dockCount: dock.length + 1, topCount: topButtons.length, pickerCount: 0, pickerCols: 6 });

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function launch(app) {
  bridge.launch(app.id).catch(() => toast(`Couldn't open ${app.name}`));
}

function activate() {
  if (focus.zone === 'top') {
    if (focus.index === 0) openCustomize();
    else if (focus.index === 1) bridge.openInputs().catch(() => toast("Couldn't open Inputs"));
    else bridge.openSettings().catch(() => toast("Couldn't open Settings"));
    return;
  }
  if (focus.index < dock.length) launch(appById(dock[focus.index]));
  else openAllApps();
}

function applyPrefs() {
  document.body.classList.toggle('reduce-motion', prefs.reduceMotion);
  retick();
}

function openCustomize() {
  overlay = openPicker({
    apps: apps || [],
    dock: dock.slice(),
    prefs: { ...prefs },
    findCity,
    onChange(next) {
      const moved = next.prefs.lat !== prefs.lat || next.prefs.lon !== prefs.lon;
      dock = savedDock = next.dock;
      saveDock(storage, dock);
      prefs = next.prefs;
      savePrefs(storage, prefs);
      if (moved) {
        cache = null; // the old forecast belongs to the old city
        saveWeather(storage, null);
        refreshWeather();
      }
      applyPrefs();
      renderDock();
    },
    onClose() {
      overlay = null;
      focus = { zone: 'dock', index: 0 };
      renderDock();
    },
  });
  renderFocus();
}

function openAllApps() {
  const sorted = (apps || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  overlay = openAppGrid({
    apps: sorted,
    onLaunch: launch,
    onClose() {
      overlay = null;
      renderFocus();
    },
  });
  renderFocus();
}

// ---- remote / keyboard ----
function handleKey(key) {
  if (overlay) return overlay.handleKey(key);
  const r = navigate(focus, key, layout()); // Escape on the main screen is 'none': never exit
  focus = r.state;
  if (r.action === 'activate') activate();
  renderFocus();
  return true;
}

document.addEventListener('keydown', (e) => {
  const key = e.keyCode === TIZEN_BACK ? 'Escape' : NAV_KEYS.indexOf(e.key) >= 0 ? e.key : null;
  if (key && handleKey(key)) e.preventDefault();
});

// The shell forwards the remote's Back key as {fl:1, key:'Escape'} (bridge replies carry an id).
window.addEventListener('message', (e) => {
  const d = e.data;
  if (window.parent === window || e.source !== window.parent) return;
  if (d && d.fl === 1 && d.id === undefined && d.key === 'Escape') handleKey('Escape');
});

$('dock').addEventListener('click', (e) => {
  const t = e.target.closest('[data-dock]');
  if (!t || overlay) return;
  focus = { zone: 'dock', index: Number(t.dataset.dock) };
  renderFocus();
  activate();
});
topButtons.forEach((b, i) => b.addEventListener('click', () => {
  if (overlay) return;
  focus = { zone: 'top', index: i };
  renderFocus();
  activate();
}));

// ---- startup ----
const rays = $('rays');
for (let i = 0; i < 8; i++) {
  const r = document.createElement('i');
  r.style.transform = `rotate(${i * 45}deg)`;
  rays.appendChild(r);
}
window.addEventListener('resize', fit);
fit();
applyPrefs();
renderDock();

bridge.getApps().then(
  (list) => {
    apps = (Array.isArray(list) ? list : []).filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string');
    const ids = apps.map((a) => a.id);
    if (savedDock) {
      dock = pruneDock(savedDock, ids); // uninstalled apps drop out silently
      if (dock.length !== savedDock.length) saveDock(storage, (savedDock = dock));
    } else dock = ids.slice(0, 5);
    renderDock();
  },
  () => {
    apps = []; // bridge timeout: keep the saved dock as-is, launches will toast
    renderDock();
  },
);

refreshWeather();
setInterval(tick, 1000);
setInterval(refreshWeather, WEATHER_EVERY);

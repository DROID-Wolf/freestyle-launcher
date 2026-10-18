// Overlays: the customize picker (Apps + Preferences tabs) and the all-apps launch grid.
// Each returns { handleKey(key) -> boolean (consumed), close() }; main.js routes keys to it.
import { navigate } from './focus.js';
import { toggleApp, moveApp, MAX_DOCK } from './dock.js';
import { tileHtml, escapeHtml } from './icons.js';

const COLS = 6;
// Preferences rows by index; city, find and locate share one line (Left/Right move between them).
const PREF_ROWS = ['name', 'city', 'find', 'locate', 'hour24', 'reduceMotion', 'done'];
const CITY_LINE = [1, 2, 3];
// The bar under a selected "Your dock" app. Geometry matches .slots: 150px label + 24px gap,
// then 96px slots 24px apart.
const SLOT_ACTIONS = [
  { act: 'left', label: '◀ Move left' },
  { act: 'remove', label: '✕ Remove' },
  { act: 'right', label: 'Move right ▶' },
];
const slotCenter = (i) => 174 + i * 120 + 48;
const PIN_SVG = '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const appsMsg = (note) => `<div class="msg">${escapeHtml(note || "Couldn't load the installed apps.")}</div>`;

const mount = (root, cls) => {
  const el = document.createElement('div');
  el.className = `ov ${cls}`;
  root.appendChild(el);
  return el;
};

// Re-rendering replaces the grid, so carry its scroll position over, then scroll vertically
// (never sideways) just enough to keep the focused app in view.
const gridScroll = (el) => {
  const wrap = el.querySelector('.gridwrap');
  return wrap ? wrap.scrollTop : 0;
};
const scrollToFocus = (el, prevTop = 0) => {
  const wrap = el.querySelector('.gridwrap');
  if (!wrap) return;
  wrap.scrollLeft = 0;
  wrap.scrollTop = prevTop;
  const f = wrap.querySelector('.focus');
  const item = f && (f.closest('.gapp') || f);
  if (!item) return;
  const pad = 16;
  if (item.offsetTop - pad < wrap.scrollTop) wrap.scrollTop = item.offsetTop - pad;
  else if (item.offsetTop + item.offsetHeight + pad > wrap.scrollTop + wrap.clientHeight)
    wrap.scrollTop = item.offsetTop + item.offsetHeight + pad - wrap.clientHeight;
};

export function openPicker({ apps, appsNote = '', dock, prefs, onChange, onClose, findCity, locateMe, root = document.getElementById('screen') }) {
  const el = mount(root, 'pick');
  let tab = 'apps';
  let row = 'body'; // 'tabs' | 'slots' (the "Your dock" row, apps tab) | 'body'
  let slotMenu = -1; // -1 closed; else the focused action under a dock slot (SLOT_ACTIONS index)
  let idx = 0;
  let status = '';
  let fullTimer = 0;
  let cityDraft = prefs.city;
  let byId = new Map(apps.map((a) => [a.id, a]));

  const emit = () => onChange({ dock: dock.slice(), prefs: { ...prefs } });
  const editingInput = () => {
    const a = document.activeElement;
    return a && a.tagName === 'INPUT' && el.contains(a) ? a : null;
  };
  const isFocus = (r, i) => (row === r && idx === i ? ' focus' : '');
  const doneIndex = () => (tab === 'apps' ? apps.length : PREF_ROWS.length - 1);

  function slotMenuHtml() {
    if (row !== 'slots' || slotMenu < 0) return '';
    const btns = SLOT_ACTIONS.map((a, i) =>
      `<div class="btn${i === slotMenu ? ' focus' : ''}" data-act="${a.act}">${a.label}</div>`).join('');
    return `<div class="slotmenu" style="left:${slotCenter(idx)}px">${btns}</div>`;
  }

  function appsHtml() {
    const slots = [];
    for (let i = 0; i < MAX_DOCK; i++) {
      const a = byId.get(dock[i]);
      // a filled slot can be focused/clicked to remove that app from the dock
      slots.push(a ? tileHtml(a, `slot${isFocus('slots', i)}`).replace('<div ', `<div data-slot="${i}" `) : '<div class="slot"></div>');
    }
    const grid = apps.map((a, i) => {
      const n = dock.indexOf(a.id);
      const badge = n >= 0 ? `<span class="badge">${n + 1}</span>` : '';
      const tile = tileHtml(a, isFocus('body', i).trim()).replace(/<\/div>$/, `${badge}</div>`);
      return `<div class="gapp${n >= 0 ? ' sel' : ''}" data-i="${i}">${tile}<span class="nm">${escapeHtml(a.name)}</span></div>`;
    }).join('');
    return `<p>Select up to ${MAX_DOCK} apps. They appear in the dock in the order you pick them. Select one again to remove it, or select it in Your dock to move or remove it.</p>
      <div class="slots"><span class="lbl">Your dock</span>${slots.join('')}${slotMenuHtml()}</div>
      ${apps.length ? `${appsNote ? appsMsg(appsNote) : ''}<div class="gridwrap"><div class="grid">${grid}</div></div>` : appsMsg(appsNote)}
      <div class="full">Dock is full. Remove an app first.</div>`;
  }

  function prefsHtml() {
    const toggle = (key, i, label) =>
      `<div class="toggle${prefs[key] ? ' on' : ''}${isFocus('body', i)}" data-i="${i}"><span class="sw"></span>${label}</div>`;
    return `<p>Your name appears in the greeting. The city is used for the weather.</p>
      <div class="form">
        <div class="field"><label>Name</label><input id="pfName" data-i="0" class="${isFocus('body', 0)}" value="${escapeHtml(prefs.name)}" maxlength="30"></div>
        <div class="field"><label>City</label><input id="pfCity" data-i="1" class="${isFocus('body', 1)}" value="${escapeHtml(cityDraft)}" maxlength="60">
          <div class="btn${isFocus('body', 2)}" data-i="2">Find</div>
          <div class="btn icon${isFocus('body', 3)}" data-i="3" title="Use current location">${PIN_SVG}<span class="tip3">Use current location</span></div></div>
        <div class="field"><label></label><span class="status">${escapeHtml(status)}</span></div>
        <div class="field"><label>Clock</label>${toggle('hour24', 4, '24-hour time')}</div>
        <div class="field"><label>Motion</label>${toggle('reduceMotion', 5, 'Reduce motion')}</div>
      </div>`;
  }

  function render() {
    const tabBtn = (name, i, label) => `<div class="tab${tab === name ? ' on' : ''}${isFocus('tabs', i)}" data-tab="${name}">${label}</div>`;
    const prevTop = gridScroll(el);
    el.innerHTML = `<h2>Customize</h2>
      <div class="tabs">${tabBtn('apps', 0, 'Apps')}${tabBtn('prefs', 1, 'Preferences')}</div>
      ${tab === 'apps' ? appsHtml() : prefsHtml()}
      <div class="done${isFocus('body', doneIndex())}" data-i="${doneIndex()}">Done</div>`;
    scrollToFocus(el, prevTop);
  }

  function showFull() {
    const f = el.querySelector('.full');
    if (!f) return;
    f.classList.add('show');
    clearTimeout(fullTimer);
    fullTimer = setTimeout(() => f.classList.remove('show'), 1800);
  }

  // Shared by Find and Use current location: lookup() resolves {lat, lon, name} or null.
  function setLocation(lookup, busy, found, missing) {
    status = busy;
    render();
    Promise.resolve().then(lookup).then(
      (r) => {
        if (r) {
          prefs.city = r.name;
          prefs.lat = r.lat;
          prefs.lon = r.lon;
          cityDraft = r.name;
          status = found(r.name);
          emit();
        } else status = missing;
        if (el.isConnected) render();
      },
      () => {
        status = 'Couldn\'t search right now. Check the internet connection.';
        if (el.isConnected) render();
      },
    );
  }

  function find() {
    const q = cityDraft.trim();
    if (q) setLocation(() => findCity(q), 'Searching…', (name) => `Found ${name}`, 'City not found');
  }

  const locate = () =>
    setLocation(locateMe, 'Finding your location…', (name) => `Using ${name} (approximate, from your internet connection)`,
      'Couldn\'t work out your location. Type your city instead.');

  // Remove the focused "Your dock" app; stay in the row while it has apps.
  function removeSlot() {
    slotMenu = -1;
    if (!dock[idx]) return;
    dock = dock.filter((_, i) => i !== idx);
    emit();
    if (dock.length) idx = Math.min(idx, dock.length - 1);
    else (row = 'body'), (idx = 0);
    render();
  }

  // Run an action from the bar under the selected dock app. Moving keeps the bar open so the
  // app can be pressed along several places.
  function slotAction(act) {
    if (act === 'remove') return removeSlot();
    const r = moveApp(dock, idx, act === 'left' ? -1 : 1);
    dock = r.dock;
    idx = r.index;
    emit();
    render();
  }

  function activate() {
    if (row === 'tabs') return;
    if (row === 'slots') {
      if (slotMenu < 0) (slotMenu = 1), render(); // open the bar on Remove
      else slotAction(SLOT_ACTIONS[slotMenu].act);
      return;
    }
    if (idx === doneIndex()) return close();
    if (tab === 'apps') {
      const r = toggleApp(dock, apps[idx].id);
      if (r.full) return showFull();
      dock = r.dock;
      emit();
      return render();
    }
    const what = PREF_ROWS[idx];
    if (what === 'name' || what === 'city') {
      const input = el.querySelector(what === 'name' ? '#pfName' : '#pfCity');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (what === 'find') find();
    else if (what === 'locate') locate();
    else {
      prefs[what] = !prefs[what];
      emit();
      render();
    }
  }

  function switchTab(name) {
    if (tab === name) return;
    tab = name;
    idx = 0;
    slotMenu = -1;
    status = '';
    render();
  }

  function moveBody(key) {
    if (tab === 'apps') {
      if (key === 'ArrowUp' && idx < COLS) {
        if (dock.length) (row = 'slots'), (idx = Math.min(idx, dock.length - 1));
        else (row = 'tabs'), (idx = 0);
        return;
      }
      idx = navigate({ zone: 'picker', index: idx }, key, { pickerCount: apps.length, pickerCols: COLS }).state.index;
      return;
    }
    const onCityLine = CITY_LINE.indexOf(idx) >= 0;
    const below = CITY_LINE[CITY_LINE.length - 1] + 1;
    if (key === 'ArrowUp') {
      if (idx === 0) (row = 'tabs'), (idx = 1);
      else idx = onCityLine ? 0 : idx === below ? 1 : idx - 1;
    } else if (key === 'ArrowDown') idx = onCityLine ? below : Math.min(PREF_ROWS.length - 1, idx + 1);
    else if (key === 'ArrowRight' && onCityLine) idx = Math.min(idx + 1, below - 1);
    else if (key === 'ArrowLeft' && onCityLine) idx = Math.max(idx - 1, CITY_LINE[0]);
  }

  // main.js calls this when getApps answers (or fails again) while the picker is open.
  function setApps(list, note) {
    apps = list;
    appsNote = note;
    byId = new Map(apps.map((a) => [a.id, a]));
    if (tab === 'apps' && row === 'body') idx = Math.min(idx, apps.length);
    if (el.isConnected) render();
  }

  function handleKey(key) {
    const input = editingInput();
    if (input) {
      if (key === 'ArrowLeft' || key === 'ArrowRight') return false; // move the text cursor
      input.blur();
      if (key === 'Enter' && input.id === 'pfCity') return find(), true;
      if (key === 'ArrowUp' || key === 'ArrowDown') moveBody(key);
      render();
      return true;
    }
    if (row === 'slots' && slotMenu >= 0 && key !== 'Enter') {
      if (key === 'ArrowLeft') slotMenu = Math.max(0, slotMenu - 1);
      else if (key === 'ArrowRight') slotMenu = Math.min(SLOT_ACTIONS.length - 1, slotMenu + 1);
      else slotMenu = -1; // Back, Up or Down closes the bar
      render();
      return true;
    }
    if (key === 'Escape') return close(), true;
    if (key === 'Enter') return activate(), true;
    if (row === 'tabs') {
      if (key === 'ArrowLeft') switchTab('apps'), (idx = 0);
      else if (key === 'ArrowRight') switchTab('prefs'), (idx = 1);
      else if (key === 'ArrowDown') (row = tab === 'apps' && dock.length ? 'slots' : 'body'), (idx = 0);
      else return false;
      render();
      return true;
    }
    if (row === 'slots') {
      if (key === 'ArrowLeft') idx = Math.max(0, idx - 1);
      else if (key === 'ArrowRight') idx = Math.min(dock.length - 1, idx + 1);
      else if (key === 'ArrowUp') (row = 'tabs'), (idx = 0);
      else if (key === 'ArrowDown') (row = 'body'), (idx = Math.min(idx, Math.max(0, apps.length - 1)));
      else return false;
      render();
      return true;
    }
    moveBody(key);
    render();
    return true;
  }

  function close() {
    if (!el.isConnected) return;
    const input = editingInput();
    if (input) input.blur();
    clearTimeout(fullTimer);
    el.remove();
    onClose();
  }

  el.addEventListener('input', (e) => {
    if (e.target.id === 'pfName') {
      prefs.name = e.target.value.trim();
      emit();
    } else if (e.target.id === 'pfCity') cityDraft = e.target.value;
  });
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab],[data-i],[data-slot],[data-act]');
    if (!t) return;
    if (t.dataset.act) return slotAction(t.dataset.act);
    if (t.dataset.slot !== undefined) {
      row = 'slots';
      idx = Number(t.dataset.slot);
      slotMenu = 1;
      return render();
    }
    if (t.dataset.tab) {
      row = 'tabs';
      idx = t.dataset.tab === 'apps' ? 0 : 1;
      switchTab(t.dataset.tab);
      return render();
    }
    row = 'body';
    idx = Number(t.dataset.i);
    if (t.tagName === 'INPUT') return render(), activate();
    activate();
    if (el.isConnected && tab === 'prefs') render();
  });

  render();
  return { handleKey, close, setApps };
}

export function openAppGrid({ apps, appsNote = '', onLaunch, onClose, root = document.getElementById('screen') }) {
  const el = mount(root, 'apps');
  let idx = 0;

  function render() {
    const grid = apps.map((a, i) =>
      `<div class="gapp" data-i="${i}">${tileHtml(a, idx === i ? 'focus' : '')}<span class="nm">${escapeHtml(a.name)}</span></div>`).join('');
    const prevTop = gridScroll(el);
    el.innerHTML = `<h2>All apps</h2>
      ${apps.length ? `<div class="gridwrap"><div class="grid">${grid}</div></div>` : appsMsg(appsNote)}
      <div class="done${idx === apps.length ? ' focus' : ''}" data-i="${apps.length}">Close</div>`;
    scrollToFocus(el, prevTop);
  }

  function activate() {
    const app = apps[idx];
    close();
    if (app) onLaunch(app);
  }

  function handleKey(key) {
    const r = navigate({ zone: 'picker', index: idx }, key, { pickerCount: apps.length, pickerCols: COLS });
    if (r.action === 'close') close();
    else if (r.action === 'activate') activate();
    else {
      idx = r.state.index;
      render();
    }
    return true;
  }

  function close() {
    if (!el.isConnected) return;
    el.remove();
    onClose();
  }

  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-i]');
    if (!t) return;
    idx = Number(t.dataset.i);
    activate();
  });

  function setApps(list, note) {
    apps = list;
    appsNote = note;
    idx = Math.min(idx, apps.length);
    if (el.isConnected) render();
  }

  render();
  return { handleKey, close, setApps };
}

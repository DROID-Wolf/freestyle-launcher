// Overlays: the customize picker (Apps + Preferences tabs) and the all-apps launch grid.
// Each returns { handleKey(key) -> boolean (consumed), close() }; main.js routes keys to it.
import { navigate } from './focus.js';
import { toggleApp, MAX_DOCK } from './dock.js';
import { tileHtml, escapeHtml } from './icons.js';

const COLS = 6;
const PREF_ROWS = ['name', 'city', 'find', 'hour24', 'reduceMotion', 'done'];

const mount = (root, cls) => {
  const el = document.createElement('div');
  el.className = `ov ${cls}`;
  root.appendChild(el);
  return el;
};

const scrollToFocus = (el) => {
  const f = el.querySelector('.focus');
  if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' });
};

export function openPicker({ apps, dock, prefs, onChange, onClose, findCity, root = document.getElementById('screen') }) {
  const el = mount(root, 'pick');
  let tab = 'apps';
  let row = 'body'; // 'tabs' | 'body'
  let idx = 0;
  let status = '';
  let fullTimer = 0;
  let cityDraft = prefs.city;
  const byId = new Map(apps.map((a) => [a.id, a]));

  const emit = () => onChange({ dock: dock.slice(), prefs: { ...prefs } });
  const editingInput = () => {
    const a = document.activeElement;
    return a && a.tagName === 'INPUT' && el.contains(a) ? a : null;
  };
  const isFocus = (r, i) => (row === r && idx === i ? ' focus' : '');
  const doneIndex = () => (tab === 'apps' ? apps.length : PREF_ROWS.length - 1);

  function appsHtml() {
    const slots = [];
    for (let i = 0; i < MAX_DOCK; i++) {
      const a = byId.get(dock[i]);
      slots.push(a ? tileHtml(a, 'slot') : '<div class="slot"></div>');
    }
    const grid = apps.map((a, i) => {
      const n = dock.indexOf(a.id);
      const badge = n >= 0 ? `<span class="badge">${n + 1}</span>` : '';
      const tile = tileHtml(a, isFocus('body', i).trim()).replace(/<\/div>$/, `${badge}</div>`);
      return `<div class="gapp${n >= 0 ? ' sel' : ''}" data-i="${i}">${tile}${escapeHtml(a.name)}</div>`;
    }).join('');
    return `<p>Select up to ${MAX_DOCK} apps. They appear in the dock in the order you pick them. Select one again to remove it.</p>
      <div class="slots"><span class="lbl">Your dock</span>${slots.join('')}</div>
      ${apps.length ? `<div class="gridwrap"><div class="grid">${grid}</div></div>` : '<div class="msg">Couldn\'t load the installed apps.</div>'}
      <div class="full">Dock is full. Remove an app first.</div>`;
  }

  function prefsHtml() {
    const toggle = (key, i, label) =>
      `<div class="toggle${prefs[key] ? ' on' : ''}${isFocus('body', i)}" data-i="${i}"><span class="sw"></span>${label}</div>`;
    return `<p>Your name appears in the greeting. The city is used for the weather.</p>
      <div class="form">
        <div class="field"><label>Name</label><input id="pfName" data-i="0" class="${isFocus('body', 0)}" value="${escapeHtml(prefs.name)}" maxlength="30"></div>
        <div class="field"><label>City</label><input id="pfCity" data-i="1" class="${isFocus('body', 1)}" value="${escapeHtml(cityDraft)}" maxlength="60">
          <div class="btn${isFocus('body', 2)}" data-i="2">Find</div></div>
        <div class="field"><label></label><span class="status">${escapeHtml(status)}</span></div>
        <div class="field"><label>Clock</label>${toggle('hour24', 3, '24-hour time')}</div>
        <div class="field"><label>Motion</label>${toggle('reduceMotion', 4, 'Reduce motion')}</div>
      </div>`;
  }

  function render() {
    const tabBtn = (name, i, label) => `<div class="tab${tab === name ? ' on' : ''}${isFocus('tabs', i)}" data-tab="${name}">${label}</div>`;
    el.innerHTML = `<h2>Customize</h2>
      <div class="tabs">${tabBtn('apps', 0, 'Apps')}${tabBtn('prefs', 1, 'Preferences')}</div>
      ${tab === 'apps' ? appsHtml() : prefsHtml()}
      <div class="done${isFocus('body', doneIndex())}" data-i="${doneIndex()}">Done</div>`;
    scrollToFocus(el);
  }

  function showFull() {
    const f = el.querySelector('.full');
    if (!f) return;
    f.classList.add('show');
    clearTimeout(fullTimer);
    fullTimer = setTimeout(() => f.classList.remove('show'), 1800);
  }

  function find() {
    const q = cityDraft.trim();
    if (!q) return;
    status = 'Searching…';
    render();
    Promise.resolve(findCity(q)).then(
      (r) => {
        if (r) {
          prefs.city = r.name;
          prefs.lat = r.lat;
          prefs.lon = r.lon;
          cityDraft = r.name;
          status = `Found ${r.name}`;
          emit();
        } else status = 'City not found';
        if (el.isConnected) render();
      },
      () => {
        status = 'Couldn\'t search right now. Check the internet connection.';
        if (el.isConnected) render();
      },
    );
  }

  function activate() {
    if (row === 'tabs') return;
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
    status = '';
    render();
  }

  function moveBody(key) {
    if (tab === 'apps') {
      if (key === 'ArrowUp' && idx < COLS) return void ((row = 'tabs'), (idx = 0));
      idx = navigate({ zone: 'picker', index: idx }, key, { pickerCount: apps.length, pickerCols: COLS }).state.index;
      return;
    }
    if (key === 'ArrowUp') idx === 0 ? ((row = 'tabs'), (idx = 1)) : (idx = idx === 3 ? 1 : idx - 1);
    else if (key === 'ArrowDown') idx = Math.min(PREF_ROWS.length - 1, idx === 1 ? 3 : idx + 1);
    else if (key === 'ArrowRight' && idx === 1) idx = 2;
    else if (key === 'ArrowLeft' && idx === 2) idx = 1;
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
    if (key === 'Escape') return close(), true;
    if (key === 'Enter') return activate(), true;
    if (row === 'tabs') {
      if (key === 'ArrowLeft') switchTab('apps'), (idx = 0);
      else if (key === 'ArrowRight') switchTab('prefs'), (idx = 1);
      else if (key === 'ArrowDown') (row = 'body'), (idx = 0);
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
    const t = e.target.closest('[data-tab],[data-i]');
    if (!t) return;
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
  return { handleKey, close };
}

export function openAppGrid({ apps, onLaunch, onClose, root = document.getElementById('screen') }) {
  const el = mount(root, 'apps');
  let idx = 0;

  function render() {
    const grid = apps.map((a, i) =>
      `<div class="gapp" data-i="${i}">${tileHtml(a, idx === i ? 'focus' : '')}${escapeHtml(a.name)}</div>`).join('');
    el.innerHTML = `<h2>All apps</h2>
      ${apps.length ? `<div class="gridwrap"><div class="grid">${grid}</div></div>` : '<div class="msg">Couldn\'t load the installed apps.</div>'}
      <div class="done${idx === apps.length ? ' focus' : ''}" data-i="${apps.length}">Close</div>`;
    scrollToFocus(el);
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

  render();
  return { handleKey, close };
}

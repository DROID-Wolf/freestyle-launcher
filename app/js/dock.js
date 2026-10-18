// Dock state: an ordered list of app IDs (max 6). Pure functions + storage helpers.
export const MAX_DOCK = 6;
const KEY = 'fl.dock';

export function toggleApp(dock, id) {
  if (dock.includes(id)) return { dock: dock.filter((x) => x !== id), full: false };
  if (dock.length >= MAX_DOCK) return { dock, full: true };
  return { dock: [...dock, id], full: false };
}

// Move the app at `index` one place left (delta -1) or right (+1); stops at the ends.
export function moveApp(dock, index, delta) {
  const to = index + delta;
  if (to < 0 || to >= dock.length) return { dock: dock.slice(), index };
  const next = dock.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return { dock: next, index: to };
}

export function pruneDock(dock, installedIds) {
  const installed = new Set(installedIds);
  return dock.filter((id) => installed.has(id));
}

export function loadDock(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(KEY));
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x) => typeof x === 'string').slice(0, MAX_DOCK);
  } catch (e) {
    return null;
  }
}

export function saveDock(storage, dock) {
  try {
    storage.setItem(KEY, JSON.stringify(dock));
  } catch (e) {
    /* storage unavailable: dock just won't persist */
  }
}

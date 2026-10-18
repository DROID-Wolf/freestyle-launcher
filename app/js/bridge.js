// postMessage client for the Tizen shell, plus a mock for desktop browsers.
// Request: {fl:1, id, method, params}. Reply: {fl:1, id, ok, result|error}.
import { MOCK_APPS } from './mock-apps.js';

export function createBridge({ target, source, timeoutMs = 2000 }) {
  let nextId = 1;
  const pending = new Map();

  source.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || typeof msg !== 'object' || msg.fl !== 1) return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(String(msg.error || 'error')));
  });

  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('timeout'));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      // The shell's origin varies (app:// on device, file:// in the fallback), so use '*'.
      // Nothing sensitive is sent; the shell validates our origin on its side.
      target.postMessage({ fl: 1, id, method, params }, '*');
    });

  return {
    getApps: () => call('getApps'),
    launch: (id) => call('launch', { id }).then(() => {}),
    openSettings: () => call('openSettings').then(() => {}),
    openInputs: () => call('openInputs').then(() => {}),
  };
}

export function mockBridge() {
  const log = (...args) => console.log('[mock bridge]', ...args);
  return {
    getApps: () => Promise.resolve(MOCK_APPS.map((a) => ({ ...a }))),
    launch: (id) => (log('launch', id), Promise.resolve()),
    openSettings: () => (log('openSettings'), Promise.resolve()),
    openInputs: () => (log('openInputs'), Promise.resolve()),
  };
}

export function pickBridge(win) {
  return win.parent !== win ? createBridge({ target: win.parent, source: win }) : mockBridge();
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBridge, mockBridge, pickBridge } from '../js/bridge.js';
import { MOCK_APPS } from '../js/mock-apps.js';

// Fake shell: `target.postMessage` hands the request to `respond`, whose return value
// (if any) is dispatched back on `source` as a message event.
const fakePair = (respond) => {
  const source = new EventTarget();
  const sent = [];
  const deliver = (data) => {
    const e = new Event('message');
    e.data = data;
    source.dispatchEvent(e);
  };
  const target = {
    postMessage(msg) {
      sent.push(msg);
      const reply = respond(msg);
      if (reply) setTimeout(() => deliver(reply), 0);
    },
  };
  return { target, source, sent, deliver };
};

test('request gets a reply and resolves', async () => {
  const apps = [{ id: 'a', name: 'A', icon: null }];
  const { target, source, sent } = fakePair((m) => ({ fl: 1, id: m.id, ok: true, result: apps }));
  const bridge = createBridge({ target, source, timeoutMs: 50 });
  assert.deepEqual(await bridge.getApps(), apps);
  assert.equal(sent[0].fl, 1);
  assert.equal(sent[0].method, 'getApps');
  assert.equal(typeof sent[0].id, 'number');
});

test('launch sends the app id as params', async () => {
  const { target, source, sent } = fakePair((m) => ({ fl: 1, id: m.id, ok: true }));
  const bridge = createBridge({ target, source, timeoutMs: 50 });
  await bridge.launch('netflix');
  assert.equal(sent[0].method, 'launch');
  assert.deepEqual(sent[0].params, { id: 'netflix' });
});

test('openSettings and openNetwork send their methods; there is no openInputs', async () => {
  const { target, source, sent } = fakePair((m) => ({ fl: 1, id: m.id, ok: true }));
  const bridge = createBridge({ target, source, timeoutMs: 50 });
  await bridge.openSettings();
  await bridge.openNetwork();
  assert.deepEqual(sent.map((m) => m.method), ['openSettings', 'openNetwork']);
  assert.notEqual(sent[0].id, sent[1].id);
  assert.equal(bridge.openInputs, undefined);
  assert.equal(mockBridge().openInputs, undefined);
});

test('getApps gets its own, longer timeout (big app lists are slow on the device)', async () => {
  const { target, source } = fakePair(() => null);
  const bridge = createBridge({ target, source, timeoutMs: 20, appsTimeoutMs: 120 });
  const t0 = Date.now();
  await assert.rejects(bridge.launch('x'), (err) => err.message === 'timeout');
  assert.ok(Date.now() - t0 < 100);
  const t1 = Date.now();
  await assert.rejects(bridge.getApps(), (err) => err.message === 'timeout');
  assert.ok(Date.now() - t1 >= 110);
});

test('a slow getApps reply inside appsTimeoutMs still resolves', async () => {
  const source = new EventTarget();
  const target = {
    postMessage(m) {
      setTimeout(() => {
        const e = new Event('message');
        e.data = { fl: 1, id: m.id, ok: true, result: [] };
        source.dispatchEvent(e);
      }, 60);
    },
  };
  const bridge = createBridge({ target, source, timeoutMs: 20, appsTimeoutMs: 200 });
  assert.deepEqual(await bridge.getApps(), []);
});

test('reply with ok:false rejects with the error', async () => {
  const { target, source } = fakePair((m) => ({ fl: 1, id: m.id, ok: false, error: 'not installed' }));
  const bridge = createBridge({ target, source, timeoutMs: 50 });
  await assert.rejects(bridge.launch('x'), (err) => err.message === 'not installed');
});

test('no reply within the timeout rejects with timeout', async () => {
  const { target, source } = fakePair(() => null);
  const bridge = createBridge({ target, source, timeoutMs: 50, appsTimeoutMs: 50 });
  await assert.rejects(bridge.getApps(), (err) => err.message === 'timeout');
});

test('replies with a non-matching id are ignored', async () => {
  const { target, source } = fakePair((m) => ({ fl: 1, id: m.id + 1000, ok: true, result: [] }));
  const bridge = createBridge({ target, source, timeoutMs: 50, appsTimeoutMs: 50 });
  await assert.rejects(bridge.getApps(), (err) => err.message === 'timeout');
});

test('non-bridge messages (no fl, key forwards) are ignored', async () => {
  const { target, source, deliver } = fakePair(() => null);
  const bridge = createBridge({ target, source, timeoutMs: 50, appsTimeoutMs: 50 });
  const p = bridge.getApps();
  deliver({ fl: 1, key: 'Escape' });
  deliver(null);
  deliver('hello');
  await assert.rejects(p, (err) => err.message === 'timeout');
});

test('MOCK_APPS has the 12 mockup apps as {id, name, icon}', () => {
  assert.equal(MOCK_APPS.length, 12);
  assert.deepEqual(MOCK_APPS.slice(0, 5).map((a) => a.id), ['netflix', 'youtube', 'disney', 'spotify', 'prime']);
  for (const a of MOCK_APPS) {
    assert.equal(typeof a.id, 'string');
    assert.equal(typeof a.name, 'string');
    assert.equal(a.icon, null);
  }
});

test('mockBridge returns copies of MOCK_APPS and resolves the other calls', async () => {
  const bridge = mockBridge();
  const apps = await bridge.getApps();
  assert.deepEqual(apps, MOCK_APPS);
  apps.pop();
  assert.equal((await bridge.getApps()).length, 12);
  const log = console.log;
  console.log = () => {};
  try {
    await bridge.launch('netflix');
    await bridge.openSettings();
    await bridge.openNetwork();
  } finally {
    console.log = log;
  }
});

test('pickBridge uses the real bridge inside a frame and the mock at top level', async () => {
  const top = { addEventListener() {} };
  top.parent = top;
  assert.equal((await pickBridge(top).getApps()).length, 12);

  const sent = [];
  const parent = { postMessage: (m) => sent.push(m) };
  const framed = { parent, addEventListener() {} };
  pickBridge(framed).openSettings().catch(() => {}); // not getApps: its 15 s timer would hold the run open
  assert.equal(sent.length, 1);
  assert.equal(sent[0].method, 'openSettings');
});

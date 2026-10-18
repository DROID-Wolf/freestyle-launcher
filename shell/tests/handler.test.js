import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// handler.js is a classic script (the widget loads it from file://, where ES modules are
// unreliable), so evaluate it in this realm and pull out the function it declares.
const file = new URL('../handler.js', import.meta.url);
const handleMessage = vm.runInThisContext(
  `(function () {\n${readFileSync(file, 'utf8')}\nreturn handleMessage;\n})()`,
  { filename: file.pathname },
);

const ORIGIN = 'https://droid-wolf.github.io';
const OWN_ID = 'FlLaunch01.FreestyleLauncher';

const fakeTizen = ({ launchError = null, launchThrows = null } = {}) => {
  const launched = [];
  return {
    launched,
    application: {
      getCurrentApplication: () => ({ appInfo: { id: OWN_ID } }),
      getAppsInfo(ok) {
        setTimeout(() => ok([
          { id: 'netflix.app', name: 'Netflix', iconPath: '/opt/usr/apps/netflix/icon.png', show: true },
          { id: 'hidden.svc', name: 'Service', iconPath: '', show: false },
          { id: OWN_ID, name: 'Freestyle Launcher', iconPath: '/opt/me.png', show: true },
          { id: 'yt.app', name: 'YouTube', iconPath: '', show: true },
        ]), 0);
      },
      launch(id, ok, err) {
        if (launchThrows) throw launchThrows;
        launched.push(id);
        setTimeout(() => (launchError ? err(launchError) : ok()), 0);
      },
    },
  };
};

const run = async (data, { origin = ORIGIN, tizen = fakeTizen(), loadIcon } = {}) => {
  const replies = [];
  await handleMessage({ origin, data }, { tizen, allowedOrigins: [ORIGIN, 'file://'], reply: (m) => replies.push(m), loadIcon });
  return { replies, tizen };
};

test('message from an unknown origin gets no reply and calls nothing', async () => {
  const { replies, tizen } = await run({ fl: 1, id: 1, method: 'launch', params: { id: 'x' } }, { origin: 'https://evil.example' });
  assert.deepEqual(replies, []);
  assert.deepEqual(tizen.launched, []);
});

test('malformed messages from the allowed origin are ignored', async () => {
  for (const data of [null, 'hi', { fl: 2, id: 1, method: 'getApps' }, { fl: 1, method: 'getApps' }, { fl: 1, key: 'Escape' }]) {
    assert.deepEqual((await run(data)).replies, []);
  }
});

test('getApps replies with visible apps as {id, name, icon}, excluding the shell', async () => {
  const { replies } = await run({ fl: 1, id: 7, method: 'getApps' });
  assert.deepEqual(replies, [{
    fl: 1, id: 7, ok: true,
    result: [
      { id: 'netflix.app', name: 'Netflix', icon: 'file:///opt/usr/apps/netflix/icon.png' },
      { id: 'yt.app', name: 'YouTube', icon: null },
    ],
  }]);
});

test('with loadIcon, getApps returns the picture as a data URL (the https UI cannot read file:// icons)', async () => {
  const asked = [];
  const loadIcon = (p) => (asked.push(p), Promise.resolve(`data:image/png;base64,${p.length}`));
  const { replies } = await run({ fl: 1, id: 11, method: 'getApps' }, { loadIcon });
  assert.deepEqual(asked, ['/opt/usr/apps/netflix/icon.png']); // apps without an iconPath aren't asked for
  assert.deepEqual(replies[0].result, [
    { id: 'netflix.app', name: 'Netflix', icon: 'data:image/png;base64,30' },
    { id: 'yt.app', name: 'YouTube', icon: null, iconError: 'no icon' },
  ]);
});

test('an icon that fails to load gives icon null and the reason', async () => {
  const loadIcon = () => Promise.reject(new Error('SecurityError: tainted canvas'));
  const { replies } = await run({ fl: 1, id: 12, method: 'getApps' }, { loadIcon });
  assert.equal(replies[0].ok, true);
  assert.deepEqual(replies[0].result[0], { id: 'netflix.app', name: 'Netflix', icon: null, iconError: 'SecurityError: tainted canvas' });
});

test('icons load at most 6 at a time', async () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `app${i}`, name: `App ${i}`, iconPath: `/i/${i}.png`, show: true }));
  const tizen = fakeTizen();
  tizen.application.getAppsInfo = (ok) => setTimeout(() => ok(many), 0);
  let inFlight = 0;
  let peak = 0;
  const loadIcon = () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    return new Promise((r) => setTimeout(() => { inFlight--; r('data:x'); }, 5));
  };
  const { replies } = await run({ fl: 1, id: 13, method: 'getApps' }, { tizen, loadIcon });
  assert.equal(replies[0].result.length, 20);
  assert.ok(replies[0].result.every((a) => a.icon === 'data:x'));
  assert.ok(peak <= 6, `peak ${peak}`);
});

test('launch calls tizen.application.launch and replies ok', async () => {
  const { replies, tizen } = await run({ fl: 1, id: 3, method: 'launch', params: { id: 'yt.app' } });
  assert.deepEqual(tizen.launched, ['yt.app']);
  assert.deepEqual(replies, [{ fl: 1, id: 3, ok: true }]);
});

test('launch error callback replies ok:false with the error', async () => {
  const tizen = fakeTizen({ launchError: { name: 'NotFoundError', message: 'App not found' } });
  const { replies } = await run({ fl: 1, id: 4, method: 'launch', params: { id: 'gone' } }, { tizen });
  assert.deepEqual(replies, [{ fl: 1, id: 4, ok: false, error: 'App not found' }]);
});

test('a synchronous tizen exception replies ok:false', async () => {
  const tizen = fakeTizen({ launchThrows: { name: 'TypeMismatchError', message: 'bad id' } });
  const { replies } = await run({ fl: 1, id: 5, method: 'launch', params: {} }, { tizen });
  assert.deepEqual(replies, [{ fl: 1, id: 5, ok: false, error: 'bad id' }]);
});

// App IDs confirmed on the Freestyle 2nd Gen by launching them and watching the screen.
test('openSettings and openNetwork launch the system apps', async () => {
  const tizen = fakeTizen();
  await run({ fl: 1, id: 8, method: 'openSettings' }, { tizen });
  await run({ fl: 1, id: 10, method: 'openNetwork' }, { tizen });
  assert.deepEqual(tizen.launched, ['org.tizen.menu', 'org.tizen.NetworkSetting-Tizen']);
});

test('openInputs is gone (no input app can be opened on this model)', async () => {
  const { replies } = await run({ fl: 1, id: 9, method: 'openInputs' });
  assert.deepEqual(replies, [{ fl: 1, id: 9, ok: false, error: 'unknown method' }]);
});

test('unknown method replies ok:false "unknown method"', async () => {
  const { replies } = await run({ fl: 1, id: 2, method: 'rm -rf' });
  assert.deepEqual(replies, [{ fl: 1, id: 2, ok: false, error: 'unknown method' }]);
});

test('missing tizen (desktop browser) replies ok:false instead of throwing', async () => {
  const { replies } = await run({ fl: 1, id: 6, method: 'getApps' }, { tizen: null });
  assert.equal(replies[0].ok, false);
});

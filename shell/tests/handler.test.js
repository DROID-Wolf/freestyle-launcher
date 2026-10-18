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

const run = async (data, { origin = ORIGIN, tizen = fakeTizen() } = {}) => {
  const replies = [];
  await handleMessage({ origin, data }, { tizen, allowedOrigins: [ORIGIN, 'file://'], reply: (m) => replies.push(m) });
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

// App IDs read from the Freestyle 2nd Gen's own app list (sdb shell 0 applist).
test('openSettings, openInputs and openNetwork launch the system apps', async () => {
  const tizen = fakeTizen();
  await run({ fl: 1, id: 8, method: 'openSettings' }, { tizen });
  await run({ fl: 1, id: 9, method: 'openInputs' }, { tizen });
  await run({ fl: 1, id: 10, method: 'openNetwork' }, { tizen });
  assert.deepEqual(tizen.launched, ['com.samsung.tv.coba.setting', 'org.tizen.SMSourceAPP', 'com.samsung.tv.coba.setting.networksettings']);
});

test('unknown method replies ok:false "unknown method"', async () => {
  const { replies } = await run({ fl: 1, id: 2, method: 'rm -rf' });
  assert.deepEqual(replies, [{ fl: 1, id: 2, ok: false, error: 'unknown method' }]);
});

test('missing tizen (desktop browser) replies ok:false instead of throwing', async () => {
  const { replies } = await run({ fl: 1, id: 6, method: 'getApps' }, { tizen: null });
  assert.equal(replies[0].ok, false);
});

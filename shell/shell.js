// Tizen shell: loads the UI from GitHub Pages (or the bundled fallback when offline) in an
// iframe and answers its bridge requests via handler.js. Classic script, like handler.js.
(function () {
  var PAGES = 'https://droid-wolf.github.io/freestyle-launcher/';
  var FALLBACK = 'fallback/index.html';
  var ONLINE_TIMEOUT = 4000;
  var BACK = 10009;
  var frame = document.getElementById('app');
  // The bundled fallback runs from file://, which browsers report as 'file://' or 'null'.
  // That's only safe because the message listener also requires e.source === our own iframe.
  var allowedOrigins = ['https://droid-wolf.github.io', location.origin, 'file://', 'null'];

  // Arrows, Enter and Back reach a TV web app without registration. Register any extra
  // remote keys here if the UI ever uses them (e.g. 'MediaPlayPause').
  var EXTRA_KEYS = [];
  EXTRA_KEYS.forEach(function (k) {
    try {
      tizen.tvinputdevice.registerKey(k);
    } catch (e) { /* not available on this device */ }
  });

  // Back must never exit the launcher (it would break Autorun Last App): forward it to the UI
  // as Escape, which only closes overlays. The UI also maps 10009 itself when it has focus.
  document.addEventListener('keydown', function (e) {
    if (e.keyCode !== BACK) return;
    e.preventDefault();
    if (frame.contentWindow) frame.contentWindow.postMessage({ fl: 1, key: 'Escape' }, '*');
  });

  // App icons live on the device (file://), which the https UI can't load, so hand them over
  // as small data URLs. Try drawing the image first, then reading the file directly.
  var ICON_PX = 128;
  var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };

  function iconViaCanvas(path) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = c.height = ICON_PX;
          c.getContext('2d').drawImage(img, 0, 0, ICON_PX, ICON_PX);
          resolve(c.toDataURL('image/png'));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = function () { reject(new Error('image did not load')); };
      img.src = path.charAt(0) === '/' ? 'file://' + path : path;
    });
  }

  function iconViaFile(path) {
    var fh = tizen.filesystem.openFile(path, 'r');
    try {
      var bytes = fh.readData();
      var bin = '';
      for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      var ext = (path.split('.').pop() || '').toLowerCase();
      return 'data:' + (MIME[ext] || 'image/png') + ';base64,' + btoa(bin);
    } finally {
      fh.close();
    }
  }

  function loadIcon(path) {
    return iconViaCanvas(path).catch(function (e1) {
      try {
        return iconViaFile(path);
      } catch (e2) {
        throw new Error('canvas: ' + (e1.message || e1) + '; file: ' + (e2.message || e2.name || e2));
      }
    });
  }

  window.addEventListener('message', function (e) {
    if (e.source !== frame.contentWindow) return;
    var target = /^https?:\/\//.test(e.origin) ? e.origin : '*';
    handleMessage(e, {
      tizen: window.tizen,
      allowedOrigins: allowedOrigins,
      reply: function (msg) { e.source.postMessage(msg, target); },
      loadIcon: loadIcon,
    });
  });

  frame.addEventListener('load', function () {
    try {
      frame.contentWindow.focus(); // send remote keys straight to the UI
    } catch (e) { /* ignore */ }
  });

  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, ONLINE_TIMEOUT);
  // Each deploy also publishes the UI under v/<build>/ (see pages.yml). Loading that exact
  // folder means a cached copy of an older deploy can never be shown.
  fetch(PAGES + 'version.json', { signal: ctrl.signal, cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().catch(function () { return {}; });
    })
    .then(function (v) {
      var build = v && typeof v.build === 'string' && /^[0-9a-f]{7,40}$/.test(v.build) ? v.build : '';
      frame.src = build ? PAGES + 'v/' + build + '/' : PAGES + '?t=' + Date.now();
    })
    .catch(function () {
      frame.src = FALLBACK;
    })
    .then(function () { clearTimeout(timer); });
})();

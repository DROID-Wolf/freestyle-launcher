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

  window.addEventListener('message', function (e) {
    if (e.source !== frame.contentWindow) return;
    var target = /^https?:\/\//.test(e.origin) ? e.origin : '*';
    handleMessage(e, {
      tizen: window.tizen,
      allowedOrigins: allowedOrigins,
      reply: function (msg) { e.source.postMessage(msg, target); },
    });
  });

  frame.addEventListener('load', function () {
    try {
      frame.contentWindow.focus(); // send remote keys straight to the UI
    } catch (e) { /* ignore */ }
  });

  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, ONLINE_TIMEOUT);
  fetch(PAGES + 'version.json', { signal: ctrl.signal, cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      frame.src = PAGES;
    })
    .catch(function () {
      frame.src = FALLBACK;
    })
    .then(function () { clearTimeout(timer); });
})();

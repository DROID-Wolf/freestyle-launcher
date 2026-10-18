// Shell side of the postMessage bridge. Classic script (no import/export): the widget loads
// it from file://, where ES modules are unreliable. Declares the global `handleMessage`.
// Request: {fl:1, id, method, params}. Reply: {fl:1, id, ok, result|error}.
// System app IDs confirmed on the Freestyle 2nd Gen by launching them and watching the screen.
// (No app opens Connected Devices / the input list, so there is no openInputs.)
var SETTINGS_APP = 'org.tizen.menu';
var NETWORK_APP = 'org.tizen.NetworkSetting-Tizen';
var ICON_CONCURRENCY = 6;

function handleMessage(event, opts) {
  var data = event.data;
  if (opts.allowedOrigins.indexOf(event.origin) < 0) return Promise.resolve(); // silent
  if (!data || typeof data !== 'object' || data.fl !== 1 || typeof data.id !== 'number') return Promise.resolve();

  var tizen = opts.tizen;
  var errText = function (e) {
    return String((e && (e.message || e.name)) || e || 'error');
  };

  var launch = function (id) {
    return new Promise(function (resolve, reject) {
      tizen.application.launch(id, function () { resolve(); }, reject);
    });
  };

  var getApps = function () {
    var ownId = null;
    try {
      ownId = tizen.application.getCurrentApplication().appInfo.id;
    } catch (e) { /* keep null */ }
    return new Promise(function (resolve, reject) {
      tizen.application.getAppsInfo(resolve, reject);
    }).then(function (infos) {
      var visible = infos.filter(function (a) { return a.show !== false && a.id !== ownId; });
      if (!opts.loadIcon) {
        return visible.map(function (a) {
          var p = a.iconPath || '';
          return { id: a.id, name: a.name || a.id, icon: p ? (p.charAt(0) === '/' ? 'file://' + p : p) : null };
        });
      }
      return withIcons(visible, opts.loadIcon);
    });
  };

  // The UI is served over https and can't read the device's file:// icons, so the shell
  // loads each icon itself (opts.loadIcon -> data URL), a few at a time.
  var withIcons = function (list, loadIcon) {
    var out = list.map(function (a) { return { id: a.id, name: a.name || a.id, icon: null }; });
    var next = 0;
    var worker = function () {
      if (next >= list.length) return Promise.resolve();
      var i = next++;
      if (!list[i].iconPath) {
        out[i].iconError = 'no icon';
        return worker();
      }
      return Promise.resolve()
        .then(function () { return loadIcon(list[i].iconPath); })
        .then(
          function (url) { out[i].icon = url; },
          function (e) { out[i].iconError = errText(e); }
        )
        .then(worker);
    };
    var workers = [];
    for (var w = 0; w < ICON_CONCURRENCY; w++) workers.push(worker());
    return Promise.all(workers).then(function () { return out; });
  };

  var methods = {
    getApps: getApps,
    launch: function (params) { return launch(params && params.id); },
    openSettings: function () { return launch(SETTINGS_APP); },
    openNetwork: function () { return launch(NETWORK_APP); },
  };

  var method = Object.prototype.hasOwnProperty.call(methods, data.method) ? methods[data.method] : null;
  return new Promise(function (resolve) {
    if (!method) throw new Error('unknown method');
    if (!tizen || !tizen.application) throw new Error('tizen API unavailable');
    resolve(method(data.params)); // synchronous tizen throws become rejections
  }).then(
    function (result) {
      var msg = { fl: 1, id: data.id, ok: true };
      if (result !== undefined) msg.result = result;
      opts.reply(msg);
    },
    function (e) {
      opts.reply({ fl: 1, id: data.id, ok: false, error: errText(e) });
    }
  );
}

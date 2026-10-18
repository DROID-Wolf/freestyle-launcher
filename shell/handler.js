// Shell side of the postMessage bridge. Classic script (no import/export): the widget loads
// it from file://, where ES modules are unreliable. Declares the global `handleMessage`.
// Request: {fl:1, id, method, params}. Reply: {fl:1, id, ok, result|error}.
var SETTINGS_APP = 'com.samsung.tv.menu';
var INPUTS_APP = 'org.tizen.tv-source';

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
      return infos
        .filter(function (a) { return a.show !== false && a.id !== ownId; })
        .map(function (a) {
          var p = a.iconPath || '';
          return { id: a.id, name: a.name || a.id, icon: p ? (p.charAt(0) === '/' ? 'file://' + p : p) : null };
        });
    });
  };

  var methods = {
    getApps: getApps,
    launch: function (params) { return launch(params && params.id); },
    openSettings: function () { return launch(SETTINGS_APP); },
    openInputs: function () { return launch(INPUTS_APP); },
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

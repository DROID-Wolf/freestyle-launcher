// App tiles: the real icon when the bridge gives one, else a colored letter tile.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// djb2 hash of the id -> one of the mockup's 12 gradient classes.
export function colorClass(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return `c${(h % 12) + 1}`;
}

const letterOf = (name) => {
  const m = String(name).match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : '?';
};

// The img sits over the letter; if it fails to load (e.g. a device-local path) it removes
// itself and the letter tile shows through.
export function tileHtml(app, extraClass = '') {
  const cls = `tile ${colorClass(app.id)}${extraClass ? ' ' + extraClass : ''}`;
  const img = app.icon ? `<img src="${escapeHtml(app.icon)}" alt="" onerror="this.remove()">` : '';
  return `<div class="${cls}" data-id="${escapeHtml(app.id)}">${letterOf(app.name)}${img}` +
    `<span class="tip">${escapeHtml(app.name)}</span></div>`;
}

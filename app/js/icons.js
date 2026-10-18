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

// The device lists ~1,000 entries, mostly system services without artwork: keep only apps with
// a real picture. If no picture loaded at all (and the shell said why), show everything + reason.
// Apps without their own artwork get Tizen's default icon (blue "TIZEN"): a picture shared by
// PLACEHOLDER_MIN or more apps is that placeholder, so those are hidden. A picture shared by a
// few apps is one app listed several times (e.g. YouTube: store app, built-in copy, test
// suite), so just one is kept: the store app (package id like "9Ur5IzDKqV."), else the first
// that isn't a test/debug entry.
const PLACEHOLDER_MIN = 6;
const STORE_ID = /^[A-Za-z0-9]{10}\./;
const TESTY = /test|debug/i;

function pickOne(group) {
  return group.find((a) => STORE_ID.test(a.id)) || group.find((a) => !TESTY.test(a.name)) || group[0];
}

// Store apps on the Freestyle (YouTube, YouTube TV, …) report a generic picture shared by many
// apps: the device has no local copy of their logo. For well-known services, use the real logo
// from the service's website instead. Most specific patterns first.
const BRANDS = [
  [/youtube\s*tv/i, 'tv.youtube.com'], [/youtube\s*kids/i, 'youtubekids.com'], [/youtube/i, 'youtube.com'],
  [/netflix/i, 'netflix.com'], [/prime\s*video|amazon\s*video/i, 'primevideo.com'], [/disney/i, 'disneyplus.com'],
  [/hulu/i, 'hulu.com'], [/^max$|hbo/i, 'max.com'], [/spotify/i, 'spotify.com'], [/plex/i, 'plex.tv'],
  [/tubi/i, 'tubitv.com'], [/twitch/i, 'twitch.tv'], [/apple\s*tv/i, 'tv.apple.com'], [/apple\s*music/i, 'music.apple.com'],
  [/paramount/i, 'paramountplus.com'], [/peacock/i, 'peacocktv.com'], [/pluto/i, 'pluto.tv'], [/sling/i, 'sling.com'],
  [/fubo/i, 'fubo.tv'], [/crunchyroll/i, 'crunchyroll.com'], [/espn/i, 'espn.com'], [/pandora/i, 'pandora.com'],
  [/amazon\s*music/i, 'music.amazon.com'], [/philo/i, 'philo.com'], [/vudu|fandango/i, 'vudu.com'],
];

export function brandIcon(name) {
  const hit = BRANDS.find(([re]) => re.test(name));
  return hit ? `https://www.google.com/s2/favicons?domain=${hit[1]}&sz=128` : null;
}

export function withPictures(list) {
  const pictured = list.filter((a) => typeof a.icon === 'string' && a.icon);
  if (pictured.length) {
    const groups = new Map();
    for (const a of pictured) groups.set(a.icon, (groups.get(a.icon) || []).concat(a));
    const keep = new Map(); // original app -> app to show
    const rescued = new Map(); // brand logo -> apps behind a placeholder that use it
    for (const group of groups.values()) {
      if (group.length < PLACEHOLDER_MIN) {
        const one = pickOne(group);
        keep.set(one, one);
        continue;
      }
      for (const a of group) {
        const logo = brandIcon(a.name);
        if (logo) rescued.set(logo, (rescued.get(logo) || []).concat(a));
      }
    }
    for (const [logo, same] of rescued) {
      const one = pickOne(same);
      keep.set(one, { ...one, icon: logo });
    }
    return { apps: pictured.filter((a) => keep.has(a)).map((a) => keep.get(a)), note: '' };
  }
  const failed = list.find((a) => a.iconError && a.iconError !== 'no icon');
  return { apps: list, note: failed ? `App pictures couldn't be loaded (${failed.iconError}).` : '' };
}

// True if a small RGBA sample of a picture has any visible pixel (some app icons are blank).
export function hasVisiblePixels(rgba) {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 16) return true;
  return false;
}

// With a picture, the tile shows only the picture (icons are often transparent logos, so a
// letter underneath would show through). If the picture fails to load, it removes itself and
// the hidden letter tile comes back.
export function tileHtml(app, extraClass = '') {
  const cls = `tile ${colorClass(app.id)}${app.icon ? ' img' : ''}${extraClass ? ' ' + extraClass : ''}`;
  const face = app.icon
    ? `<span class="ltr">${letterOf(app.name)}</span><img src="${escapeHtml(app.icon)}" alt="" ` +
      `onerror="this.parentNode.classList.remove('img');this.remove()">`
    : letterOf(app.name);
  return `<div class="${cls}" data-id="${escapeHtml(app.id)}">${face}` +
    `<span class="tip">${escapeHtml(app.name)}</span></div>`;
}

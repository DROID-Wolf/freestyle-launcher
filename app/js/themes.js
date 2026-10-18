// Theme registry: which themes exist, their options, and the scene each one shows.
// Pure (no DOM) so it can be unit-tested; scene.js turns a scene spec into elements.
// A scene spec is { room: picture path | null, videos: [{ slot, clip }], layout }.

const clip = (id) => ({ video: `media/video/${id}.mp4`, poster: `media/posters/${id}.jpg` });
export const CLIPS = {
  'city-rain': clip('city-rain'), // "Rainy night"
  'rain-heavy': clip('rain-heavy'),
  'rain-storm': clip('rain-storm'),
  'city-night': clip('city-night'),
  'snowy-forest': clip('snowy-forest'),
  beach: clip('beach'),
  fire: clip('fire'),
  aquarium: clip('aquarium'),
};

// Room pictures (all green-screen AI renders): the five from Canva are JPEG; the seven the
// user made in their own AI tool came as WebP.
const JPG_ROOMS = ['desk', 'loft', 'train', 'attic', 'highrise'];
const WEBP_ROOMS = ['sunroom', 'porch', 'hearth-stone', 'hearth-brick', 'cafe', 'aquarium', 'cabin'];
export const ROOM_FILES = {};
JPG_ROOMS.forEach((n) => { ROOM_FILES[n] = `media/rooms/${n}.jpg`; });
WEBP_ROOMS.forEach((n) => { ROOM_FILES[n] = `media/rooms/${n}.webp`; });
const room = (name) => ROOM_FILES[name];
// The high-rise has heavy green spill on its ceiling/floor and no plants: remove all of it.
export const ROOM_SPILL = { [ROOM_FILES.highrise]: 'all' };
const opt = (key, label, def, values, allowNone = false) =>
  ({ key, label, allowNone, default: def, values: values.map(([id, l]) => ({ id, label: l })) });

// Theme card pictures in Customize → Themes: a real still from each scene. Aurora has none
// (its card draws the aurora colours).
const THUMBS = {
  aurora: null,
  window: CLIPS['city-night'].poster,
  fireplace: CLIPS.fire.poster,
  cafe: CLIPS['city-rain'].poster,
  aquarium: CLIPS.aquarium.poster,
  cabin: CLIPS['snowy-forest'].poster,
};

// Live window view: weather first, then day/night (sunrise minute is day, sunset minute is night).
// Storms get Storm; rain is Heavy rain by day and Rainy night after dark.
export function liveView(icon, nowMin, riseMin, setMin) {
  const day = nowMin >= riseMin && nowMin < setMin;
  if (icon === 'storm') return 'rain-storm';
  if (icon === 'rain') return day ? 'rain-heavy' : 'city-rain';
  if (icon === 'snow') return 'snowy-forest';
  return day ? 'beach' : 'city-night';
}

export const THEMES = [
  { id: 'aurora', name: 'Aurora', options: [], scene: () => ({ room: null, videos: [], layout: 'aurora' }) },
  {
    id: 'window',
    name: 'Window',
    options: [
      opt('style', 'Style', 'desk', [['desk', 'Desk'], ['loft', 'Loft'], ['train', 'Train'], ['attic', 'Attic'],
        ['highrise', 'High-rise'], ['sunroom', 'Sunroom'], ['porch', 'Porch']], true),
      opt('view', 'View', 'live', [['live', 'Live'], ['city-rain', 'Rainy night'], ['rain-heavy', 'Heavy rain'], ['rain-storm', 'Storm'],['snowy-forest', 'Snowy forest'], ['beach', 'Beach']]),
    ],
    scene: (o, c) => {
      const view = o.view === 'live' ? liveView(c.icon, c.nowMin, c.riseMin, c.setMin) : o.view;
      return o.style
        ? { room: room(o.style), videos: [{ slot: 'view', clip: view }], layout: `window-${o.style}` }
        : { room: null, videos: [{ slot: 'view', clip: view }], layout: 'window-full' };
    },
  },
  {
    id: 'fireplace',
    name: 'Fireplace',
    options: [opt('hearth', 'Hearth', 'stone', [['stone', 'Stone'], ['brick', 'Brick']])],
    scene: (o) => ({ room: room(`hearth-${o.hearth}`), videos: [{ slot: 'fire', clip: 'fire' }], layout: 'fireplace' }),
  },
  { id: 'cafe', name: 'Rainy café', options: [], scene: () => ({ room: room('cafe'), videos: [{ slot: 'view', clip: 'city-rain' }], layout: 'cafe' }) },
  { id: 'aquarium', name: 'Aquarium', options: [], scene: () => ({ room: room('aquarium'), videos: [{ slot: 'tank', clip: 'aquarium' }], layout: 'aquarium' }) },
  {
    id: 'cabin',
    name: 'Snowy cabin',
    options: [],
    scene: () => ({ room: room('cabin'), videos: [{ slot: 'view', clip: 'snowy-forest' }, { slot: 'fire', clip: 'fire' }], layout: 'cabin' }),
  },
].map((t) => ({ ...t, thumb: THUMBS[t.id] }));

export const themeById = (id) => THEMES.find((t) => t.id === id);

export function defaultOptions(themeId) {
  const t = themeById(themeId);
  const out = {};
  if (t) for (const o of t.options) out[o.key] = o.default;
  return out;
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Validated copy of one theme's saved options: known keys only, bad values -> default,
// null kept only where the option can be cleared.
function cleanOptions(theme, saved) {
  const out = {};
  for (const o of theme.options) {
    const v = saved[o.key];
    out[o.key] = (v === null && o.allowNone) || o.values.some((x) => x.id === v) ? v : o.default;
  }
  return out;
}

export function cleanThemePrefs(theme, themeOptions) {
  const opts = {};
  if (isPlainObject(themeOptions)) {
    for (const [id, saved] of Object.entries(themeOptions)) {
      const t = themeById(id);
      if (t && isPlainObject(saved)) opts[id] = cleanOptions(t, saved);
    }
  }
  return { theme: themeById(theme) ? theme : 'aurora', themeOptions: opts };
}

export function resolveScene(themeId, themeOptions, ctx) {
  const { theme, themeOptions: clean } = cleanThemePrefs(themeId, themeOptions);
  const t = themeById(theme);
  return t.scene(cleanOptions(t, clean[theme] || {}), ctx);
}

// Stable identity of a scene, so re-applying an identical one can be skipped.
export const sceneKey = (spec) =>
  JSON.stringify([spec.layout, spec.room, spec.videos.map((v) => [v.slot, v.clip])]);

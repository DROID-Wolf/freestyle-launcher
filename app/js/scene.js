// Builds a theme's scene (room picture + looping videos) in #scene, behind the widgets.
// Spec in, elements out: themes.js decides *what* to show; this only shows it.
import { CLIPS, ROOM_SPILL, sceneKey } from './themes.js';
import { keyGreen, assignSlots } from './chroma.js';

const W = 1920;
const H = 1080;

// Draws the room picture to fill 1920×1080 (like object-fit: cover), cuts out its green-screen
// openings and returns the canvas plus where the video slots should go (null = no openings).
function cutOutRoom(img, slotCount, spill) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  c.className = 'room';
  const g = c.getContext('2d');
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const pixels = g.getImageData(0, 0, W, H);
  const { regions } = keyGreen(pixels.data, W, H, 8, { spill });
  g.putImageData(pixels, 0, 0);
  return { canvas: c, boxes: assignSlots(regions, slotCount) };
}

const place = (el, box) => {
  el.style.left = `${box.x}px`;
  el.style.top = `${box.y}px`;
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
};

export function createSceneRenderer(screenEl, { mediaUrl, timeoutMs = 8000 }) {
  const host = screenEl.querySelector('#scene');
  let key = null;
  let timer = 0;
  let paused = false;
  let generation = 0; // bumps on every new scene so a late-loading room can't land in a newer one

  const setClasses = (themeId, layout) => {
    [...screenEl.classList].filter((c) => /^(theme|layout)-/.test(c)).forEach((c) => screenEl.classList.remove(c));
    screenEl.classList.add(`theme-${themeId}`, `layout-${layout}`);
  };

  // Media missing or too slow: hide the scene so the Aurora background shows. Prefs are
  // untouched (this module never sees them), so the chosen theme comes back next time.
  const fallback = () => {
    clearTimeout(timer);
    screenEl.classList.add('scene-fallback');
  };

  function apply(themeId, spec) {
    const k = `${themeId}|${sceneKey(spec)}`;
    if (k === key) return; // same scene (e.g. a weather refresh): keep the videos playing
    key = k;
    const gen = ++generation;
    clearTimeout(timer);
    screenEl.classList.remove('scene-fallback');
    setClasses(themeId, spec.layout);
    host.innerHTML = '';
    if (!spec.room && !spec.videos.length) return;

    // Ready once the room picture and the first video's first frame have loaded. Events from a
    // scene that has since been replaced are ignored.
    let pending = (spec.room ? 1 : 0) + (spec.videos.length ? 1 : 0);
    const ready = () => { if (gen === generation && --pending === 0) clearTimeout(timer); };
    const fail = () => { if (gen === generation) fallback(); };
    timer = setTimeout(fallback, timeoutMs);

    const slots = spec.videos.map((v, i) => {
      const clip = CLIPS[v.clip];
      const slot = document.createElement('div');
      slot.className = `slot slot-${v.slot}`;
      if (spec.room) slot.style.visibility = 'hidden'; // shown once the room says where
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = !paused;
      video.preload = 'auto';
      video.poster = mediaUrl(clip.poster);
      if (i === 0) {
        video.addEventListener('loadeddata', ready, { once: true });
        video.addEventListener('error', fail, { once: true });
      }
      video.src = mediaUrl(clip.video);
      slot.appendChild(video);
      host.appendChild(slot);
      return slot;
    });

    // The room goes on top of the videos; its cut-out openings let them show through.
    if (spec.room) {
      const img = new Image();
      img.onload = () => {
        if (gen !== generation) return;
        let room = img;
        try {
          const cut = cutOutRoom(img, slots.length, ROOM_SPILL[spec.room]);
          room = cut.canvas;
          if (cut.boxes) slots.forEach((s, i) => place(s, cut.boxes[i]));
        } catch (e) {
          img.className = 'room'; // canvas unavailable: show the plain picture
        }
        host.appendChild(room);
        slots.forEach((s) => { s.style.visibility = ''; });
        ready();
      };
      img.onerror = fail;
      img.src = mediaUrl(spec.room);
    }
  }

  // Reduce motion: hold every video on a still frame.
  function setPaused(p) {
    paused = p;
    host.querySelectorAll('video').forEach((v) => {
      if (p) v.pause();
      else if (v.paused) v.play().catch(() => {});
    });
  }

  return { apply, setPaused };
}

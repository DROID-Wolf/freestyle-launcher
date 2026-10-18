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
  return { canvas: c, pixels, boxes: assignSlots(regions, slotCount) };
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
  let dim = 0; // % the room picture is darkened (the videos never are)
  let roomEl = null; // the room on screen: keyed canvas, or the plain picture if canvas failed
  let roomKeyed = false; // roomEl is the keyed canvas
  // The keyed room, undimmed, so the dim can be redrawn. Only held while dimmed (8 MB): when
  // undimmed the canvas itself is the clean copy, read back on the next dim.
  let roomPixels = null;
  let shown = []; // the current scene's <video> elements
  let clips = []; // the clip id each of them is playing
  let frame = null; // what a clip change can't touch: theme, room, layout and slots

  // Paint the dim on the room once (not per frame). On the canvas, black goes only over the
  // room's own pixels (source-atop), so the cut-out openings stay clear for the videos.
  function paintDim() {
    if (!roomEl) return;
    if (!roomKeyed) {
      roomEl.style.filter = dim ? `brightness(${1 - dim / 100})` : '';
      return;
    }
    const g = roomEl.getContext('2d');
    if (!dim) {
      if (roomPixels) g.putImageData(roomPixels, 0, 0);
      roomPixels = null;
      return;
    }
    if (!roomPixels) roomPixels = g.getImageData(0, 0, W, H);
    g.putImageData(roomPixels, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(0,0,0,${dim / 100})`;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }

  const unload = (v) => { v.pause(); v.removeAttribute('src'); v.load(); };

  // Start a clip in a <video>. Without a room the first video is the whole scene, so it decides
  // readiness and failure (with a room, a broken video just leaves its poster in the opening).
  function loadClip(video, clipId, decides, ready, fail) {
    const clip = CLIPS[clipId];
    video.autoplay = !paused;
    video.poster = mediaUrl(clip.poster);
    if (decides) {
      video.addEventListener('loadeddata', ready, { once: true });
      video.addEventListener('error', fail, { once: true });
    }
    video.src = mediaUrl(clip.video);
  }

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

  // Ready once the room picture has loaded (a slow video shows its poster until it plays: the
  // forest clip is one 20 MB chunk and can take longer than the timeout on the projector's
  // Wi-Fi), or, with no room, once the first video's first frame has. Events from a scene
  // that has since been replaced are ignored. Arriving after the timeout still counts: the
  // fallback is lifted, so a slow start at power-on doesn't leave Aurora up for good.
  function arm() {
    const gen = ++generation;
    clearTimeout(timer);
    screenEl.classList.remove('scene-fallback');
    timer = setTimeout(fallback, timeoutMs);
    const ready = () => {
      if (gen !== generation) return;
      clearTimeout(timer);
      screenEl.classList.remove('scene-fallback');
    };
    const fail = () => { if (gen === generation) fallback(); };
    return { gen, ready, fail };
  }

  // Only the clips changed (Live view at sunrise/sunset or when the weather turns): swap each
  // changed slot's video in place, keeping the keyed room (no reload, re-key or Aurora flash).
  function swapClips(spec) {
    const room = !!spec.room;
    // With a room, readiness is the room's (which may still be loading: leave its generation
    // alone so it can land). Without one, the new first clip decides it afresh.
    const r = room ? null : arm();
    spec.videos.forEach((v, i) => {
      const video = shown[i];
      if (clips[i] === v.clip) return;
      unload(video);
      clips[i] = v.clip;
      loadClip(video, v.clip, i === 0 && !room, r && r.ready, r && r.fail);
    });
  }

  function apply(themeId, spec) {
    const k = `${themeId}|${sceneKey(spec)}`;
    if (k === key) return; // same scene (e.g. a weather refresh): keep the videos playing
    key = k;
    const f = JSON.stringify([themeId, spec.layout, spec.room, spec.videos.map((v) => v.slot)]);
    if (f === frame && shown.length) return swapClips(spec);
    frame = f;
    clearTimeout(timer);
    setClasses(themeId, spec.layout);
    // Unload the old videos before dropping them: a detached <video> keeps its decoder until
    // garbage collection, and the TV has only a few.
    shown.forEach(unload);
    shown = [];
    clips = [];
    host.innerHTML = '';
    roomEl = null;
    roomKeyed = false;
    roomPixels = null;
    if (!spec.room && !spec.videos.length) {
      ++generation; // a room still loading for the old scene must not land
      screenEl.classList.remove('scene-fallback');
      return;
    }
    const { gen, ready, fail } = arm();
    let slots = [];

    // The room goes on top of the videos; its cut-out openings let them show through. Its
    // download starts first so it isn't queued behind the (much bigger) clips at boot.
    if (spec.room) {
      const img = new Image();
      img.onload = () => {
        if (gen !== generation) return;
        let room = img;
        try {
          const cut = cutOutRoom(img, slots.length, ROOM_SPILL[spec.room]);
          room = cut.canvas;
          roomKeyed = true;
          if (dim) roomPixels = cut.pixels;
          if (cut.boxes) slots.forEach((s, i) => place(s, cut.boxes[i]));
        } catch (e) {
          img.className = 'room'; // canvas unavailable: show the plain picture
        }
        roomEl = room;
        paintDim();
        host.appendChild(room);
        slots.forEach((s) => { s.style.visibility = ''; });
        ready();
      };
      img.onerror = fail;
      img.src = mediaUrl(spec.room);
    }

    slots = spec.videos.map((v, i) => {
      const slot = document.createElement('div');
      slot.className = `slot slot-${v.slot}`;
      if (spec.room) slot.style.visibility = 'hidden'; // shown once the room says where
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      loadClip(video, v.clip, i === 0 && !spec.room, ready, fail);
      shown.push(video);
      clips.push(v.clip);
      slot.appendChild(video);
      host.appendChild(slot); // the room loads after this, so it is appended on top
      return slot;
    });
  }

  // Reduce motion: hold every video on a still frame.
  function setPaused(p) {
    paused = p;
    host.querySelectorAll('video').forEach((v) => {
      if (p) v.pause();
      else if (v.paused) v.play().catch(() => {});
    });
  }

  function setDim(pct) {
    if (pct === dim) return;
    dim = pct;
    paintDim();
  }

  return { apply, setPaused, setDim };
}

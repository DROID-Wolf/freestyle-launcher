// Green-screen keying for room pictures: the AI rooms have their window/firebox/tank painted
// flat chroma green, so the scene can cut them out at load time and play video behind them.
// Pure (works on an RGBA array) so it can be unit-tested; scene.js feeds it canvas pixels.

const FULL = 80; // how much greener than red/blue a pixel must be to vanish completely
const SOFT = 25; // from here up to FULL the pixel fades (anti-aliased edges)
const MIN_CELLS = 4; // smaller green patches are specks, not openings
const NEUTRAL = 0.25; // |red − blue| under this share of green = a neutral surface with spill
const MIN_SHARE = 0.002; // ...and so is anything under 0.2% of the picture (glow, reflections)

const isFull = (r, g, b) => g > 100 && g - Math.max(r, b) >= FULL;

// Keys `data` in place and returns the green openings, left to right, as pixel boxes.
// Only the openings (and a one-cell margin for their soft edges) become see-through; green
// glow or reflections elsewhere in the room are just de-greened and stay solid.
// opts.spill: 'neutral' (default) spares foliage; 'all' de-greens everything (rooms without plants).
export function keyGreen(data, w, h, cell = 8, opts = {}) {
  const spillAll = opts.spill === 'all';
  const keyed = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < w * h; i += 4, p++) keyed[p] = isFull(data[i], data[i + 1], data[i + 2]) ? 1 : 0;
  const regions = findRegions(keyed, w, h, cell);

  const inside = new Uint8Array(w * h);
  for (const r of regions) {
    const x1 = Math.min(w, r.x + r.w + cell);
    const y1 = Math.min(h, r.y + r.h + cell);
    for (let y = Math.max(0, r.y - cell); y < y1; y++) inside.fill(1, y * w + Math.max(0, r.x - cell), y * w + x1);
  }

  for (let i = 0, p = 0; p < w * h; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const other = Math.max(r, b);
    const greenness = g - other;
    if (greenness <= 0) continue;
    // Apart from the green screen itself, only neutral surfaces tinted by it (red ≈ blue:
    // walls, frames, ceiling, floor reflections) lose their green; foliage (red ≠ blue) is left
    // alone, even where a plant stands in front of a window.
    if (!keyed[p] && !spillAll && Math.abs(r - b) > NEUTRAL * g) continue;
    data[i + 1] = other; // remove green spill, even a faint cast
    if (!inside[p] || greenness <= SOFT) continue;
    if (keyed[p]) data[i + 3] = 0;
    else data[i + 3] = Math.round(data[i + 3] * (1 - Math.min(1, (greenness - SOFT) / (FULL - SOFT))));
  }
  return { regions };
}

const union = (rs) => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};

// Where each of `count` video slots goes: one video spans all openings (multi-pane windows);
// several videos take the openings left to right; extras share the whole area.
// null = no openings found (slots stay full-frame).
export function assignSlots(regions, count) {
  if (!regions.length) return null;
  if (count === 1 || regions.length < count) return Array.from({ length: count }, () => union(regions));
  return regions.slice(0, count);
}

// Openings = 4-connected groups of grid cells whose centre pixel was fully keyed.
function findRegions(keyed, w, h, cell) {
  const cw = Math.ceil(w / cell);
  const ch = Math.ceil(h / cell);
  const half = Math.floor(cell / 2);
  const green = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const x = Math.min(w - 1, cx * cell + half);
      const y = Math.min(h - 1, cy * cell + half);
      green[cy * cw + cx] = keyed[y * w + x];
    }
  }
  const seen = new Uint8Array(cw * ch);
  const regions = [];
  const minCells = Math.max(MIN_CELLS, Math.round(cw * ch * MIN_SHARE));
  for (let start = 0; start < cw * ch; start++) {
    if (!green[start] || seen[start]) continue;
    let minX = cw, minY = ch, maxX = -1, maxY = -1, count = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % cw;
      const cy = (c - cx) / cw;
      count++;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      const next = [cx > 0 ? c - 1 : -1, cx < cw - 1 ? c + 1 : -1, cy > 0 ? c - cw : -1, cy < ch - 1 ? c + cw : -1];
      for (const n of next) if (n >= 0 && green[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
    }
    if (count >= minCells) regions.push({ x: minX * cell, y: minY * cell, w: (maxX - minX + 1) * cell, h: (maxY - minY + 1) * cell });
  }
  return regions.sort((a, b) => a.x - b.x);
}

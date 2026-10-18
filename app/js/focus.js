// Remote-control focus model. Pure: (state, key, layout) -> { state, action }.
// Zones: 'dock' (bottom row), 'top' (top-bar buttons, layout.topCount, default 1),
// 'picker' (overlay grid; index === layout.pickerCount is the Done button).
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function navigate(state, key, layout) {
  const { zone, index } = state;
  const same = { state, action: 'none' };
  if (key === 'Enter') return { state, action: 'activate' };

  if (zone === 'picker') {
    const { pickerCount: n, pickerCols: cols } = layout;
    if (key === 'Escape') return { state, action: 'close' };
    let i = index;
    if (key === 'ArrowRight') i = clamp(index + 1, 0, n);
    else if (key === 'ArrowLeft') i = clamp(index - 1, 0, n);
    else if (key === 'ArrowDown') i = index === n ? n : index + cols < n ? index + cols : n;
    else if (key === 'ArrowUp') i = index === n ? n - 1 : index - cols >= 0 ? index - cols : index;
    else return same;
    return { state: { zone, index: i }, action: 'none' };
  }

  if (zone === 'top') {
    const last = (layout.topCount || 1) - 1;
    if (key === 'ArrowDown') return { state: { zone: 'dock', index: 0 }, action: 'none' };
    if (key === 'ArrowRight') return { state: { zone, index: clamp(index + 1, 0, last) }, action: 'none' };
    if (key === 'ArrowLeft') return { state: { zone, index: clamp(index - 1, 0, last) }, action: 'none' };
    return same; // Escape and other keys do nothing on the main screen
  }

  // dock
  if (key === 'ArrowUp') return { state: { zone: 'top', index: 0 }, action: 'none' };
  if (key === 'ArrowRight') return { state: { zone, index: clamp(index + 1, 0, layout.dockCount - 1) }, action: 'none' };
  if (key === 'ArrowLeft') return { state: { zone, index: clamp(index - 1, 0, layout.dockCount - 1) }, action: 'none' };
  return same;
}

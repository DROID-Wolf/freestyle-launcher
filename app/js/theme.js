// Picks the color theme from the time of day relative to sunrise/sunset (minutes since midnight).
export function themeFor(nowMin, riseMin, setMin) {
  if (nowMin < riseMin) return 'night';
  if (nowMin < riseMin + 120) return 'morning';
  if (nowMin < setMin - 90) return 'day';
  if (nowMin < setMin + 90) return 'evening';
  return 'night';
}

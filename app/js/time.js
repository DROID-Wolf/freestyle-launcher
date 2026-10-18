// Pure helpers for the clock, date, greeting and daylight bar.

const pad = (n) => String(n).padStart(2, '0');

export function formatTime(date, hour24) {
  const h = date.getHours();
  const m = pad(date.getMinutes());
  if (hour24) return { h: pad(h), m, ampm: '' };
  return { h: String(h % 12 || 12), m, ampm: h < 12 ? 'AM' : 'PM' };
}

export function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function greeting(hour) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

// nowMin / riseMin / setMin are minutes since local midnight.
export function dayProgress(nowMin, riseMin, setMin) {
  if (nowMin < riseMin) return { pct: 0, label: 'Before sunrise' };
  if (nowMin >= setMin) return { pct: 100, label: 'Sun has set' };
  const pct = Math.round(((nowMin - riseMin) / (setMin - riseMin)) * 100);
  return { pct, label: `Day ${pct}% done` };
}

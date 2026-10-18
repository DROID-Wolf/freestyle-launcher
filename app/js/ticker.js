// The short line of text at the bottom right, built from parsed weather.
import { hourLabel } from './weather.js';

const clock = (min) => `${hourLabel(Math.floor(min / 60)).split(' ')[0]}:${String(min % 60).padStart(2, '0')} ${min < 720 ? 'AM' : 'PM'}`;

export function tickerText(w, now) {
  if (!w) return '';
  const wet = w.hours.find((h) => h.icon === 'rain' || h.icon === 'storm');
  if (wet) return `${wet.icon === 'storm' ? 'Storms' : 'Rain'} likely around ${wet.label}`;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < w.setMin) return `Sunset at ${clock(w.setMin)}`;
  if (w.icon === 'clear' || w.icon === 'partly') return 'Clear skies tonight, a good night to project outside';
  return `${w.cond} tonight, low of ${w.lo}°`;
}

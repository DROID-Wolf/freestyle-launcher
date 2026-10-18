// Weather: Open-Meteo URLs and pure parsing. Fetching happens in main.js.
const FIELDS =
  'current=temperature_2m,weather_code&hourly=temperature_2m,weather_code' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset' +
  '&temperature_unit=fahrenheit&timezone=auto&forecast_days=7';

export const forecastUrl = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&${FIELDS}`;

export const geocodeUrl = (city) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;

export function describeCode(code) {
  if (code === 0) return { cond: 'Clear', icon: 'clear' };
  if (code === 1 || code === 2) return { cond: code === 1 ? 'Mostly clear' : 'Partly cloudy', icon: 'partly' };
  if (code === 3) return { cond: 'Cloudy', icon: 'cloudy' };
  if (code === 45 || code === 48) return { cond: 'Fog', icon: 'fog' };
  if (code >= 51 && code <= 57) return { cond: 'Drizzle', icon: 'rain' };
  if (code >= 61 && code <= 67) return { cond: 'Rain', icon: 'rain' };
  if (code >= 71 && code <= 77) return { cond: 'Snow', icon: 'snow' };
  if (code >= 80 && code <= 82) return { cond: 'Showers', icon: 'rain' };
  if (code === 85 || code === 86) return { cond: 'Snow showers', icon: 'snow' };
  if (code >= 95 && code <= 99) return { cond: 'Thunderstorms', icon: 'storm' };
  return { cond: 'Cloudy', icon: 'cloudy' };
}

const pad = (n) => String(n).padStart(2, '0');
const hourKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
const minutesOf = (iso) => { const [h, m] = iso.slice(11, 16).split(':').map(Number); return h * 60 + m; };
export const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
const dayLabel = (iso, i) => {
  if (i === 0) return 'Today';
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
};

// Open-Meteo times are local to the forecast location (timezone=auto).
export function parseForecast(json, now) {
  try {
    const { current, hourly, daily } = json;
    const temp = Math.round(current.temperature_2m);
    if (!Number.isFinite(temp)) return null;
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);
    const start = hourly.time.indexOf(hourKey(next));
    const hours = [];
    for (let i = start; start >= 0 && i < hourly.time.length && hours.length < 4; i += 2) {
      hours.push({
        label: hourLabel(Number(hourly.time[i].slice(11, 13))),
        temp: Math.round(hourly.temperature_2m[i]),
        icon: describeCode(hourly.weather_code[i]).icon,
      });
    }
    return {
      temp,
      code: current.weather_code,
      ...describeCode(current.weather_code),
      hi: Math.round(daily.temperature_2m_max[0]),
      lo: Math.round(daily.temperature_2m_min[0]),
      riseMin: minutesOf(daily.sunrise[0]),
      setMin: minutesOf(daily.sunset[0]),
      hours,
      days: daily.time.slice(0, 7).map((iso, i) => ({
        label: dayLabel(iso, i),
        hi: Math.round(daily.temperature_2m_max[i]),
        lo: Math.round(daily.temperature_2m_min[i]),
        icon: daily.weather_code ? describeCode(daily.weather_code[i]).icon : 'cloudy',
      })),
    };
  } catch (e) {
    return null;
  }
}

export function parseGeocode(json) {
  const r = json && Array.isArray(json.results) && json.results[0];
  if (!r || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return null;
  return { lat: r.latitude, lon: r.longitude, name: r.name };
}

// Approximate location from the public IP (BigDataCloud's free client-side endpoint, no key).
export const IP_LOCATION_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en';

export function parseIpLocation(json) {
  if (!json || !Number.isFinite(json.latitude) || !Number.isFinite(json.longitude)) return null;
  return { lat: json.latitude, lon: json.longitude, name: json.city || json.locality || 'Current location' };
}

// The cached icon for the Live view, or null once it is too old to trust (then the view
// follows day/night only, rather than showing last night's storm all day).
const LIVE_ICON_MAX_AGE = 6 * 3600e3;
export function liveIcon(cache, now) {
  if (!cache || !cache.data || !cache.data.icon) return null;
  return now.getTime() - cache.fetchedAt <= LIVE_ICON_MAX_AGE ? cache.data.icon : null;
}

export function weatherView(cache, now) {
  if (!cache || !cache.data || !Number.isFinite(cache.data.temp)) return { show: false, stale: '' };
  const mins = Math.floor((now.getTime() - cache.fetchedAt) / 60000);
  if (mins <= 30) return { show: true, stale: '' };
  return { show: true, stale: mins >= 60 ? `updated ${Math.floor(mins / 60)}h ago` : `updated ${mins}m ago` };
}

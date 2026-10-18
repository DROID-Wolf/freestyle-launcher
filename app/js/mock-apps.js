// Sample apps from docs/mockup.html, used when running outside the Tizen shell.
export const MOCK_APPS = [
  ['netflix', 'Netflix'], ['youtube', 'YouTube'], ['disney', 'Disney+'],
  ['spotify', 'Spotify'], ['prime', 'Prime Video'], ['plex', 'Plex'],
  ['hulu', 'Hulu'], ['max', 'Max'], ['twitch', 'Twitch'],
  ['tubi', 'Tubi'], ['apple', 'Apple TV'], ['browser', 'Internet'],
].map(([id, name]) => ({ id, name, icon: null }));

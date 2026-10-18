// Media (videos, room pictures) is published once at the site root, not inside each deploy's
// versioned v/<build>/ folder (see pages.yml), so pages served from v/<build>/ reach it two
// levels up. Everywhere else (site root, local dev) it sits beside the page.
const VERSIONED = /\/v\/[0-9a-f]{7,40}\//;

export function mediaUrl(path, pathname) {
  return VERSIONED.test(pathname) ? `../../${path}` : path;
}

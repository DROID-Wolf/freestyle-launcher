// Copies app/ into shell/fallback/ so the widget can run offline. Run before packaging:
//   node scripts/build-fallback.mjs
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'app');
const dest = join(root, 'shell', 'fallback');

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, {
  recursive: true,
  // unit tests aren't shipped; media (videos) is too big for the widget — offline shows Aurora
  filter: (p) => { const parts = relative(src, p).split(sep); return !parts.includes('tests') && !parts.includes('media'); },
});
console.log(`Copied ${relative(root, src)} -> ${relative(root, dest)}`);

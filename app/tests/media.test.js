import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaUrl } from '../js/media.js';

// Media lives once at the site root; each deploy's UI is under v/<build>/ (see pages.yml).
test('from a versioned build folder, media is two levels up', () => {
  assert.equal(mediaUrl('media/x.mp4', '/freestyle-launcher/v/66ee4e21f831/'), '../../media/x.mp4');
  assert.equal(mediaUrl('media/x.mp4', '/freestyle-launcher/v/66ee4e21f831/index.html'), '../../media/x.mp4');
});

test('anywhere else (site root, local dev), media is beside the page', () => {
  assert.equal(mediaUrl('media/x.mp4', '/'), 'media/x.mp4');
  assert.equal(mediaUrl('media/x.mp4', '/freestyle-launcher/'), 'media/x.mp4');
});

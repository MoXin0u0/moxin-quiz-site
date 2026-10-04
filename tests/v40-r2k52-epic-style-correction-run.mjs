import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/R2K5_2_EPIC_ASSET_MANIFEST.json', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');
const css = fs.readFileSync('styles/v4-learning-styles.css', 'utf8');

assert.equal(manifest.length, 16, 'R2K.5.2 should contain 8 desktop + 8 mobile Epic assets');

// R2K.5.2 assets may be superseded by a later approved Epic asset milestone.
// Its regression remains responsible for path/dimension architecture and contrast,
// while R2K.5.3 owns exact hashes for the current production artwork.
for (const asset of manifest) {
  assert.match(asset.path, /^assets\/learning\/styles\/epic\//);
  assert.equal(asset.width, asset.variant === 'mobile' ? 1080 : 2560);
  assert.equal(asset.height, 1440);
}

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);
assert.match(sw, /SCENE_CACHE_VERSION = 'moxin-quiz-scenes-r2k\.5-\d+'/);

// Contrast/readability guard: Epic must retain a strong content-safe shield in both themes.
assert.match(css, /html\[data-learning-style="epic"\] \.learning-hero-whole::before/);
assert.match(css, /rgba\(255,252,250,.99\) 0%/);
assert.match(css, /html\[data-theme="dark"\]\[data-learning-style="epic"\] \.learning-hero-whole::before/);
assert.match(css, /rgba\(15,11,34,.99\) 0%/);
assert.match(css, /--learn-text: #241b3b/);
assert.match(css, /--learn-text: #fbf7ff/);

console.log('MoXin Quiz v4.0 R2K.5.2 Epic style correction and contrast guard tests passed.');

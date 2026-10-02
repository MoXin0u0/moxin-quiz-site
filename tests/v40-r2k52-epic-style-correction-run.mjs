import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/R2K5_2_EPIC_ASSET_MANIFEST.json', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');
const css = fs.readFileSync('styles/v4-learning-styles.css', 'utf8');

assert.equal(manifest.length, 16, 'R2K.5.2 should contain 8 desktop + 8 mobile Epic assets');

for (const asset of manifest) {
  assert.equal(fs.existsSync(asset.path), true, `${asset.path} should exist`);
  const bytes = fs.readFileSync(asset.path);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256, asset.sha256, `${asset.path} must match the approved R2K.5.2 asset`);
  assert.ok(bytes.length >= 160 * 1024, `${asset.path} should retain production-detail WebP data`);

  const dimensions = readWebpSize(asset.path);
  assert.ok(dimensions, `${asset.path} should be a valid WebP`);
  assert.equal(dimensions.width, asset.width);
  assert.equal(dimensions.height, asset.height);
}

// Keep the scene cache moving so cache-first never serves the previous simplified art.
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.0\.0-r2k\.5-2'/);
assert.match(sw, /SCENE_CACHE_VERSION = 'moxin-quiz-scenes-r2k\.5-3'/);

// Contrast/readability guard: Epic must retain a strong content-safe shield in both themes.
assert.match(css, /html\[data-learning-style="epic"\] \.learning-hero-whole::before/);
assert.match(css, /rgba\(255,252,250,.99\) 0%/);
assert.match(css, /html\[data-theme="dark"\]\[data-learning-style="epic"\] \.learning-hero-whole::before/);
assert.match(css, /rgba\(15,11,34,.99\) 0%/);
assert.match(css, /--learn-text: #241b3b/);
assert.match(css, /--learn-text: #fbf7ff/);

console.log('MoXin Quiz v4.0 R2K.5.2 Epic style correction and contrast guard tests passed.');

function readWebpSize(file) {
  const buffer = fs.readFileSync(file);
  if (
    buffer.length < 16 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) return null;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (chunk === 'VP8X' && data + 10 <= buffer.length) {
      return {
        width: 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16),
        height: 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16),
      };
    }
    if (
      chunk === 'VP8 ' &&
      data + 10 <= buffer.length &&
      buffer[data + 3] === 0x9d &&
      buffer[data + 4] === 0x01 &&
      buffer[data + 5] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      };
    }
    if (chunk === 'VP8L' && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    offset = data + size + (size % 2);
  }
  return null;
}

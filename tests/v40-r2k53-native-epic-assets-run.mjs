import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const sources = JSON.parse(fs.readFileSync('docs/R2K5_3_EPIC_SOURCE_MANIFEST.json', 'utf8'));
const assets = JSON.parse(fs.readFileSync('docs/R2K5_3_EPIC_ASSET_MANIFEST.json', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(sources.length, 8, 'R2K.5.3 must use 8 independent single-scene Epic sources');
assert.equal(assets.length, 16, 'R2K.5.3 must provide 8 desktop + 8 mobile Epic assets');

for (const source of sources) {
  assert.equal(source.sourceKind, 'single-scene', `${source.sourceFile} must not be a collage/contact sheet`);
  assert.ok(source.width >= 1600, `${source.sourceFile} source width is too small`);
  assert.ok(source.height >= 900, `${source.sourceFile} source height is too small`);
  assert.ok(source.bytes >= 500 * 1024, `${source.sourceFile} source file is suspiciously small`);
  assert.match(source.sha256, /^[a-f0-9]{64}$/);
}

const sourceKeys = new Set(sources.map(x => `${x.scene}:${x.theme}`));
assert.equal(sourceKeys.size, 8, 'Each Epic page/theme pair must have its own source');

for (const asset of assets) {
  assert.equal(fs.existsSync(asset.path), true, `${asset.path} should exist`);
  const bytes = fs.readFileSync(asset.path);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256, asset.sha256, `${asset.path} must match the approved R2K.5.3 production asset`);

  const expectedWidth = asset.variant === 'mobile' ? 1080 : 2560;
  assert.equal(asset.width, expectedWidth);
  assert.equal(asset.height, 1440);
  assert.equal(asset.sourceKind, 'single-scene');
  assert.ok(asset.sourceWidth >= 1600 && asset.sourceHeight >= 900);
  assert.ok(asset.detailScore >= 4.0, `${asset.path} should retain measurable local detail`);

  if (asset.variant === 'desktop') {
    assert.ok(bytes.length >= 500 * 1024, `${asset.path} desktop art should retain production detail`);
  } else {
    assert.ok(bytes.length >= 250 * 1024, `${asset.path} mobile art should retain production detail`);
  }
}

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.0\.0-r2k\.5-3'/);
assert.match(sw, /SCENE_CACHE_VERSION = 'moxin-quiz-scenes-r2k\.5-4'/);
assert.match(sw, /cacheFirstScene/);

console.log('MoXin Quiz v4.0 R2K.5.3 native Epic asset regression tests passed.');

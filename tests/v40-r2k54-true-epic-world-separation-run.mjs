import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const sources = JSON.parse(fs.readFileSync('docs/R2K5_4_EPIC_SOURCE_MANIFEST.json', 'utf8'));
const assets = JSON.parse(fs.readFileSync('docs/R2K5_4_EPIC_ASSET_MANIFEST.json', 'utf8'));
const comparisons = JSON.parse(fs.readFileSync('docs/R2K5_4_STYLE_SEPARATION_AUDIT.json', 'utf8'));
const academy = JSON.parse(fs.readFileSync('docs/R2K5_1_ACADEMY_ASSET_MANIFEST.json', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(sources.length, 8, 'R2K.5.4 must have 8 Epic-only source scenes');
assert.equal(assets.length, 16, 'R2K.5.4 must have 8 desktop + 8 mobile Epic assets');

const academySources = new Set(academy.map(item => item.source));
const sourceFiles = new Set();
const sourceHashes = new Set();
const conceptsByScene = new Map();

for (const source of sources) {
  assert.equal(source.world, 'epic');
  assert.equal(source.sourceFamily, 'true-epic-v1');
  assert.equal(source.sourceKind, 'single-scene');
  assert.equal(source.derivedFromAcademy, false);
  assert.equal(academySources.has(source.sourceFile), false, `${source.sourceFile} reuses an Academy source`);
  assert.ok(source.width >= 1600 && source.height >= 900);
  assert.ok(source.bytes >= 500 * 1024);
  assert.match(source.sha256, /^[a-f0-9]{64}$/);
  assert.ok(source.semanticTags.length >= 4);

  sourceFiles.add(source.sourceFile);
  sourceHashes.add(source.sha256);
  conceptsByScene.set(source.scene, source.concept);
}

assert.equal(sourceFiles.size, 8, 'Every page/theme pair must use an independent Epic source');
assert.equal(sourceHashes.size, 8, 'Epic sources must not be duplicate image bytes');
assert.equal(new Set(conceptsByScene.values()).size, 4, 'Library/review/exam/stats need four distinct world concepts');

for (const asset of assets) {
  assert.equal(fs.existsSync(asset.path), true, `${asset.path} should exist`);
  const bytes = fs.readFileSync(asset.path);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');

  assert.equal(hash, asset.sha256, `${asset.path} must match the approved R2K.5.4 asset`);
  assert.equal(asset.world, 'epic');
  assert.equal(asset.sourceFamily, 'true-epic-v1');
  assert.equal(asset.derivedFromAcademy, false);
  assert.ok(asset.detailScore >= 5.0);

  const expectedWidth = asset.variant === 'mobile' ? 1080 : 2560;
  assert.equal(asset.width, expectedWidth);
  assert.equal(asset.height, 1440);
}

if (comparisons.length > 0) {
  assert.equal(comparisons.length, 8);
  for (const item of comparisons) {
    assert.equal(item.passes, true, `${item.scene}-${item.theme} is too visually close to Academy`);
    assert.ok(item.normalizedPixelDifference >= item.threshold);
  }
}

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.0\.0-r2k\.5-\d+'/);
assert.match(sw, /SCENE_CACHE_VERSION = 'moxin-quiz-scenes-r2k\.5-5'/);

console.log('MoXin Quiz v4.0 R2K.5.4 true Epic world-separation tests passed.');

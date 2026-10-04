import assert from 'node:assert/strict';
import fs from 'node:fs';

const sources = JSON.parse(fs.readFileSync('docs/R2K5_3_EPIC_SOURCE_MANIFEST.json', 'utf8'));
const assets = JSON.parse(fs.readFileSync('docs/R2K5_3_EPIC_ASSET_MANIFEST.json', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(sources.length, 8);
assert.equal(assets.length, 16);
assert.ok(sources.every(source => source.sourceKind === 'single-scene'));
assert.ok(assets.every(asset => asset.sourceKind === 'single-scene'));

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);
assert.match(sw, /SCENE_CACHE_VERSION = 'moxin-quiz-scenes-r2k\.5-\d+'/);
assert.match(sw, /cacheFirstScene/);

console.log('MoXin Quiz v4.0 R2K.5.3 historical source-quality checks passed.');

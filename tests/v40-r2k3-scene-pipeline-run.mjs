import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const sceneLoader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');
const css = fs.readFileSync('styles/v4-learning-styles.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(index, v3);
assert.match(index, /src\/ui\/scene-assets\.js/);
assert.match(index, /preload\.fetchPriority = 'high'/);
assert.match(index, /sceneIntensity === 'full'/);

assert.match(sceneLoader, /SCENE_ASSETS/);
assert.match(sceneLoader, /academy/);
assert.match(sceneLoader, /epic/);
assert.match(sceneLoader, /intensity === 'off'/);
assert.match(sceneLoader, /style === 'focus'/);
assert.match(sceneLoader, /image\.decode/);
assert.match(sceneLoader, /MutationObserver/);

assert.match(css, /v4\.0 R2K\.3 — High-Fidelity Scene Delivery Pipeline/);
assert.match(css, /background-image:\s*none/);
assert.match(css, /data-scene-state="loading"/);
assert.match(css, /data-scene-state="ready"/);

assert.match(sw, /moxin-quiz-v3-4\.0\.0-r2k\.\d+-1/);
assert.match(sw, /moxin-quiz-scenes-r2k\.\d+-1/);
assert.match(sw, /cacheFirstScene/);
assert.match(sw, /isLearningScene/);
assert.match(sw, /src\/ui\/scene-assets\.js/);
assert.doesNotMatch(sw, /APP_SHELL[\s\S]*assets\/learning\/styles\/academy\/library-light\.webp/);
assert.doesNotMatch(sw, /APP_SHELL[\s\S]*assets\/learning\/styles\/epic\/library-dark\.webp/);

console.log('MoXin Quiz v4.0 R2K.3 scene delivery pipeline tests passed.');

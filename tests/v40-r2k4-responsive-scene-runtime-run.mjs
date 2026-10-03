import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const audit = fs.readFileSync('scripts/audit-scene-assets.mjs', 'utf8');

assert.match(loader, /SCENE_BREAKPOINT = '\(max-width: 760px\)'/);
assert.match(loader, /prefers-reduced-data: reduce/);
assert.match(loader, /saveData:/);
assert.match(loader, /devicePixelRatio/);
assert.match(loader, /desktop2x/);
assert.match(loader, /mobile2x/);
assert.match(loader, /mobile-fallback-desktop/);
assert.match(loader, /backgroundPosition/);
assert.match(loader, /data-saver/);
assert.match(loader, /sceneState = hasVisibleScene \? 'swapping' : 'loading'/);
assert.match(loader, /connection\.addEventListener\('change', scheduleSync\)/);
assert.match(loader, /listenMediaQuery\(sceneMedia\)/);
assert.match(loader, /listenMediaQuery\(reducedDataMedia\)/);

for (const scene of ['library', 'review', 'exam', 'stats']) {
  assert.match(loader, new RegExp(`${scene}:[\\s\\S]*focal:`));
}
for (const style of ['academy', 'epic']) {
  assert.match(loader, new RegExp(`${style}:[\\s\\S]*desktop:`));
}

assert.match(sw, /moxin-quiz-v3-4\.0\.0-r2k\.\d+(?:\.\d+)?-\d+/);
assert.match(sw, /moxin-quiz-scenes-r2k\.\d+(?:\.\d+)?-\d+/);

assert.match(audit, /readWebpSize/);
assert.match(audit, /2560/);
assert.match(audit, /1440/);
assert.match(audit, /mobile/);

console.log('MoXin Quiz v4.0 R2K.4 responsive scene runtime tests passed.');

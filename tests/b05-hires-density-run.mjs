import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const loader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const workflow = fs.readFileSync('.github/workflows/v3-regression.yml', 'utf8');
const start = loader.indexOf('function pickAssetVariant(');
const end = loader.indexOf('function resolveAsset(', start);
assert.ok(start >= 0 && end > start);
const choose = vm.runInNewContext(loader.slice(start, end) + '\npickAssetVariant;');
const entry = {
  mobile: './portrait.webp', mobile2x: './portrait-hd.webp',
  desktop: './landscape.webp', desktop2x: './landscape-hd.webp',
};
const context = (props = {}) => ({
  highDpi: true, dpr: 2, intensity: 'full',
  saveData: false, mobile: false,
  ...props,
});
const select = (props) => choose(entry, context(props));

// B05-02 measured hero widths and source dimensions, not viewport guesses.
assert.equal(select({ artBox: { width: 1059, height: 438 } }).href, entry.desktop,
  '1366 CSS px DPR2: existing 2560 artwork covers physical pixels, skip HD');
assert.equal(select({ artBox: { width: 1606, height: 501 } }).href, entry.desktop2x,
  '1920 CSS px DPR2: source density 0.80, HD can be worthwhile');
assert.equal(select({ artBox: { width: 1767, height: 501 } }).href, entry.desktop2x,
  '2560 CSS px DPR2: source density 0.72, HD can be worthwhile');
assert.equal(select({ mobile: true, dpr: 3,
  artBox: { width: 382, height: 206 } }).href, entry.mobile,
  '390 CSS px DPR3: coverage about 0.94, skip heavy mobile HD');
assert.equal(select({ mobile: true, dpr: 3,
  artBox: { width: 422, height: 230 } }).href, entry.mobile2x,
  '430 CSS px DPR3: density about 0.85, mobile HD can be worthwhile');
assert.equal(select({ mobile: false, dpr: 1, highDpi: false,
  artBox: { width: 1767, height: 501 } }).href, entry.desktop);
assert.equal(select({ intensity: 'reduced',
  artBox: { width: 1767, height: 501 } }).href, entry.desktop);
assert.equal(select({ saveData: true,
  artBox: { width: 1767, height: 501 } }).href, entry.desktop);
assert.equal(select({ artBox: { width: 0, height: 0 } }).href, entry.desktop,
  'hidden zero-size scene must never eagerly load 2x');
assert.equal(select({ artBox: { width: Number.NaN, height: 0 } }).href, entry.desktop,
  'invalid DOM box must fail safe to regular art');
assert.equal(select({ artBox: { width: 1606, height: 501 }, dpr: 2, highDpi: false })
  .href, entry.desktop, 'highDpi disabled must remain low-cost');
assert.equal(choose(entry, context()).href, entry.desktop2x,
  'legacy pure selection without box remains compatible');
assert.equal(choose({ desktop: entry.desktop }, context({
  artBox: { width: 1767, height: 501 },
})).href, entry.desktop,
  'unavailable 2x asset always falls back to existing 1x source');

assert.match(loader, /const artBox = rect \? \{ width: rect\.width, height: rect\.height \} : null/);
assert.match(loader, /resolveAsset\(node\.dataset\.sceneArt, currentContext\(\), node\)/);
assert.match(loader, /new ResizeObserver\(scheduleSync\)/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-5\.0\.0-prod-11'/);
assert.match(pkg.scripts.test, /b05-hires-density-run\.mjs/);
assert.match(pkg.scripts['audit:b05-density'], /b05-hires-density-browser-run\.mjs/);
assert.match(workflow, /npm run audit:b05-density/);
console.log('B05-03B PASS: measured density selection; 1366, 1920, 2560, phone, Reduced, save-data, hidden and missing assets');

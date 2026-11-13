import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const css = fs.readFileSync('styles/v4-learning-styles.css', 'utf8');
const loader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const wf = fs.readFileSync('.github/workflows/v3-regression.yml', 'utf8');

assert.match(css, /B05-03A: desktop Epic headings must not spill/);
assert.match(css, /@media \(min-width: 761px\)/);
assert.match(css, /data-learning-style="epic".*\.learning-hero-content h2/);
assert.match(css, /max-width: min\(100%, clamp\(20rem, 33vw, 27rem\)\)/);
assert.match(css, /max-width: min\(100%, clamp\(22rem, 38vw, 31rem\)\)/);

const begin = loader.indexOf('function pickAssetVariant(');
const end = loader.indexOf('function resolveAsset(', begin);
assert.ok(begin >= 0 && end > begin, 'pure responsive policy function must be present');
const choose = vm.runInNewContext(loader.slice(begin, end) + '\npickAssetVariant;');
const entry = {
  mobile: './mobile.webp', mobile2x: './mobile-2x.webp',
  desktop: './desktop.webp', desktop2x: './desktop-2x.webp',
  focal: { mobile: '70% 42%', desktop: '78% 50%' },
};
const config = { mobile: true, highDpi: true, intensity: 'full' };
assert.equal(choose(entry, config).variant, 'mobile-2x', 'Full on high DPI phone can use approved mobile2x');
assert.equal(choose(entry, { ...config, intensity: 'reduced' }).href, './mobile.webp',
  'Reduced must not load heavy mobile2x art');
assert.equal(choose(entry, { ...config, highDpi: false }).href, './mobile.webp',
  'normal DPR uses mobile crop');
assert.equal(choose(entry, { ...config, mobile: false }).variant, 'desktop-2x',
  'Full high-DPI desktop can use approved desktop2x');
assert.equal(choose(entry, { ...config, mobile: false, intensity: 'reduced' }).href, './desktop.webp',
  'Reduced uses lighter desktop source');
assert.equal(choose({ desktop: './base.webp' }, config).href, './base.webp',
  'missing mobile variants must fall back to desktop');
assert.equal(choose({ desktop: './base.webp', mobile: './mobile.webp' }, config).href, './mobile.webp',
  'missing optional 2x source must not cause a request to a nonexistent file');
assert.equal(choose(null, config), null);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-5\.0\.0-prod-11'/);
assert.match(pkg.scripts.test, /b05-hero-safe-area-run\.mjs/);
assert.match(pkg.scripts['audit:b05-hero'], /b05-hero-safe-area-browser-run\.mjs/);
assert.match(wf, /npm run audit:b05-hero/);
console.log('B05-03A desktop Epic safe-copy & future 2x tier behavior PASS');

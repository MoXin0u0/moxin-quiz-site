import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('styles/v4-learning-styles.css', 'utf8');
const loader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const workflow = fs.readFileSync('.github/workflows/v3-regression.yml', 'utf8');

assert.match(css, /B05-01: 'Full' on phones/);
assert.match(css, /opacity:\s*\.86\s*!important/);
assert.match(css, /opacity:\s*\.82\s*!important/);
assert.match(css, /background:\s*linear-gradient\(\s*180deg/);
assert.match(css, /color-mix\(in srgb, var\(--learn-surface-strong\) 98%, transparent\)/);
assert.match(css, /html\[data-scene-intensity="reduced"\] \.learning-hero-art/);
assert.match(css, /html\[data-scene-intensity="off"\] \.learning-hero-art/);
assert.match(loader, /const SCENE_BREAKPOINT = '\(max-width: 760px\)'/);
assert.match(loader, /highDpi: \(window\.devicePixelRatio \|\| 1\) >= 1\.5/);
assert.match(loader, /context\.mobile\s*\? \[/);
for (const style of ['academy', 'epic']) {
  for (const scene of ['library', 'review', 'exam', 'stats']) {
    for (const theme of ['light', 'dark']) {
      for (const suffix of ['', '-mobile']) {
        assert.ok(loader.includes(`./assets/learning/styles/${style}/${scene}-${theme}${suffix}.webp`),
          `Missing ${style}/${scene}-${theme}${suffix} mapping`);
      }
    }
  }
}
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-5\.0\.0-prod-9'/);
assert.match(pkg.scripts.test, /b05-scene-full-run/);
assert.match(pkg.scripts['audit:b05-scene'], /b05-scene-full-browser-run/);
assert.match(workflow, /npm run audit:b05-scene/);
console.log('B05-01 mobile Full-mode and responsive scene contracts PASS');

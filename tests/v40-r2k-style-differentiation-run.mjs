import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const css = fs.readFileSync('styles/v4-learning-styles.css', 'utf8');
const settingsUi = fs.readFileSync('src/ui/settings.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const sceneLoader = fs.readFileSync('src/ui/scene-assets.js', 'utf8');

const pages = ['library', 'review', 'exam', 'stats'];
const themes = ['light', 'dark'];

for (const style of ['academy', 'epic']) {
  for (const page of pages) {
    for (const theme of themes) {
      const path = `assets/learning/styles/${style}/${page}-${theme}.webp`;
      assert.equal(fs.existsSync(path), true, `${path} must exist`);
      assert.ok(fs.statSync(path).size > 20_000, `${path} must be a real scene asset`);
    }
  }
}

for (const page of pages) {
  for (const theme of themes) {
    const academy = fs.readFileSync(`assets/learning/styles/academy/${page}-${theme}.webp`);
    const epic = fs.readFileSync(`assets/learning/styles/epic/${page}-${theme}.webp`);
    const ah = crypto.createHash('sha256').update(academy).digest('hex');
    const eh = crypto.createHash('sha256').update(epic).digest('hex');
    assert.notEqual(ah, eh, `${page}-${theme} academy and epic assets must be materially different`);
  }
}

assert.match(css, /v4\.0 R2K — Style Differentiation/);
assert.match(css, /styles\/academy\/library-light\.webp/);
assert.match(css, /styles\/academy\/review-dark\.webp/);
assert.match(css, /styles\/academy\/exam-light\.webp/);
assert.match(css, /styles\/academy\/stats-dark\.webp/);
assert.match(css, /styles\/epic\/library-light\.webp/);
assert.match(css, /styles\/epic\/review-dark\.webp/);
assert.match(css, /--academy-brass:/);
assert.match(css, /--academy-walnut:/);
assert.match(css, /--epic-cyan:/);
assert.match(css, /Songti TC/);
assert.match(css, /radial-gradient\(circle, rgba\(255,255,255/);

assert.match(settingsUi, /古典書庫、手稿、黃銅儀器與學院考場/);
assert.match(settingsUi, /漂浮魔導書、符文星圖、記憶水晶與試煉殿堂/);

assert.match(sceneLoader, /styles\/academy\/library-light\.webp/);
assert.match(sceneLoader, /styles\/academy\/stats-dark\.webp/);
assert.match(sceneLoader, /styles\/epic\/library-light\.webp/);
assert.match(sw, /cacheFirstScene/);
// Cache revision is allowed to advance independently of this milestone.
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);

console.log('MoXin Quiz v4.0 R2K style differentiation tests passed.');

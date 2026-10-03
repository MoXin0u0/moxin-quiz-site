import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const review = fs.readFileSync('src/ui/review-center.js', 'utf8');
const exam = fs.readFileSync('src/ui/exam-center.js', 'utf8');
const stats = fs.readFileSync('src/ui/stats.js', 'utf8');
const css = fs.readFileSync('styles/v4-learning.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(index, v3);

// The retired small scene cards must no longer be part of runtime hero DOM.
for (const source of [index, review, exam, stats]) {
  assert.doesNotMatch(source, /learning-scene-panel/);
}

for (const [source, scene] of [
  [index, 'library'],
  [review, 'review'],
  [exam, 'exam'],
  [stats, 'stats'],
]) {
  assert.match(source, new RegExp(`learning-hero-whole[\\s\\S]*data-learning-scene="${scene}"|data-learning-scene="${scene}"[\\s\\S]*learning-hero-whole`));
  assert.match(source, new RegExp(`data-scene-art="${scene}"`));
}

assert.match(index, /選擇題庫開始練習/);
assert.match(index, /href="#librarySourceTitle"/);
assert.match(review, /pickReviewRecommendation/);
assert.match(review, /learning-hero-primary-cta/);
assert.match(exam, /href="#examBankList"/);
assert.match(exam, /learning-hero-flow/);
assert.match(stats, /learning-hero-data-visual/);

assert.match(css, /v4\.0 R2H — Whole-page Learning Composition/);
assert.match(css, /\.learning-hero-whole \{/);
assert.match(css, /\.learning-hero-art \{/);
assert.match(css, /\.learning-hero-content \{/);
assert.match(css, /--hero-content-width:/);
assert.match(css, /--hero-art-position:/);
assert.match(css, /\.learning-hero-whole::before/);
assert.match(css, /\.learning-hero-cta-row/);
assert.match(css, /\.learning-hero-floating-stat/);
assert.match(css, /\.learning-hero-data-visual/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.learning-hero-art[\s\S]*height: 54%/);
assert.match(css, /prefers-reduced-data: reduce/);

const sceneRuntimeCache =
  sw.includes('cacheFirstScene') &&
  sw.includes('/assets/learning/scenes/');

for (const name of [
  'library-light.webp', 'library-dark.webp',
  'review-light.webp', 'review-dark.webp',
  'exam-light.webp', 'exam-dark.webp',
  'stats-light.webp', 'stats-dark.webp',
]) {
  const path = `./assets/learning/scenes/${name}`;
  assert.ok(
    sw.includes(path) || sceneRuntimeCache,
    `${path} should be offline-capable via APP_SHELL or the runtime scene cache`,
  );
}

assert.match(sw, /moxin-quiz-v3-4\.0\.0-[^']+/);

console.log('MoXin Quiz v4.0 R2H whole-page learning composition tests passed.');

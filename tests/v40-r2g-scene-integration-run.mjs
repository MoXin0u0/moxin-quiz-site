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
assert.match(index, /data-scene-art="library"/);
assert.match(review, /data-scene-art="review"/);
assert.match(exam, /data-scene-art="exam"/);
assert.match(stats, /data-scene-art="stats"/);

const sceneRuntimeCache =
  sw.includes('cacheFirstScene') &&
  sw.includes('/assets/learning/scenes/');

for (const name of [
  'library-light.webp', 'library-dark.webp',
  'review-light.webp', 'review-dark.webp',
  'exam-light.webp', 'exam-dark.webp',
  'stats-light.webp', 'stats-dark.webp',
]) {
  const path = `assets/learning/scenes/${name}`;
  assert.equal(fs.existsSync(path), true, `${path} should exist`);
  const size = fs.statSync(path).size;
  assert.ok(size > 20_000, `${path} should contain a real scene asset`);
  assert.ok(size < 180_000, `${path} should stay lightweight for GitHub Pages/PWA`);
  assert.ok(
    sw.includes(`./${path}`) || sceneRuntimeCache,
    `${path} should be offline-capable via APP_SHELL or the runtime scene cache`,
  );
}

assert.match(css, /v4\.0 R2G — Learning Scene Integration/);
assert.match(css, /--learning-scene-image:/);
assert.match(css, /\.learning-scene-art/);
assert.match(css, /library-light\.webp/);
assert.match(css, /review-dark\.webp/);
assert.match(css, /exam-light\.webp/);
assert.match(css, /stats-dark\.webp/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.learning-scene-panel \.learning-scene-art[\s\S]*display: none/);
assert.match(css, /prefers-reduced-data: reduce/);
assert.match(sw, /moxin-quiz-v3-4\.0\.0-r2[a-z0-9.]+-1/);

console.log('MoXin Quiz v4.0 R2G scene integration tests passed.');

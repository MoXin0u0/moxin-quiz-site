import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('styles/v4-learning.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const doc = fs.readFileSync('docs/V4_0_R2C_LEARNING_DECOR_AND_RESPONSIVE.md', 'utf8');

for (const file of [
  'assets/learning/light-sun-corner.svg',
  'assets/learning/light-books-side.svg',
  'assets/learning/dark-moon-lantern.svg',
  'assets/learning/dark-desk-side.svg',
]) {
  assert.equal(fs.existsSync(file), true, `${file} should exist`);
}

assert.match(css, /--learn-decor-a:/);
assert.match(css, /--learn-decor-b:/);
assert.match(css, /::after \{/);
assert.match(css, /light-sun-corner\.svg/);
assert.match(css, /dark-moon-lantern\.svg/);
assert.match(css, /learning-hero-scene::before/);
assert.match(css, /learning-review-focus::before/);
assert.match(css, /learning-accuracy-card::before/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /@media \(max-width: 520px\)/);
assert.match(css, /display: none;/);
assert.match(css, /learning-scene-note/);
assert.match(css, /learning-book-stack/);

assert.match(sw, /moxin-quiz-v3-4\.0\.0-r2c-1/);
assert.match(sw, /assets\/learning\/light-sun-corner\.svg/);
assert.match(sw, /assets\/learning\/dark-desk-side\.svg/);

assert.match(doc, /桌面版學習頁外圍仍有留白/);
assert.match(doc, /<= 520px/);

console.log('MoXin Quiz v4.0 R2C learning decor and responsive tests passed.');

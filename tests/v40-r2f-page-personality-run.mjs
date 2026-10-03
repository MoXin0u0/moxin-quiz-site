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
assert.match(index, /data-learning-scene="library"/);
assert.match(index, /data-scene-art="library"/);

assert.match(review, /data-learning-scene="review"/);
assert.match(review, /data-scene-art="review"/);
assert.match(review, /今日優先/);

assert.match(exam, /data-learning-scene="exam"/);
assert.match(exam, /data-scene-art="exam"/);
assert.match(exam, /learning-hero-flow/);

assert.match(stats, /data-learning-scene="stats"/);
assert.match(stats, /data-scene-art="stats"/);
assert.match(stats, /learning-hero-data-visual/);

assert.match(css, /v4\.0 R2F — Learning Page Personality & Scene Framework/);
assert.match(css, /--learn-page-accent:/);
assert.match(css, /--learn-page-accent-2:/);
assert.match(css, /v4\.0 R2H — Whole-page Learning Composition/);
assert.match(css, /\.learning-hero-whole/);
assert.match(css, /html\[data-reduce-motion="true"\]/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

// Legacy R2C bitmap/SVG decorations remain retired from the R2F+ page layer.
const r2fStart = css.indexOf('v4.0 R2F — Learning Page Personality & Scene Framework');
assert.ok(r2fStart >= 0);
const r2fCss = css.slice(r2fStart);
assert.doesNotMatch(r2fCss, /assets\/learning\/light-sun-corner\.svg/);
assert.doesNotMatch(r2fCss, /assets\/learning\/dark-desk-side\.svg/);

// Cache revision is allowed to advance independently of this milestone.
assert.match(sw, /moxin-quiz-v3-4\.0\.0-r2[a-z0-9.]+-\d+/);

console.log('MoXin Quiz v4.0 R2F page personality and scene framework tests passed.');

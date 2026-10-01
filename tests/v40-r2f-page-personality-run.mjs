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

assert.match(review, /learning-scene-panel learning-scene-review/);
assert.match(review, /data-learning-scene="review"/);
assert.match(review, /記憶焦點/);

assert.match(exam, /learning-scene-panel learning-scene-exam/);
assert.match(exam, /learning-exam-flow-steps/);
assert.match(exam, /data-learning-scene="exam"/);
assert.match(exam, /考場流程/);

assert.match(stats, /learning-scene-panel learning-scene-stats/);
assert.match(stats, /data-learning-scene="stats"/);
assert.match(stats, /整體掌握/);

assert.match(css, /v4\.0 R2F — Learning Page Personality & Scene Framework/);
assert.match(css, /--learn-page-accent:/);
assert.match(css, /--learn-page-accent-2:/);
assert.match(css, /\.learning-scene-panel \{/);
assert.match(css, /\.learning-scene-panel-heading/);
assert.match(css, /\.learning-exam-flow-steps/);
assert.match(css, /--learning-library-art: none/);
assert.match(css, /html\[data-reduce-motion="true"\]/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

// Page-level scene framework must not reactivate the retired R2C bitmap/SVG
// decorations as a full-page background.
const r2fStart = css.indexOf('v4.0 R2F — Learning Page Personality & Scene Framework');
assert.ok(r2fStart >= 0);
const r2fCss = css.slice(r2fStart);
assert.doesNotMatch(r2fCss, /assets\/learning\/light-sun-corner\.svg/);
assert.doesNotMatch(r2fCss, /assets\/learning\/dark-desk-side\.svg/);

assert.match(sw, /moxin-quiz-v3-4\.0\.0-r2[a-z0-9.]+-1/);

console.log('MoXin Quiz v4.0 R2F page personality and scene framework tests passed.');

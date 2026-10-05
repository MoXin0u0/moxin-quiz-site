import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const review = fs.readFileSync('src/ui/review-center.js', 'utf8');
const exam = fs.readFileSync('src/ui/exam-center.js', 'utf8');
const stats = fs.readFileSync('src/ui/stats.js', 'utf8');
const learning = fs.readFileSync('styles/v4-learning.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(index, v3);

assert.match(index, /learning-hero-library/);
assert.match(index, /learning-hero-whole/);
assert.match(index, /learning-hero-cta-row/);
assert.match(index, /data-nav-review/);
assert.match(index, /data-nav-exam/);
assert.match(index, /data-nav-stats/);

assert.match(review, /learning-review-hero/);
assert.match(review, /learning-hero-stat-strip/);
assert.match(review, /learning-review-mode-grid/);
assert.match(review, /data-review-bank/);
assert.match(review, /data-review-mode/);

assert.match(exam, /learning-exam-hero/);
assert.match(exam, /learning-hero-flow/);
assert.match(exam, /learning-exam-config/);
assert.match(exam, /data-start-exam/);
assert.match(exam, /data-resume-exam/);

assert.match(stats, /learning-stats-hero/);
assert.match(stats, /learning-accuracy-ring/);
assert.match(stats, /learning-mastery-bar/);
assert.match(stats, /item\.accuracy/);

assert.match(learning, /\.learning-hero/);
assert.match(learning, /\.learning-hero-whole/);
assert.match(learning, /\.learning-hero-art/);
assert.match(learning, /\.learning-accuracy-ring/);
assert.match(learning, /html\[data-theme="dark"\]/);

assert.doesNotMatch(learning, /content:\s*["']✦["']/);
assert.doesNotMatch(learning, /#toolsView/);
assert.doesNotMatch(learning, /#settingsView/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v(?:3-4\.\d+\.\d+|5)-[^']+'/);
assert.match(sw, /styles\/v4-learning\.css/);

console.log('MoXin Quiz v4.0 R2B learning page redesign tests passed.');

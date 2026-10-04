import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const learning = fs.readFileSync('styles/v4-learning.css', 'utf8');
const design = fs.readFileSync('styles/v4-design.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(index, v3);

const designPos = index.indexOf('styles/v4-design.css');
const learningPos = index.indexOf('styles/v4-learning.css');
assert.ok(designPos >= 0);
assert.ok(learningPos > designPos, 'v4-learning.css must load after v4-design.css');
assert.doesNotMatch(design, /@import url\('\.\/v4-learning\.css'\)/);

for (const view of [
  '#libraryView',
  '#reviewView',
  '#examCenterView',
  '#examView',
  '#statsView',
  '#bankDetailView',
  '#practiceView',
]) {
  assert.equal(learning.includes(view), true, `${view} missing from learning scope`);
}

assert.equal(learning.includes('#toolsView'), false);
assert.equal(learning.includes('#settingsView'), false);

assert.match(learning, /html\[data-theme="dark"\]/);
assert.match(learning, /html\[data-theme="light"\]/);
assert.match(learning, /--learn-canvas:/);
assert.match(learning, /--learn-surface:/);
assert.match(learning, /--learn-text:/);
assert.match(learning, /--learn-primary:/);

for (const nav of [
  'data-nav-library',
  'data-nav-review',
  'data-nav-exam',
  'data-nav-stats',
  'data-nav-tools',
]) {
  assert.equal(learning.includes(nav), true, `${nav} missing`);
}

assert.match(learning, /#libraryView \.bank-card/);
assert.match(learning, /#reviewView \.review-mode-card/);
assert.match(learning, /#examCenterView \.exam-bank-card/);
assert.match(learning, /#statsView \.mastery-cell/);
assert.match(learning, /#practiceView \.answer-option/);

assert.match(sw, /styles\/v4-learning\.css/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);

console.log('MoXin Quiz v4.0 R2A learning experience tests passed.');

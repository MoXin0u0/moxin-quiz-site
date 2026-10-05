import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const design = fs.readFileSync('styles/v4-design.css', 'utf8');
const studio = fs.readFileSync('src/ui/studio-r1.js', 'utf8');

assert.equal(index, v3);
assert.match(index, /styles\/v4-design\.css/);
assert.match(index, /<span class="version-badge">v[0-9][^<]*<\/span>/);
assert.doesNotMatch(index, /v4 preview/i);

for (const nav of [
  'data-nav-library',
  'data-nav-review',
  'data-nav-exam',
  'data-nav-stats',
  'data-nav-tools',
  'data-nav-settings',
]) {
  assert.match(index, new RegExp(nav));
}

assert.match(design, /--sidebar-width:/);
assert.match(design, /html\[data-theme="dark"\]/);
assert.match(design, /\.mastery-cell\.learning/);
assert.match(design, /\.answer-option\.is-correct/);
assert.match(design, /grid-template-columns:\s*repeat\(6/);

assert.match(studio, /題庫設定/);
assert.match(studio, /即時預覽/);
assert.match(studio, /設定正確答案/);
assert.match(studio, /planQuestionTypeChange/);
assert.match(studio, /convertQuestionType/);
assert.doesNotMatch(studio, /normalizeQuestionForType/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v(?:3-4\.\d+\.\d+|5)-[^']+'/);
assert.match(sw, /styles\/v4-design\.css/);
assert.match(sw, /src\/studio\/question-draft\.js/);

console.log('MoXin Quiz v4.0 R1 structural checks passed.');

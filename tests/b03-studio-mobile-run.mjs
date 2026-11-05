import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('src/ui/studio-r1.js', 'utf8');
const css = readFileSync('styles/v4-studio-r1.css', 'utf8');
const sw = readFileSync('service-worker.js', 'utf8');

for (const step of ['questions', 'edit', 'inspect', 'export']) {
  assert.match(studio, new RegExp('data-studio-jump="' + step + '"'));
}
assert.match(studio, /aria-label="工作室快速導覽"/);
assert.match(studio, /target\?\.scrollIntoView/);
assert.match(studio, /window\.matchMedia\('\(max-width: 820px\)'\)/);
assert.match(studio, /mount\.querySelector\('\.studio-r1-canvas'\)\?\.scrollIntoView/);
assert.match(studio, /aria-current="true"/);
assert.match(studio, /Array\.from\(addImagesInput\.files \|\| \[\]\)/);
assert.match(studio, /rail\.scrollLeft \+=/);

for (const section of ['studioQuestionRail', 'studioQuestionCanvas', 'studioQuestionInspector', 'studioExportPanel']) {
  assert.equal(studio.split('id="' + section + '"').length - 1, 1, section + ' should exist exactly once');
}
assert.match(studio, /編輯內容會自動儲存為本機草稿/);
assert.match(studio, /儲存到我的題庫/);
assert.match(studio, /不會自動上傳或公開/);
assert.match(studio, /另存新題庫.*?新草稿/);
assert.match(studio, /data-studio-save-library/);
assert.match(studio, /data-studio-export-json/);
assert.match(studio, /data-studio-export-zip/);
assert.match(studio, /\$\{report\.valid \? '' : 'disabled'\}/);

assert.match(css, /\.studio-r1-mobile-nav\s*\{\s*display:\s*none/);
assert.match(css, /@media \(max-width:\s*820px\)/);
assert.match(css, /\.studio-r1-mobile-nav\s*\{\s*position:\s*sticky/);
assert.match(css, /\.studio-r1-mobile-nav > button\s*\{[^}]*min-height:\s*44px/s);
assert.match(css, /\.studio-r1-editor-topbar\s*\{\s*position:\s*static/);
assert.match(css, /scroll-margin-top:\s*5\.5rem/);
assert.match(css, /@media \(max-width:\s*560px\)/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-5\.0\.0-prod-6'/);
assert.match(sw, /'\.\/src\/ui\/studio-r1\.js'/);
assert.match(sw, /'\.\/styles\/v4-studio-r1\.css'/);

console.log('B03-03 mobile studio navigation and safe editing/export contracts PASS.');

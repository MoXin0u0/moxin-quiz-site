import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('app.html', 'utf8');
const legacy = readFileSync('v3.html', 'utf8');
const css = readFileSync('styles/v4-home.css', 'utf8');
const sw = readFileSync('service-worker.js', 'utf8');
const dashboardCopy = readFileSync('src/ui/home-dashboard.js', 'utf8');
assert.match(dashboardCopy, /題庫選擇已放在上方/);
assert.doesNotMatch(dashboardCopy, /題庫收藏仍維持在下方/);

assert.equal(app, legacy, 'Main and compatibility entry must stay byte-identical.');

const library = app.split('<section id="libraryView" data-view="library">')[1]
  ?.split('<section id="reviewView"')[0];
assert.ok(library, 'Library view markup must exist.');
const pos = fragment => library.indexOf(fragment);
const title = pos('id="librarySourceTitle"');
const author = pos('id="authorLibraryPanel"');
const user = pos('id="userLibraryPanel"');
const hero = pos('learning-hero learning-hero-library learning-hero-whole');
const dashboard = pos('id="homeDashboardArea"');
assert.ok([title, author, user, hero, dashboard].every(n => n >= 0));
assert.ok(title < user && user < author && author < hero && hero < dashboard,
  'Actionable bank tabs and panels must precede artwork and learning summary.');

for (const fragment of [
  'aria-controls="authorLibraryPanel"',
  'aria-controls="userLibraryPanel"',
  'class="learning-section-head library-priority-head"',
  'class="learning-storage-row library-storage-inline"',
  'href="#homeDashboardArea"',
  'aria-selected="true" aria-controls="userLibraryPanel"',
  'aria-selected="false" aria-controls="authorLibraryPanel"',
]) assert.ok(library.includes(fragment), 'Missing B03 library contract: ' + fragment);

for (const id of [
  'librarySourceTitle', 'authorLibraryPanel', 'userLibraryPanel',
  'homeDashboardArea', 'storageStatus', 'bankFileInput', 'authorBankList',
]) assert.equal(app.split('id="' + id + '"').length - 1, 1, id + ' duplicated or missing.');

assert.match(css, /#libraryView > \.library-priority-head/);
assert.match(css, /\.source-tab\s*\{[^}]*min-height:\s*44px/s);
assert.match(css, /@media \(max-width:\s*760px\)/);
assert.match(css, /min-height:\s*48px/);
const main = readFileSync('src/app/main.js', 'utf8');
assert.match(main, /librarySourceTab:\s*'user'/);
assert.match(main, /renderBankLibrary\(elements\.bankList, state\.banks\)/);
assert.match(app, /<h2 id="libraryTitle">已加入的題庫<\/h2>/);
assert.match(app, /<h2 id="authorLibraryTitle">探索題庫<\/h2>/);
assert.match(sw, /moxin-quiz-v5-5\.0\.0-prod-14/);
assert.match(sw, /'\.\/app\.html'/);
assert.match(sw, /'\.\/v3\.html'/);
assert.match(sw, /'\.\/styles\/v4-home\.css'/);

console.log('B03-02 task-first library ordering, a11y selectors and PWA shell PASS.');

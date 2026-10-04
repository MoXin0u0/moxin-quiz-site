import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const css = fs.readFileSync('styles/v4-learning.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(index, v3);
assert.match(index, /learning-hero-whole/);
assert.match(index, /learning-hero-art-library/);
assert.doesNotMatch(index, /learning-book book-a/);
assert.doesNotMatch(index, /learning-book book-b/);
assert.doesNotMatch(index, /learning-book book-c/);

assert.match(css, /v4\.0 R2D — Learning Layout Polish/);
assert.match(css, /max-width: 1800px/);
assert.match(css, /width: calc\(100% - var\(--sidebar-width\)\)/);
assert.match(css, /v4\.0 R2H — Whole-page Learning Composition/);
assert.match(css, /\.learning-hero-art \{/);

// Legacy R2C decorations stay in the file for compatibility, but R2D must
// explicitly suppress them later in the cascade.
const legacyDecor = css.indexOf('background-image: var(--learn-decor-a), var(--learn-decor-b);');
const r2dStart = css.indexOf('v4.0 R2D — Learning Layout Polish');
const suppression = css.indexOf('learning-hero-scene::before', r2dStart);
assert.ok(legacyDecor >= 0);
assert.ok(r2dStart > legacyDecor);
assert.ok(suppression > r2dStart);
assert.match(css.slice(suppression, suppression + 240), /display: none;/);

assert.match(css, /@media \(max-width: 940px\)/);
assert.match(css, /backdrop-filter: none/);
assert.match(css, /bottom: 0 !important/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /\.learning-hero-art[\s\S]*height: 54%/);
assert.match(css, /@media \(max-width: 390px\)|@media \(max-width: 420px\)/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);

console.log('MoXin Quiz v4.0 R2D layout polish tests passed.');

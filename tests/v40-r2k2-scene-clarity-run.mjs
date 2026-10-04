import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('styles/v4-learning-styles.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(css, /v4\.0 R2K\.2 — Scene Clarity/);

const fullStart = css.indexOf('html[data-scene-intensity="full"] .learning-hero-art {', css.indexOf('v4.0 R2K.2'));
assert.ok(fullStart >= 0);
const fullRule = css.slice(fullStart, css.indexOf('}', fullStart) + 1);
assert.match(fullRule, /opacity:\s*1\s*!important/);
assert.match(fullRule, /filter:\s*none/);

const reducedStart = css.indexOf('html[data-scene-intensity="reduced"] .learning-hero-art,', css.indexOf('v4.0 R2K.2'));
assert.ok(reducedStart >= 0);
const reducedRule = css.slice(reducedStart, css.indexOf('}', reducedStart) + 1);
assert.match(reducedRule, /opacity:\s*\.24\s*!important/);
assert.match(reducedRule, /saturate\(\.62\)/);

assert.match(css, /transparent 64%/);
assert.match(css, /data-learning-style="academy"\]\[data-scene-intensity="full"/);
assert.match(css, /data-learning-style="epic"\]\[data-scene-intensity="full"/);
assert.match(css, /@media \(max-width: 760px\)/);

// Cache revision is allowed to advance independently of this milestone.
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);

console.log('MoXin Quiz v4.0 R2K.2 scene clarity tests passed.');

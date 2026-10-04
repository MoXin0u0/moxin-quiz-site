import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('styles/v4-learning.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

const r2dStart = css.indexOf('v4.0 R2D — Learning Layout Polish');
assert.ok(r2dStart >= 0);

const pathRuleStart = css.indexOf('.learning-scene-path {', r2dStart);
assert.ok(pathRuleStart >= 0);

const pathRuleEnd = css.indexOf('}', pathRuleStart);
const pathRule = css.slice(pathRuleStart, pathRuleEnd + 1);

assert.match(pathRule, /position:\s*absolute/);
assert.match(pathRule, /bottom:\s*1rem/);
assert.match(pathRule, /left:\s*clamp/);
assert.match(pathRule, /right:\s*clamp/);

assert.match(css, /\.learning-art-slot \.learning-scene-path/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);

console.log('MoXin Quiz v4.0 R2D.1 scene path positioning tests passed.');

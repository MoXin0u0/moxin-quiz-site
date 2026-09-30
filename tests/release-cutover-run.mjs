import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const legacy = fs.readFileSync('legacy-v2.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(index, v3, 'index.html must remain identical to the tested v3.html release entry.');
assert.ok(legacy.length > 0, 'legacy-v2.html must exist as rollback entry.');

assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');

assert.match(sw, /moxin-quiz-v3-release-1/);
assert.match(sw, /'\.\/index\.html'/);
assert.match(sw, /'\.\/v3\.html'/);
assert.match(sw, /cache\.match\('\.\/index\.html'\)/);

assert.doesNotMatch(index, /(?:src|href)="(?:script\.js|style\.css)"/);
assert.match(legacy, /style\.css/);
assert.match(legacy, /script\.js/);

console.log('MoXin Quiz v3 release cutover regression tests passed.');

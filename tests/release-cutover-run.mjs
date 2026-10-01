import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const legacy = fs.readFileSync('legacy-v2.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(index, v3, 'index.html must remain identical to the tested v3.html release entry.');
assert.ok(legacy.length > 0, 'legacy-v2.html must exist as compatibility entry.');
assert.match(legacy, /\.\/legacy-v2\//);

assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');

assert.match(sw, /moxin-quiz-v3-[^'"\s]+/);
assert.match(sw, /'\.\/index\.html'/);
assert.match(sw, /'\.\/v3\.html'/);
assert.match(sw, /cache\.match\('\.\/index\.html'\)/);

assert.doesNotMatch(index, /(?:src|href)="(?:script\.js|style\.css)"/);
assert.equal(fs.existsSync('legacy-v2/index.html'), true);
assert.equal(fs.existsSync('legacy-v2/style.css'), true);
assert.equal(fs.existsSync('legacy-v2/script.js'), true);
assert.equal(fs.existsSync('script.js'), false);
assert.equal(fs.existsSync('style.css'), false);

console.log('MoXin Quiz v3 release cutover regression tests passed.');

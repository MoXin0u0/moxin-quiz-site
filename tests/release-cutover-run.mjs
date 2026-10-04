import assert from 'node:assert/strict';
import fs from 'node:fs';

const landing = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const legacy = fs.readFileSync('legacy-v2.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(app, v3, 'app.html and v3.html must remain byte-identical compatibility entries.');
assert.match(landing, /data-landing-page|class="landing-body"/);
assert.match(landing, /href="\.\/app\.html"/);
assert.doesNotMatch(landing, /src\/app\/main\.js/);
assert.match(app, /data-nav-library/);
assert.match(app, /src\/app\/main\.js/);

assert.ok(legacy.length > 0);
assert.match(legacy, /\.\/legacy-v2\//);

assert.equal(manifest.start_url, './app.html');
assert.equal(manifest.scope, './');

assert.match(sw, /moxin-quiz-v3-[^'"\s]+/);
assert.match(sw, /'\.\/index\.html'/);
assert.match(sw, /'\.\/app\.html'/);
assert.match(sw, /'\.\/v3\.html'/);
assert.match(sw, /cache\.match\('\.\/index\.html'\)/);
assert.match(sw, /cache\.match\('\.\/app\.html'\)/);

assert.doesNotMatch(app, /(?:src|href)="(?:script\.js|style\.css)"/);
assert.equal(fs.existsSync('legacy-v2/index.html'), true);
assert.equal(fs.existsSync('legacy-v2/style.css'), true);
assert.equal(fs.existsSync('legacy-v2/script.js'), true);
assert.equal(fs.existsSync('script.js'), false);
assert.equal(fs.existsSync('style.css'), false);

console.log('MoXin Quiz v4.1 landing/app entry regression tests passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_CONFIG } from '../src/app/config.js';

const app = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const readme = fs.readFileSync('README.md', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');
const plan = fs.readFileSync('docs/V4_0_PLAN.md', 'utf8');

assert.equal(app, v3);
assert.match(app, /<title>墨忻刷題網 v4\.\d+<\/title>/);
assert.match(app, /<span class="version-badge">v4\.\d+<\/span>/);
assert.doesNotMatch(app, /v4 preview|v3\.3|RC1/i);

if (APP_CONFIG.features?.v5DataFoundation) {
  assert.match(APP_CONFIG.appVersion, /^5\.0\.0(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(APP_CONFIG.releaseChannel, 'development');
} else {
  assert.match(APP_CONFIG.appVersion, /^4\.\d+\.\d+$/);
  assert.equal(APP_CONFIG.releaseChannel, 'production');
}
assert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');
assert.ok(APP_CONFIG.dbVersion >= 3);

assert.equal(manifest.scope, './');
assert.match(readme, /\*\*v4\.\d+\*\*/);
assert.equal(pkg.scripts.preflight, 'node scripts/v4-release-preflight.mjs');
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-[^']+'/);
assert.match(plan, /## v4\.0 Production/);
assert.match(plan, /\*\*狀態：Released\*\*/);

console.log('MoXin Quiz v4 production compatibility contract passed.');

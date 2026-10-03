import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_CONFIG } from '../src/app/config.js';

const index = fs.readFileSync('index.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const readme = fs.readFileSync('README.md', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');
const plan = fs.readFileSync('docs/V4_0_PLAN.md', 'utf8');

assert.equal(index, v3);
assert.match(index, /<title>墨忻刷題網 v4\.0<\/title>/);
assert.match(index, /<span class="version-badge">v4\.0<\/span>/);
assert.doesNotMatch(index, /v4 preview|v3\.3|v4\.0 RC1/i);

assert.equal(APP_CONFIG.appVersion, '4.0.0');
assert.equal(APP_CONFIG.releaseChannel, 'production');
assert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');
assert.equal(APP_CONFIG.dbVersion, 3);

assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');

assert.match(readme, /\*\*v4\.0\*\*/);
assert.match(readme, /Branch: main/);
assert.match(readme, /Release tag: v4\.0\.0/);

assert.equal(pkg.name, 'moxin-quiz-site-v4');
assert.match(pkg.scripts.test, /v40-production-release-run\.mjs/);
assert.doesNotMatch(pkg.scripts.test, /v40-rc1-release-metadata-run\.mjs|v40-rc1-cutover-contract-run\.mjs/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.0\.0-r2k\.5-21'/);
assert.match(plan, /## v4\.0 Production/);
assert.match(plan, /\*\*狀態：Released\*\*/);

for (const file of [
  '.github/workflows/v4-production-cutover.yml',
  'scripts/finalize-v4-production.mjs',
]) {
  assert.equal(fs.existsSync(file), false);
}

console.log('MoXin Quiz v4.0 production release contract passed.');

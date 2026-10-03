import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_CONFIG } from '../src/app/config.js';

const index = fs.readFileSync('index.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const plan = fs.readFileSync('docs/V4_0_PLAN.md', 'utf8');

assert.equal(index, v3, 'index.html and v3.html must remain byte-identical.');
assert.match(index, /<title>墨忻刷題網 v4\.0 RC1<\/title>/);
assert.match(index, /<span class="version-badge">v4\.0 RC1<\/span>/);

assert.equal(APP_CONFIG.appVersion, '4.0.0-rc.1');
assert.equal(APP_CONFIG.releaseChannel, 'rc1');
assert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');
assert.equal(APP_CONFIG.dbVersion, 3);

assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.0\.0-r2k\.5-20'/);
assert.match(sw, /key\.startsWith\('moxin-quiz-v3-'\)/);
assert.match(sw, /key\.startsWith\('moxin-quiz-scenes-'\)/);
assert.match(sw, /cache\.match\('\.\/index\.html'\)/);
assert.match(sw, /cache\.match\('\.\/v3\.html'\)/);

assert.equal(pkg.scripts.preflight, 'node scripts/v4-release-preflight.mjs');
assert.equal(fs.existsSync('scripts/v4-cutover-rehearsal.mjs'), true);
assert.match(pkg.scripts.test, /v40-rc1-cutover-contract-run\.mjs/);

assert.match(plan, /RC1 — v4\.0 Release Readiness/);
assert.match(plan, /狀態：Stable（Main Cutover Rehearsal）/);
assert.match(plan, /✅ Main cutover rehearsal/);

for (const forbidden of [
  '.github/workflows/apply-rc1-main-cutover-rehearsal.yml',
  'scripts/apply-rc1-main-cutover-rehearsal.mjs',
]) {
  assert.equal(fs.existsSync(forbidden), false, `One-time installer must not enter release candidate: ${forbidden}`);
}

console.log('MoXin Quiz v4.0 RC1 cutover contract tests passed.');

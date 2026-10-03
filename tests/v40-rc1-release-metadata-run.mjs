import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_CONFIG } from '../src/app/config.js';

const index = fs.readFileSync('index.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const readme = fs.readFileSync('README.md', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.equal(index, v3, 'index.html and v3.html must remain byte-identical.');

assert.match(index, /<title>墨忻刷題網 v4\.0 RC1<\/title>/);
assert.match(index, /<span class="version-badge">v4\.0 RC1<\/span>/);
assert.doesNotMatch(index, /v4 preview/i);
assert.doesNotMatch(index, /v3\.3/i);
assert.match(index, /meta name="description" content="墨忻刷題網 v4\.0/);

assert.equal(manifest.name, '墨忻刷題網');
assert.equal(manifest.short_name, '墨忻刷題');
assert.match(manifest.description, /題庫工作室/);
assert.match(manifest.description, /本機優先/);

assert.match(readme, /^# 墨忻刷題網$/m);
assert.match(readme, /\*\*v4\.0 RC1\*\*/);
assert.match(readme, /題庫工作室/);
assert.match(readme, /學習目標/);
assert.match(readme, /考前衝刺/);
assert.match(readme, /內部相容性名稱/);
assert.match(readme, /moxin-quiz-v3/);
assert.match(readme, /moxin\.v3\.settings/);

assert.equal(APP_CONFIG.appVersion, '4.0.0-rc.1');
assert.equal(APP_CONFIG.releaseChannel, 'rc1');
assert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');
assert.equal(APP_CONFIG.dbVersion, 3);

assert.equal(pkg.name, 'moxin-quiz-site-v4-rc1');
assert.equal(pkg.scripts.preflight, 'node scripts/v4-release-preflight.mjs');
assert.match(pkg.scripts.test, /v40-rc1-release-metadata-run\.mjs/);

assert.equal(fs.existsSync('scripts/v4-release-preflight.mjs'), true);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.0\.0-r2k\.5-20'/);
assert.match(sw, /key\.startsWith\('moxin-quiz-v3-'\)/);

console.log('MoXin Quiz v4.0 RC1 release metadata tests passed.');

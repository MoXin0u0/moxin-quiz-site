import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_CONFIG } from '../src/app/config.js';

const landing = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('service-worker.js', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');

assert.match(landing, /<title>墨忻刷題網｜首頁<\/title>/);
assert.match(landing, /class="landing-body"/);
assert.match(landing, /href="\.\/app\.html">開始使用<\/a>/);
assert.match(landing, /id="features"/);
assert.match(landing, /id="howToStart"/);
assert.match(landing, /id="updates"/);
assert.match(landing, /id="data"/);
assert.match(landing, /2026-10-04/);
assert.doesNotMatch(landing, /src\/app\/main\.js/);

assert.equal(app, v3);
assert.match(app, /<title>墨忻刷題網 v4\.1<\/title>/);
assert.match(app, /<span class="version-badge">v4\.1<\/span>/);
assert.match(app, /data-nav-library/);

if (APP_CONFIG.features?.v5DataFoundation) {
  assert.equal(APP_CONFIG.appVersion, '5.0.0-dev');
  assert.equal(APP_CONFIG.releaseChannel, 'development');
} else {
  assert.equal(APP_CONFIG.appVersion, '4.1.0');
  assert.equal(APP_CONFIG.releaseChannel, 'production');
}
assert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');
assert.ok(APP_CONFIG.dbVersion >= 3);

assert.equal(manifest.start_url, './app.html');
assert.equal(manifest.scope, './');
assert.match(manifest.description, /v4\.1/);

for (const asset of [
  './index.html',
  './app.html',
  './v3.html',
  './styles/v41-landing.css',
  './src/app/landing.js',
]) {
  assert.ok(sw.includes(`'${asset}'`), `APP_SHELL missing ${asset}`);
}

if (APP_CONFIG.features?.v5DataFoundation) {
  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b075-1'/);
} else {
  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.1\.0-v41-landing-1'/);
}
assert.match(sw, /cache\.match\('\.\/app\.html'\)/);
assert.match(sw, /cache\.match\('\.\/index\.html'\)/);

assert.match(readme, /\*\*v4\.1\*\*/);
assert.match(readme, /公開首頁/);
assert.match(readme, /app\.html/);

console.log('MoXin Quiz v4.1 landing page tests passed.');

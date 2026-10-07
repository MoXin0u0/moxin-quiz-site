import assert from 'node:assert/strict';
import fs from 'node:fs';

import { APP_CONFIG } from '../src/app/config.js';

assert.equal(APP_CONFIG.appVersion, '5.0.0-dev');
assert.equal(APP_CONFIG.dbVersion, 4);
assert.equal(APP_CONFIG.features.cloudSync, false);
assert.equal(APP_CONFIG.features.syncUi, true);
assert.equal(
  APP_CONFIG.cloud.googleDriveScope,
  'https://www.googleapis.com/auth/drive.appdata',
);

const preflight = fs.readFileSync('src/app/preflight.js', 'utf8');
for (const id of [
  'db-version',
  'v5-migration',
  'cloud-auth-runtime',
  'cloud-schema',
  'sync-outbox',
  'sync-conflicts',
  'last-sync',
  'cloud-runtime',
  'google-oauth-config',
]) {
  assert.match(preflight, new RegExp(`id: '${id}'`));
}

assert.match(preflight, /APP_CONFIG\.dbVersion/);
assert.match(preflight, /APP_CONFIG\.cloudSyncSchemaVersion/);
assert.match(preflight, /Local-only/);
assert.match(preflight, /未連結時不會自動上傳/);

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.html', 'utf8');
const legacyEntry = fs.readFileSync('v3.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const readme = fs.readFileSync('README.md', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(index, /墨忻刷題網 v5/);
assert.match(index, /雲端同步是選用功能/);
assert.match(index, /完整備份仍獨立保留/);
assert.match(index, /不登入也能完整練習與離線使用/);
assert.match(index, /v5 development preview/);

for (const html of [app, legacyEntry]) {
  assert.match(html, /墨忻刷題網 v5/);
  assert.match(html, /version-badge">v5/);
  assert.match(html, /本機優先 · 雲端同步可選用/);
}

assert.match(manifest.description, /v5/);
assert.match(manifest.description, /可選用跨裝置雲端同步/);

assert.match(readme, /Local-first \/ Offline-ready/);
assert.match(readme, /Optional Cloud Sync/);
assert.match(readme, /features\.cloudSync=false/);
assert.match(readme, /Backup 與 Sync/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b13d1-1'/);

console.log('V5 B13D1 release readiness contracts passed.');

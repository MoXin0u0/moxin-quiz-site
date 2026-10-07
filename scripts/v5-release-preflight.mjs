import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { APP_CONFIG } from '../src/app/config.js';

const root = process.cwd();
const errors = [];
const warnings = [];

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const fail = message => errors.push(message);
const warn = message => warnings.push(message);

const legacy = spawnSync(
  process.execPath,
  ['scripts/v4-release-preflight.mjs'],
  { cwd: root, encoding: 'utf8' },
);

if (legacy.stdout) process.stdout.write(legacy.stdout);
if (legacy.stderr) process.stderr.write(legacy.stderr);
if (legacy.status !== 0) {
  fail('Base static release preflight failed.');
}

if (!APP_CONFIG.features?.v5DataFoundation) {
  fail('V5 data foundation feature must be enabled.');
}
if (!APP_CONFIG.features?.syncUi) {
  fail('V5 sync UI must be enabled for release readiness.');
}
if (!/^5\.0\.0(?:-[0-9A-Za-z.-]+)?$/.test(APP_CONFIG.appVersion)) {
  fail(`Unexpected V5 appVersion: ${APP_CONFIG.appVersion}`);
}
if (Number(APP_CONFIG.dbVersion) !== 4) {
  fail(`V5 requires IndexedDB v4; got v${APP_CONFIG.dbVersion}.`);
}
if (Number(APP_CONFIG.cloudSyncSchemaVersion) !== 1) {
  fail(
    `Unexpected Cloud Sync schema version: ${APP_CONFIG.cloudSyncSchemaVersion}`,
  );
}
if (APP_CONFIG.cloud.minimumClientVersion !== '5.0.0') {
  fail(
    `minimumClientVersion must be 5.0.0; got ${APP_CONFIG.cloud.minimumClientVersion}`,
  );
}
if (
  APP_CONFIG.cloud.googleDriveScope !==
  'https://www.googleapis.com/auth/drive.appdata'
) {
  fail('Google Drive scope must remain drive.appdata.');
}

const cloudRuntime = APP_CONFIG.features.cloudSync === true;
const clientConfigured = Boolean(
  APP_CONFIG.cloud.googleClientId &&
  APP_CONFIG.cloud.googleDriveScope,
);

if (cloudRuntime && !clientConfigured) {
  fail('Cloud runtime cannot be enabled without a Google Client ID.');
}
if (!cloudRuntime) {
  warn(
    'Cloud runtime is dormant. Local-only release readiness can pass, but live cloud cutover is not authorized.',
  );
}

for (const file of [
  'src/app/preflight.js',
  'src/app/sync-ui.js',
  'src/app/cloud-sync-flow.js',
  'src/sync/sync-engine.js',
  'src/sync/sync-scheduler.js',
  'src/sync/account-lifecycle.js',
  'src/sync/conflict-resolution.js',
  'src/ui/sync-center.js',
  'src/ui/conflicts.js',
  'styles/v5-sync.css',
  'styles/v5-dialogs.css',
]) {
  if (!exists(file)) fail(`Missing V5 release resource: ${file}`);
}

const preflight = read('src/app/preflight.js');
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
  if (!preflight.includes(`id: '${id}'`)) {
    fail(`Missing V5 diagnostic check: ${id}`);
  }
}

const app = read('app.html');
const compatibility = read('v3.html');
const landing = read('index.html');
const manifest = JSON.parse(read('manifest.webmanifest'));
const sw = read('service-worker.js');
const readme = read('README.md');

if (app !== compatibility) {
  fail('app.html and v3.html must remain byte-identical.');
}
if (!/<title>墨忻刷題網 v5<\/title>/.test(app)) {
  fail('App title must expose V5.');
}
if (!/version-badge">v5/.test(app)) {
  fail('App header must expose the V5 badge.');
}
if (!/Optional Cloud Sync/.test(landing)) {
  fail('Landing page must communicate Optional Cloud Sync.');
}
if (!/不強迫登入/.test(landing)) {
  fail('Landing page must preserve the no-forced-login promise.');
}
if (!/完整備份仍獨立保留/.test(landing)) {
  fail('Landing page must state Backup remains independent of Sync.');
}
if (!/v5/i.test(manifest.description || '')) {
  fail('Manifest description must identify V5.');
}
if (!/Optional Cloud Sync/.test(readme)) {
  fail('README must document Optional Cloud Sync.');
}

for (const resource of [
  './src/app/sync-ui.js',
  './src/app/cloud-sync-flow.js',
  './src/sync/sync-engine.js',
  './src/sync/sync-scheduler.js',
  './src/sync/account-lifecycle.js',
  './src/sync/conflict-resolution.js',
  './src/ui/sync-status.js',
  './src/ui/sync-center.js',
  './src/ui/first-sync.js',
  './src/ui/conflicts.js',
  './styles/v5-sync.css',
  './styles/v5-dialogs.css',
]) {
  if (!sw.includes(`'${resource}'`)) {
    fail(`Service Worker App Shell missing V5 resource: ${resource}`);
  }
}

console.log(
  `V5 release preflight: ${errors.length ? 'FAIL' : 'PASS'}` +
  ` (${cloudRuntime ? 'cloud runtime enabled' : 'cloud runtime dormant'})`,
);

for (const message of warnings) console.warn(`WARN: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);

if (errors.length) process.exit(1);

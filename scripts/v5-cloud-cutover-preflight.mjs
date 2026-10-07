import { APP_CONFIG } from '../src/app/config.js';

const errors = [];

const fail = message => errors.push(message);

if (!APP_CONFIG.features?.v5DataFoundation) {
  fail('V5 data foundation is disabled.');
}
if (!APP_CONFIG.features?.syncUi) {
  fail('Sync UI is disabled.');
}
if (!APP_CONFIG.features?.cloudSync) {
  fail('Cloud runtime is still disabled.');
}
if (!String(APP_CONFIG.cloud.googleClientId || '').trim()) {
  fail('Google OAuth Client ID is not configured.');
}
if (
  APP_CONFIG.cloud.googleDriveScope !==
  'https://www.googleapis.com/auth/drive.appdata'
) {
  fail('Google Drive scope must be drive.appdata.');
}
if (Number(APP_CONFIG.dbVersion) !== 4) {
  fail(`Production cutover requires DB v4; got v${APP_CONFIG.dbVersion}.`);
}
if (Number(APP_CONFIG.cloudSyncSchemaVersion) !== 1) {
  fail(
    `Production cutover expects Cloud Schema v1; got v${APP_CONFIG.cloudSyncSchemaVersion}.`,
  );
}
if (APP_CONFIG.cloud.minimumClientVersion !== '5.0.0') {
  fail(
    `minimumClientVersion must remain 5.0.0; got ${APP_CONFIG.cloud.minimumClientVersion}.`,
  );
}
if (APP_CONFIG.releaseChannel === 'development') {
  fail('Release channel is still development.');
}
if (/-dev\b/i.test(APP_CONFIG.appVersion)) {
  fail(`Development appVersion cannot cut over: ${APP_CONFIG.appVersion}`);
}

console.log(
  `V5 cloud cutover preflight: ${errors.length ? 'BLOCKED' : 'READY'}`,
);

for (const message of errors) console.error(`BLOCKER: ${message}`);

if (errors.length) {
  console.error(
    'Live Google/two-device validation and manual release checklist must also pass before main merge.',
  );
  process.exit(1);
}

console.log(
  'Configuration is eligible for manual cloud/two-device validation. This command does not authorize a production merge.',
);

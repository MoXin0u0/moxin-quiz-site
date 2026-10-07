import assert from 'node:assert/strict';
import fs from 'node:fs';

const lifecycle = fs.readFileSync('src/sync/account-lifecycle.js', 'utf8');
const engine = fs.readFileSync('src/sync/sync-engine.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(lifecycle, /inspectAccountSwitch/);
assert.match(lifecycle, /confirmAccountSwitch/);
assert.match(lifecycle, /unlinkCurrentCloudProfile/);
assert.match(lifecycle, /verifyLinkedCloudContext/);
assert.match(lifecycle, /ACCOUNT_SWITCH_REQUIRED/);
assert.match(lifecycle, /providerSubject/);
assert.match(lifecycle, /syncOutbox'\)\.clear|syncOutbox.*clear/s);
assert.match(lifecycle, /preservedLocalData:\s*true/);

assert.match(engine, /getCurrentDeviceSyncPermission/);
assert.match(engine, /account-switch-required/);
assert.match(lifecycle, /device-revoked/);
assert.match(engine, /permissionAfterPull/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b13b-1'/);
assert.match(sw, /src\/sync\/account-lifecycle\.js/);

console.log('V5 B13B account lifecycle contracts passed.');

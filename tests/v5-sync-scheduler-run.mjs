
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  SYNC_PENDING_EVENT,
  SyncScheduler,
  isAutomaticSyncEligible,
} from '../src/sync/sync-scheduler.js';

assert.equal(SYNC_PENDING_EVENT, 'moxin:v5-sync-pending');

assert.equal(
  isAutomaticSyncEligible({
    cloudRuntimeEnabled: true,
    cloudConfigured: true,
    connected: true,
    linkedProfileId: 'profile-a',
  }, { onLine: true }),
  true,
);

for (const snapshot of [
  {
    cloudRuntimeEnabled: false,
    cloudConfigured: true,
    connected: true,
    linkedProfileId: 'profile-a',
  },
  {
    cloudRuntimeEnabled: true,
    cloudConfigured: false,
    connected: true,
    linkedProfileId: 'profile-a',
  },
  {
    cloudRuntimeEnabled: true,
    cloudConfigured: true,
    connected: false,
    linkedProfileId: null,
  },
]) {
  assert.equal(isAutomaticSyncEligible(snapshot, { onLine: true }), false);
}

assert.equal(
  isAutomaticSyncEligible({
    cloudRuntimeEnabled: true,
    cloudConfigured: true,
    connected: true,
    linkedProfileId: 'profile-a',
  }, { onLine: false }),
  false,
);

assert.equal(typeof SyncScheduler, 'function');

const mutation = fs.readFileSync(
  'src/storage/transactions/sync-mutation.js',
  'utf8',
);
const syncUi = fs.readFileSync('src/app/sync-ui.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(mutation, /notifySyncPending/);
assert.match(mutation, /entityType:\s*mutation\?\.entityType/);
assert.match(syncUi, /startAutomaticSyncScheduler/);
assert.match(syncUi, /runAutomaticSync/);
assert.match(syncUi, /peekAccessToken/);
assert.doesNotMatch(
  syncUi.match(/async function runAutomaticSync[\s\S]*?\n}\n/)?.[0] || '',
  /\.authorize\(/,
);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b13d1-2'/);
assert.match(sw, /src\/sync\/sync-scheduler\.js/);

console.log('V5 B13C4 automatic sync scheduler contracts passed.');

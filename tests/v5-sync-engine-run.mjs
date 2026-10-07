import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  classifySyncFailure,
  computeRetryDelayMs,
  nextRetryInstant,
  SYNC_RETRY_CLASS,
} from '../src/sync/retry-policy.js';

const offline = classifySyncFailure({ code: 'NETWORK', retryable: true }, { online: false });
assert.equal(offline.classification, SYNC_RETRY_CLASS.RETRYABLE);
assert.equal(offline.runtimeState, 'OFFLINE');
assert.equal(offline.retryable, true);

const onlineNetwork = classifySyncFailure(
  { code: 'NETWORK', retryable: true },
  { online: true },
);
assert.equal(onlineNetwork.classification, SYNC_RETRY_CLASS.RETRYABLE);
assert.equal(onlineNetwork.runtimeState, 'ERROR');
assert.equal(onlineNetwork.retryable, true);

for (const code of ['RATE_LIMIT', 'SERVER_ERROR']) {
  const transient = classifySyncFailure({ code, retryable: true }, { online: true });
  assert.equal(transient.classification, SYNC_RETRY_CLASS.RETRYABLE);
  assert.equal(transient.runtimeState, 'ERROR');
  assert.equal(transient.retryable, true);
}

const auth = classifySyncFailure({ code: 'AUTH_REQUIRED' }, { online: true });
assert.equal(auth.classification, SYNC_RETRY_CLASS.BLOCKED);
assert.equal(auth.runtimeState, 'AUTH_REQUIRED');
assert.equal(auth.retryable, false);

const schema = classifySyncFailure({ code: 'CLOUD_SCHEMA_NEWER' }, { online: true });
assert.equal(schema.classification, SYNC_RETRY_CLASS.BLOCKED);
assert.equal(schema.retryable, false);

assert.equal(
  computeRetryDelayMs(1, { baseMs: 1000, maxMs: 10000, jitterRatio: 0, random: () => 0.5 }),
  1000,
);
assert.equal(
  computeRetryDelayMs(4, { baseMs: 1000, maxMs: 10000, jitterRatio: 0, random: () => 0.5 }),
  8000,
);
assert.equal(
  computeRetryDelayMs(9, { baseMs: 1000, maxMs: 10000, jitterRatio: 0, random: () => 0.5 }),
  10000,
);
assert.equal(
  nextRetryInstant(2, {
    now: new Date('2026-10-06T12:00:00.000Z'),
    baseMs: 1000,
    maxMs: 10000,
    jitterRatio: 0,
    random: () => 0.5,
  }),
  '2026-10-06T12:00:02.000Z',
);

const engineSource = fs.readFileSync('src/sync/sync-engine.js', 'utf8');
const seedSource = fs.readFileSync('src/sync/initial-seed.js', 'utf8');
const transportSource = fs.readFileSync('src/sync/commit-transport.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(engineSource, /inspectFirstSync/);
assert.match(engineSource, /confirmFirstSyncReconciliation/);
assert.match(engineSource, /cancelFirstSyncReconciliation/);
assert.match(engineSource, /ensureCloudProfile/);
assert.match(engineSource, /targetProfileId/);
assert.match(engineSource, /runSyncCycle/);
assert.match(engineSource, /Pull|stageRemoteCommits/);
assert.match(engineSource, /publishPreparedCloudCommit/);
assert.match(engineSource, /reconciliation-required/);
assert.match(engineSource, /syncRetry/);
assert.match(engineSource, /nextRetryInstant/);
assert.match(engineSource, /retry-backoff/);

assert.match(seedSource, /seedInitialSyncOutbox/);
assert.match(seedSource, /entityType:\s*'attempt'/);
assert.match(seedSource, /sourceType === 'author'/);
assert.match(seedSource, /syncTombstones/);

assert.match(transportSource, /nextRetryInstant/);
assert.match(transportSource, /OUTBOX_STATUS\.BLOCKED/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b13c3-1'/);
assert.match(sw, /src\/sync\/sync-engine\.js/);
assert.match(sw, /src\/sync\/initial-seed\.js/);
assert.match(sw, /src\/sync\/retry-policy\.js/);

console.log('V5 B12 sync-engine core contracts passed.');

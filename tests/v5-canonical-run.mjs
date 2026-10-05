import assert from 'node:assert/strict';
import { APP_CONFIG } from '../src/app/config.js';
import { STORE_DEFINITIONS } from '../src/storage/db.js';
import { canonicalJson } from '../src/sync/canonical.js';
import { sha256Canonical, sha256Text } from '../src/sync/hash.js';
import {
  compareHybridClocks,
  nextHybridClock,
  normalizeHybridClock,
} from '../src/sync/clock.js';
import {
  createRevisionMeta,
  isDirectRevisionParent,
  normalizeParentRevisionIds,
} from '../src/sync/revision.js';
import {
  MUTATION_POLICY,
  getMutationPolicy,
} from '../src/sync/mutation-policy.js';
import { SYNC_RUNTIME_STATE, getSyncLimits } from '../src/sync/config.js';
import {
  createCommitId,
  createDeviceId,
  createMutationId,
  createRevisionId,
} from '../src/utils/ids.js';

assert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');
assert.equal(APP_CONFIG.dbVersion, 4);
assert.equal(APP_CONFIG.cloudSyncSchemaVersion, 1);
assert.equal(Object.keys(STORE_DEFINITIONS).length, 23);
assert.ok(STORE_DEFINITIONS.syncRevisions);
assert.ok(STORE_DEFINITIONS.syncOutbox);
assert.ok(STORE_DEFINITIONS.cloudObjects);

const eventIndex = STORE_DEFINITIONS.attempts.indexes.find(([name]) => name === 'eventId');
assert.deepEqual(eventIndex, ['eventId', 'eventId', { unique: true }]);

assert.equal(
  canonicalJson({ z: 3, a: 1, nested: { y: 2, x: 1 } }),
  '{"a":1,"nested":{"x":1,"y":2},"z":3}',
);
assert.equal(canonicalJson([undefined, -0, Number.NaN]), '[null,0,null]');
assert.equal(
  canonicalJson({ payloadHash: 'self', value: 1 }, { omitKeys: ['payloadHash'] }),
  '{"value":1}',
);
assert.throws(() => {
  const cyclic = {};
  cyclic.self = cyclic;
  canonicalJson(cyclic);
}, /cyclic/i);

assert.equal(
  await sha256Text('abc'),
  'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
);
assert.equal(
  await sha256Canonical({ b: 2, a: 1 }),
  await sha256Canonical({ a: 1, b: 2 }),
);
assert.equal(
  await sha256Canonical(
    { value: 1, payloadHash: 'old', driveFileId: 'provider-a' },
    { omitKeys: ['payloadHash', 'driveFileId'] },
  ),
  await sha256Canonical({ value: 1 }),
);

assert.deepEqual(normalizeHybridClock(null, 'device-a'), {
  physicalMs: 0,
  logical: 0,
  deviceId: 'device-a',
});
assert.deepEqual(
  nextHybridClock({
    local: { physicalMs: 100, logical: 2, deviceId: 'device-a' },
    deviceId: 'device-a',
    nowMs: 100,
  }),
  { physicalMs: 100, logical: 3, deviceId: 'device-a' },
);
assert.deepEqual(
  nextHybridClock({
    local: { physicalMs: 100, logical: 2, deviceId: 'device-a' },
    remote: { physicalMs: 120, logical: 4, deviceId: 'device-b' },
    deviceId: 'device-a',
    nowMs: 110,
  }),
  { physicalMs: 120, logical: 5, deviceId: 'device-a' },
);
assert.equal(
  compareHybridClocks(
    { physicalMs: 100, logical: 1, deviceId: 'a' },
    { physicalMs: 100, logical: 1, deviceId: 'b' },
  ),
  -1,
);

assert.deepEqual(normalizeParentRevisionIds(['b', 'a', 'b', null]), ['a', 'b']);
const revision = createRevisionMeta({
  revisionId: 'rev-c',
  parentRevisionIds: ['rev-b', 'rev-a', 'rev-b'],
  changedAt: '2026-10-05T00:00:00.000Z',
  changedByDeviceId: 'device-a',
  clock: { physicalMs: 100, logical: 2, deviceId: 'device-a' },
});
assert.deepEqual(revision.parentRevisionIds, ['rev-a', 'rev-b']);
assert.equal(isDirectRevisionParent('rev-a', revision), true);
assert.equal(isDirectRevisionParent('rev-z', revision), false);

assert.equal(getMutationPolicy('attempt'), MUTATION_POLICY.IMMUTABLE);
assert.equal(getMutationPolicy('favorite'), MUTATION_POLICY.COALESCIBLE);
assert.equal(getMutationPolicy('note'), MUTATION_POLICY.CONFLICT_SENSITIVE);
assert.throws(() => getMutationPolicy('unknown'), /Unsupported sync entity type/);

assert.equal(SYNC_RUNTIME_STATE.LOCAL_ONLY, 'LOCAL_ONLY');
assert.equal(getSyncLimits().maxCommitMutations, 250);
assert.equal(getSyncLimits().maxCommitJsonBytes, 1024 * 1024);

for (const [value, prefix] of [
  [createDeviceId(), 'device-'],
  [createRevisionId(), 'rev-'],
  [createMutationId(), 'mutation-'],
  [createCommitId(), 'commit-'],
]) {
  assert.ok(value.startsWith(prefix), `Expected ${value} to start with ${prefix}`);
}

console.log('V5 canonical/data-foundation tests passed.');

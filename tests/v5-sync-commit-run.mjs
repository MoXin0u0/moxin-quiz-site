import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CLOUD_OBJECT_TYPE,
  SyncProtocolError,
  cloudAppProperties,
  cloudCommitByteLength,
  cloudCommitFileName,
  createCloudCommit,
  validateCloudCommit,
} from '../src/sync/cloud-contract.js';
import { buildOutboxMutation } from '../src/sync/outbox-service.js';

const commit = await createCloudCommit({
  profileId: 'profile-a',
  deviceId: 'device-a',
  deviceSequence: 7,
  commitId: 'commit-fixed',
  createdAt: '2026-10-06T08:00:00.000Z',
  appVersion: '5.0.0-dev',
  mutations: [{
    mutationId: 'mutation-1',
    type: 'note',
    key: 'bank::Q1',
    op: 'upsert',
    policy: 'conflict-sensitive',
    revision: { revisionId: 'rev-1' },
    value: { text: 'hello', revision: { revisionId: 'rev-1' } },
  }],
});

assert.equal(commit.deviceSequence, 7);
assert.match(commit.payloadHash, /^sha256:[a-f0-9]{64}$/);
assert.equal(
  (await validateCloudCommit(commit, { expectedProfileId: 'profile-a' })).payloadHash,
  commit.payloadHash,
);
assert.ok(cloudCommitByteLength(commit) > 0);
assert.equal(
  cloudCommitFileName(commit),
  'commit-device-a-000000000007-commit-fixed.json',
);
assert.deepEqual(
  cloudAppProperties({
    profileId: 'profile-a',
    objectType: CLOUD_OBJECT_TYPE.COMMIT,
    objectId: 'commit-fixed',
    hash: commit.payloadHash,
  }),
  {
    moxinApp: 'moxin-quiz',
    cloudSchema: '1',
    profileId: 'profile-a',
    objectType: 'commit',
    objectId: 'commit-fixed',
    hash: commit.payloadHash,
  },
);

const tampered = structuredClone(commit);
tampered.mutations[0].value.text = 'changed';
await assert.rejects(
  () => validateCloudCommit(tampered, { expectedProfileId: 'profile-a' }),
  error => error instanceof SyncProtocolError && error.code === 'COMMIT_HASH_MISMATCH',
);

const newer = structuredClone(commit);
newer.cloudSchema = 999;
await assert.rejects(
  () => validateCloudCommit(newer),
  error => error instanceof SyncProtocolError && error.code === 'CLOUD_SCHEMA_NEWER',
);

const mutation = buildOutboxMutation({
  entityType: 'note',
  entityKey: 'bank::Q1',
  operation: 'upsert',
  targetRevisionId: 'rev-1',
  deviceId: 'device-a',
  payload: { text: 'snapshot' },
});
assert.equal(mutation.hasPayload, true);
assert.equal(mutation.payload.text, 'snapshot');

const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b09-1'/);
assert.match(sw, /src\/sync\/cloud-contract\.js/);
assert.match(sw, /src\/sync\/commit-transport\.js/);
assert.match(sw, /src\/sync\/sync-lock\.js/);

console.log('V5 B09 immutable cloud commit contracts passed.');

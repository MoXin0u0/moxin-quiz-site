import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  compareClientVersions,
  createCloudProfileDocument,
  validateCloudProfile,
} from '../src/sync/cloud-profile.js';
import {
  CLOUD_CHECKPOINT_FORMAT,
  CLOUD_CHECKPOINT_VERSION,
  validateCloudCheckpoint,
} from '../src/sync/checkpoint.js';
import { sha256Canonical } from '../src/sync/hash.js';

assert.equal(compareClientVersions('5.0.0-dev', '5.0.0'), 0);
assert.equal(compareClientVersions('5.1.0', '5.0.9'), 1);
assert.equal(compareClientVersions('4.9.9', '5.0.0'), -1);

const profile = await createCloudProfileDocument({
  profileId: 'profile-test',
  createdAt: '2026-10-07T01:00:00.000Z',
  minimumClientVersion: '5.0.0',
});
const validatedProfile = await validateCloudProfile(profile, {
  clientVersion: '5.0.0-dev',
});
assert.equal(validatedProfile.profileId, 'profile-test');
assert.equal(validatedProfile.latestCheckpoint, null);

await assert.rejects(
  () => validateCloudProfile({ ...profile, profileId: 'tampered' }),
  error => error?.code === 'CLOUD_PROFILE_HASH_MISMATCH',
);

const checkpointBase = {
  format: CLOUD_CHECKPOINT_FORMAT,
  version: CLOUD_CHECKPOINT_VERSION,
  cloudSchema: 1,
  checkpointId: 'checkpoint-test',
  profileId: 'profile-test',
  createdAt: '2026-10-07T01:05:00.000Z',
  createdByDeviceId: 'device-test',
  receiptCount: 100,
  commitFrontier: { 'device-a': 10, 'device-b': 20 },
  entityHeadIndex: [{
    entityType: 'favorite',
    entityKey: 'bank::Q1',
    revisionId: 'rev-favorite',
    changedAt: '2026-10-07T01:04:00.000Z',
  }],
  tombstoneHeadIndex: [],
  deviceIndex: [{
    deviceId: 'device-test',
    revisionId: 'rev-device',
    status: 'active',
    label: '此裝置',
    lastSeenAt: null,
    lastSyncAt: null,
    appVersion: '5.0.0-dev',
  }],
};
const checkpoint = {
  ...checkpointBase,
  payloadHash: await sha256Canonical(checkpointBase),
};
const validatedCheckpoint = await validateCloudCheckpoint(checkpoint, {
  expectedProfileId: 'profile-test',
});
assert.equal(validatedCheckpoint.receiptCount, 100);
assert.equal(validatedCheckpoint.commitFrontier['device-b'], 20);

await assert.rejects(
  () => validateCloudCheckpoint({ ...checkpoint, receiptCount: 101 }),
  error => error?.code === 'CHECKPOINT_HASH_MISMATCH',
);

const source = fs.readFileSync('src/sync/sync-engine.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.match(source, /publishCheckpointIfDue/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b13c51-1'/);
assert.match(sw, /src\/sync\/cloud-profile\.js/);
assert.match(sw, /src\/sync\/checkpoint\.js/);

console.log('V5 B13A cloud profile/checkpoint contracts passed.');

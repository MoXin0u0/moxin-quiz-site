import assert from 'node:assert/strict';
import fs from 'node:fs';

const studioSource = fs.readFileSync('src/storage/repositories/studio.js', 'utf8');
const bankSource = fs.readFileSync('src/storage/repositories/banks.js', 'utf8');
const transportSource = fs.readFileSync('src/sync/object-mutation-transport.js', 'utf8');
const remoteApplySource = fs.readFileSync('src/sync/remote-apply.js', 'utf8');
const commitTransportSource = fs.readFileSync('src/sync/commit-transport.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(studioSource, /entityType:\s*'studio-draft'/);
assert.match(studioSource, /computeDraftFingerprint/);
assert.match(studioSource, /syncTombstones/);
assert.match(studioSource, /attachMutationPayloadInTransaction/);

assert.match(bankSource, /entityType:\s*'user-bank'/);
assert.match(bankSource, /computeBankFingerprint/);
assert.match(bankSource, /deleteUserBankFromSyncedLibrary/);
assert.match(
  bankSource,
  /Local content removal only/,
  'local-only bank removal must remain distinct from synced delete',
);

assert.match(transportSource, /materializePendingObjectMutations/);
assert.match(transportSource, /ensureCloudAsset/);
assert.match(transportSource, /ensureJsonDocumentObject/);
assert.match(transportSource, /resolveCommitObjectValues/);
assert.match(transportSource, /REMOTE_OBJECT_REVISION_MISMATCH/);

assert.match(remoteApplySource, /resolveCommitObjectValues/);
assert.match(remoteApplySource, /applyRemoteUserBank/);
assert.match(commitTransportSource, /materializePendingObjectMutations/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b11b-1'/);
assert.match(sw, /src\/sync\/object-mutation-transport\.js/);

console.log('V5 B11B sync-aware object repository contracts passed.');

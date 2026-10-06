import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  attachUploadedAssetRefs,
  buildStudioDraftDocument,
  buildUserBankDocument,
} from '../src/sync/cloud-object-transport.js';
import {
  createCloudCommit,
  validateCloudCommit,
} from '../src/sync/cloud-contract.js';

const draft = {
  id: 'draft-1',
  bankId: 'bank-1',
  manifest: { id: 'bank-1', name: 'Draft Bank' },
  questions: [{ id: 'Q1', questionUid: 'uid-1', type: 'true-false', question: 'Q?', answer: [true] }],
  assets: [{
    path: 'assets/a.png',
    contentHash: 'sha256:abc',
    mimeType: 'image/png',
    size: 3,
    blob: new Blob(['abc']),
  }],
  contentFingerprint: 'sha256:draft',
  revision: { revisionId: 'rev-draft' },
};
const draftDoc = buildStudioDraftDocument(draft);
assert.equal(draftDoc.assets[0].contentHash, 'sha256:abc');
assert.equal('blob' in draftDoc.assets[0], false);

const bankDoc = buildUserBankDocument({
  bank: {
    id: 'bank-1',
    name: 'Bank',
    version: '1.0.0',
    sourceType: 'user',
    storedAt: '2026-10-06T00:00:00.000Z',
    contentFingerprint: 'sha256:bank',
    revision: { revisionId: 'rev-bank' },
  },
  questions: [{
    key: 'bank-1::Q1',
    bankId: 'bank-1',
    questionId: 'Q1',
    id: 'Q1',
    type: 'true-false',
    question: 'Q?',
    answer: [true],
  }],
  assets: [{
    path: 'assets/a.png',
    contentHash: 'sha256:abc',
    mimeType: 'image/png',
    size: 3,
  }],
});
assert.equal(bankDoc.manifest.sourceType, undefined);
assert.equal(bankDoc.questions[0].key, undefined);

const ref = {
  objectType: 'asset',
  objectId: 'sha256:abc',
  contentHash: 'sha256:abc',
  size: 3,
  mimeType: 'image/png',
  driveFileId: 'file-asset',
};
const withRefs = attachUploadedAssetRefs(draftDoc, new Map([['sha256:abc', ref]]));
assert.equal(withRefs.assets[0].objectRef.driveFileId, 'file-asset');

const commit = await createCloudCommit({
  profileId: 'profile-a',
  deviceId: 'device-a',
  deviceSequence: 1,
  commitId: 'commit-object-ref',
  mutations: [{
    mutationId: 'mutation-object',
    type: 'studio-draft',
    key: 'draft-1',
    op: 'upsert',
    policy: 'conflict-sensitive',
    revision: { revisionId: 'rev-draft' },
    value: null,
    objectRef: {
      objectType: 'draft',
      objectId: 'draft-1:rev-draft',
      contentHash: 'sha256:1234',
      size: 10,
      mimeType: 'application/json',
      driveFileId: 'file-draft',
    },
  }],
});
const validated = await validateCloudCommit(commit);
assert.equal(validated.mutations[0].objectRef.driveFileId, 'file-draft');

const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b[0-9A-Za-z.-]+-\\d+'/);
assert.match(sw, /src\/sync\/cloud-object-transport\.js/);

console.log('V5 B11A cloud object document contracts passed.');

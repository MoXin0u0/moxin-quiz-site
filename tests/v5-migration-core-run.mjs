import assert from 'node:assert/strict';
import { canonicalJson } from '../src/sync/canonical.js';
import {
  dateKeyFromLegacy,
  legacyRevisionMeta,
  V5_MIGRATION_PHASES,
} from '../src/storage/migrations/v5-migration.js';
import {
  canonicalQuestionPayload,
  computeBankFingerprint,
  computeDraftFingerprint,
} from '../src/content/fingerprints.js';

assert.deepEqual(V5_MIGRATION_PHASES, [
  'device-identity',
  'attempt-events',
  'boolean-states',
  'notes-goals',
  'sessions',
  'banks',
  'drafts',
  'asset-hashes',
  'derived-rebuild',
  'completed',
]);

assert.equal(dateKeyFromLegacy('2026-11-20T00:00:00.000Z'), '2026-11-20');
assert.equal(dateKeyFromLegacy('invalid'), null);

const revisionA = await legacyRevisionMeta({
  entityType: 'note',
  entityKey: 'bank::Q001',
  payload: { text: 'same' },
  changedAt: '2026-10-05T00:00:00.000Z',
});
const revisionB = await legacyRevisionMeta({
  entityType: 'note',
  entityKey: 'bank::Q001',
  payload: { text: 'same' },
  changedAt: '2026-10-05T00:00:00.000Z',
});
assert.equal(revisionA.revisionId, revisionB.revisionId);
assert.equal(revisionA.changedByDeviceId, 'legacy-migration');

const questionA = {
  id: 'Q001',
  type: 'multiple-choice',
  question: 'Question',
  options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
  answer: ['B', 'A'],
  tags: ['z', 'a', 'a'],
  images: [],
  explanationImages: [],
};
const questionB = {
  ...questionA,
  key: 'bank::Q001',
  bankId: 'bank',
  questionId: 'Q001',
  answer: ['A', 'B'],
  tags: ['a', 'z'],
};
assert.equal(
  canonicalJson(canonicalQuestionPayload(questionA)),
  canonicalJson(canonicalQuestionPayload(questionB)),
);

const bankBase = {
  id: 'bank',
  schemaVersion: '2.0',
  name: 'Bank',
  version: '1.0.0',
  sourceType: 'user',
  storedAt: '2026-10-05T00:00:00.000Z',
};
const fpA = await computeBankFingerprint({
  bank: { ...bankBase, updatedAt: '2026-10-01T00:00:00.000Z' },
  questions: [questionA],
  assets: [],
});
const fpB = await computeBankFingerprint({
  bank: { ...bankBase, updatedAt: '2026-10-05T00:00:00.000Z' },
  questions: [questionB],
  assets: [],
});
assert.equal(fpA, fpB, 'storage/update timestamps must not change semantic bank fingerprint');

const draftA = await computeDraftFingerprint({
  id: 'draft-a',
  bankId: 'bank',
  manifest: { id: 'bank', name: 'Bank' },
  questions: [
    { ...questionA, questionUid: 'uid-1' },
    { ...questionA, questionUid: 'uid-2' },
  ],
  assets: [],
});
const draftB = await computeDraftFingerprint({
  id: 'draft-a',
  bankId: 'bank',
  manifest: { id: 'bank', name: 'Bank' },
  questions: [
    { ...questionA, questionUid: 'uid-2' },
    { ...questionA, questionUid: 'uid-1' },
  ],
  assets: [],
});
assert.notEqual(draftA, draftB, 'draft fingerprint must preserve working order / questionUid identity');

console.log('V5 migration core contracts passed.');

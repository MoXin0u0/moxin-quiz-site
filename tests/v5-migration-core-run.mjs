import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalJson } from '../src/sync/canonical.js';
import {
  dateKeyFromLegacy,
  legacyRevisionMeta,
  V5_MIGRATION_PHASES,
  V5_MIGRATION_LOCK_NAME,
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
assert.equal(V5_MIGRATION_LOCK_NAME, 'moxin-quiz-v5-migration');

const migrationSource = fs.readFileSync('src/storage/migrations/v5-migration.js', 'utf8');
assert.match(
  migrationSource,
  /derivedRebuiltAt:\s*rebuiltAt/,
  'completed migration state must record a derived rebuild marker',
);
assert.match(
  migrationSource,
  /if \(!migration\.derivedRebuiltAt\)/,
  'completed states without a rebuild marker must self-heal',
);
assert.match(
  migrationSource,
  /navigator\?\.locks|navigator\.locks|globalThis\.navigator\?\.locks/,
  'migration completion must use a browser-wide lock when available',
);
assert.match(
  migrationSource,
  /migrationRunPromise/,
  'migration completion must coalesce concurrent calls in one realm',
);

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

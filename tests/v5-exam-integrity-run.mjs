import assert from 'node:assert/strict';

import {
  countAnswered,
  createExamLease,
  createExamSession,
  getExamAnswer,
  getRemainingSeconds,
  gradeExam,
  isExamLeaseActive,
  normalizeResumedExam,
  setExamAnswer,
} from '../src/quiz/exam-engine.js';

const now = new Date('2026-10-05T12:00:00.000Z');
const questions = [
  {
    id: 'Q1',
    questionFingerprint: 'sha256:q1',
    type: 'single-choice',
    question: 'Frozen?',
    options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
    answer: ['A'],
    explanation: 'Original',
    images: ['assets/images/q1.png'],
    explanationImages: [],
    chapter: 'C1',
    tags: ['x'],
    difficulty: 2,
  },
  {
    id: 'Q2',
    questionFingerprint: 'sha256:q2',
    type: 'true-false',
    question: 'Second?',
    answer: [true],
    explanation: '',
    images: [],
    explanationImages: [],
    chapter: 'C2',
    tags: [],
    difficulty: 1,
  },
];

const session = createExamSession({
  bankId: 'bank',
  bankName: 'Bank',
  bankVersion: '1.2.3',
  bankFingerprint: 'sha256:bank',
  questions,
  questionCount: 2,
  durationMinutes: 30,
  assetHashes: new Map([['assets/images/q1.png', 'sha256:image']]),
  random: () => 0.999,
  now,
});

assert.equal(session.status, 'active');
assert.equal(session.submissionReason, null);
assert.equal(session.bankFingerprint, 'sha256:bank');
assert.equal(session.questionSnapshot.length, 2);
assert.equal(session.questionSnapshot[0].images[0].contentHash, 'sha256:image');
assert.equal(getRemainingSeconds(session, now), 1800);

// Mutating the live bank question cannot change the frozen exam.
questions[0].answer = ['B'];
questions[0].question = 'Changed';
const frozenMap = new Map(session.questionSnapshot.map(q => [q.questionId, q]));
setExamAnswer(session, 'Q1', 'A');
const result = gradeExam(session, frozenMap);
assert.equal(result.correctCount, 1);
assert.equal(frozenMap.get('Q1').question, 'Frozen?');
assert.equal(countAnswered(session), 1);
assert.equal(getExamAnswer(session, 'Q1'), 'A');

const resumed = normalizeResumedExam({
  ...session,
  currentIndex: 99,
}, questions, now);
assert.equal(resumed.currentIndex, 1);
assert.equal(resumed.status, 'active');
assert.equal(resumed.expired, false);
assert.equal(resumed.questionSnapshot[0].question, 'Frozen?');

const expired = normalizeResumedExam({
  ...session,
  deadlineAt: '2026-10-05T11:59:00.000Z',
}, questions, now);
assert.equal(expired.expired, true);
assert.equal(expired.status, 'active');

const lease = createExamLease('device-a', { now, ttlMs: 60000 });
assert.equal(lease.holderDeviceId, 'device-a');
assert.equal(isExamLeaseActive(lease, now), true);
assert.equal(
  isExamLeaseActive(lease, new Date('2026-10-05T12:02:00.000Z')),
  false,
);

console.log('V5 exam integrity core contracts passed.');

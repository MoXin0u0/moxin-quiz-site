import assert from 'node:assert/strict';
import fs from 'node:fs';

import { APP_CONFIG } from '../src/app/config.js';
import { calculateNextReviewFromOutcome } from '../src/quiz/review-engine.js';
import { reduceReviewSchedule } from '../src/learning/derived-state.js';
import { normalizeResumedExam } from '../src/quiz/exam-engine.js';
import { resolveSessionStatus } from '../src/storage/repositories/sessions.js';

assert.equal(APP_CONFIG.appVersion, '5.0.0-dev');
assert.equal(APP_CONFIG.releaseChannel, 'development');

const previousReview = {
  level: 4,
  mastery: 'familiar',
  intervalDays: 14,
  dueAt: '2026-10-20T00:00:00.000Z',
  correctStreak: 3,
  wrongCount: 2,
  unansweredCount: 1,
  reviewCount: 8,
  lastReviewedAt: '2026-10-01T00:00:00.000Z',
};
const unanswered = calculateNextReviewFromOutcome(
  previousReview,
  'unanswered',
  new Date('2026-10-05T00:00:00.000Z'),
);
assert.equal(unanswered.level, 4);
assert.equal(unanswered.mastery, 'familiar');
assert.equal(unanswered.correctStreak, 3);
assert.equal(unanswered.wrongCount, 2);
assert.equal(unanswered.unansweredCount, 2);
assert.equal(unanswered.reviewCount, 8);
assert.equal(unanswered.dueAt, previousReview.dueAt);

const replay = reduceReviewSchedule([
  {
    eventId: 'a',
    bankId: 'bank',
    questionId: 'Q1',
    answeredAt: '2026-10-01T00:00:00.000Z',
    outcome: 'correct',
  },
  {
    eventId: 'b',
    bankId: 'bank',
    questionId: 'Q1',
    answeredAt: '2026-10-02T00:00:00.000Z',
    outcome: 'correct',
  },
  {
    eventId: 'c',
    bankId: 'bank',
    questionId: 'Q1',
    answeredAt: '2026-10-03T00:00:00.000Z',
    outcome: 'unanswered',
  },
], {
  rebuiltAt: '2026-10-05T00:00:00.000Z',
});
assert.equal(replay.level, 2, 'unanswered must not demote mastery');
assert.equal(replay.correctStreak, 2, 'unanswered must not reset correct streak');
assert.equal(replay.unansweredCount, 1);

assert.equal(resolveSessionStatus({ status: 'active', finishedAt: '2026-10-05T00:00:00.000Z' }), 'finished');
assert.equal(resolveSessionStatus({ status: 'active', abandonedAt: '2026-10-05T00:00:00.000Z' }), 'abandoned');
assert.equal(resolveSessionStatus({ status: 'finished', submittedAt: '2026-10-05T00:00:00.000Z' }), 'submitted');

const brokenExam = normalizeResumedExam({
  id: 'exam-a',
  questionIds: ['Q1', 'Q2'],
  questionSnapshot: [{
    id: 'Q1',
    questionId: 'Q1',
    type: 'single-choice',
    question: 'Q1',
    answer: ['A'],
    options: [{ id: 'A', text: 'A' }],
  }],
  answers: {},
  status: 'active',
  deadlineAt: '2026-10-06T00:00:00.000Z',
}, [], new Date('2026-10-05T00:00:00.000Z'));
assert.equal(brokenExam.questionIds.length, 2, 'resume must not silently shrink the exam');
assert.deepEqual(brokenExam.integrityError?.missingQuestionIds, ['Q2']);

const mainSource = fs.readFileSync('src/app/main.js', 'utf8');
assert.match(mainSource, /runV5MigrationToCompletion\(\)/);
assert.match(mainSource, /persistPracticeSession\(\{ syncLifecycle: true \}\)/);
const confirmIndex = mainSource.indexOf('const confirmed = confirm(');
const abandonIndex = mainSource.indexOf("status: 'abandoned'", confirmIndex);
assert.ok(confirmIndex >= 0 && abandonIndex > confirmIndex, 'exam abandon mutation must occur only after the final confirmation');

const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b075-1'/);

console.log('V5 B07.5 consistency repair unit contracts passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ATTEMPT_ACTIVITY,
  ATTEMPT_OUTCOME,
  attemptActivityType,
  attemptInstant,
  attemptOutcome,
  sortAttemptEvents,
} from '../src/learning/attempt-events.js';
import {
  buildDerivedLearningRecords,
  reduceQuestionProgress,
  reduceReviewSchedule,
} from '../src/learning/derived-state.js';
import {
  buildDailyLearningActivity,
  calculateLearningStreak,
} from '../src/learning/goal-progress.js';
import { buildLearningAnalytics } from '../src/learning/analytics.js';
import { buildExamSprintPlan } from '../src/learning/exam-sprint.js';
import {
  normalizeStudyTimeZone,
  resolveStudyTimeZone,
} from '../src/learning/study-time-zone.js';

const TZ = 'Asia/Taipei';

assert.equal(
  attemptInstant({ answeredAt: '2026-10-02T16:30:00.000Z', timestamp: '2020-01-01T00:00:00.000Z' }),
  '2026-10-02T16:30:00.000Z',
);
assert.equal(attemptOutcome({ outcome: 'unanswered', correct: false }), ATTEMPT_OUTCOME.UNANSWERED);
assert.equal(attemptOutcome({ correct: true }), ATTEMPT_OUTCOME.CORRECT);
assert.equal(
  attemptActivityType({ activityType: 'review', mode: 'filtered' }),
  ATTEMPT_ACTIVITY.REVIEW,
);

const events = [
  {
    eventId: 'event-b',
    bankId: 'bank-a',
    questionId: 'Q001',
    answeredAt: '2026-10-02T02:00:00.000Z',
    outcome: 'wrong',
    activityType: 'practice',
    context: {
      questionType: 'multiple-choice',
      chapter: '當時章節',
    },
  },
  {
    eventId: 'event-a',
    bankId: 'bank-a',
    questionId: 'Q001',
    answeredAt: '2026-10-02T01:00:00.000Z',
    outcome: 'correct',
    activityType: 'practice',
    context: {
      questionType: 'multiple-choice',
      chapter: '當時章節',
    },
  },
  {
    eventId: 'event-c',
    bankId: 'bank-a',
    questionId: 'Q001',
    answeredAt: '2026-10-02T03:00:00.000Z',
    outcome: 'unanswered',
    activityType: 'exam',
    context: {
      questionType: 'multiple-choice',
      chapter: '當時章節',
    },
  },
];

assert.deepEqual(sortAttemptEvents(events).map(item => item.eventId), [
  'event-a',
  'event-b',
  'event-c',
]);

const progressA = reduceQuestionProgress(events, {
  bankId: 'bank-a',
  questionId: 'Q001',
  rebuiltAt: '2026-10-05T00:00:00.000Z',
});
const progressB = reduceQuestionProgress([...events].reverse(), {
  bankId: 'bank-a',
  questionId: 'Q001',
  rebuiltAt: '2026-10-05T00:00:00.000Z',
});
assert.deepEqual(progressA, progressB);
assert.equal(progressA.attempts, 3);
assert.equal(progressA.correctCount, 1);
assert.equal(progressA.wrongCount, 1);
assert.equal(progressA.unansweredCount, 1);
assert.equal(progressA.lastOutcome, 'unanswered');

const reviewA = reduceReviewSchedule(events, {
  bankId: 'bank-a',
  questionId: 'Q001',
  rebuiltAt: '2026-10-05T00:00:00.000Z',
});
const reviewB = reduceReviewSchedule([...events].reverse(), {
  bankId: 'bank-a',
  questionId: 'Q001',
  rebuiltAt: '2026-10-05T00:00:00.000Z',
});
assert.deepEqual(reviewA, reviewB);
assert.equal(reviewA.wrongCount, 1);
assert.equal(reviewA.unansweredCount, 1);
assert.equal(reviewA.lastOutcome, 'unanswered');

const rebuilt = buildDerivedLearningRecords(events, {
  rebuiltAt: '2026-10-05T00:00:00.000Z',
});
assert.equal(rebuilt.progress.length, 1);
assert.equal(rebuilt.review.length, 1);

const daily = buildDailyLearningActivity([
  {
    eventId: 'event-new',
    bankId: 'bank-a',
    questionId: 'Q009',
    answeredAt: '2026-10-02T16:30:00.000Z',
    timestamp: '2026-10-01T00:00:00.000Z',
    activityType: 'review',
    mode: 'filtered',
    outcome: 'correct',
  },
], {
  now: new Date('2026-10-02T17:00:00.000Z'),
  days: 1,
  timeZone: TZ,
})[0];
assert.equal(daily.dateKey, '2026-10-03');
assert.equal(daily.review, 1);
assert.equal(daily.practice, 0);

assert.equal(calculateLearningStreak([
  { bankId: 'bank-a', questionId: 'Q1', answeredAt: '2026-10-01T03:00:00.000Z', activityType: 'practice' },
  { bankId: 'bank-a', questionId: 'Q2', answeredAt: '2026-10-02T03:00:00.000Z', activityType: 'practice' },
], {
  now: new Date('2026-10-02T12:00:00.000Z'),
  timeZone: TZ,
}), 2);

const analytics = buildLearningAnalytics({
  questions: [{
    bankId: 'bank-a',
    questionId: 'Q001',
    id: 'Q001',
    type: 'single-choice',
    chapter: '目前章節',
  }],
  attempts: events,
}, {
  bankId: 'bank-a',
  now: new Date('2026-10-02T12:00:00.000Z'),
  timeZone: TZ,
});
assert.equal(analytics.overall.attempts, 3);
assert.equal(analytics.overall.correct, 1);
assert.equal(analytics.overall.wrong, 1);
assert.equal(analytics.overall.unanswered, 1);
assert.equal(analytics.overall.accuracy, 33);
assert.equal(analytics.typeAccuracy[0].key, 'multiple-choice');
assert.equal(analytics.chapterAccuracy[0].key, '當時章節');
assert.equal(analytics.dataQuality.attemptsWithoutQuestionMetadata, 0);

const removedWithSnapshot = buildLearningAnalytics({
  questions: [],
  attempts: [{
    eventId: 'historical',
    bankId: 'removed-bank',
    questionId: 'Q1',
    answeredAt: '2026-10-02T03:00:00.000Z',
    outcome: 'wrong',
    context: {
      questionType: 'true-false',
      chapter: '歷史章節',
    },
  }],
}, { now: new Date('2026-10-02T12:00:00.000Z'), timeZone: TZ });
assert.equal(removedWithSnapshot.chapterAccuracy[0].key, '歷史章節');
assert.equal(removedWithSnapshot.dataQuality.attemptsWithoutQuestionMetadata, 0);

const sprint = buildExamSprintPlan({
  id: 'exam-sprint',
  sprintEnabled: true,
  sprintBankIds: ['bank-a'],
  examDateKey: '2026-10-10',
  examDate: '2030-01-01T00:00:00.000Z',
  sprintDailyTarget: 1,
}, {
  questions: [{ bankId: 'bank-a', questionId: 'Q1', question: 'Q1' }],
}, {
  now: new Date('2026-10-03T10:00:00.000Z'),
  timeZone: TZ,
});
assert.equal(sprint.examDateKey, '2026-10-10');
assert.equal(sprint.daysUntilExam, 7);

assert.equal(normalizeStudyTimeZone('Asia/Taipei'), 'Asia/Taipei');
assert.equal(normalizeStudyTimeZone('Not/AZone'), null);
assert.equal(resolveStudyTimeZone({
  accountSettings: { studyTimeZone: 'Asia/Tokyo' },
  runtimeTimeZone: 'Asia/Taipei',
}), 'Asia/Tokyo');
assert.equal(resolveStudyTimeZone({
  accountSettings: null,
  runtimeTimeZone: 'Asia/Taipei',
}), 'Asia/Taipei');

const mainSource = fs.readFileSync('src/app/main.js', 'utf8');
assert.match(mainSource, /getStudyTimeZone/);
assert.match(mainSource, /globalAnalytics\.overall\.attempts/);
assert.match(mainSource, /timeZone: state\.statsModel\.timeZone/);

const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.match(sw, /\.\/src\/learning\/attempt-events\.js/);
assert.match(sw, /\.\/src\/learning\/derived-state\.js/);
assert.match(sw, /\.\/src\/learning\/study-time-zone\.js/);
assert.match(sw, /\.\/src\/storage\/transactions\/learning-mutation\.js/);

console.log('V5 learning event/source-of-truth contracts passed.');

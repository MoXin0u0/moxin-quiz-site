import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  LEARNING_ATTEMPT_KIND,
  buildDailyLearningActivity,
  buildLearningGoalProgress,
  calculateLearningStreak,
  classifyLearningAttempt,
  countRecentActiveDays,
  localDateKey,
  shiftDateKey,
} from '../src/learning/goal-progress.js';

const TZ = 'Asia/Taipei';

function attempt(timestamp, {
  bankId = 'bank-a',
  questionId = 'Q001',
  mode = 'filtered',
  id = null,
} = {}) {
  return {
    id,
    bankId,
    questionId,
    timestamp,
    mode,
  };
}

// 1. Attempt mode classification.
assert.equal(classifyLearningAttempt({ mode: 'filtered' }), LEARNING_ATTEMPT_KIND.PRACTICE);
assert.equal(classifyLearningAttempt({ mode: 'due' }), LEARNING_ATTEMPT_KIND.REVIEW);
assert.equal(classifyLearningAttempt({ mode: 'wrong' }), LEARNING_ATTEMPT_KIND.REVIEW);
assert.equal(classifyLearningAttempt({ mode: 'unfamiliar' }), LEARNING_ATTEMPT_KIND.REVIEW);
assert.equal(classifyLearningAttempt({ mode: 'favorite' }), LEARNING_ATTEMPT_KIND.REVIEW);
assert.equal(classifyLearningAttempt({ mode: 'review:custom' }), LEARNING_ATTEMPT_KIND.REVIEW);
assert.equal(classifyLearningAttempt({ mode: 'exam' }), LEARNING_ATTEMPT_KIND.EXAM);

// 2. Unknown / legacy modes count as normal practice.
assert.equal(classifyLearningAttempt({ mode: '' }), LEARNING_ATTEMPT_KIND.PRACTICE);
assert.equal(classifyLearningAttempt({}), LEARNING_ATTEMPT_KIND.PRACTICE);

// 3. Local date is based on the user's timezone, not UTC calendar date.
assert.equal(
  localDateKey('2026-10-01T16:30:00.000Z', { timeZone: TZ }),
  '2026-10-02',
);

// 4. Date key shifting is calendar-safe.
assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');
assert.equal(shiftDateKey('2024-03-01', -1), '2024-02-29');

// 5. Wrong retry of the same normal-practice question counts as one daily practice question.
{
  const rows = [
    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001', mode: 'filtered' }),
    attempt('2026-10-02T01:01:00.000Z', { questionId: 'Q001', mode: 'filtered' }),
    attempt('2026-10-02T01:02:00.000Z', { questionId: 'Q002', mode: 'filtered' }),
  ];
  const day = buildDailyLearningActivity(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    days: 1,
    timeZone: TZ,
  })[0];

  assert.equal(day.practice, 2);
  assert.equal(day.attempts, 3);
  assert.equal(day.answered, 2);
}

// 6. Review modes count toward review, not daily practice.
{
  const rows = [
    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001', mode: 'due' }),
    attempt('2026-10-02T01:01:00.000Z', { questionId: 'Q002', mode: 'wrong' }),
    attempt('2026-10-02T01:02:00.000Z', { questionId: 'Q003', mode: 'favorite' }),
  ];
  const day = buildDailyLearningActivity(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    days: 1,
    timeZone: TZ,
  })[0];

  assert.equal(day.practice, 0);
  assert.equal(day.review, 3);
}

// 7. Exam questions do not inflate practice/review targets, but still mark the day active.
{
  const rows = [
    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001', mode: 'exam' }),
    attempt('2026-10-02T01:01:00.000Z', { questionId: 'Q002', mode: 'exam' }),
  ];
  const day = buildDailyLearningActivity(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    days: 1,
    timeZone: TZ,
  })[0];

  assert.equal(day.practice, 0);
  assert.equal(day.review, 0);
  assert.equal(day.exam, 2);
  assert.equal(day.active, true);
}

// 8. The same question can legitimately count once in practice and once in review.
{
  const rows = [
    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001', mode: 'filtered' }),
    attempt('2026-10-02T02:00:00.000Z', { questionId: 'Q001', mode: 'due' }),
  ];
  const day = buildDailyLearningActivity(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    days: 1,
    timeZone: TZ,
  })[0];

  assert.equal(day.practice, 1);
  assert.equal(day.review, 1);
  assert.equal(day.answered, 1);
}

// 9. Bank-scoped activity excludes other banks even when question IDs match.
{
  const rows = [
    attempt('2026-10-02T01:00:00.000Z', { bankId: 'bank-a', questionId: 'Q001' }),
    attempt('2026-10-02T01:00:00.000Z', { bankId: 'bank-b', questionId: 'Q001' }),
  ];
  const day = buildDailyLearningActivity(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    days: 1,
    timeZone: TZ,
    bankId: 'bank-a',
  })[0];

  assert.equal(day.practice, 1);
  assert.equal(day.answered, 1);
}

// 10. Global scope distinguishes identical question IDs from different banks.
{
  const rows = [
    attempt('2026-10-02T01:00:00.000Z', { bankId: 'bank-a', questionId: 'Q001' }),
    attempt('2026-10-02T01:00:00.000Z', { bankId: 'bank-b', questionId: 'Q001' }),
  ];
  const day = buildDailyLearningActivity(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    days: 1,
    timeZone: TZ,
  })[0];

  assert.equal(day.practice, 2);
}

// 11. Goal progress reports independent practice/review completion.
{
  const rows = [
    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001' }),
    attempt('2026-10-02T01:05:00.000Z', { questionId: 'Q002' }),
    attempt('2026-10-02T01:10:00.000Z', { questionId: 'Q003', mode: 'due' }),
  ];
  const progress = buildLearningGoalProgress({
    id: 'global',
    enabled: true,
    dailyPracticeTarget: 2,
    dailyReviewTarget: 2,
  }, rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    timeZone: TZ,
  });

  assert.equal(progress.today.practiceGoal.count, 2);
  assert.equal(progress.today.practiceGoal.complete, true);
  assert.equal(progress.today.reviewGoal.count, 1);
  assert.equal(progress.today.reviewGoal.complete, false);
  assert.equal(progress.today.completionPercent, 75);
  assert.equal(progress.today.achieved, false);
}

// 12. Goal achievement requires every configured target; zero targets are ignored.
{
  const rows = [
    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001' }),
    attempt('2026-10-02T01:05:00.000Z', { questionId: 'Q002' }),
  ];
  const progress = buildLearningGoalProgress({
    enabled: true,
    dailyPracticeTarget: 2,
    dailyReviewTarget: 0,
  }, rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    timeZone: TZ,
  });

  assert.equal(progress.activeTargetCount, 1);
  assert.equal(progress.today.reviewGoal.active, false);
  assert.equal(progress.today.achieved, true);
  assert.equal(progress.today.completionPercent, 100);
}

// 13. An enabled goal with no configured targets is not considered achieved.
{
  const progress = buildLearningGoalProgress({
    enabled: true,
    dailyPracticeTarget: 0,
    dailyReviewTarget: 0,
  }, [], {
    now: new Date('2026-10-02T12:00:00.000Z'),
    timeZone: TZ,
  });

  assert.equal(progress.activeTargetCount, 0);
  assert.equal(progress.today.achieved, false);
  assert.equal(progress.today.completionPercent, 0);
}

// 14. Disabled goals still expose counts but never mark a day achieved.
{
  const rows = [
    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001' }),
  ];
  const progress = buildLearningGoalProgress({
    enabled: false,
    dailyPracticeTarget: 1,
    dailyReviewTarget: 0,
  }, rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    timeZone: TZ,
  });

  assert.equal(progress.today.practiceGoal.count, 1);
  assert.equal(progress.today.achieved, false);
}

// 15. History is chronological and applies the current target to all seven days.
{
  const rows = [
    attempt('2026-09-27T02:00:00.000Z', { questionId: 'Q001' }),
    attempt('2026-10-02T02:00:00.000Z', { questionId: 'Q002' }),
  ];
  const progress = buildLearningGoalProgress({
    enabled: true,
    dailyPracticeTarget: 1,
    dailyReviewTarget: 0,
  }, rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    timeZone: TZ,
    historyDays: 7,
  });

  assert.equal(progress.history.length, 7);
  assert.equal(progress.history[0].dateKey, '2026-09-26');
  assert.equal(progress.history[6].dateKey, '2026-10-02');
  assert.equal(progress.history.find(day => day.dateKey === '2026-09-27').achieved, true);
  assert.equal(progress.history.find(day => day.dateKey === '2026-10-02').achieved, true);
  assert.equal(progress.recentAchievedDays, 2);
}

// 16. Current streak includes today when today has learning activity.
{
  const rows = [
    attempt('2026-09-30T03:00:00.000Z'),
    attempt('2026-10-01T03:00:00.000Z'),
    attempt('2026-10-02T03:00:00.000Z'),
  ];
  assert.equal(calculateLearningStreak(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    timeZone: TZ,
  }), 3);
}

// 17. Streak remains alive during an unfinished today when yesterday was active.
{
  const rows = [
    attempt('2026-09-30T03:00:00.000Z'),
    attempt('2026-10-01T03:00:00.000Z'),
  ];
  assert.equal(calculateLearningStreak(rows, {
    now: new Date('2026-10-02T04:00:00.000Z'),
    timeZone: TZ,
  }), 2);
}

// 18. A fully missed day breaks the streak.
{
  const rows = [
    attempt('2026-09-29T03:00:00.000Z'),
    attempt('2026-09-30T03:00:00.000Z'),
  ];
  assert.equal(calculateLearningStreak(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    timeZone: TZ,
  }), 0);
}

// 19. Exam-only activity keeps a learning streak alive.
{
  const rows = [
    attempt('2026-10-01T03:00:00.000Z', { mode: 'exam' }),
    attempt('2026-10-02T03:00:00.000Z', { mode: 'exam' }),
  ];
  assert.equal(calculateLearningStreak(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    timeZone: TZ,
  }), 2);
}

// 20. Streak can be scoped to one bank.
{
  const rows = [
    attempt('2026-10-01T03:00:00.000Z', { bankId: 'bank-a' }),
    attempt('2026-10-02T03:00:00.000Z', { bankId: 'bank-b' }),
  ];
  assert.equal(calculateLearningStreak(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    timeZone: TZ,
    bankId: 'bank-a',
  }), 1);
}

// 21. Malformed timestamps are ignored.
{
  const rows = [
    attempt('not-a-date'),
    attempt('2026-10-02T03:00:00.000Z', { questionId: 'Q002' }),
  ];
  const day = buildDailyLearningActivity(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    days: 1,
    timeZone: TZ,
  })[0];

  assert.equal(day.practice, 1);
  assert.equal(day.attempts, 1);
}

// 22. Recent active days counts practice, review and exam days.
{
  const rows = [
    attempt('2026-09-30T03:00:00.000Z', { mode: 'filtered' }),
    attempt('2026-10-01T03:00:00.000Z', { mode: 'due' }),
    attempt('2026-10-02T03:00:00.000Z', { mode: 'exam' }),
  ];
  assert.equal(countRecentActiveDays(rows, {
    now: new Date('2026-10-02T12:00:00.000Z'),
    days: 7,
    timeZone: TZ,
  }), 3);
}

// 23. Attempts repository exposes all attempts for future P3 UI aggregation.
{
  const source = fs.readFileSync('src/storage/repositories/attempts.js', 'utf8');
  assert.match(source, /getAllRecords/);
  assert.match(source, /export function listAllAttempts\(\)/);
}

// 24. P3 core is available offline.
{
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(sw, /\.\/src\/learning\/goal-progress\.js/);
  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v(?:3-4\.\d+\.\d+|5)-[^']+'/);
}

console.log('MoXin Quiz v4.0 P3 learning goal progress core: 24 regression cases passed.');

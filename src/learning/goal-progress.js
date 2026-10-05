import {
  ATTEMPT_ACTIVITY,
  attemptActivityType,
  attemptInstant,
} from './attempt-events.js';

export const LEARNING_ATTEMPT_KIND = Object.freeze({
  PRACTICE: ATTEMPT_ACTIVITY.PRACTICE,
  REVIEW: ATTEMPT_ACTIVITY.REVIEW,
  EXAM: ATTEMPT_ACTIVITY.EXAM,
});

export function classifyLearningAttempt(attempt = {}) {
  return attemptActivityType(attempt);
}

export function localDateKey(value = new Date(), { timeZone = null } = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);

      const map = Object.fromEntries(
        parts
          .filter(part => part.type !== 'literal')
          .map(part => [part.type, part.value]),
      );

      if (map.year && map.month && map.day) {
        return `${map.year}-${map.month}-${map.day}`;
      }
    } catch {
      // Fall through to runtime-local date when an invalid/unsupported zone is supplied.
    }
  }

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function shiftDateKey(dateKey, deltaDays) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!match) return null;

  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) + Number(deltaDays || 0),
  ));

  if (Number.isNaN(date.getTime())) return null;

  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function buildDailyLearningActivity(attempts = [], {
  now = new Date(),
  days = 7,
  timeZone = null,
  bankId = null,
} = {}) {
  const normalizedDays = Math.max(1, Math.min(3660, Math.round(Number(days) || 7)));
  const todayKey = localDateKey(now, { timeZone });
  if (!todayKey) return [];

  const keys = [];
  for (let offset = normalizedDays - 1; offset >= 0; offset -= 1) {
    keys.push(shiftDateKey(todayKey, -offset));
  }

  const requested = new Set(keys);
  const buckets = new Map(keys.map(key => [key, createBucket(key)]));
  const scopedBankId = bankId ? String(bankId) : null;

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    const instant = attemptInstant(attempt);
    if (!attempt || !instant) continue;
    if (scopedBankId && String(attempt.bankId || '') !== scopedBankId) continue;

    const dateKey = localDateKey(instant, { timeZone });
    if (!dateKey || !requested.has(dateKey)) continue;

    const bucket = buckets.get(dateKey);
    const kind = classifyLearningAttempt(attempt);
    const questionKey = learningAttemptQuestionKey(attempt);

    bucket.attempts += 1;
    bucket.active = true;
    bucket.all.add(questionKey);

    if (kind === LEARNING_ATTEMPT_KIND.EXAM) {
      bucket.exam.add(questionKey);
    } else if (kind === LEARNING_ATTEMPT_KIND.REVIEW) {
      bucket.review.add(questionKey);
    } else {
      bucket.practice.add(questionKey);
    }
  }

  return keys.map(key => finalizeBucket(buckets.get(key)));
}

export function calculateLearningStreak(attempts = [], {
  now = new Date(),
  timeZone = null,
  bankId = null,
} = {}) {
  const todayKey = localDateKey(now, { timeZone });
  if (!todayKey) return 0;

  const scopedBankId = bankId ? String(bankId) : null;
  const activeDays = new Set();

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    const instant = attemptInstant(attempt);
    if (!instant) continue;
    if (scopedBankId && String(attempt.bankId || '') !== scopedBankId) continue;

    const key = localDateKey(instant, { timeZone });
    if (key && key <= todayKey) activeDays.add(key);
  }

  let cursor = todayKey;
  if (!activeDays.has(cursor)) {
    const yesterday = shiftDateKey(cursor, -1);
    if (!yesterday || !activeDays.has(yesterday)) return 0;
    cursor = yesterday;
  }

  let streak = 0;
  while (cursor && activeDays.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return streak;
}

export function buildLearningGoalProgress(goal = {}, attempts = [], {
  now = new Date(),
  timeZone = null,
  historyDays = 7,
} = {}) {
  const scopedBankId = goal?.bankId ? String(goal.bankId) : null;
  const daily = buildDailyLearningActivity(attempts, {
    now,
    days: historyDays,
    timeZone,
    bankId: scopedBankId,
  });

  const practiceTarget = clampTarget(goal?.dailyPracticeTarget);
  const reviewTarget = clampTarget(goal?.dailyReviewTarget);
  const enabled = goal?.enabled === true;
  const targetTotal = practiceTarget + reviewTarget;

  const history = daily.map(day => {
    const practice = buildMetric(day.practice, practiceTarget);
    const review = buildMetric(day.review, reviewTarget);
    const achieved = enabled && targetTotal > 0 &&
      (!practice.active || practice.complete) &&
      (!review.active || review.complete);

    return {
      ...day,
      practiceGoal: practice,
      reviewGoal: review,
      achieved,
      completionPercent: combinedPercent(practice, review),
    };
  });

  const today = history[history.length - 1] || {
    dateKey: localDateKey(now, { timeZone }),
    practice: 0,
    review: 0,
    exam: 0,
    answered: 0,
    attempts: 0,
    active: false,
    practiceGoal: buildMetric(0, practiceTarget),
    reviewGoal: buildMetric(0, reviewTarget),
    achieved: false,
    completionPercent: 0,
  };

  return {
    goalId: String(goal?.id || 'global'),
    bankId: scopedBankId,
    enabled,
    activeTargetCount: Number(practiceTarget > 0) + Number(reviewTarget > 0),
    today,
    history,
    streak: calculateLearningStreak(attempts, {
      now,
      timeZone,
      bankId: scopedBankId,
    }),
    recentAchievedDays: history.filter(day => day.achieved).length,
  };
}

export function countRecentActiveDays(attempts = [], {
  now = new Date(),
  days = 7,
  timeZone = null,
  bankId = null,
} = {}) {
  return buildDailyLearningActivity(attempts, {
    now,
    days,
    timeZone,
    bankId,
  }).filter(day => day.active).length;
}

function createBucket(dateKey) {
  return {
    dateKey,
    practice: new Set(),
    review: new Set(),
    exam: new Set(),
    all: new Set(),
    attempts: 0,
    active: false,
  };
}

function finalizeBucket(bucket) {
  return {
    dateKey: bucket.dateKey,
    practice: bucket.practice.size,
    review: bucket.review.size,
    exam: bucket.exam.size,
    answered: bucket.all.size,
    attempts: bucket.attempts,
    active: bucket.active,
  };
}

function learningAttemptQuestionKey(attempt) {
  const bank = String(attempt?.bankId || '');
  const question = String(attempt?.questionId || '');

  if (bank || question) return `${bank}\u0000${question}`;

  if (attempt?.eventId) return `event:${String(attempt.eventId)}`;
  const id = attempt?.id;
  return id === undefined || id === null
    ? `anonymous:${String(attemptInstant(attempt) || '')}:${String(attempt?.mode || '')}`
    : `attempt:${String(id)}`;
}

function clampTarget(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(10000, Math.round(number)));
}

function buildMetric(count, target) {
  const normalizedCount = Math.max(0, Math.round(Number(count) || 0));
  const active = target > 0;
  const complete = active ? normalizedCount >= target : true;
  const percent = active
    ? Math.min(100, Math.round((normalizedCount / target) * 100))
    : 0;

  return {
    count: normalizedCount,
    target,
    active,
    complete,
    percent,
    remaining: active ? Math.max(0, target - normalizedCount) : 0,
  };
}

function combinedPercent(practice, review) {
  const target = (practice.active ? practice.target : 0) +
    (review.active ? review.target : 0);
  if (!target) return 0;

  const completed =
    (practice.active ? Math.min(practice.count, practice.target) : 0) +
    (review.active ? Math.min(review.count, review.target) : 0);

  return Math.min(100, Math.round((completed / target) * 100));
}

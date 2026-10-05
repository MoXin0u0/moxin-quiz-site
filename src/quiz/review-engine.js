export const REVIEW_INTERVAL_DAYS = Object.freeze([0, 1, 3, 7, 14, 30, 60]);

export function calculateNextReview(previous = null, correct, now = new Date()) {
  const currentLevel = clampLevel(previous?.level ?? 0);
  const nextLevel = correct
    ? Math.min(6, currentLevel + 1)
    : Math.max(0, currentLevel - 2);

  const intervalDays = correct
    ? REVIEW_INTERVAL_DAYS[nextLevel]
    : 1;

  const correctStreak = correct ? (Number(previous?.correctStreak) || 0) + 1 : 0;
  const wrongCount = (Number(previous?.wrongCount) || 0) + (correct ? 0 : 1);
  const reviewCount = (Number(previous?.reviewCount) || 0) + 1;

  return {
    level: nextLevel,
    mastery: masteryLabel(nextLevel),
    intervalDays,
    dueAt: addDays(now, intervalDays).toISOString(),
    correctStreak,
    wrongCount,
    reviewCount,
    lastResult: correct ? 'correct' : 'wrong',
    lastReviewedAt: now.toISOString(),
  };
}

export function calculateNextReviewFromOutcome(previous = null, outcome, now = new Date()) {
  const normalized = String(outcome || '').trim().toLowerCase();

  if (normalized === 'unanswered') {
    const currentLevel = clampLevel(previous?.level ?? 0);
    const previousDue = previous?.dueAt ? new Date(previous.dueAt) : null;
    const dueAt = previousDue && !Number.isNaN(previousDue.getTime())
      ? previousDue.toISOString()
      : now.toISOString();

    return {
      level: currentLevel,
      mastery: previous?.mastery || masteryLabel(currentLevel),
      intervalDays: Number.isFinite(Number(previous?.intervalDays))
        ? Number(previous.intervalDays)
        : 0,
      dueAt,
      correctStreak: Number(previous?.correctStreak) || 0,
      wrongCount: Number(previous?.wrongCount) || 0,
      unansweredCount: (Number(previous?.unansweredCount) || 0) + 1,
      reviewCount: Number(previous?.reviewCount) || 0,
      lastResult: 'unanswered',
      lastOutcome: 'unanswered',
      lastUnansweredAt: now.toISOString(),
      lastReviewedAt: previous?.lastReviewedAt || null,
    };
  }

  const correct = normalized === 'correct';
  const next = calculateNextReview(previous, correct, now);
  return {
    ...next,
    unansweredCount: Number(previous?.unansweredCount) || 0,
    lastOutcome: correct ? 'correct' : 'wrong',
  };
}

export function masteryLabel(level) {
  const normalized = clampLevel(level);
  if (normalized >= 5) return 'mastered';
  if (normalized >= 3) return 'familiar';
  if (normalized >= 1) return 'learning';
  return 'new';
}

export function isReviewDue(record, now = new Date()) {
  if (!record?.dueAt) return false;
  const due = new Date(record.dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() <= now.getTime();
}

export function summarizeMastery(questionIds, reviewRecords = []) {
  const byQuestion = new Map(reviewRecords.map(record => [record.questionId, record]));
  const summary = { new: 0, learning: 0, familiar: 0, mastered: 0 };

  for (const id of questionIds || []) {
    const record = byQuestion.get(id);
    const label = record?.mastery || masteryLabel(record?.level ?? 0);
    summary[label] = (summary[label] || 0) + 1;
  }

  return summary;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setTime(result.getTime() + days * 24 * 60 * 60 * 1000);
  return result;
}

function clampLevel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(6, Math.trunc(number)));
}

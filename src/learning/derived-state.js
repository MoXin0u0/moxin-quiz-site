import { learningKey } from '../utils/ids.js';
import { calculateNextReview } from '../quiz/review-engine.js';
import {
  ATTEMPT_OUTCOME,
  attemptInstant,
  attemptOutcome,
  sortAttemptEvents,
} from './attempt-events.js';

export function reduceQuestionProgress(attempts = [], {
  bankId = null,
  questionId = null,
  rebuiltAt = new Date().toISOString(),
} = {}) {
  const scoped = scopedAttempts(attempts, bankId, questionId);
  if (!scoped.length) return null;

  const first = scoped[0];
  const resolvedBankId = String(bankId || first.bankId || '');
  const resolvedQuestionId = String(questionId || first.questionId || '');
  const record = {
    key: learningKey(resolvedBankId, resolvedQuestionId),
    bankId: resolvedBankId,
    questionId: resolvedQuestionId,
    attempts: 0,
    correctCount: 0,
    wrongCount: 0,
    unansweredCount: 0,
    lastResult: null,
    lastOutcome: null,
    lastAnsweredAt: null,
    lastCorrectAt: null,
    lastWrongAt: null,
    lastUnansweredAt: null,
    rebuiltAt: String(rebuiltAt),
  };

  for (const attempt of scoped) {
    const outcome = attemptOutcome(attempt);
    const instant = validInstant(attemptInstant(attempt));
    record.attempts += 1;

    if (outcome === ATTEMPT_OUTCOME.CORRECT) {
      record.correctCount += 1;
      if (instant) record.lastCorrectAt = instant;
    } else if (outcome === ATTEMPT_OUTCOME.WRONG) {
      record.wrongCount += 1;
      if (instant) record.lastWrongAt = instant;
    } else {
      record.unansweredCount += 1;
      if (instant) record.lastUnansweredAt = instant;
    }

    record.lastOutcome = outcome;
    record.lastResult = outcome;
    if (instant) record.lastAnsweredAt = instant;
  }

  return record;
}

export function reduceReviewSchedule(attempts = [], {
  bankId = null,
  questionId = null,
  rebuiltAt = new Date().toISOString(),
} = {}) {
  const scoped = scopedAttempts(attempts, bankId, questionId)
    .filter(attempt => validInstant(attemptInstant(attempt)));

  if (!scoped.length) return null;

  const first = scoped[0];
  const resolvedBankId = String(bankId || first.bankId || '');
  const resolvedQuestionId = String(questionId || first.questionId || '');
  let current = null;
  let wrongCount = 0;
  let unansweredCount = 0;

  for (const attempt of scoped) {
    const outcome = attemptOutcome(attempt);
    if (outcome === ATTEMPT_OUTCOME.WRONG) wrongCount += 1;
    if (outcome === ATTEMPT_OUTCOME.UNANSWERED) unansweredCount += 1;

    const instant = validInstant(attemptInstant(attempt));
    const next = calculateNextReview(
      current,
      outcome === ATTEMPT_OUTCOME.CORRECT,
      new Date(instant),
    );

    current = {
      ...(current || {}),
      ...next,
      key: learningKey(resolvedBankId, resolvedQuestionId),
      bankId: resolvedBankId,
      questionId: resolvedQuestionId,
      wrongCount,
      unansweredCount,
      lastOutcome: outcome,
      lastResult: outcome,
      updatedAt: instant,
      rebuiltAt: String(rebuiltAt),
    };
  }

  return current;
}

export function buildDerivedLearningRecords(attempts = [], {
  rebuiltAt = new Date().toISOString(),
} = {}) {
  const groups = new Map();

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    const bankId = String(attempt?.bankId || '');
    const questionId = String(attempt?.questionId || '');
    if (!bankId || !questionId) continue;
    const key = learningKey(bankId, questionId);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(attempt);
  }

  const progress = [];
  const review = [];
  for (const rows of groups.values()) {
    const progressRecord = reduceQuestionProgress(rows, { rebuiltAt });
    const reviewRecord = reduceReviewSchedule(rows, { rebuiltAt });
    if (progressRecord) progress.push(progressRecord);
    if (reviewRecord) review.push(reviewRecord);
  }

  return { progress, review };
}

function scopedAttempts(attempts, bankId, questionId) {
  const bank = bankId ? String(bankId) : null;
  const question = questionId ? String(questionId) : null;

  return sortAttemptEvents(attempts).filter(attempt => {
    if (bank && String(attempt.bankId || '') !== bank) return false;
    if (question && String(attempt.questionId || '') !== question) return false;
    return Boolean(attempt.bankId && attempt.questionId);
  });
}

function validInstant(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

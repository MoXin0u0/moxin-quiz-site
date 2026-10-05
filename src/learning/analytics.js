import { localDateKey } from './goal-progress.js';
import {
  ATTEMPT_OUTCOME,
  attemptInstant,
  attemptOutcome,
  hasAttemptContextMetadata,
  normalizedAttemptEvent,
} from './attempt-events.js';

export const ANALYTICS_WINDOW_DAYS = Object.freeze({
  WEEK: 7,
  MONTH: 30,
});

export const ANALYTICS_UNKNOWN_TYPE = 'unknown';
export const ANALYTICS_UNCATEGORIZED_CHAPTER = '未分類';
export const ANALYTICS_REMOVED_QUESTION_CHAPTER = '已移除題目';

const TYPE_ORDER = Object.freeze([
  'single-choice',
  'multiple-choice',
  'true-false',
  'fill-in',
  ANALYTICS_UNKNOWN_TYPE,
]);

export function buildLearningAnalytics(data = {}, {
  bankId = null,
  now = new Date(),
  timeZone = null,
  weakMinAttempts = 3,
  weakLimit = 5,
} = {}) {
  const questions = normalizeQuestions(data?.questions);
  const questionMap = new Map(
    questions.map(question => [
      questionKey(question.bankId, question.questionId),
      question,
    ]),
  );

  const attempts = normalizeAttempts(data?.attempts)
    .filter(attempt => !bankId || attempt.bankId === String(bankId));

  const todayKey = localDateKey(now, { timeZone });
  const history30 = buildDailySeries(attempts, {
    days: ANALYTICS_WINDOW_DAYS.MONTH,
    todayKey,
    timeZone,
  });
  const history7 = history30.slice(-ANALYTICS_WINDOW_DAYS.WEEK);

  const typeAccuracy = buildDimensionAccuracy(attempts, attempt => {
    const contextType = String(attempt?.context?.questionType || '').trim();
    if (contextType && contextType !== ANALYTICS_UNKNOWN_TYPE) {
      return normalizeType(contextType);
    }
    const question = questionMap.get(questionKey(attempt.bankId, attempt.questionId));
    return normalizeType(question?.type);
  }, TYPE_ORDER);

  const chapterAccuracy = buildDimensionAccuracy(attempts, attempt => {
    const context = attempt?.context;
    if (
      context &&
      Object.prototype.hasOwnProperty.call(context, 'chapter') &&
      context.chapter !== null
    ) {
      return normalizeChapter(context.chapter);
    }

    const question = questionMap.get(questionKey(attempt.bankId, attempt.questionId));
    if (!question) return ANALYTICS_REMOVED_QUESTION_CHAPTER;
    return normalizeChapter(question.chapter);
  });

  const weakChapters = buildWeakChapterList(chapterAccuracy, {
    minAttempts: weakMinAttempts,
    limit: weakLimit,
  });

  const validDateAttempts = attempts.filter(attempt =>
    Boolean(toDateKey(attemptInstant(attempt), { timeZone })),
  );

  return {
    scope: {
      bankId: bankId ? String(bankId) : null,
    },
    todayKey,
    overall: summarizeAttempts(attempts),
    recent7: summarizeSeries(history7),
    recent30: summarizeSeries(history30),
    history7,
    history30,
    typeAccuracy,
    chapterAccuracy,
    weakChapters,
    dataQuality: {
      attemptsWithoutValidTimestamp: attempts.length - validDateAttempts.length,
      attemptsWithoutQuestionMetadata: attempts.filter(attempt =>
        !questionMap.has(questionKey(attempt.bankId, attempt.questionId)) &&
        !hasAttemptContextMetadata(attempt),
      ).length,
    },
  };
}

export function buildDailySeries(attempts = [], {
  days = 7,
  todayKey,
  now = new Date(),
  timeZone = null,
} = {}) {
  const windowDays = clampPositiveInteger(days, 1, 366);
  const resolvedTodayKey = todayKey || localDateKey(now, { timeZone });
  const startKey = shiftDateKey(resolvedTodayKey, -(windowDays - 1));
  const buckets = new Map();

  for (let index = 0; index < windowDays; index += 1) {
    const dateKey = shiftDateKey(startKey, index);
    buckets.set(dateKey, {
      dateKey,
      attempts: 0,
      correct: 0,
      wrong: 0,
      unanswered: 0,
      accuracy: 0,
      uniqueQuestions: 0,
      active: false,
      _questionKeys: new Set(),
    });
  }

  for (const attempt of normalizeAttempts(attempts)) {
    const dateKey = toDateKey(attemptInstant(attempt), { timeZone });
    const bucket = dateKey ? buckets.get(dateKey) : null;
    if (!bucket) continue;

    bucket.attempts += 1;
    if (attempt.outcome === ATTEMPT_OUTCOME.CORRECT) bucket.correct += 1;
    else if (attempt.outcome === ATTEMPT_OUTCOME.WRONG) bucket.wrong += 1;
    else bucket.unanswered += 1;
    bucket._questionKeys.add(questionKey(attempt.bankId, attempt.questionId));
  }

  return [...buckets.values()].map(bucket => ({
    dateKey: bucket.dateKey,
    attempts: bucket.attempts,
    correct: bucket.correct,
    wrong: bucket.wrong,
    unanswered: bucket.unanswered,
    accuracy: percent(bucket.correct, bucket.attempts),
    uniqueQuestions: bucket._questionKeys.size,
    active: bucket.attempts > 0,
  }));
}

export function buildDimensionAccuracy(attempts = [], keySelector, order = null) {
  const buckets = new Map();

  for (const attempt of normalizeAttempts(attempts)) {
    const rawKey = keySelector?.(attempt);
    const key = String(rawKey || ANALYTICS_UNKNOWN_TYPE).trim() || ANALYTICS_UNKNOWN_TYPE;

    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        attempts: 0,
        correct: 0,
        wrong: 0,
        unanswered: 0,
        accuracy: 0,
        uniqueQuestions: 0,
        _questionKeys: new Set(),
      });
    }

    const bucket = buckets.get(key);
    bucket.attempts += 1;
    if (attempt.outcome === ATTEMPT_OUTCOME.CORRECT) bucket.correct += 1;
    else if (attempt.outcome === ATTEMPT_OUTCOME.WRONG) bucket.wrong += 1;
    else bucket.unanswered += 1;
    bucket._questionKeys.add(questionKey(attempt.bankId, attempt.questionId));
  }

  const results = [...buckets.values()].map(bucket => ({
    key: bucket.key,
    attempts: bucket.attempts,
    correct: bucket.correct,
    wrong: bucket.wrong,
    unanswered: bucket.unanswered,
    accuracy: percent(bucket.correct, bucket.attempts),
    uniqueQuestions: bucket._questionKeys.size,
  }));

  if (Array.isArray(order)) {
    const rank = new Map(order.map((key, index) => [key, index]));
    return results.sort((a, b) => {
      const aRank = rank.has(a.key) ? rank.get(a.key) : order.length;
      const bRank = rank.has(b.key) ? rank.get(b.key) : order.length;
      return aRank - bRank || a.key.localeCompare(b.key);
    });
  }

  return results.sort((a, b) =>
    b.attempts - a.attempts ||
    a.key.localeCompare(b.key),
  );
}

export function buildWeakChapterList(chapterAccuracy = [], {
  minAttempts = 3,
  limit = 5,
} = {}) {
  const normalizedMin = clampPositiveInteger(minAttempts, 1, 10000);
  const normalizedLimit = clampPositiveInteger(limit, 1, 100);

  const actionable = (Array.isArray(chapterAccuracy) ? chapterAccuracy : [])
    .filter(item =>
      item &&
      item.key !== ANALYTICS_REMOVED_QUESTION_CHAPTER &&
      Number(item.attempts || 0) > 0,
    );

  const eligible = actionable.filter(item =>
    Number(item.attempts || 0) >= normalizedMin,
  );

  const source = eligible.length ? eligible : actionable;

  return [...source]
    .sort((a, b) =>
      Number(a.accuracy || 0) - Number(b.accuracy || 0) ||
      Number(b.wrong || 0) - Number(a.wrong || 0) ||
      Number(b.unanswered || 0) - Number(a.unanswered || 0) ||
      Number(b.attempts || 0) - Number(a.attempts || 0) ||
      String(a.key).localeCompare(String(b.key)),
    )
    .slice(0, normalizedLimit)
    .map(item => ({
      ...item,
      provisional: Number(item.attempts || 0) < normalizedMin,
    }));
}

export function summarizeAttempts(attempts = []) {
  const normalized = normalizeAttempts(attempts);
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  for (const attempt of normalized) {
    if (attempt.outcome === ATTEMPT_OUTCOME.CORRECT) correct += 1;
    else if (attempt.outcome === ATTEMPT_OUTCOME.WRONG) wrong += 1;
    else unanswered += 1;
  }

  const unique = new Set(
    normalized.map(attempt => questionKey(attempt.bankId, attempt.questionId)),
  );

  return {
    attempts: normalized.length,
    correct,
    wrong,
    unanswered,
    accuracy: percent(correct, normalized.length),
    uniqueQuestions: unique.size,
  };
}

export function summarizeSeries(series = []) {
  const items = Array.isArray(series) ? series : [];
  const attempts = items.reduce((sum, day) => sum + Number(day.attempts || 0), 0);
  const correct = items.reduce((sum, day) => sum + Number(day.correct || 0), 0);
  const wrong = items.reduce((sum, day) => sum + Number(day.wrong || 0), 0);
  const unanswered = items.reduce((sum, day) => sum + Number(day.unanswered || 0), 0);

  return {
    attempts,
    correct,
    wrong,
    unanswered,
    accuracy: percent(correct, attempts),
    activeDays: items.filter(day => day.active).length,
    uniqueQuestionTouches: items.reduce(
      (sum, day) => sum + Number(day.uniqueQuestions || 0),
      0,
    ),
  };
}

export function shiftDateKey(dateKey, offsetDays) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!match) return null;

  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ));

  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Number(offsetDays || 0));

  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeQuestions(questions = []) {
  return (Array.isArray(questions) ? questions : [])
    .map(question => ({
      ...question,
      bankId: String(question?.bankId || ''),
      questionId: String(question?.questionId || question?.id || ''),
    }))
    .filter(question => question.bankId && question.questionId);
}

function normalizeAttempts(attempts = []) {
  return (Array.isArray(attempts) ? attempts : [])
    .map(normalizedAttemptEvent)
    .filter(attempt => attempt.bankId && attempt.questionId);
}

function normalizeType(type) {
  const key = String(type || '').trim();
  return TYPE_ORDER.includes(key) ? key : ANALYTICS_UNKNOWN_TYPE;
}

function normalizeChapter(chapter) {
  const value = String(chapter || '').trim();
  return value || ANALYTICS_UNCATEGORIZED_CHAPTER;
}

function toDateKey(timestamp, { timeZone = null } = {}) {
  if (!timestamp) return null;
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return localDateKey(date, { timeZone });
}

function questionKey(bankId, questionId) {
  return `${String(bankId)}\u0000${String(questionId)}`;
}

function percent(correct, total) {
  const denominator = Number(total) || 0;
  if (denominator <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((Number(correct || 0) / denominator) * 100)),
  );
}

function clampPositiveInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

import {
  LEARNING_ATTEMPT_KIND,
  classifyLearningAttempt,
  localDateKey,
} from './goal-progress.js';

export const SPRINT_PRIORITY = Object.freeze({
  WRONG: 'wrong',
  UNFAMILIAR: 'unfamiliar',
  DUE: 'due',
  LOW_MASTERY: 'low-mastery',
  UNANSWERED: 'unanswered',
  OTHER: 'other',
});

export const SPRINT_PRIORITY_ORDER = Object.freeze([
  SPRINT_PRIORITY.WRONG,
  SPRINT_PRIORITY.UNFAMILIAR,
  SPRINT_PRIORITY.DUE,
  SPRINT_PRIORITY.LOW_MASTERY,
  SPRINT_PRIORITY.UNANSWERED,
  SPRINT_PRIORITY.OTHER,
]);

export const SPRINT_LOW_MASTERY_MAX_LEVEL = 2;

export function buildExamSprintPlan(goal = {}, data = {}, {
  now = new Date(),
  timeZone = null,
  todayPracticeCount = 0,
} = {}) {
  const todayKey = localDateKey(now, { timeZone });
  const examDateKey = normalizeExamDateKey(goal?.examDate);
  const daysUntilExam = diffDateKeys(todayKey, examDateKey);
  const remainingStudyDays =
    daysUntilExam === null || daysUntilExam < 0
      ? 0
      : Math.max(1, daysUntilExam);

  const questions = normalizeQuestions(data?.questions, goal?.bankId);
  const indexes = buildIndexes({
    progressRecords: data?.progressRecords,
    unfamiliarRecords: data?.unfamiliarRecords,
    reviewRecords: data?.reviewRecords,
  });

  const ranked = questions
    .map(question => buildCandidate(question, indexes, now))
    .sort(compareSprintCandidates);

  const completedTodayKeys = buildTodayPracticeKeySet(data?.attempts, {
    now,
    timeZone,
    bankId: goal?.bankId,
  });
  const availableToday = ranked.filter(
    candidate => !completedTodayKeys.has(questionKey(candidate.bankId, candidate.questionId)),
  );

  const priorityCounts = Object.fromEntries(
    SPRINT_PRIORITY_ORDER.map(priority => [priority, 0]),
  );
  for (const candidate of ranked) {
    priorityCounts[candidate.priority] += 1;
  }

  const candidateCount = ranked.length;
  const recommendedDailyTarget =
    candidateCount > 0 && remainingStudyDays > 0
      ? Math.ceil(candidateCount / remainingStudyDays)
      : 0;

  const configuredDailyTarget = clampTarget(goal?.dailyPracticeTarget);
  const dailyTarget =
    remainingStudyDays > 0
      ? configuredDailyTarget || recommendedDailyTarget
      : 0;

  const completedPracticeToday = Math.max(
    0,
    Math.round(Number(todayPracticeCount) || 0),
  );

  const remainingToday = Math.max(0, dailyTarget - completedPracticeToday);
  const availableTodayCount = availableToday.length;
  const selectionTarget = Math.min(availableTodayCount, remainingToday);
  const selected = availableToday.slice(0, selectionTarget);

  const projectedCoverage = Math.min(
    candidateCount,
    dailyTarget * remainingStudyDays,
  );
  const coverageGap = Math.max(0, candidateCount - projectedCoverage);

  const hasExamDate = Boolean(examDateKey);
  const examPassed = daysUntilExam !== null && daysUntilExam < 0;
  const enabled = goal?.sprintEnabled === true;
  const active =
    enabled &&
    hasExamDate &&
    !examPassed &&
    candidateCount > 0;

  return {
    goalId: String(goal?.id || 'global'),
    bankId: goal?.bankId ? String(goal.bankId) : null,
    examLabel: String(goal?.examLabel || '').trim(),
    examDateKey,
    sprintEnabled: enabled,
    active,
    status: sprintStatus({
      enabled,
      hasExamDate,
      examPassed,
      candidateCount,
      remainingToday,
      availableTodayCount,
    }),
    daysUntilExam,
    remainingStudyDays,
    candidateCount,
    availableTodayCount,
    configuredDailyTarget,
    recommendedDailyTarget,
    dailyTarget,
    completedPracticeToday,
    remainingToday,
    selectionTarget,
    projectedCoverage,
    coverageGap,
    priorityCounts,
    selected,
    ranked,
  };
}

export function classifySprintQuestion(question, {
  progress = null,
  unfamiliar = null,
  review = null,
  now = new Date(),
} = {}) {
  if (progress?.lastResult === 'wrong') {
    return SPRINT_PRIORITY.WRONG;
  }

  if (unfamiliar?.status === 'unfamiliar') {
    return SPRINT_PRIORITY.UNFAMILIAR;
  }

  if (isDue(review, now)) {
    return SPRINT_PRIORITY.DUE;
  }

  if (isAnswered(progress) && isLowMastery(review)) {
    return SPRINT_PRIORITY.LOW_MASTERY;
  }

  if (!isAnswered(progress)) {
    return SPRINT_PRIORITY.UNANSWERED;
  }

  return SPRINT_PRIORITY.OTHER;
}

export function recommendedSprintDailyTarget({
  questionCount = 0,
  remainingStudyDays = 0,
} = {}) {
  const count = Math.max(0, Math.round(Number(questionCount) || 0));
  const days = Math.max(0, Math.round(Number(remainingStudyDays) || 0));
  if (!count || !days) return 0;
  return Math.ceil(count / days);
}

export function buildTodayPracticeKeySet(attempts = [], {
  now = new Date(),
  timeZone = null,
  bankId = null,
} = {}) {
  const todayKey = localDateKey(now, { timeZone });
  const scopedBankId = bankId ? String(bankId) : null;
  const keys = new Set();

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    if (!attempt?.timestamp) continue;
    if (scopedBankId && String(attempt.bankId || '') !== scopedBankId) continue;
    if (classifyLearningAttempt(attempt) !== LEARNING_ATTEMPT_KIND.PRACTICE) continue;
    if (localDateKey(attempt.timestamp, { timeZone }) !== todayKey) continue;

    const attemptBankId = String(attempt.bankId || '');
    const questionId = String(attempt.questionId || '');
    if (!attemptBankId || !questionId) continue;
    keys.add(questionKey(attemptBankId, questionId));
  }

  return keys;
}

export function normalizeExamDateKey(value) {
  if (!value) return null;

  const text = String(value).trim();
  const direct = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (direct) {
    const key = `${direct[1]}-${direct[2]}-${direct[3]}`;
    return isValidDateKey(key) ? key : null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function diffDateKeys(fromKey, toKey) {
  const from = dateKeyNumber(fromKey);
  const to = dateKeyNumber(toKey);
  if (from === null || to === null) return null;
  return to - from;
}

function buildCandidate(question, indexes, now) {
  const key = questionKey(question.bankId, question.questionId);
  const progress = indexes.progress.get(key) || null;
  const unfamiliar = indexes.unfamiliar.get(key) || null;
  const review = indexes.review.get(key) || null;
  const priority = classifySprintQuestion(question, {
    progress,
    unfamiliar,
    review,
    now,
  });

  return {
    bankId: question.bankId,
    questionId: question.questionId,
    question: question.question,
    chapter: question.chapter,
    difficulty: question.difficulty,
    priority,
    priorityRank: SPRINT_PRIORITY_ORDER.indexOf(priority),
    lastResult: progress?.lastResult || null,
    attempts: Math.max(0, Number(progress?.attempts) || 0),
    wrongCount: Math.max(0, Number(progress?.wrongCount) || 0),
    lastWrongAt: progress?.lastWrongAt || null,
    lastAnsweredAt: progress?.lastAnsweredAt || null,
    unfamiliarMarkedAt: unfamiliar?.markedAt || unfamiliar?.updatedAt || null,
    reviewLevel: normalizeLevel(review?.level),
    dueAt: review?.dueAt || null,
  };
}

function buildIndexes({
  progressRecords = [],
  unfamiliarRecords = [],
  reviewRecords = [],
} = {}) {
  return {
    progress: recordMap(progressRecords),
    unfamiliar: recordMap(unfamiliarRecords),
    review: recordMap(reviewRecords),
  };
}

function recordMap(records) {
  const map = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const bankId = String(record?.bankId || '');
    const questionId = String(record?.questionId || '');
    if (!bankId || !questionId) continue;
    map.set(questionKey(bankId, questionId), record);
  }
  return map;
}

function normalizeQuestions(questions, fallbackBankId = null) {
  const fallback = fallbackBankId ? String(fallbackBankId) : '';
  const seen = new Set();
  const normalized = [];

  for (const question of Array.isArray(questions) ? questions : []) {
    const bankId = String(question?.bankId || fallback || '');
    const questionId = String(question?.questionId || question?.id || '');
    if (!bankId || !questionId) continue;
    if (fallback && bankId !== fallback) continue;

    const key = questionKey(bankId, questionId);
    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({
      bankId,
      questionId,
      question: String(question?.question || ''),
      chapter: String(question?.chapter || ''),
      difficulty: Number(question?.difficulty) || 0,
    });
  }

  return normalized;
}

function compareSprintCandidates(a, b) {
  if (a.priorityRank !== b.priorityRank) {
    return a.priorityRank - b.priorityRank;
  }

  if (a.priority === SPRINT_PRIORITY.WRONG) {
    if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
    const recent = compareRecentFirst(a.lastWrongAt, b.lastWrongAt);
    if (recent !== 0) return recent;
  }

  if (a.priority === SPRINT_PRIORITY.UNFAMILIAR) {
    const recent = compareRecentFirst(a.unfamiliarMarkedAt, b.unfamiliarMarkedAt);
    if (recent !== 0) return recent;
  }

  if (a.priority === SPRINT_PRIORITY.DUE) {
    const due = compareOldestFirst(a.dueAt, b.dueAt);
    if (due !== 0) return due;
  }

  if (a.priority === SPRINT_PRIORITY.LOW_MASTERY) {
    if (a.reviewLevel !== b.reviewLevel) return a.reviewLevel - b.reviewLevel;
    if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
  }

  return (
    String(a.bankId).localeCompare(String(b.bankId)) ||
    String(a.questionId).localeCompare(String(b.questionId))
  );
}

function isDue(review, now) {
  if (!review?.dueAt) return false;
  const due = new Date(review.dueAt);
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(due.getTime()) || Number.isNaN(current.getTime())) return false;
  return due.getTime() <= current.getTime();
}

function isLowMastery(review) {
  if (!review) return true;
  return normalizeLevel(review.level) <= SPRINT_LOW_MASTERY_MAX_LEVEL;
}

function isAnswered(progress) {
  return Math.max(0, Number(progress?.attempts) || 0) > 0;
}

function normalizeLevel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(6, Math.trunc(number)));
}

function clampTarget(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(10000, Math.round(number)));
}

function sprintStatus({
  enabled,
  hasExamDate,
  examPassed,
  candidateCount,
  remainingToday,
  availableTodayCount,
}) {
  if (!enabled) return 'disabled';
  if (!hasExamDate) return 'missing-exam-date';
  if (examPassed) return 'exam-passed';
  if (!candidateCount) return 'no-questions';
  if (!remainingToday) return 'today-complete';
  if (!availableTodayCount) return 'today-exhausted';
  return 'ready';
}

function questionKey(bankId, questionId) {
  return `${String(bankId)}\u0000${String(questionId)}`;
}

function compareRecentFirst(a, b) {
  return timestampValue(b) - timestampValue(a);
}

function compareOldestFirst(a, b) {
  return timestampValue(a, Number.POSITIVE_INFINITY) -
    timestampValue(b, Number.POSITIVE_INFINITY);
}

function timestampValue(value, fallback = 0) {
  if (!value) return fallback;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function dateKeyNumber(key) {
  if (!isValidDateKey(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function isValidDateKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

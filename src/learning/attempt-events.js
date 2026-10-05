export const ATTEMPT_OUTCOME = Object.freeze({
  CORRECT: 'correct',
  WRONG: 'wrong',
  UNANSWERED: 'unanswered',
});

export const ATTEMPT_ACTIVITY = Object.freeze({
  PRACTICE: 'practice',
  REVIEW: 'review',
  EXAM: 'exam',
});

const VALID_OUTCOMES = new Set(Object.values(ATTEMPT_OUTCOME));
const VALID_ACTIVITIES = new Set(Object.values(ATTEMPT_ACTIVITY));
const REVIEW_MODES = new Set([
  'review',
  'due',
  'wrong',
  'unfamiliar',
  'favorite',
  'scheduled-review',
]);

export function attemptInstant(attempt = {}) {
  return attempt?.answeredAt || attempt?.timestamp || null;
}

export function attemptOutcome(attempt = {}) {
  const explicit = String(attempt?.outcome || '').trim().toLowerCase();
  if (VALID_OUTCOMES.has(explicit)) return explicit;
  if (attempt?.correct === true) return ATTEMPT_OUTCOME.CORRECT;
  if (attempt?.correct === false) return ATTEMPT_OUTCOME.WRONG;
  return ATTEMPT_OUTCOME.UNANSWERED;
}

export function attemptActivityType(attempt = {}) {
  const explicit = String(attempt?.activityType || '').trim().toLowerCase();
  if (VALID_ACTIVITIES.has(explicit)) return explicit;

  const mode = String(attempt?.mode || '').trim().toLowerCase();
  if (mode === 'exam' || mode.startsWith('exam:')) return ATTEMPT_ACTIVITY.EXAM;
  if (REVIEW_MODES.has(mode) || mode.startsWith('review:')) {
    return ATTEMPT_ACTIVITY.REVIEW;
  }
  return ATTEMPT_ACTIVITY.PRACTICE;
}

export function normalizedAttemptEvent(attempt = {}) {
  const outcome = attemptOutcome(attempt);
  return {
    ...attempt,
    bankId: String(attempt?.bankId || ''),
    questionId: String(attempt?.questionId || ''),
    answeredAt: attemptInstant(attempt),
    activityType: attemptActivityType(attempt),
    outcome,
    correct: outcome === ATTEMPT_OUTCOME.CORRECT,
  };
}

export function compareAttemptEvents(left, right) {
  const leftTime = instantValue(attemptInstant(left));
  const rightTime = instantValue(attemptInstant(right));
  if (leftTime !== rightTime) return leftTime - rightTime;

  const leftId = stableAttemptId(left);
  const rightId = stableAttemptId(right);
  return leftId.localeCompare(rightId);
}

export function sortAttemptEvents(attempts = []) {
  return [...(Array.isArray(attempts) ? attempts : [])]
    .map(normalizedAttemptEvent)
    .sort(compareAttemptEvents);
}

export function hasAttemptContextMetadata(attempt = {}) {
  const context = attempt?.context;
  if (!context || typeof context !== 'object') return false;
  const type = String(context.questionType || '').trim();
  if (type && type !== 'unknown') return true;
  return Object.prototype.hasOwnProperty.call(context, 'chapter') && context.chapter !== null;
}

function stableAttemptId(attempt = {}) {
  if (attempt?.eventId) return String(attempt.eventId);
  if (attempt?.id !== undefined && attempt?.id !== null) return `legacy-id:${attempt.id}`;
  return [
    String(attempt?.bankId || ''),
    String(attempt?.questionId || ''),
    String(attemptInstant(attempt) || ''),
    String(attempt?.mode || ''),
  ].join('\u0000');
}

function instantValue(value) {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

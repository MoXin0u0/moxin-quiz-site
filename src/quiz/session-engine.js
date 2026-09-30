import { createSessionId } from '../utils/ids.js';
import { shuffle } from './shuffle.js';

export function createPracticeSession({ bankId, bankName, questions, mode = 'filtered', random = Math.random }) {
  const ids = questions.map(question => question.id);
  return {
    id: createSessionId('practice'),
    bankId,
    bankName,
    mode,
    sourceQuestionIds: [...ids],
    queue: shuffle(ids, random),
    completedIds: [],
    errorsByQuestion: {},
    attemptCount: 0,
    wrongCount: 0,
    currentQuestionId: null,
    answered: false,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finishedAt: null,
  };
}

export function advanceSession(session) {
  if (!session || session.queue.length === 0) {
    if (session) session.finishedAt = new Date().toISOString();
    return null;
  }
  session.currentQuestionId = session.queue.shift();
  session.answered = false;
  session.questionStartedAt = Date.now();
  session.updatedAt = new Date().toISOString();
  return session.currentQuestionId;
}

export function recordSessionAnswer(session, questionId, correct) {
  session.attemptCount += 1;
  session.answered = true;
  session.updatedAt = new Date().toISOString();

  if (correct) {
    if (!session.completedIds.includes(questionId)) session.completedIds.push(questionId);
  } else {
    session.wrongCount += 1;
    session.errorsByQuestion[questionId] = (session.errorsByQuestion[questionId] || 0) + 1;
    if (!session.queue.includes(questionId)) session.queue.push(questionId);
  }

  return session;
}

export function getSessionStats(session) {
  const total = session?.sourceQuestionIds?.length || 0;
  const completed = session?.completedIds?.length || 0;
  const attempts = session?.attemptCount || 0;
  const wrong = session?.wrongCount || 0;
  const accuracy = attempts ? Math.round(((attempts - wrong) / attempts) * 100) : 0;
  return {
    total,
    completed,
    remaining: Math.max(0, total - completed),
    attempts,
    wrong,
    accuracy,
  };
}

export function isSessionFinished(session) {
  return Boolean(
    session &&
    session.queue.length === 0 &&
    session.completedIds.length >= session.sourceQuestionIds.length
  );
}

export function normalizeResumedSession(session, validQuestionIds) {
  const valid = new Set(validQuestionIds || []);
  const completed = unique((session.completedIds || []).filter(id => valid.has(id)));
  const source = unique((session.sourceQuestionIds || []).filter(id => valid.has(id)));
  const completedSet = new Set(completed);

  let currentQuestionId = valid.has(session.currentQuestionId)
    ? session.currentQuestionId
    : null;

  const queue = unique((session.queue || []).filter(id =>
    valid.has(id) &&
    !completedSet.has(id) &&
    id !== currentQuestionId
  ));

  if (!session.answered && currentQuestionId && !completedSet.has(currentQuestionId)) {
    // Keep current unanswered question outside queue; it will be rendered directly.
  } else {
    currentQuestionId = null;
  }

  const scheduled = new Set([...completed, ...queue, ...(currentQuestionId ? [currentQuestionId] : [])]);
  for (const id of source) {
    if (!scheduled.has(id)) queue.push(id);
  }

  return {
    ...session,
    sourceQuestionIds: source,
    completedIds: completed,
    queue,
    currentQuestionId,
    answered: currentQuestionId ? false : Boolean(session.answered),
    finishedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function unique(values) {
  return [...new Set(values)];
}

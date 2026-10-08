import { deleteRecord, getAllByIndex, getRecord, putRecord } from '../db.js';
import { learningKey } from '../../utils/ids.js';
import { getAttemptsByQuestion } from './attempts.js';
import { reduceQuestionProgress } from '../../learning/derived-state.js';

export async function recordQuestionResult(bankId, questionId, correct) {
  const key = learningKey(bankId, questionId);
  const existing = (await getRecord('progress', key)) || {
    key,
    bankId,
    questionId,
    attempts: 0,
    correctCount: 0,
    wrongCount: 0,
    unansweredCount: 0,
  };

  const now = new Date().toISOString();
  const outcome = correct ? 'correct' : 'wrong';
  const next = {
    ...existing,
    attempts: (existing.attempts || 0) + 1,
    correctCount: (existing.correctCount || 0) + (correct ? 1 : 0),
    wrongCount: (existing.wrongCount || 0) + (correct ? 0 : 1),
    unansweredCount: existing.unansweredCount || 0,
    lastResult: outcome,
    lastOutcome: outcome,
    lastAnsweredAt: now,
    ...(correct ? { lastCorrectAt: now } : { lastWrongAt: now }),
  };

  await putRecord('progress', next);
  return next;
}

export async function rebuildQuestionProgress(bankId, questionId, attempts = null) {
  const rows = attempts || await getAttemptsByQuestion(bankId, questionId);
  const record = reduceQuestionProgress(rows, { bankId, questionId });
  const key = learningKey(bankId, questionId);
  if (!record) {
    await deleteRecord('progress', key);
    return null;
  }
  await putRecord('progress', record);
  return record;
}

export function getQuestionProgress(bankId, questionId) {
  return getRecord('progress', learningKey(bankId, questionId));
}

export function listQuestionProgress(bankId) {
  return getAllByIndex('progress', 'bankId', bankId);
}

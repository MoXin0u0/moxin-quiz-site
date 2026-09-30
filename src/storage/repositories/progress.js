import { getAllByIndex, getRecord, putRecord } from '../db.js';
import { learningKey } from '../../utils/ids.js';

export async function recordQuestionResult(bankId, questionId, correct) {
  const key = learningKey(bankId, questionId);
  const existing = (await getRecord('progress', key)) || {
    key,
    bankId,
    questionId,
    attempts: 0,
    correctCount: 0,
    wrongCount: 0,
  };

  const now = new Date().toISOString();
  const next = {
    ...existing,
    attempts: (existing.attempts || 0) + 1,
    correctCount: (existing.correctCount || 0) + (correct ? 1 : 0),
    wrongCount: (existing.wrongCount || 0) + (correct ? 0 : 1),
    lastResult: correct ? 'correct' : 'wrong',
    lastAnsweredAt: now,
    ...(correct ? { lastCorrectAt: now } : { lastWrongAt: now }),
  };

  await putRecord('progress', next);
  return next;
}

export function getQuestionProgress(bankId, questionId) {
  return getRecord('progress', learningKey(bankId, questionId));
}

export function listQuestionProgress(bankId) {
  return getAllByIndex('progress', 'bankId', bankId);
}

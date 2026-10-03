import { getAllRecords, openDatabase, requestToPromise, transactionDone } from '../db.js';
import { questionKey } from '../../utils/ids.js';

export async function addAttempt({ bankId, questionId, selectedAnswer, correct, responseTime, mode }) {
  const db = await openDatabase();
  const tx = db.transaction('attempts', 'readwrite');
  const done = transactionDone(tx);
  const record = {
    bankId,
    questionId,
    questionKey: questionKey(bankId, questionId),
    timestamp: new Date().toISOString(),
    selectedAnswer,
    correct: Boolean(correct),
    responseTime: Number.isFinite(responseTime) ? responseTime : null,
    mode: mode || 'practice',
  };
  const id = await requestToPromise(tx.objectStore('attempts').add(record));
  await done;
  return { ...record, id };
}

export async function getAttemptsByBank(bankId) {
  const db = await openDatabase();
  const tx = db.transaction('attempts', 'readonly');
  return (await requestToPromise(tx.objectStore('attempts').index('bankId').getAll(IDBKeyRange.only(bankId)))) ?? [];
}

export async function getAttemptsByQuestion(bankId, questionId) {
  const db = await openDatabase();
  const tx = db.transaction('attempts', 'readonly');
  return (await requestToPromise(tx.objectStore('attempts').index('questionKey').getAll(IDBKeyRange.only(questionKey(bankId, questionId))))) ?? [];
}


export function listAllAttempts() {
  return getAllRecords('attempts');
}

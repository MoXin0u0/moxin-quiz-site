import { deleteRecord, getAllByIndex, getRecord, putRecord } from '../db.js';
import { createSessionId } from '../../utils/ids.js';

export async function saveSession(session) {
  const now = new Date().toISOString();
  const record = {
    ...session,
    id: session.id || createSessionId(),
    createdAt: session.createdAt || now,
    updatedAt: now,
  };
  await putRecord('sessions', record);
  return record;
}

export function getSession(sessionId) {
  return getRecord('sessions', sessionId);
}

export function listSessionsForBank(bankId) {
  return getAllByIndex('sessions', 'bankId', bankId);
}

export async function getLatestUnfinishedSessionForBank(bankId) {
  const sessions = await listSessionsForBank(bankId);
  return sessions
    .filter(session => isUnfinished(session))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null;
}

export function deleteSession(sessionId) {
  return deleteRecord('sessions', sessionId);
}

function isUnfinished(session) {
  if (!session || session.finishedAt) return false;
  const source = Array.isArray(session.sourceQuestionIds) ? session.sourceQuestionIds : [];
  const completed = new Set(Array.isArray(session.completedIds) ? session.completedIds : []);
  return source.some(id => !completed.has(id));
}

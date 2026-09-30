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

export function deleteSession(sessionId) {
  return deleteRecord('sessions', sessionId);
}

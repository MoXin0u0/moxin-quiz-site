import { deleteRecord, getAllByIndex, getAllRecords, getRecord } from '../db.js';
import { createSessionId } from '../../utils/ids.js';
import { runReadwriteTransaction } from '../transactions/transaction-utils.js';
import { createRevisionMutationInTransaction } from '../transactions/sync-mutation.js';

export async function saveSession(session) {
  const now = new Date();
  const id = session.id || createSessionId();

  return runReadwriteTransaction([
    'sessions',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
  ], async ({ store, request, tx }) => {
    const existing = await request(store('sessions').get(id));
    const sessionType = session.sessionType || (session.mode === 'exam' ? 'exam' : 'practice');
    const entityType = sessionType === 'exam' ? 'exam-session' : 'practice-session';
    const status = session.status || (
      session.submittedAt
        ? 'submitted'
        : session.finishedAt
          ? 'finished'
          : session.abandonedAt
            ? 'abandoned'
            : 'active'
    );

    const { revision } = await createRevisionMutationInTransaction(tx, {
      entityType,
      entityKey: id,
      previousRevision: existing?.revision || session.revision || null,
      operation: 'upsert',
      coalesceKey: `${entityType}:${id}`,
      now,
    });

    const record = {
      ...(existing || {}),
      ...session,
      id,
      sessionType,
      status,
      createdAt: existing?.createdAt || session.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
      revision,
    };
    store('sessions').put(record);
    return record;
  });
}

export function getSession(sessionId) {
  return getRecord('sessions', sessionId);
}

export function listSessionsForBank(bankId) {
  return getAllByIndex('sessions', 'bankId', bankId);
}

export function listAllSessions() {
  return getAllRecords('sessions');
}

export async function getLatestUnfinishedPracticeSession({ bankIds = null } = {}) {
  const sessions = await listAllSessions();
  const allowed = Array.isArray(bankIds)
    ? new Set(bankIds.map(String))
    : null;

  return sessions
    .filter(session =>
      isUnfinishedPractice(session) &&
      (!allowed || allowed.has(String(session.bankId || '')))
    )
    .sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    )[0] || null;
}

export async function getLatestUnfinishedSessionForBank(bankId) {
  const sessions = await listSessionsForBank(bankId);
  return sessions
    .filter(session => isUnfinishedPractice(session))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null;
}

export async function getLatestUnfinishedExamForBank(bankId) {
  const sessions = await listSessionsForBank(bankId);
  return sessions
    .filter(session => isUnfinishedExam(session))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null;
}

export function deleteSession(sessionId) {
  return deleteRecord('sessions', sessionId);
}

function isUnfinishedPractice(session) {
  if (!session || session.finishedAt || session.submittedAt) return false;
  if (session.sessionType === 'exam' || session.mode === 'exam') return false;
  const source = Array.isArray(session.sourceQuestionIds) ? session.sourceQuestionIds : [];
  const completed = new Set(Array.isArray(session.completedIds) ? session.completedIds : []);
  return source.some(id => !completed.has(id));
}

function isUnfinishedExam(session) {
  if (!session || session.finishedAt || session.submittedAt) return false;
  if (session.sessionType !== 'exam' && session.mode !== 'exam') return false;
  return Array.isArray(session.questionIds) && session.questionIds.length > 0;
}

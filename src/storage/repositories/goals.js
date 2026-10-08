import {
  getAllRecords,
  getRecord,
} from '../db.js';
import { createUuid } from '../../utils/ids.js';
import { runReadwriteTransaction } from '../transactions/transaction-utils.js';
import {
  attachMutationPayloadInTransaction,
  createRevisionMutationInTransaction,
  getLatestTombstoneRevisionInTransaction,
} from '../transactions/sync-mutation.js';

export const GLOBAL_GOAL_ID = 'global';

export function normalizeLearningGoal(input = {}, now = new Date()) {
  const source = input && typeof input === 'object' ? input : {};
  const id = String(source.id || GLOBAL_GOAL_ID);
  const examDate = normalizeOptionalDate(source.examDate);
  const examDateKey = source.examDateKey
    ? String(source.examDateKey).slice(0, 10)
    : examDate
      ? examDate.slice(0, 10)
      : null;

  return {
    id,
    bankId: source.bankId ? String(source.bankId) : null,
    enabled: source.enabled === true,
    dailyPracticeTarget: clampInteger(source.dailyPracticeTarget, 0, 10000),
    dailyReviewTarget: clampInteger(source.dailyReviewTarget, 0, 10000),
    examDate,
    examDateKey,
    examLabel: String(source.examLabel || '').trim(),
    sprintEnabled: source.sprintEnabled === true,
    sprintBankIds: normalizeStringArray(source.sprintBankIds),
    sprintDailyTarget: clampInteger(source.sprintDailyTarget, 0, 10000),
    createdAt: normalizeDateString(source.createdAt, now),
    updatedAt: normalizeDateString(source.updatedAt, now),
  };
}

export async function saveLearningGoal(input) {
  const id = String(input?.id || GLOBAL_GOAL_ID);
  const now = new Date();

  return runReadwriteTransaction([
    'learningGoals',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
    'syncTombstones',
  ], async ({ store, request, tx }) => {
    const existing = await request(store('learningGoals').get(id));
    const tombstoneRevision = existing
      ? null
      : await getLatestTombstoneRevisionInTransaction(tx, {
          entityType: 'learning-goal',
          entityKey: id,
        });
    const goal = normalizeLearningGoal({
      ...existing,
      ...input,
      id,
      createdAt: existing?.createdAt || input?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
    }, now);

    const { revision, mutation } = await createRevisionMutationInTransaction(tx, {
      entityType: 'learning-goal',
      entityKey: id,
      previousRevision: existing?.revision || tombstoneRevision || null,
      operation: 'upsert',
      coalesceKey: `learning-goal:${id}`,
      now,
    });

    const record = { ...goal, revision };
    store('learningGoals').put(record);
    attachMutationPayloadInTransaction(tx, mutation, record);
    return record;
  });
}

export function getLearningGoal(id = GLOBAL_GOAL_ID) {
  return getRecord('learningGoals', String(id));
}

export async function listLearningGoals() {
  const goals = await getAllRecords('learningGoals');
  return (goals || []).sort(
    (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
  );
}

export async function deleteLearningGoal(id = GLOBAL_GOAL_ID) {
  const key = String(id);
  const now = new Date();

  return runReadwriteTransaction([
    'learningGoals',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
    'syncTombstones',
  ], async ({ store, request, tx }) => {
    const existing = await request(store('learningGoals').get(key));
    if (!existing) return false;

    const { revision, mutation } = await createRevisionMutationInTransaction(tx, {
      entityType: 'learning-goal',
      entityKey: key,
      previousRevision: existing.revision || null,
      operation: 'delete',
      coalesceKey: `learning-goal:${key}`,
      now,
    });

    const tombstone = {
      tombstoneId: createUuid('tombstone'),
      entityType: 'learning-goal',
      entityKey: key,
      deletedAt: now.toISOString(),
      revision,
    };
    store('learningGoals').delete(key);
    store('syncTombstones').put(tombstone);
    attachMutationPayloadInTransaction(tx, mutation, tombstone);
    return true;
  });
}

function clampInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeStringArray(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const item = String(value || '').trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function normalizeOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeDateString(value, fallback) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

import {
  deleteRecord,
  getAllRecords,
  getRecord,
  putRecord,
} from '../db.js';

export const GLOBAL_GOAL_ID = 'global';

export function normalizeLearningGoal(input = {}, now = new Date()) {
  const source = input && typeof input === 'object' ? input : {};
  const id = String(source.id || GLOBAL_GOAL_ID);

  return {
    id,
    bankId: source.bankId ? String(source.bankId) : null,
    enabled: source.enabled === true,
    dailyPracticeTarget: clampInteger(source.dailyPracticeTarget, 0, 10000),
    dailyReviewTarget: clampInteger(source.dailyReviewTarget, 0, 10000),
    examDate: normalizeOptionalDate(source.examDate),
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
  const existing = await getRecord('learningGoals', id);
  const now = new Date();
  const goal = normalizeLearningGoal({
    ...existing,
    ...input,
    id,
    createdAt: existing?.createdAt || input?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  }, now);

  await putRecord('learningGoals', goal);
  return goal;
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

export function deleteLearningGoal(id = GLOBAL_GOAL_ID) {
  return deleteRecord('learningGoals', String(id));
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

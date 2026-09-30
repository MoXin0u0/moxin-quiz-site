import { getAllRecords, getRecord, putRecord } from '../db.js';
import { learningKey } from '../../utils/ids.js';
import { calculateNextReview, isReviewDue } from '../../quiz/review-engine.js';

export async function updateReviewScheduleFromResult(bankId, questionId, correct, now = new Date()) {
  const key = learningKey(bankId, questionId);
  const existing = await getRecord('reviewSchedule', key);
  const next = calculateNextReview(existing, correct, now);

  const record = {
    ...existing,
    ...next,
    key,
    bankId,
    questionId,
    updatedAt: now.toISOString(),
  };

  await putRecord('reviewSchedule', record);
  return record;
}

export async function listReviewSchedules(bankId = null) {
  const all = await getAllRecords('reviewSchedule');
  if (!bankId) return all;
  return all.filter(record => record.bankId === bankId);
}

export async function listDueReviews(bankId = null, now = new Date()) {
  const records = await listReviewSchedules(bankId);
  return records
    .filter(record => isReviewDue(record, now))
    .sort((a, b) => String(a.dueAt || '').localeCompare(String(b.dueAt || '')));
}

import { deleteRecord, getAllByIndex, getRecord, putRecord } from '../db.js';
import { learningKey } from '../../utils/ids.js';

export function setFavorite(bankId, questionId, favorite = true) {
  const key = learningKey(bankId, questionId);
  if (!favorite) return deleteRecord('favorites', key);
  return putRecord('favorites', {
    key,
    bankId,
    questionId,
    addedAt: new Date().toISOString(),
  });
}

export function getFavorite(bankId, questionId) {
  return getRecord('favorites', learningKey(bankId, questionId));
}

export function listFavorites(bankId) {
  return getAllByIndex('favorites', 'bankId', bankId);
}

export function saveNote(bankId, questionId, text) {
  const key = learningKey(bankId, questionId);
  const normalized = String(text ?? '');
  if (!normalized.trim()) return deleteRecord('notes', key);
  return putRecord('notes', {
    key,
    bankId,
    questionId,
    text: normalized,
    updatedAt: new Date().toISOString(),
  });
}

export function getNote(bankId, questionId) {
  return getRecord('notes', learningKey(bankId, questionId));
}

export function listNotes(bankId) {
  return getAllByIndex('notes', 'bankId', bankId);
}

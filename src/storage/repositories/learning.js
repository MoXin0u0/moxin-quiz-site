import { getAllByIndex, getRecord } from '../db.js';
import { learningKey, createUuid } from '../../utils/ids.js';
import { runReadwriteTransaction } from '../transactions/transaction-utils.js';
import { createRevisionMutationInTransaction } from '../transactions/sync-mutation.js';

export async function setFavorite(bankId, questionId, favorite = true) {
  const key = learningKey(bankId, questionId);
  const now = new Date();

  return runReadwriteTransaction([
    'favorites',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
  ], async ({ store, request, tx }) => {
    const existing = await request(store('favorites').get(key));
    const firstAddedAt = existing?.firstAddedAt || existing?.addedAt || (favorite ? now.toISOString() : null);

    const { revision } = await createRevisionMutationInTransaction(tx, {
      entityType: 'favorite',
      entityKey: key,
      previousRevision: existing?.revision || null,
      operation: 'upsert',
      coalesceKey: `favorite:${key}`,
      now,
    });

    const record = {
      ...(existing || {}),
      key,
      bankId,
      questionId,
      isFavorite: Boolean(favorite),
      firstAddedAt,
      addedAt: firstAddedAt,
      changedAt: now.toISOString(),
      revision,
    };
    store('favorites').put(record);
    return record;
  });
}

export async function getFavorite(bankId, questionId) {
  const record = await getRecord('favorites', learningKey(bankId, questionId));
  return record?.isFavorite === false ? null : record;
}

export async function listFavorites(bankId) {
  const records = await getAllByIndex('favorites', 'bankId', bankId);
  return records.filter(record => record?.isFavorite !== false);
}

export async function setUnfamiliar(bankId, questionId, unfamiliar = true) {
  const key = learningKey(bankId, questionId);
  const now = new Date();

  return runReadwriteTransaction([
    'mastery',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
  ], async ({ store, request, tx }) => {
    const existing = await request(store('mastery').get(key));
    const firstMarkedAt = existing?.firstMarkedAt || existing?.markedAt || (unfamiliar ? now.toISOString() : null);

    const { revision } = await createRevisionMutationInTransaction(tx, {
      entityType: 'unfamiliar',
      entityKey: key,
      previousRevision: existing?.revision || null,
      operation: 'upsert',
      coalesceKey: `unfamiliar:${key}`,
      now,
    });

    const record = {
      ...(existing || {}),
      key,
      bankId,
      questionId,
      isUnfamiliar: Boolean(unfamiliar),
      status: unfamiliar ? 'unfamiliar' : 'familiar',
      firstMarkedAt,
      markedAt: firstMarkedAt,
      changedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      revision,
    };
    store('mastery').put(record);
    return record;
  });
}

export async function getUnfamiliar(bankId, questionId) {
  const record = await getRecord('mastery', learningKey(bankId, questionId));
  return record?.isUnfamiliar === false || record?.status === 'familiar'
    ? null
    : record;
}

export async function listUnfamiliar(bankId) {
  const records = await getAllByIndex('mastery', 'bankId', bankId);
  return records.filter(record =>
    record?.isUnfamiliar !== false &&
    record?.status !== 'familiar'
  );
}

export async function saveNote(bankId, questionId, text) {
  const key = learningKey(bankId, questionId);
  const normalized = String(text ?? '');
  const now = new Date();

  return runReadwriteTransaction([
    'notes',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
    'syncTombstones',
  ], async ({ store, request, tx }) => {
    const existing = await request(store('notes').get(key));

    if (!normalized.trim()) {
      if (!existing) return null;

      const { revision } = await createRevisionMutationInTransaction(tx, {
        entityType: 'note',
        entityKey: key,
        previousRevision: existing.revision || null,
        operation: 'delete',
        coalesceKey: `note:${key}`,
        now,
      });

      store('notes').delete(key);
      store('syncTombstones').put({
        tombstoneId: createUuid('tombstone'),
        entityType: 'note',
        entityKey: key,
        deletedAt: now.toISOString(),
        revision,
      });
      return null;
    }

    const { revision } = await createRevisionMutationInTransaction(tx, {
      entityType: 'note',
      entityKey: key,
      previousRevision: existing?.revision || null,
      operation: 'upsert',
      coalesceKey: `note:${key}`,
      now,
    });

    const record = {
      ...(existing || {}),
      key,
      bankId,
      questionId,
      text: normalized,
      createdAt: existing?.createdAt || existing?.updatedAt || now.toISOString(),
      updatedAt: now.toISOString(),
      revision,
    };
    store('notes').put(record);
    return record;
  });
}

export function getNote(bankId, questionId) {
  return getRecord('notes', learningKey(bankId, questionId));
}

export function listNotes(bankId) {
  return getAllByIndex('notes', 'bankId', bankId);
}

import { getAllByIndex, getAllRecords, getRecord, putRecord } from '../db.js';

export function getSyncTombstone(tombstoneId) {
  return getRecord('syncTombstones', String(tombstoneId));
}

export function listSyncTombstones() {
  return getAllRecords('syncTombstones');
}

export function listSyncTombstonesForEntity(entityKey) {
  return getAllByIndex('syncTombstones', 'entityKey', String(entityKey));
}

export async function saveSyncTombstone(tombstone) {
  if (!tombstone?.tombstoneId) throw new Error('sync tombstone requires tombstoneId.');
  if (!tombstone?.entityType || !tombstone?.entityKey) {
    throw new Error('sync tombstone requires entityType and entityKey.');
  }
  await putRecord('syncTombstones', tombstone);
  return tombstone;
}

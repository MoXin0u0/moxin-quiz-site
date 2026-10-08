import { getAllByIndex, getAllRecords, getRecord, putRecord } from '../db.js';

export function getSyncConflict(conflictId) {
  return getRecord('syncConflicts', String(conflictId));
}

export function listSyncConflicts() {
  return getAllRecords('syncConflicts');
}

export function listOpenSyncConflicts() {
  return getAllByIndex('syncConflicts', 'status', 'open');
}

export async function saveSyncConflict(conflict) {
  if (!conflict?.conflictId) throw new Error('sync conflict requires conflictId.');
  await putRecord('syncConflicts', conflict);
  return conflict;
}

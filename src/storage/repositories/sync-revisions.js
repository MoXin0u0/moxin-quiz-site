import { getAllByIndex, getRecord, putRecord } from '../db.js';

export function getSyncRevision(revisionId) {
  return getRecord('syncRevisions', String(revisionId));
}

export function listSyncRevisionsForEntity(entityKey) {
  return getAllByIndex('syncRevisions', 'entityKey', String(entityKey));
}

export async function saveSyncRevision(revision) {
  if (!revision?.revisionId) throw new Error('sync revision requires revisionId.');
  if (!revision?.entityType || !revision?.entityKey) {
    throw new Error('sync revision requires entityType and entityKey.');
  }
  await putRecord('syncRevisions', revision);
  return revision;
}

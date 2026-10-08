import { getAllRecords, getRecord, putRecord } from '../db.js';

export function getSyncReceipt(commitId) {
  return getRecord('syncReceipts', String(commitId));
}

export function listSyncReceipts() {
  return getAllRecords('syncReceipts');
}

export async function saveSyncReceipt(receipt) {
  if (!receipt?.commitId) throw new Error('sync receipt requires commitId.');
  await putRecord('syncReceipts', receipt);
  return receipt;
}

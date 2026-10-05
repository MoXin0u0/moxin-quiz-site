import { getRecord, putRecord } from '../db.js';

export const SYNC_META_KEY = 'global';

export function getSyncMeta() {
  return getRecord('syncMeta', SYNC_META_KEY);
}

export async function saveSyncMeta(meta) {
  if (!meta || meta.key !== SYNC_META_KEY) {
    throw new Error('sync meta must use key "global".');
  }
  await putRecord('syncMeta', meta);
  return meta;
}

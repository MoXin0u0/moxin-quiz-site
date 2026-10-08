import { APP_CONFIG } from '../app/config.js';

export const SYNC_RUNTIME_STATE = Object.freeze({
  LOCAL_ONLY: 'LOCAL_ONLY',
  SYNCED: 'SYNCED',
  PENDING: 'PENDING',
  SYNCING: 'SYNCING',
  OFFLINE: 'OFFLINE',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  CONFLICT: 'CONFLICT',
  ERROR: 'ERROR',
});

export function getSyncLimits() {
  return APP_CONFIG.syncLimits;
}

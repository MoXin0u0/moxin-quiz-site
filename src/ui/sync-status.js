import { APP_CONFIG } from '../app/config.js';
import {
  openDatabase,
  requestToPromise,
} from '../storage/db.js';
import { getLastFullBackupAt } from '../storage/backup-meta.js';
import { buildLocalSyncInventory } from '../sync/reconciliation.js';

export const SYNC_STATE_PRESENTATION = Object.freeze({
  LOCAL_ONLY: Object.freeze({
    label: '● 僅此裝置',
    shortLabel: '僅此裝置',
    tone: 'neutral',
    description: '目前資料只保存在這個裝置；不登入也能完整使用核心學習功能。',
  }),
  SYNCED: Object.freeze({
    label: '✓ 已同步',
    shortLabel: '已同步',
    tone: 'success',
    description: '本機與雲端目前沒有待處理的同步項目。',
  }),
  PENDING: Object.freeze({
    label: '↑ 等待同步',
    shortLabel: '等待同步',
    tone: 'pending',
    description: '本機已有變更，會在同步可用時安全送出。',
  }),
  SYNCING: Object.freeze({
    label: '↕ 正在同步',
    shortLabel: '正在同步',
    tone: 'active',
    description: '正在執行 Pull → Merge → Push，同步期間仍以本機資料為主。',
  }),
  OFFLINE: Object.freeze({
    label: '◌ 離線使用中',
    shortLabel: '離線使用中',
    tone: 'offline',
    description: '目前沒有網路；本機資料仍可正常使用，恢復連線後再同步。',
  }),
  AUTH_REQUIRED: Object.freeze({
    label: '! 請重新連結 Google',
    shortLabel: '請重新連結',
    tone: 'warning',
    description: 'Google 授權已失效或尚未完成；本機資料不受影響。',
  }),
  CONFLICT: Object.freeze({
    label: '! 需要處理',
    shortLabel: '需要處理',
    tone: 'warning',
    description: '有同步衝突需要你選擇版本；處理前不會自動推送衝突資料。',
  }),
  ERROR: Object.freeze({
    label: '× 同步失敗',
    shortLabel: '同步失敗',
    tone: 'danger',
    description: '同步流程發生錯誤；本機資料仍保留，可稍後再試。',
  }),
});

export async function getSyncStatusSnapshot({
  includeInventory = false,
} = {}) {
  const db = await openDatabase();
  const tx = db.transaction(
    ['syncMeta', 'syncOutbox', 'syncConflicts', 'devices'],
    'readonly',
  );
  const [meta, pendingCount, conflicts, devices] = await Promise.all([
    requestToPromise(tx.objectStore('syncMeta').get('global')),
    requestToPromise(tx.objectStore('syncOutbox').count()),
    requestToPromise(
      tx.objectStore('syncConflicts')
        .index('status')
        .getAll(IDBKeyRange.only('open')),
    ),
    requestToPromise(tx.objectStore('devices').getAll()),
  ]);

  const runtimeState = normalizeRuntimeState(meta?.runtimeState);
  const presentation = getSyncStatePresentation(runtimeState);
  const linkedProfileId = meta?.linkedProfileId || null;
  const cloudConfigured = Boolean(
    APP_CONFIG.cloud.googleClientId &&
    APP_CONFIG.cloud.googleDriveScope,
  );
  const activeReconciliation =
    meta?.accountSwitch?.phase &&
    meta.accountSwitch.phase !== 'completed'
      ? meta.accountSwitch
      : meta?.reconciliation || null;

  let localInventory = null;
  if (includeInventory) {
    localInventory = await buildLocalSyncInventory();
  }

  return {
    runtimeState,
    presentation,
    syncUiEnabled: APP_CONFIG.features.syncUi === true,
    cloudRuntimeEnabled: APP_CONFIG.features.cloudSync === true,
    cloudConfigured,
    linkedProfileId,
    connected: Boolean(linkedProfileId),
    account: normalizeAccount(meta?.cloudAccount),
    lastSuccessfulSyncAt: meta?.lastSuccessfulSyncAt || null,
    lastSyncAttemptAt: meta?.lastSyncAttemptAt || null,
    pendingCount: Math.max(0, Number(pendingCount) || 0),
    conflicts: Array.isArray(conflicts) ? conflicts : [],
    conflictCount: Array.isArray(conflicts) ? conflicts.length : 0,
    devices: (devices || [])
      .filter(item => item?.deviceId)
      .map(item => ({
        ...item,
        isCurrent: String(item.deviceId) === String(meta?.deviceId || ''),
      }))
      .sort((left, right) => (
        Number(right.isCurrent) - Number(left.isCurrent) ||
        String(right.lastSeenAt || '').localeCompare(String(left.lastSeenAt || '')) ||
        String(left.deviceId).localeCompare(String(right.deviceId))
      )),
    currentDeviceId: meta?.deviceId || null,
    checkpoint: {
      lastCheckpointId: meta?.lastCheckpointId || null,
      lastCheckpointCreatedAt: meta?.lastCheckpointCreatedAt || null,
      lastCheckpointError: meta?.lastCheckpointError || null,
    },
    retry: meta?.syncRetry || null,
    blockReason: meta?.blockReason || null,
    reconciliation: meta?.reconciliation || null,
    accountSwitch: meta?.accountSwitch || null,
    localInventory,
    cloudInventory: {
      known: Boolean(activeReconciliation),
      fileCount: Math.max(
        0,
        Number(activeReconciliation?.remoteFileCount) || 0,
      ),
      plan: activeReconciliation?.plan || null,
      phase: activeReconciliation?.phase || null,
      inventoryHash: activeReconciliation?.remoteInventoryHash || null,
    },
    lastFullBackupAt: getLastFullBackupAt(),
  };
}

export function getSyncCenterSnapshot() {
  return getSyncStatusSnapshot({ includeInventory: true });
}

export function getSyncStatePresentation(runtimeState) {
  return (
    SYNC_STATE_PRESENTATION[normalizeRuntimeState(runtimeState)] ||
    SYNC_STATE_PRESENTATION.LOCAL_ONLY
  );
}

export function normalizeRuntimeState(value) {
  const state = String(value || 'LOCAL_ONLY').toUpperCase();
  return Object.hasOwn(SYNC_STATE_PRESENTATION, state)
    ? state
    : 'LOCAL_ONLY';
}

function normalizeAccount(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    provider: value.provider || 'google',
    providerSubject: value.providerSubject || null,
    displayName: value.displayName || null,
    displayEmail: value.displayEmail || null,
    photoUrl: value.photoUrl || null,
  };
}

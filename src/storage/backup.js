import { APP_CONFIG } from '../app/config.js';
import { createDeviceId, createRevisionId } from '../utils/ids.js';
import { openDatabase, transactionDone } from './db.js';
import { loadSettings, normalizeSettings, saveSettings } from './settings.js';

export const BACKUP_FORMAT = 'moxin-quiz-backup';
export const BACKUP_VERSION = 2;
export const LEGACY_BACKUP_VERSION = 1;
export const MAX_BACKUP_FILE_BYTES = 400 * 1024 * 1024;

export const BACKUP_STORE_NAMES = Object.freeze([
  'banks',
  'questions',
  'assets',
  'attempts',
  'progress',
  'favorites',
  'notes',
  'mastery',
  'reviewSchedule',
  'sessions',
  'studioDrafts',
  'learningGoals',
  'accountSettings',
  'authorLibrary',
  'syncRevisions',
  'syncConflicts',
  'syncTombstones',
]);

const V1_STORE_NAMES = Object.freeze([
  'banks',
  'questions',
  'assets',
  'attempts',
  'progress',
  'favorites',
  'notes',
  'mastery',
  'reviewSchedule',
  'sessions',
  'studioDrafts',
  'learningGoals',
]);

const DERIVED_STORES = Object.freeze([
  'bankRegistry',
]);

const OPERATIONAL_STORES = Object.freeze([
  'devices',
  'syncMeta',
  'syncOutbox',
  'syncReceipts',
  'cloudObjects',
]);

export async function createBackupSnapshot() {
  const db = await openDatabase();
  const stores = {};

  for (const storeName of BACKUP_STORE_NAMES) {
    if (!db.objectStoreNames.contains(storeName)) {
      stores[storeName] = [];
      continue;
    }
    const records = await readAll(db, storeName);
    stores[storeName] = await Promise.all(records.map(record => serializeValue(record)));
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: {
      name: APP_CONFIG.appName,
      appVersion: APP_CONFIG.appVersion,
      questionBankSchemaVersion: APP_CONFIG.schemaVersion,
      dbName: APP_CONFIG.dbName,
      dbVersion: APP_CONFIG.dbVersion,
      backupVersion: BACKUP_VERSION,
    },
    deviceSettings: normalizeSettings(loadSettings()),
    stores,
  };
}

export function validateBackupSnapshot(snapshot) {
  const errors = [];
  const warnings = [];

  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    errors.push('備份根節點必須是物件。');
    return { valid: false, errors, warnings };
  }

  if (snapshot.format !== BACKUP_FORMAT) {
    errors.push(`不是 ${BACKUP_FORMAT} 格式。`);
  }

  if (![LEGACY_BACKUP_VERSION, BACKUP_VERSION].includes(snapshot.version)) {
    errors.push(`不支援備份格式版本 ${snapshot.version ?? '未知'}；目前可讀取版本 1 與 2。`);
  }

  if (!snapshot.stores || typeof snapshot.stores !== 'object' || Array.isArray(snapshot.stores)) {
    errors.push('備份缺少 stores。');
  }

  const expectedStores = snapshot.version === LEGACY_BACKUP_VERSION
    ? V1_STORE_NAMES
    : BACKUP_STORE_NAMES;

  if (snapshot.stores && typeof snapshot.stores === 'object') {
    for (const storeName of expectedStores) {
      if (snapshot.stores[storeName] !== undefined && !Array.isArray(snapshot.stores[storeName])) {
        errors.push(`stores.${storeName} 必須是陣列。`);
      }
    }
  }

  if (snapshot.version === LEGACY_BACKUP_VERSION) {
    warnings.push('這是 V4 Backup v1；還原後會執行 V5 deterministic migration。');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export async function restoreBackupSnapshot(snapshot, { replace = true } = {}) {
  const validation = validateBackupSnapshot(snapshot);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const sourceStoreNames = snapshot.version === LEGACY_BACKUP_VERSION
    ? V1_STORE_NAMES
    : BACKUP_STORE_NAMES;

  const decodedStores = {};
  for (const storeName of sourceStoreNames) {
    const source = snapshot.stores?.[storeName] || [];
    decodedStores[storeName] = await Promise.all(source.map(record => deserializeValue(record)));
  }

  const db = await openDatabase();
  const restoreStores = BACKUP_STORE_NAMES.filter(name => db.objectStoreNames.contains(name));
  const resetStores = [...DERIVED_STORES, ...OPERATIONAL_STORES]
    .filter(name => db.objectStoreNames.contains(name));
  const transactionStores = [...new Set([...restoreStores, ...resetStores])];
  const tx = db.transaction(transactionStores, 'readwrite');
  const done = transactionDone(tx);

  for (const storeName of restoreStores) {
    const store = tx.objectStore(storeName);
    if (replace) store.clear();

    for (const record of decodedStores[storeName] || []) {
      store.put(record);
    }
  }

  for (const storeName of resetStores) {
    tx.objectStore(storeName).clear();
  }

  const deviceId = createDeviceId();
  const now = new Date().toISOString();
  const deviceRevision = {
    revisionId: createRevisionId(),
    parentRevisionIds: [],
    changedAt: now,
    changedByDeviceId: deviceId,
    clock: {
      physicalMs: Date.now(),
      logical: 0,
      deviceId,
    },
  };

  if (tx.objectStoreNames.contains('devices')) {
    tx.objectStore('devices').put({
      deviceId,
      label: '此裝置',
      platformHint: globalThis.navigator?.platform || null,
      browserHint: globalThis.navigator?.userAgent || null,
      status: 'active',
      createdAt: now,
      lastSeenAt: now,
      lastSyncAt: null,
      appVersion: APP_CONFIG.appVersion,
      revision: deviceRevision,
    });
  }

  if (tx.objectStoreNames.contains('syncRevisions')) {
    tx.objectStore('syncRevisions').put({
      ...deviceRevision,
      entityType: 'device',
      entityKey: deviceId,
    });
  }

  if (tx.objectStoreNames.contains('syncMeta')) {
    tx.objectStore('syncMeta').put({
      key: 'global',
      deviceId,
      linkedProfileId: null,
      cloudSchemaVersion: null,
      nextCommitSequence: 1,
      lastSuccessfulSyncAt: null,
      lastSyncAttemptAt: null,
      lastCheckpointId: null,
      runtimeState: 'LOCAL_ONLY',
      pendingCloudCommit: null,
      clock: {
        physicalMs: Date.now(),
        logical: 0,
      },
      migration: snapshot.version === LEGACY_BACKUP_VERSION
        ? {
            targetDbVersion: APP_CONFIG.dbVersion,
            phase: 'device-identity',
            scope: null,
            cursor: null,
            status: 'pending',
            startedAt: null,
            updatedAt: now,
            lastError: null,
          }
        : {
            targetDbVersion: APP_CONFIG.dbVersion,
            phase: 'completed',
            scope: null,
            cursor: null,
            status: 'completed',
            startedAt: now,
            updatedAt: now,
            lastError: null,
          },
      reconciliation: {
        reconciliationId: createRecoveryId(),
        kind: 'restore',
        phase: 'inventory',
        localInventoryHash: null,
        remoteCheckpointId: null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  await done;

  const deviceSettings = snapshot.deviceSettings || snapshot.settings;
  if (deviceSettings) {
    saveSettings(deviceSettings);
  }

  if (snapshot.version === LEGACY_BACKUP_VERSION) {
    const { runV5MigrationToCompletion } = await import('./migrations/v5-migration.js');
    await runV5MigrationToCompletion();
  }

  return {
    ...summarizeSnapshot(snapshot),
    restoredFromVersion: snapshot.version,
    newDeviceId: deviceId,
    cloudLinkReset: true,
  };
}

export async function backupSnapshotToBlob(snapshot) {
  const json = JSON.stringify(snapshot);
  return new Blob([json], { type: 'application/json' });
}

export async function readBackupFile(file) {
  if (!file) throw new Error('尚未選擇備份檔。');
  if (file.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error(`備份檔過大；目前上限為 ${Math.round(MAX_BACKUP_FILE_BYTES / 1024 / 1024)} MB。`);
  }

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (error) {
    throw new Error(`備份檔不是合法 JSON：${error.message}`);
  }

  const validation = validateBackupSnapshot(parsed);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return parsed;
}

export function summarizeSnapshot(snapshot) {
  const counts = {};
  let totalRecords = 0;

  const storeNames = snapshot?.version === LEGACY_BACKUP_VERSION
    ? V1_STORE_NAMES
    : BACKUP_STORE_NAMES;

  for (const storeName of storeNames) {
    const count = Array.isArray(snapshot?.stores?.[storeName])
      ? snapshot.stores[storeName].length
      : 0;
    counts[storeName] = count;
    totalRecords += count;
  }

  return {
    version: snapshot?.version ?? null,
    exportedAt: snapshot?.exportedAt || null,
    counts,
    totalRecords,
  };
}

export function createBackupFilename(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `moxin-quiz-backup-${stamp}.json`;
}

async function readAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function serializeValue(value) {
  if (value instanceof Blob) {
    return {
      __moxinType: 'Blob',
      mimeType: value.type || 'application/octet-stream',
      data: bytesToBase64(new Uint8Array(await value.arrayBuffer())),
    };
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map(item => serializeValue(item)));
  }

  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = await serializeValue(item);
    }
    return result;
  }

  return value;
}

async function deserializeValue(value) {
  if (Array.isArray(value)) {
    return Promise.all(value.map(item => deserializeValue(item)));
  }

  if (value && typeof value === 'object') {
    if (value.__moxinType === 'Blob' && typeof value.data === 'string') {
      return new Blob([base64ToBytes(value.data)], {
        type: value.mimeType || 'application/octet-stream',
      });
    }

    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = await deserializeValue(item);
    }
    return result;
  }

  return value;
}

function createRecoveryId() {
  if (globalThis.crypto?.randomUUID) return `restore-${crypto.randomUUID()}`;
  return `restore-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function bytesToBase64(bytes) {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

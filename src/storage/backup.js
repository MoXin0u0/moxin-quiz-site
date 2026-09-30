import { APP_CONFIG } from '../app/config.js';
import { openDatabase, transactionDone } from './db.js';
import { loadSettings, normalizeSettings, saveSettings } from './settings.js';

export const BACKUP_FORMAT = 'moxin-quiz-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_FILE_BYTES = 400 * 1024 * 1024;

const STORE_NAMES = Object.freeze([
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
]);

export async function createBackupSnapshot() {
  const db = await openDatabase();
  const stores = {};

  for (const storeName of STORE_NAMES) {
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
      schemaVersion: APP_CONFIG.schemaVersion,
      dbName: APP_CONFIG.dbName,
      dbVersion: APP_CONFIG.dbVersion,
    },
    settings: normalizeSettings(loadSettings()),
    stores,
  };
}

export function validateBackupSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    errors.push('備份根節點必須是物件。');
    return { valid: false, errors };
  }
  if (snapshot.format !== BACKUP_FORMAT) {
    errors.push(`不是 ${BACKUP_FORMAT} 格式。`);
  }
  if (snapshot.version !== BACKUP_VERSION) {
    errors.push(`目前只支援備份格式版本 ${BACKUP_VERSION}。`);
  }
  if (!snapshot.stores || typeof snapshot.stores !== 'object' || Array.isArray(snapshot.stores)) {
    errors.push('備份缺少 stores。');
  }

  if (snapshot.stores && typeof snapshot.stores === 'object') {
    for (const storeName of STORE_NAMES) {
      if (snapshot.stores[storeName] !== undefined && !Array.isArray(snapshot.stores[storeName])) {
        errors.push(`stores.${storeName} 必須是陣列。`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function restoreBackupSnapshot(snapshot, { replace = true } = {}) {
  const validation = validateBackupSnapshot(snapshot);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const decodedStores = {};
  for (const storeName of STORE_NAMES) {
    const source = snapshot.stores?.[storeName] || [];
    decodedStores[storeName] = await Promise.all(source.map(record => deserializeValue(record)));
  }

  const db = await openDatabase();
  const availableStores = STORE_NAMES.filter(name => db.objectStoreNames.contains(name));
  const tx = db.transaction(availableStores, 'readwrite');
  const done = transactionDone(tx);

  for (const storeName of availableStores) {
    const store = tx.objectStore(storeName);
    if (replace) store.clear();
    for (const record of decodedStores[storeName]) {
      store.put(record);
    }
  }

  await done;

  if (snapshot.settings) {
    saveSettings(snapshot.settings);
  }

  return summarizeSnapshot(snapshot);
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

  for (const storeName of STORE_NAMES) {
    const count = Array.isArray(snapshot?.stores?.[storeName])
      ? snapshot.stores[storeName].length
      : 0;
    counts[storeName] = count;
    totalRecords += count;
  }

  return {
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

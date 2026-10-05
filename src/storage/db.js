import { APP_CONFIG } from '../app/config.js';

export const DATABASE_STATE_EVENT = 'moxin:indexeddb-state';

export const STORE_DEFINITIONS = Object.freeze({
  banks: {
    keyPath: 'id',
    indexes: [['updatedAt', 'updatedAt'], ['name', 'name']],
  },
  questions: {
    keyPath: 'key',
    indexes: [['bankId', 'bankId'], ['questionId', 'questionId'], ['chapter', 'chapter']],
  },
  assets: {
    keyPath: 'key',
    indexes: [['bankId', 'bankId'], ['path', 'path'], ['contentHash', 'contentHash']],
  },
  attempts: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      ['bankId', 'bankId'],
      ['questionKey', 'questionKey'],
      ['timestamp', 'timestamp'],
      ['eventId', 'eventId', { unique: true }],
      ['answeredAt', 'answeredAt'],
      ['sessionId', 'sessionId'],
    ],
  },
  progress: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
  favorites: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
  notes: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
  mastery: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
  reviewSchedule: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['dueAt', 'dueAt']] },
  sessions: {
    keyPath: 'id',
    indexes: [
      ['bankId', 'bankId'],
      ['updatedAt', 'updatedAt'],
      ['sessionType', 'sessionType'],
      ['status', 'status'],
    ],
  },
  studioDrafts: {
    keyPath: 'id',
    indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt'], ['status', 'status']],
  },
  learningGoals: {
    keyPath: 'id',
    indexes: [
      ['bankId', 'bankId'],
      ['updatedAt', 'updatedAt'],
      ['examDate', 'examDate'],
      ['examDateKey', 'examDateKey'],
    ],
  },
  accountSettings: {
    keyPath: 'id',
    indexes: [['updatedAt', 'updatedAt']],
  },
  authorLibrary: {
    keyPath: 'bankId',
    indexes: [['inLibrary', 'inLibrary'], ['changedAt', 'changedAt']],
  },
  devices: {
    keyPath: 'deviceId',
    indexes: [['status', 'status'], ['lastSyncAt', 'lastSyncAt'], ['lastSeenAt', 'lastSeenAt']],
  },
  bankRegistry: {
    keyPath: 'bankId',
    indexes: [['sourceType', 'sourceType'], ['availability', 'availability'], ['lastSeenAt', 'lastSeenAt']],
  },
  syncMeta: {
    keyPath: 'key',
    indexes: [],
  },
  syncOutbox: {
    keyPath: 'mutationId',
    indexes: [
      ['status', 'status'],
      ['entityKey', 'entityKey'],
      ['coalesceKey', 'coalesceKey'],
      ['createdAt', 'createdAt'],
    ],
  },
  syncReceipts: {
    keyPath: 'commitId',
    indexes: [
      ['deviceId', 'deviceId'],
      ['deviceSequence', 'deviceSequence'],
      ['appliedAt', 'appliedAt'],
    ],
  },
  syncRevisions: {
    keyPath: 'revisionId',
    indexes: [['entityType', 'entityType'], ['entityKey', 'entityKey'], ['changedAt', 'changedAt']],
  },
  syncConflicts: {
    keyPath: 'conflictId',
    indexes: [
      ['status', 'status'],
      ['entityType', 'entityType'],
      ['entityKey', 'entityKey'],
      ['createdAt', 'createdAt'],
    ],
  },
  syncTombstones: {
    keyPath: 'tombstoneId',
    indexes: [['entityType', 'entityType'], ['entityKey', 'entityKey'], ['deletedAt', 'deletedAt']],
  },
  cloudObjects: {
    keyPath: 'objectKey',
    indexes: [['contentHash', 'contentHash'], ['objectType', 'objectType'], ['logicalId', 'logicalId']],
  },
});

let dbPromise = null;
let databaseRuntimeState = Object.freeze({
  status: 'idle',
  requestedVersion: APP_CONFIG.dbVersion,
  currentVersion: null,
  previousVersion: null,
  blocked: false,
  error: null,
});

function publishDatabaseState(patch) {
  databaseRuntimeState = Object.freeze({
    ...databaseRuntimeState,
    ...patch,
  });

  if (
    typeof globalThis.dispatchEvent === 'function' &&
    typeof globalThis.CustomEvent === 'function'
  ) {
    try {
      globalThis.dispatchEvent(new CustomEvent(DATABASE_STATE_EVENT, {
        detail: databaseRuntimeState,
      }));
    } catch {
      // Diagnostics must never block database access.
    }
  }
}

export function getDatabaseRuntimeState() {
  return { ...databaseRuntimeState };
}

export function openDatabase() {
  if (dbPromise) return dbPromise;

  publishDatabaseState({
    status: 'opening',
    requestedVersion: APP_CONFIG.dbVersion,
    blocked: false,
    error: null,
  });

  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      const error = new Error('This browser does not support IndexedDB.');
      publishDatabaseState({ status: 'error', error: error.message });
      dbPromise = null;
      reject(error);
      return;
    }

    const request = indexedDB.open(APP_CONFIG.dbName, APP_CONFIG.dbVersion);

    request.onupgradeneeded = event => {
      publishDatabaseState({
        status: 'upgrading',
        previousVersion: event.oldVersion,
        currentVersion: event.newVersion,
        blocked: false,
      });

      const db = request.result;
      const tx = request.transaction;
      for (const [storeName, definition] of Object.entries(STORE_DEFINITIONS)) {
        const store = db.objectStoreNames.contains(storeName)
          ? tx.objectStore(storeName)
          : db.createObjectStore(storeName, {
              keyPath: definition.keyPath,
              autoIncrement: definition.autoIncrement === true,
            });

        for (const [indexName, keyPath, options = {}] of definition.indexes || []) {
          if (!store.indexNames.contains(indexName)) {
            store.createIndex(indexName, keyPath, options);
          }
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      publishDatabaseState({
        status: 'open',
        currentVersion: db.version,
        blocked: false,
        error: null,
      });

      db.onversionchange = event => {
        publishDatabaseState({
          status: 'versionchange',
          currentVersion: event.newVersion,
          previousVersion: event.oldVersion,
        });
        db.close();
        dbPromise = null;
      };

      resolve(db);
    };

    request.onerror = () => {
      const error = request.error || new Error('IndexedDB open failed.');
      dbPromise = null;
      publishDatabaseState({
        status: 'error',
        blocked: false,
        error: error.message,
      });
      reject(error);
    };

    request.onblocked = event => {
      publishDatabaseState({
        status: 'blocked',
        previousVersion: event.oldVersion,
        currentVersion: event.newVersion,
        blocked: true,
        error: null,
      });
      console.warn(
        `IndexedDB upgrade to version ${APP_CONFIG.dbVersion} is blocked by another open tab.`
      );
    };
  });

  return dbPromise;
}

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
  });
}

export async function getRecord(storeName, key) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  return (await requestToPromise(tx.objectStore(storeName).get(key))) ?? null;
}

export async function getAllRecords(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  return (await requestToPromise(tx.objectStore(storeName).getAll())) ?? [];
}

export async function getAllByIndex(storeName, indexName, value) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const index = tx.objectStore(storeName).index(indexName);
  return (await requestToPromise(index.getAll(IDBKeyRange.only(value)))) ?? [];
}

export async function putRecord(storeName, value) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const done = transactionDone(tx);
  const result = await requestToPromise(tx.objectStore(storeName).put(value));
  await done;
  return result;
}

export async function deleteRecord(storeName, key) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore(storeName).delete(key);
  await done;
}

export async function clearStore(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore(storeName).clear();
  await done;
}

export async function closeDatabase() {
  if (!dbPromise) {
    publishDatabaseState({ status: 'closed', blocked: false });
    return;
  }

  const db = await dbPromise.catch(() => null);
  db?.close();
  dbPromise = null;
  publishDatabaseState({
    status: 'closed',
    currentVersion: db?.version ?? databaseRuntimeState.currentVersion,
    blocked: false,
  });
}

import { APP_CONFIG } from '../app/config.js';

const STORE_DEFINITIONS = Object.freeze({
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
    indexes: [['bankId', 'bankId'], ['path', 'path']],
  },
  attempts: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: [['bankId', 'bankId'], ['questionKey', 'questionKey'], ['timestamp', 'timestamp']],
  },
  progress: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
  favorites: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
  notes: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
  mastery: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
  reviewSchedule: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['dueAt', 'dueAt']] },
  sessions: { keyPath: 'id', indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt']] },
  studioDrafts: {
    keyPath: 'id',
    indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt'], ['status', 'status']],
  },
  learningGoals: {
    keyPath: 'id',
    indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt'], ['examDate', 'examDate']],
  },
});

let dbPromise = null;

export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('This browser does not support IndexedDB.'));
      return;
    }

    const request = indexedDB.open(APP_CONFIG.dbName, APP_CONFIG.dbVersion);

    request.onupgradeneeded = () => {
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
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      console.warn('IndexedDB upgrade is blocked by another open tab.');
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
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  db?.close();
  dbPromise = null;
}

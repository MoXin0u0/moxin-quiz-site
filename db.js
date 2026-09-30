import { APP_CONFIG } from '../app/config.js';

const STORE_DEFINITIONS = Object.freeze({
  banks: { keyPath: 'id' },
  questions: { keyPath: 'key' },
  assets: { keyPath: 'key' },
  attempts: { keyPath: 'id', autoIncrement: true },
  progress: { keyPath: 'key' },
  favorites: { keyPath: 'key' },
  notes: { keyPath: 'key' },
  mastery: { keyPath: 'key' },
  reviewSchedule: { keyPath: 'key' },
  sessions: { keyPath: 'id' },
});

let dbPromise = null;

export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_CONFIG.dbName, APP_CONFIG.dbVersion);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      for (const [storeName, options] of Object.entries(STORE_DEFINITIONS)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, options);
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('IndexedDB upgrade is blocked by another open tab.');
    };
  });

  return dbPromise;
}

export async function withStore(storeName, mode, callback) {
  const db = await openDatabase();
  if (!db.objectStoreNames.contains(storeName)) {
    throw new Error(`Unknown IndexedDB store: ${storeName}`);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let callbackResult;

    try {
      callbackResult = callback(store, tx);
    } catch (error) {
      tx.abort();
      reject(error);
      return;
    }

    tx.oncomplete = () => resolve(callbackResult);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

export async function getRecord(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function putRecord(storeName, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecord(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllRecords(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

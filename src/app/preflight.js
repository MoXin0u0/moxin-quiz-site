import { openDatabase } from '../storage/db.js';

export async function runPreflightChecks() {
  const checks = [];

  checks.push({
    id: 'secure-context',
    label: '安全連線',
    ok: globalThis.isSecureContext === true,
    detail: globalThis.isSecureContext
      ? '目前為 Secure Context，可使用 PWA 與 Service Worker。'
      : '需要 HTTPS（或 localhost）才能完整使用 PWA。',
  });

  checks.push({
    id: 'indexeddb',
    label: 'IndexedDB',
    ok: Boolean(globalThis.indexedDB),
    detail: globalThis.indexedDB
      ? '瀏覽器支援 IndexedDB。'
      : '瀏覽器不支援 IndexedDB。',
  });

  if (globalThis.indexedDB) {
    try {
      await openDatabase();
      checks.push({
        id: 'db-open',
        label: '本機資料庫',
        ok: true,
        detail: 'moxin-quiz-v3 可正常開啟。',
      });
    } catch (error) {
      checks.push({
        id: 'db-open',
        label: '本機資料庫',
        ok: false,
        detail: error.message,
      });
    }
  }

  checks.push({
    id: 'service-worker',
    label: 'Service Worker',
    ok: 'serviceWorker' in navigator,
    detail: 'serviceWorker' in navigator
      ? '瀏覽器支援離線 App Shell。'
      : '此瀏覽器不支援 Service Worker。',
  });

  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      checks.push({
        id: 'storage',
        label: '儲存空間',
        ok: true,
        detail: `${formatBytes(estimate.usage || 0)} / 約 ${formatBytes(estimate.quota || 0)}`,
      });
    } catch {
      // Non-critical.
    }
  }

  if (navigator.storage?.persisted) {
    try {
      const persisted = await navigator.storage.persisted();
      checks.push({
        id: 'persistent-storage',
        label: '持久化儲存',
        ok: persisted,
        warning: !persisted,
        detail: persisted
          ? '瀏覽器已將本網站資料標記為持久化。'
          : '尚未取得持久化儲存；瀏覽器在極端空間不足時仍可能清除網站資料。',
      });
    } catch {
      // Non-critical.
    }
  }

  return checks;
}

export async function getStorageSummary() {
  const db = await openDatabase();
  const stores = ['banks', 'questions', 'assets', 'attempts', 'progress', 'sessions'];
  const counts = {};

  for (const storeName of stores) {
    if (!db.objectStoreNames.contains(storeName)) {
      counts[storeName] = 0;
      continue;
    }
    counts[storeName] = await countStore(db, storeName);
  }

  let estimate = null;
  if (navigator.storage?.estimate) {
    try {
      estimate = await navigator.storage.estimate();
    } catch {
      estimate = null;
    }
  }

  return { counts, estimate };
}

function countStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).count();
    request.onsuccess = () => resolve(request.result || 0);
    request.onerror = () => reject(request.error);
  });
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

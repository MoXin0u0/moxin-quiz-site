import { APP_CONFIG } from './config.js';
import {
  openDatabase,
  requestToPromise,
} from '../storage/db.js';

export async function runPreflightChecks() {
  const checks = [];
  let db = null;

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
      db = await openDatabase();
      checks.push({
        id: 'db-open',
        label: '本機資料庫',
        ok: true,
        detail: `${APP_CONFIG.dbName} 可正常開啟。`,
      });
      checks.push({
        id: 'db-version',
        label: '資料庫版本',
        ok: Number(db.version) === Number(APP_CONFIG.dbVersion),
        detail:
          `目前 IndexedDB v${db.version}；V5 預期 v${APP_CONFIG.dbVersion}。`,
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

  if (db) {
    checks.push(...await buildV5DataChecks(db));
  }

  checks.push(...buildCloudReadinessChecks());

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

async function buildV5DataChecks(db) {
  const tx = db.transaction(
    ['syncMeta', 'syncOutbox', 'syncConflicts'],
    'readonly',
  );
  const [meta, outboxCount, openConflictCount] = await Promise.all([
    requestToPromise(tx.objectStore('syncMeta').get('global')),
    requestToPromise(tx.objectStore('syncOutbox').count()),
    requestToPromise(
      tx.objectStore('syncConflicts')
        .index('status')
        .count(IDBKeyRange.only('open')),
    ),
  ]);

  const migration = meta?.migration || null;
  const migrationComplete =
    migration?.status === 'completed' &&
    Number(migration?.targetDbVersion) === Number(APP_CONFIG.dbVersion);
  const linked = Boolean(meta?.linkedProfileId);
  const runtimeState = String(meta?.runtimeState || 'LOCAL_ONLY');
  const expectedSchema = Number(APP_CONFIG.cloudSyncSchemaVersion);
  const cloudSchema = meta?.cloudSchemaVersion == null
    ? null
    : Number(meta.cloudSchemaVersion);
  const schemaCompatible =
    !linked ||
    cloudSchema === null ||
    cloudSchema === expectedSchema;
  const authRequired = runtimeState === 'AUTH_REQUIRED';

  return [
    {
      id: 'v5-migration',
      label: 'V5 資料遷移',
      ok: migrationComplete,
      detail: migrationComplete
        ? `遷移已完成（DB v${migration.targetDbVersion}）。`
        : `狀態：${migration?.status || '未知'}；階段：${migration?.phase || '未知'}。`,
    },
    {
      id: 'cloud-auth-runtime',
      label: '雲端授權狀態',
      ok: !authRequired,
      warning: authRequired,
      detail: !linked
        ? '目前未連結雲端帳號；Local-only 不需要授權。'
        : authRequired
          ? '已連結的雲端帳號需要重新授權；本機資料仍可使用。'
          : `已連結 Profile；同步狀態：${runtimeState}。`,
    },
    {
      id: 'cloud-schema',
      label: '雲端 Schema',
      ok: schemaCompatible,
      warning: linked && cloudSchema === null,
      detail: !linked
        ? `尚未連結雲端；客戶端支援 Cloud Schema v${expectedSchema}。`
        : cloudSchema === null
          ? `已連結，但尚未記錄雲端 Schema；客戶端預期 v${expectedSchema}。`
          : `Cloud Schema v${cloudSchema}；客戶端預期 v${expectedSchema}。`,
    },
    {
      id: 'sync-outbox',
      label: '同步待送佇列',
      ok: !linked || Number(outboxCount || 0) === 0,
      warning: linked && Number(outboxCount || 0) > 0,
      detail: linked
        ? `${Number(outboxCount || 0)} 筆 mutation 等待或正在處理。`
        : `${Number(outboxCount || 0)} 筆本機 mutation；未連結時不會自動上傳。`,
    },
    {
      id: 'sync-conflicts',
      label: '同步衝突',
      ok: Number(openConflictCount || 0) === 0,
      warning: Number(openConflictCount || 0) > 0,
      detail: Number(openConflictCount || 0) === 0
        ? '目前沒有待處理的同步衝突。'
        : `${Number(openConflictCount || 0)} 筆衝突需要明確處理。`,
    },
    {
      id: 'last-sync',
      label: '最近同步',
      ok: !linked || Boolean(meta?.lastSuccessfulSyncAt),
      warning: linked && !meta?.lastSuccessfulSyncAt,
      detail: !linked
        ? 'Local-only 模式沒有雲端同步時間。'
        : meta?.lastSuccessfulSyncAt
          ? `最近成功：${formatDateTime(meta.lastSuccessfulSyncAt)}。`
          : '已連結但尚無成功同步紀錄。',
    },
  ];
}

function buildCloudReadinessChecks() {
  const cloudRuntime = APP_CONFIG.features.cloudSync === true;
  const clientConfigured = Boolean(
    APP_CONFIG.cloud.googleClientId &&
    APP_CONFIG.cloud.googleDriveScope,
  );

  return [
    {
      id: 'cloud-runtime',
      label: '雲端功能開關',
      ok: true,
      detail: cloudRuntime
        ? 'Cloud runtime 已啟用；仍以 Local-first 規則執行。'
        : 'Cloud runtime 目前停用；Local-only / Offline 功能不受影響。',
    },
    {
      id: 'google-oauth-config',
      label: 'Google OAuth 設定',
      ok: !cloudRuntime || clientConfigured,
      warning: cloudRuntime && !clientConfigured,
      detail: clientConfigured
        ? 'Google Client ID 與 drive.appdata scope 已配置。'
        : cloudRuntime
          ? 'Cloud runtime 已啟用，但 Google Client ID 尚未配置。'
          : '尚未配置 Google Client ID；因 Cloud runtime 關閉，目前不會觸發登入。',
    },
  ];
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

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

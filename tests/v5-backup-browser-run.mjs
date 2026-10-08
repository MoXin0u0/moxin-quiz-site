import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const DB_NAME = 'moxin-quiz-v3';

async function establishOrigin(page) {
  await page.goto(new URL('docs/v5-baseline.md', BASE_URL).href, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
}

async function deleteDatabase(page) {
  await page.evaluate(async dbName => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB delete was blocked.'));
    });
  }, DB_NAME);
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await establishOrigin(page);
  await deleteDatabase(page);

  const result = await page.evaluate(async () => {
    const { openDatabase } = await import('/src/storage/db.js');
    const { saveSettings, loadSettings } = await import('/src/storage/settings.js');
    const backup = await import('/src/storage/backup.js');

    const db = await openDatabase();
    const now = '2026-10-05T00:00:00.000Z';

    const tx = db.transaction([
      'banks',
      'notes',
      'accountSettings',
      'syncRevisions',
      'syncConflicts',
      'syncTombstones',
      'devices',
      'syncMeta',
      'syncOutbox',
      'syncReceipts',
      'cloudObjects',
      'bankRegistry',
    ], 'readwrite');

    tx.objectStore('banks').put({
      id: 'bank-a',
      schemaVersion: '2.0',
      name: 'Backup Bank',
      version: '1.0.0',
      sourceType: 'user',
      storedAt: now,
    });
    tx.objectStore('notes').put({
      key: 'bank-a::Q1',
      bankId: 'bank-a',
      questionId: 'Q1',
      text: 'backup note',
      createdAt: now,
      updatedAt: now,
      revision: {
        revisionId: 'rev-note',
        parentRevisionIds: [],
        changedAt: now,
        changedByDeviceId: 'device-old',
        clock: { physicalMs: 1, logical: 0, deviceId: 'device-old' },
      },
    });
    tx.objectStore('accountSettings').put({
      id: 'global',
      studyTimeZone: 'Asia/Taipei',
      createdAt: now,
      updatedAt: now,
      revision: {
        revisionId: 'rev-account',
        parentRevisionIds: [],
        changedAt: now,
        changedByDeviceId: 'device-old',
        clock: { physicalMs: 1, logical: 0, deviceId: 'device-old' },
      },
    });
    tx.objectStore('syncRevisions').put({
      revisionId: 'rev-note',
      entityType: 'note',
      entityKey: 'bank-a::Q1',
      parentRevisionIds: [],
      changedAt: now,
      changedByDeviceId: 'device-old',
      clock: { physicalMs: 1, logical: 0, deviceId: 'device-old' },
    });
    tx.objectStore('syncConflicts').put({
      conflictId: 'conflict-a',
      entityType: 'note',
      entityKey: 'bank-a::Q1',
      status: 'open',
      createdAt: now,
    });
    tx.objectStore('syncTombstones').put({
      tombstoneId: 'tombstone-a',
      entityType: 'note',
      entityKey: 'bank-a::Q2',
      deletedAt: now,
      revision: {
        revisionId: 'rev-delete',
        parentRevisionIds: [],
        changedAt: now,
        changedByDeviceId: 'device-old',
        clock: { physicalMs: 1, logical: 0, deviceId: 'device-old' },
      },
    });
    tx.objectStore('devices').put({
      deviceId: 'device-old',
      label: 'Old Device',
      status: 'active',
      createdAt: now,
      lastSeenAt: now,
      appVersion: '5.0.0-dev',
    });
    tx.objectStore('syncMeta').put({
      key: 'global',
      deviceId: 'device-old',
      linkedProfileId: 'profile-old',
      runtimeState: 'SYNCED',
      nextCommitSequence: 77,
    });
    tx.objectStore('syncOutbox').put({
      mutationId: 'mutation-old',
      entityKey: 'note:bank-a::Q1',
      status: 'pending',
      createdAt: now,
    });
    tx.objectStore('syncReceipts').put({
      commitId: 'commit-old',
      deviceId: 'device-old',
      deviceSequence: 1,
      appliedAt: now,
    });
    tx.objectStore('cloudObjects').put({
      objectKey: 'asset:old',
      objectType: 'asset',
      logicalId: 'asset-old',
      contentHash: 'sha256:old',
      driveFileId: 'drive-old',
      verifiedAt: now,
    });
    tx.objectStore('bankRegistry').put({
      bankId: 'bank-a',
      displayName: 'Cached Bank',
      sourceType: 'user',
      availability: 'installed',
      lastSeenAt: now,
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    saveSettings({
      theme: 'dark',
      fontScale: 'large',
      optionSpacing: 'comfortable',
      reduceMotion: true,
      learningStyle: 'focus',
      sceneIntensity: 'off',
      studioTypeSwitchConfirm: false,
    });

    const snapshot = await backup.createBackupSnapshot();

    // Corrupt local state after export so restore must prove replacement/reset.
    const mutate = db.transaction([
      'banks',
      'syncOutbox',
      'syncReceipts',
      'cloudObjects',
      'bankRegistry',
    ], 'readwrite');
    mutate.objectStore('banks').clear();
    mutate.objectStore('syncOutbox').put({
      mutationId: 'mutation-new',
      entityKey: 'x',
      status: 'pending',
      createdAt: now,
    });
    mutate.objectStore('syncReceipts').put({
      commitId: 'commit-new',
      deviceId: 'device-old',
      deviceSequence: 2,
      appliedAt: now,
    });
    mutate.objectStore('cloudObjects').put({
      objectKey: 'asset:new',
      objectType: 'asset',
      logicalId: 'asset-new',
      contentHash: 'sha256:new',
      driveFileId: 'drive-new',
      verifiedAt: now,
    });
    mutate.objectStore('bankRegistry').put({
      bankId: 'stale',
      displayName: 'Stale',
      sourceType: 'user',
      availability: 'installed',
      lastSeenAt: now,
    });
    await new Promise((resolve, reject) => {
      mutate.oncomplete = resolve;
      mutate.onerror = () => reject(mutate.error);
      mutate.onabort = () => reject(mutate.error);
    });

    saveSettings({ theme: 'light' });

    const restored = await backup.restoreBackupSnapshot(snapshot, { replace: true });

    const readAll = storeName => new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    const readOne = (storeName, key) => new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    return {
      snapshotVersion: snapshot.version,
      snapshotStores: Object.keys(snapshot.stores),
      hasDeviceSettings: Boolean(snapshot.deviceSettings),
      restored,
      settings: loadSettings(),
      bank: await readOne('banks', 'bank-a'),
      note: await readOne('notes', 'bank-a::Q1'),
      account: await readOne('accountSettings', 'global'),
      devices: await readAll('devices'),
      syncMeta: await readOne('syncMeta', 'global'),
      outbox: await readAll('syncOutbox'),
      receipts: await readAll('syncReceipts'),
      cloudObjects: await readAll('cloudObjects'),
      bankRegistry: await readAll('bankRegistry'),
      conflicts: await readAll('syncConflicts'),
      tombstones: await readAll('syncTombstones'),
      revisions: await readAll('syncRevisions'),
    };
  });

  assert.equal(result.snapshotVersion, 2);
  assert.equal(result.hasDeviceSettings, true);
  for (const excluded of ['devices', 'syncMeta', 'syncOutbox', 'syncReceipts', 'cloudObjects', 'bankRegistry']) {
    assert.ok(!result.snapshotStores.includes(excluded), `Backup v2 must exclude ${excluded}`);
  }

  assert.equal(result.bank.name, 'Backup Bank');
  assert.equal(result.note.text, 'backup note');
  assert.equal(result.account.studyTimeZone, 'Asia/Taipei');
  assert.equal(result.settings.theme, 'dark');
  assert.equal(result.settings.learningStyle, 'focus');

  assert.equal(result.devices.length, 1);
  assert.notEqual(result.devices[0].deviceId, 'device-old');
  assert.match(result.devices[0].deviceId, /^device-/);
  assert.ok(result.devices[0].revision?.revisionId);

  assert.equal(result.syncMeta.deviceId, result.devices[0].deviceId);
  assert.equal(result.syncMeta.linkedProfileId, null);
  assert.equal(result.syncMeta.runtimeState, 'LOCAL_ONLY');
  assert.equal(result.syncMeta.reconciliation.kind, 'restore');
  assert.equal(result.restored.cloudLinkReset, true);
  assert.equal(result.restored.newDeviceId, result.devices[0].deviceId);

  assert.equal(result.outbox.length, 0);
  assert.equal(result.receipts.length, 0);
  assert.equal(result.cloudObjects.length, 0);
  assert.equal(result.bankRegistry.length, 0);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.tombstones.length, 1);
  assert.ok(result.revisions.some(item => item.revisionId === 'rev-note'));
  assert.ok(result.revisions.some(item => item.entityType === 'device'));

  await deleteDatabase(page);

  const legacy = await page.evaluate(async () => {
    const { openDatabase } = await import('/src/storage/db.js');
    const backup = await import('/src/storage/backup.js');
    const { loadSettings } = await import('/src/storage/settings.js');

    await openDatabase();

    const v1 = {
      format: 'moxin-quiz-backup',
      version: 1,
      exportedAt: '2026-09-01T00:00:00.000Z',
      app: {
        name: 'MoXin Quiz',
        schemaVersion: '2.0',
        dbName: 'moxin-quiz-v3',
        dbVersion: 3,
      },
      settings: {
        theme: 'light',
        fontScale: 'normal',
        optionSpacing: 'normal',
        reduceMotion: false,
        learningStyle: 'academy',
        sceneIntensity: 'full',
        studioTypeSwitchConfirm: true,
      },
      stores: {
        banks: [{
          id: 'legacy-bank',
          schemaVersion: '2.0',
          name: 'Legacy Backup Bank',
          version: '1.0.0',
          sourceType: 'user',
          storedAt: '2026-09-01T00:00:00.000Z',
        }],
        questions: [],
        assets: [],
        attempts: [{
          id: 1,
          bankId: 'legacy-bank',
          questionId: 'Q1',
          questionKey: 'legacy-bank::Q1',
          timestamp: '2026-09-01T01:00:00.000Z',
          selectedAnswer: ['A'],
          correct: true,
          responseTime: 1000,
          mode: 'filtered',
        }],
        progress: [],
        favorites: [],
        notes: [],
        mastery: [],
        reviewSchedule: [],
        sessions: [],
        studioDrafts: [],
        learningGoals: [],
      },
    };

    const restored = await backup.restoreBackupSnapshot(v1, { replace: true });
    const db = await openDatabase();

    const attempt = await new Promise((resolve, reject) => {
      const request = db.transaction('attempts', 'readonly').objectStore('attempts').get(1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const syncMeta = await new Promise((resolve, reject) => {
      const request = db.transaction('syncMeta', 'readonly').objectStore('syncMeta').get('global');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return {
      restored,
      attempt,
      syncMeta,
      settings: loadSettings(),
    };
  });

  assert.equal(legacy.restored.restoredFromVersion, 1);
  assert.match(legacy.attempt.eventId, /^legacy-sha256:/);
  assert.equal(legacy.syncMeta.runtimeState, 'LOCAL_ONLY');
  assert.equal(legacy.syncMeta.linkedProfileId, null);
  assert.equal(legacy.syncMeta.migration.status, 'completed');
  assert.equal(legacy.settings.theme, 'light');

  await context.close();
  console.log('V5 Backup v2 browser recovery tests passed.');
} finally {
  await browser.close();
}

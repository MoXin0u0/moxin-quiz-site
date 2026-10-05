import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const DB_NAME = 'moxin-quiz-v3';
const EXPECTED_STORES = [
  'accountSettings',
  'assets',
  'attempts',
  'authorLibrary',
  'bankRegistry',
  'banks',
  'cloudObjects',
  'devices',
  'favorites',
  'learningGoals',
  'mastery',
  'notes',
  'progress',
  'questions',
  'reviewSchedule',
  'sessions',
  'studioDrafts',
  'syncConflicts',
  'syncMeta',
  'syncOutbox',
  'syncReceipts',
  'syncRevisions',
  'syncTombstones',
].sort();

async function waitReady(page) {
  await page.waitForSelector('#storageStatus', { timeout: 15000 });
  await page.waitForFunction(() => {
    const text = document.querySelector('#storageStatus')?.textContent || '';
    return text.includes('IndexedDB 已就緒');
  }, null, { timeout: 15000 });
}

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

async function inspectDatabase(page) {
  return page.evaluate(async () => {
    const { openDatabase } = await import('/src/storage/db.js');
    const db = await openDatabase();
    const attempts = db.transaction('attempts', 'readonly').objectStore('attempts');
    return {
      version: db.version,
      stores: Array.from(db.objectStoreNames).sort(),
      attemptIndexes: Array.from(attempts.indexNames).sort(),
      eventIdUnique: attempts.index('eventId').unique,
      runtimeState: (await import('/src/storage/db.js')).getDatabaseRuntimeState(),
    };
  });
}

async function seedLegacyV3(page, { keepOpen = false } = {}) {
  await page.evaluate(async ({ dbName, keepOpen }) => {
    const definitions = {
      banks: { keyPath: 'id', indexes: [['updatedAt', 'updatedAt'], ['name', 'name']] },
      questions: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['questionId', 'questionId'], ['chapter', 'chapter']] },
      assets: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['path', 'path']] },
      attempts: { keyPath: 'id', autoIncrement: true, indexes: [['bankId', 'bankId'], ['questionKey', 'questionKey'], ['timestamp', 'timestamp']] },
      progress: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
      favorites: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
      notes: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
      mastery: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
      reviewSchedule: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['dueAt', 'dueAt']] },
      sessions: { keyPath: 'id', indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt']] },
      studioDrafts: { keyPath: 'id', indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt'], ['status', 'status']] },
      learningGoals: { keyPath: 'id', indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt'], ['examDate', 'examDate']] },
    };

    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 3);
      request.onupgradeneeded = () => {
        const database = request.result;
        for (const [name, definition] of Object.entries(definitions)) {
          const store = database.createObjectStore(name, {
            keyPath: definition.keyPath,
            autoIncrement: definition.autoIncrement === true,
          });
          for (const [indexName, keyPath] of definition.indexes) {
            store.createIndex(indexName, keyPath);
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const now = '2026-10-05T00:00:00.000Z';
    const stores = Object.keys(definitions);
    const tx = db.transaction(stores, 'readwrite');

    tx.objectStore('banks').put({
      id: 'legacy-bank',
      schemaVersion: '2.0',
      name: 'Legacy V4 Bank',
      version: '1.0.0',
      questionCount: 1,
      sourceType: 'user',
      importedAt: now,
      storedAt: now,
      updatedAt: now,
    });
    tx.objectStore('questions').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      id: 'Q001',
      type: 'single-choice',
      question: 'Legacy question',
      options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
      answer: ['A'],
      explanation: '',
      chapter: 'Legacy',
      tags: [],
      difficulty: 1,
      images: [],
      explanationImages: [],
    });
    tx.objectStore('assets').put({
      key: 'legacy-bank::assets/images/a.txt',
      bankId: 'legacy-bank',
      path: 'assets/images/a.txt',
      mimeType: 'text/plain',
      size: 1,
      blob: new Blob(['a'], { type: 'text/plain' }),
    });

    const legacyAttempt = {
      bankId: 'legacy-bank',
      questionId: 'Q001',
      questionKey: 'legacy-bank::Q001',
      timestamp: now,
      selectedAnswer: ['A'],
      correct: true,
      responseTime: 1000,
      mode: 'filtered',
    };
    tx.objectStore('attempts').add(legacyAttempt);
    tx.objectStore('attempts').add(legacyAttempt);

    tx.objectStore('progress').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      attempts: 2,
      correctCount: 2,
      wrongCount: 0,
      lastResult: 'correct',
      lastAnsweredAt: now,
    });
    tx.objectStore('favorites').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      addedAt: now,
    });
    tx.objectStore('notes').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      text: 'legacy note',
      updatedAt: now,
    });
    tx.objectStore('mastery').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      status: 'unfamiliar',
      markedAt: now,
      updatedAt: now,
    });
    tx.objectStore('reviewSchedule').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      level: 1,
      dueAt: now,
      updatedAt: now,
    });
    tx.objectStore('sessions').put({
      id: 'legacy-session',
      bankId: 'legacy-bank',
      bankName: 'Legacy V4 Bank',
      mode: 'filtered',
      sourceQuestionIds: ['Q001'],
      queue: ['Q001'],
      completedIds: [],
      errorsByQuestion: {},
      attemptCount: 0,
      wrongCount: 0,
      currentQuestionId: null,
      answered: false,
      startedAt: now,
      updatedAt: now,
      finishedAt: null,
    });
    tx.objectStore('studioDrafts').put({
      id: 'legacy-draft',
      bankId: 'legacy-bank',
      manifest: { id: 'legacy-bank', name: 'Legacy V4 Bank' },
      questions: [],
      assets: [],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('learningGoals').put({
      id: 'global',
      bankId: null,
      enabled: true,
      dailyPracticeTarget: 10,
      dailyReviewTarget: 5,
      examDate: null,
      examLabel: '',
      sprintEnabled: false,
      sprintBankIds: [],
      sprintDailyTarget: 0,
      createdAt: now,
      updatedAt: now,
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    if (keepOpen) {
      window.__v5HeldLegacyDb = db;
    } else {
      db.close();
    }
  }, { dbName: DB_NAME, keepOpen });
}

async function readStoreCounts(page) {
  return page.evaluate(async storeNames => {
    const { openDatabase } = await import('/src/storage/db.js');
    const db = await openDatabase();
    const tx = db.transaction(storeNames, 'readonly');
    const counts = {};
    await Promise.all(storeNames.map(name => new Promise((resolve, reject) => {
      const request = tx.objectStore(name).count();
      request.onsuccess = () => {
        counts[name] = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    })));
    return counts;
  }, [
    'banks', 'questions', 'assets', 'attempts', 'progress', 'favorites',
    'notes', 'mastery', 'reviewSchedule', 'sessions', 'studioDrafts', 'learningGoals',
  ]);
}

const browser = await chromium.launch({ headless: true });

try {
  // Fresh DB v4.
  {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await establishOrigin(page);
    await deleteDatabase(page);
    // Open db.js directly from the neutral docs origin so this block tests only
    // IndexedDB onupgradeneeded structure. The real app bootstrap migration is
    // covered separately by the B07.5 consistency browser gate.
    const state = await inspectDatabase(page);
    assert.equal(state.version, 4);
    assert.deepEqual(state.stores, EXPECTED_STORES);
    assert.equal(state.stores.length, 23);
    for (const index of ['answeredAt', 'bankId', 'eventId', 'questionKey', 'sessionId', 'timestamp']) {
      assert.ok(state.attemptIndexes.includes(index), `Missing attempts index: ${index}`);
    }
    assert.equal(state.eventIdUnique, true);
    assert.equal(state.runtimeState.status, 'open');

    const repositoryRoundTrip = await page.evaluate(async () => {
      const [
        accountSettings,
        authorLibrary,
        devices,
        bankRegistry,
        syncMeta,
        syncOutbox,
        syncReceipts,
        syncRevisions,
        syncConflicts,
        syncTombstones,
        cloudObjects,
      ] = await Promise.all([
        import('/src/storage/repositories/account-settings.js'),
        import('/src/storage/repositories/author-library.js'),
        import('/src/storage/repositories/devices.js'),
        import('/src/storage/repositories/bank-registry.js'),
        import('/src/storage/repositories/sync-meta.js'),
        import('/src/storage/repositories/sync-outbox.js'),
        import('/src/storage/repositories/sync-receipts.js'),
        import('/src/storage/repositories/sync-revisions.js'),
        import('/src/storage/repositories/sync-conflicts.js'),
        import('/src/storage/repositories/sync-tombstones.js'),
        import('/src/storage/repositories/cloud-objects.js'),
      ]);

      const now = '2026-10-05T00:00:00.000Z';
      await accountSettings.saveAccountSettings({ id: 'global', studyTimeZone: 'Asia/Taipei', updatedAt: now });
      await authorLibrary.saveAuthorLibraryState({ bankId: 'author-a', inLibrary: true, changedAt: now });
      await devices.saveDeviceProfile({ deviceId: 'device-a', label: 'Test', status: 'active', lastSeenAt: now });
      await bankRegistry.saveBankRegistryRecord({ bankId: 'bank-a', displayName: 'Bank A', sourceType: 'user', availability: 'installed', lastSeenAt: now });
      await syncMeta.saveSyncMeta({ key: 'global', deviceId: 'device-a', runtimeState: 'LOCAL_ONLY' });
      await syncOutbox.saveOutboxMutation({ mutationId: 'mutation-a', status: 'pending', entityKey: 'note:bank-a::Q1', createdAt: now });
      await syncReceipts.saveSyncReceipt({ commitId: 'commit-a', deviceId: 'device-a', deviceSequence: 1, appliedAt: now });
      await syncRevisions.saveSyncRevision({ revisionId: 'rev-a', entityType: 'note', entityKey: 'bank-a::Q1', changedAt: now });
      await syncConflicts.saveSyncConflict({ conflictId: 'conflict-a', entityType: 'note', entityKey: 'bank-a::Q1', status: 'open', createdAt: now });
      await syncTombstones.saveSyncTombstone({ tombstoneId: 'tombstone-a', entityType: 'note', entityKey: 'bank-a::Q1', deletedAt: now });
      await cloudObjects.saveCloudObjectMapping({ objectKey: 'asset:sha256:test', objectType: 'asset', logicalId: 'asset-a', contentHash: 'sha256:test', driveFileId: 'drive-a', verifiedAt: now });

      return {
        account: await accountSettings.getAccountSettings(),
        author: await authorLibrary.getAuthorLibraryState('author-a'),
        device: await devices.getDeviceProfile('device-a'),
        bank: await bankRegistry.getBankRegistryRecord('bank-a'),
        meta: await syncMeta.getSyncMeta(),
        pending: (await syncOutbox.listOutboxMutationsByStatus('pending')).length,
        receipt: await syncReceipts.getSyncReceipt('commit-a'),
        revisions: (await syncRevisions.listSyncRevisionsForEntity('bank-a::Q1')).length,
        conflicts: (await syncConflicts.listOpenSyncConflicts()).length,
        tombstones: (await syncTombstones.listSyncTombstonesForEntity('bank-a::Q1')).length,
        cloudByHash: (await cloudObjects.listCloudObjectsByHash('sha256:test')).length,
      };
    });

    assert.equal(repositoryRoundTrip.account.studyTimeZone, 'Asia/Taipei');
    assert.equal(repositoryRoundTrip.author.inLibrary, true);
    assert.equal(repositoryRoundTrip.device.status, 'active');
    assert.equal(repositoryRoundTrip.bank.availability, 'installed');
    assert.equal(repositoryRoundTrip.meta.runtimeState, 'LOCAL_ONLY');
    assert.equal(repositoryRoundTrip.pending, 1);
    assert.equal(repositoryRoundTrip.receipt.deviceSequence, 1);
    assert.equal(repositoryRoundTrip.revisions, 1);
    assert.equal(repositoryRoundTrip.conflicts, 1);
    assert.equal(repositoryRoundTrip.tombstones, 1);
    assert.equal(repositoryRoundTrip.cloudByHash, 1);

    await context.close();
  }

  // Real structural v3 → v4 upgrade with duplicate legacy attempts that have no eventId.
  {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await establishOrigin(page);
    await deleteDatabase(page);
    await seedLegacyV3(page);

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);

    const state = await inspectDatabase(page);
    assert.equal(state.version, 4);
    assert.deepEqual(state.stores, EXPECTED_STORES);
    assert.equal(state.eventIdUnique, true);

    const counts = await readStoreCounts(page);
    assert.equal(counts.attempts, 2, 'Legacy duplicate-content attempts must both survive structural upgrade.');
    for (const [store, count] of Object.entries(counts)) {
      if (store === 'attempts') continue;
      assert.ok(count >= 1, `Legacy store ${store} lost its seeded record.`);
    }

    const legacyIds = await page.evaluate(async () => {
      const { openDatabase } = await import('/src/storage/db.js');
      const db = await openDatabase();
      const request = db.transaction('attempts', 'readonly').objectStore('attempts').getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result.map(item => item.eventId ?? null));
        request.onerror = () => reject(request.error);
      });
    });
    assert.deepEqual(legacyIds, [null, null], 'B02 structural upgrade must not run heavy event migration.');

    await context.close();
  }

  // Blocked upgrade diagnostics: keep a v3 connection open, observe the v4 request, then release it.
  {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const holder = await context.newPage();
    await establishOrigin(holder);
    await deleteDatabase(holder);
    await seedLegacyV3(holder, { keepOpen: true });

    const upgrader = await context.newPage();
    await upgrader.addInitScript(() => {
      window.__v5DbStates = [];
      window.addEventListener('moxin:indexeddb-state', event => {
        window.__v5DbStates.push(event.detail);
      });
    });

    await upgrader.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await upgrader.waitForFunction(
      () => window.__v5DbStates?.some(state => state.status === 'blocked'),
      null,
      { timeout: 10000 },
    );

    const blocked = await upgrader.evaluate(() =>
      window.__v5DbStates.find(state => state.status === 'blocked')
    );
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.currentVersion, 4);

    await holder.evaluate(() => {
      window.__v5HeldLegacyDb?.close();
      window.__v5HeldLegacyDb = null;
    });

    await waitReady(upgrader);
    const states = await upgrader.evaluate(() => window.__v5DbStates);
    assert.ok(states.some(state => state.status === 'upgrading'));
    assert.ok(states.some(state => state.status === 'open' && state.currentVersion === 4));

    await context.close();
  }

  console.log('V5 DB v4 browser structural upgrade tests passed.');
} finally {
  await browser.close();
}

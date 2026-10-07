import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const DB_NAME = 'moxin-quiz-v3';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() =>
    (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'),
  null, { timeout: 15000 });

  await page.waitForFunction(() => {
    const host = document.querySelector('#syncStatusHost');
    return host && !host.hidden &&
      Boolean(host.querySelector('[data-open-sync-center]'));
  }, null, { timeout: 10000 });

  const result = await page.evaluate(async dbName => {
    const {
      closeDatabase,
      openDatabase,
      requestToPromise,
      transactionDone,
    } = await import('/src/storage/db.js');
    const { runV5MigrationToCompletion } = await import('/src/storage/migrations/v5-migration.js');
    const { setFavorite } = await import('/src/storage/repositories/learning.js');
    const {
      inspectFirstSync,
      confirmFirstSyncReconciliation,
      runSyncCycle,
    } = await import('/src/sync/sync-engine.js');
    const {
      createCloudCommit,
      cloudAppProperties,
    } = await import('/src/sync/cloud-contract.js');

    await closeDatabase();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB delete blocked.'));
    });
    await openDatabase();
    await runV5MigrationToCompletion();

    await setFavorite('bank-local', 'Q1', true);

    // Simulate a migrated V4 note that exists locally with a revision but no
    // Outbox mutation yet. First-sync confirmation must seed it.
    let db = await openDatabase();
    const legacyTx = db.transaction(['notes', 'syncMeta', 'syncRevisions'], 'readwrite');
    const done = transactionDone(legacyTx);
    const meta = await requestToPromise(legacyTx.objectStore('syncMeta').get('global'));
    const legacyRevision = {
      revisionId: 'legacy-revision:first-sync-note',
      parentRevisionIds: [],
      changedAt: '2026-10-01T00:00:00.000Z',
      changedByDeviceId: 'legacy-migration',
      clock: {
        physicalMs: Date.parse('2026-10-01T00:00:00.000Z'),
        logical: 0,
        deviceId: 'legacy-migration',
      },
    };
    legacyTx.objectStore('notes').put({
      key: 'bank-local::Q2',
      bankId: 'bank-local',
      questionId: 'Q2',
      text: 'legacy note',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      revision: legacyRevision,
    });
    legacyTx.objectStore('syncRevisions').put({
      ...legacyRevision,
      entityType: 'note',
      entityKey: 'bank-local::Q2',
    });
    legacyTx.objectStore('syncMeta').put(meta);
    await done;

    const files = [];
    const payloads = new Map();

    const provider = {
      async listFiles({ appProperties = {}, pageToken = null } = {}) {
        if (pageToken) return { files: [], nextPageToken: null };
        return {
          files: files.filter(file =>
            Object.entries(appProperties).every(([key, value]) =>
              String(file.appProperties?.[key] || '') === String(value)
            )
          ),
          nextPageToken: null,
        };
      },
      async createJsonFile({ name, data, appProperties }) {
        const file = {
          id: `file-${files.length + 1}`,
          name,
          mimeType: 'application/json',
          modifiedTime: '2026-10-06T13:00:00.000Z',
          appProperties: { ...appProperties },
        };
        files.push(file);
        payloads.set(file.id, structuredClone(data));
        return structuredClone(file);
      },
      async downloadJson(fileId) {
        return structuredClone(payloads.get(fileId));
      },
      async getFileMetadata(fileId) {
        return structuredClone(files.find(file => file.id === fileId));
      },
    };

    const inspected = await inspectFirstSync(provider, {
      profileId: 'profile-sync-engine',
      now: new Date('2026-10-06T13:01:00.000Z'),
    });

    const blocked = await runSyncCycle(provider, {
      profileId: 'profile-sync-engine',
      now: () => new Date('2026-10-06T13:01:30.000Z'),
    });

    const confirmed = await confirmFirstSyncReconciliation(
      inspected.reconciliation.reconciliationId,
      { now: new Date('2026-10-06T13:02:00.000Z') },
    );

    const firstCycle = await runSyncCycle(provider, {
      profileId: 'profile-sync-engine',
      now: () => new Date('2026-10-06T13:03:00.000Z'),
    });

    db = await openDatabase();
    const outboxAfterFirst = await requestToPromise(
      db.transaction('syncOutbox', 'readonly').objectStore('syncOutbox').getAll(),
    );
    const metaAfterFirst = await requestToPromise(
      db.transaction('syncMeta', 'readonly').objectStore('syncMeta').get('global'),
    );

    const remoteRevision = {
      revisionId: 'rev-remote-favorite',
      parentRevisionIds: [],
      changedAt: '2026-10-06T13:04:00.000Z',
      changedByDeviceId: 'device-remote',
      clock: {
        physicalMs: Date.parse('2026-10-06T13:04:00.000Z'),
        logical: 0,
        deviceId: 'device-remote',
      },
    };
    const remoteCommit = await createCloudCommit({
      profileId: 'profile-sync-engine',
      deviceId: 'device-remote',
      deviceSequence: 1,
      commitId: 'commit-remote-engine',
      createdAt: '2026-10-06T13:04:00.000Z',
      mutations: [{
        mutationId: 'mutation-remote-favorite',
        type: 'favorite',
        key: 'bank-remote::Q9',
        op: 'upsert',
        policy: 'coalescible',
        revision: remoteRevision,
        value: {
          key: 'bank-remote::Q9',
          bankId: 'bank-remote',
          questionId: 'Q9',
          isFavorite: true,
          firstAddedAt: '2026-10-06T13:04:00.000Z',
          changedAt: '2026-10-06T13:04:00.000Z',
          revision: remoteRevision,
        },
      }],
    });
    const remoteFile = {
      id: `file-${files.length + 1}`,
      name: 'remote-engine.json',
      mimeType: 'application/json',
      modifiedTime: '2026-10-06T13:04:00.000Z',
      appProperties: cloudAppProperties({
        profileId: 'profile-sync-engine',
        objectType: 'commit',
        objectId: remoteCommit.commitId,
        hash: remoteCommit.payloadHash,
      }),
    };
    files.push(remoteFile);
    payloads.set(remoteFile.id, remoteCommit);

    const secondCycle = await runSyncCycle(provider, {
      profileId: 'profile-sync-engine',
      now: () => new Date('2026-10-06T13:05:00.000Z'),
    });

    db = await openDatabase();
    const remoteFavorite = await requestToPromise(
      db.transaction('favorites', 'readonly')
        .objectStore('favorites')
        .get('bank-remote::Q9'),
    );
    const finalMeta = await requestToPromise(
      db.transaction('syncMeta', 'readonly').objectStore('syncMeta').get('global'),
    );

    return {
      plan: inspected.plan.plan,
      blocked,
      seedResult: confirmed.seedResult,
      firstCycle: {
        status: firstCycle.status,
        runtimeState: firstCycle.runtimeState,
        pushed: firstCycle.pushed.length,
        pendingCount: firstCycle.pendingCount,
      },
      outboxAfterFirst: outboxAfterFirst.length,
      reconciliationPhaseAfterFirst: metaAfterFirst.reconciliation?.phase || null,
      secondCycle: {
        status: secondCycle.status,
        runtimeState: secondCycle.runtimeState,
        pulled: secondCycle.pulled.length,
      },
      remoteFavorite: {
        isFavorite: remoteFavorite?.isFavorite ?? null,
        revisionId: remoteFavorite?.revision?.revisionId || null,
      },
      finalState: finalMeta.runtimeState,
    };
  }, DB_NAME);

  assert.equal(result.plan, 'upload-local');
  assert.equal(result.blocked.status, 'blocked');
  assert.equal(result.blocked.reason, 'reconciliation-required');

  assert.ok(
    result.seedResult.seededCount >= 1,
    'first-sync confirmation must seed legacy local state that has no Outbox row',
  );

  assert.equal(result.firstCycle.status, 'synced');
  assert.equal(result.firstCycle.runtimeState, 'SYNCED');
  assert.ok(result.firstCycle.pushed >= 1);
  assert.equal(result.firstCycle.pendingCount, 0);
  assert.equal(result.outboxAfterFirst, 0);
  assert.equal(result.reconciliationPhaseAfterFirst, 'completed');

  assert.equal(result.secondCycle.status, 'synced');
  assert.equal(result.secondCycle.runtimeState, 'SYNCED');
  assert.equal(result.secondCycle.pulled, 1);
  assert.equal(result.remoteFavorite.isFavorite, true);
  assert.equal(result.remoteFavorite.revisionId, 'rev-remote-favorite');
  assert.equal(result.finalState, 'SYNCED');

  console.log('V5 B12 sync-cycle browser gate passed.');
} finally {
  await browser.close();
}

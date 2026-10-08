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

  const result = await page.evaluate(async dbName => {
    const {
      closeDatabase,
      openDatabase,
      requestToPromise,
    } = await import('/src/storage/db.js');
    const { runV5MigrationToCompletion } = await import('/src/storage/migrations/v5-migration.js');
    const { setFavorite } = await import('/src/storage/repositories/learning.js');
    const { saveBankPackage } = await import('/src/storage/repositories/banks.js');
    const {
      inspectFirstSync,
      confirmFirstSyncReconciliation,
      runSyncCycle,
    } = await import('/src/sync/sync-engine.js');
    const {
      createCloudCommit,
      cloudAppProperties,
    } = await import('/src/sync/cloud-contract.js');

    const reset = async () => {
      await closeDatabase();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB delete blocked.'));
      });
      await openDatabase();
      await runV5MigrationToCompletion();
    };

    const readMeta = async () => {
      const db = await openDatabase();
      return requestToPromise(
        db.transaction('syncMeta', 'readonly').objectStore('syncMeta').get('global'),
      );
    };

    const buildProvider = () => {
      const files = [];
      const payloads = new Map();
      let failureMode = 'none';

      const throwFailure = code => {
        const error = new Error(`simulated ${code}`);
        error.code = code;
        error.retryable = ['NETWORK', 'RATE_LIMIT', 'SERVER_ERROR'].includes(code);
        throw error;
      };

      const provider = {
        setFailureMode(value) {
          failureMode = value;
        },
        async listFiles({ appProperties = {}, pageToken = null } = {}) {
          if (pageToken) return { files: [], nextPageToken: null };
          if (failureMode === 'network') throwFailure('NETWORK');
          if (failureMode === 'rate-limit') throwFailure('RATE_LIMIT');
          if (failureMode === 'server') throwFailure('SERVER_ERROR');
          if (failureMode === 'asset-rate-limit' && appProperties.objectType === 'asset') {
            throwFailure('RATE_LIMIT');
          }
          return {
            files: files.filter(file =>
              Object.entries(appProperties).every(([key, value]) =>
                String(file.appProperties?.[key] || '') === String(value)
              )
            ),
            nextPageToken: null,
          };
        },
        async createBlobFile({ name, blob, mimeType, appProperties }) {
          const file = {
            id: `file-${files.length + 1}`,
            name,
            mimeType,
            size: String(blob.size),
            modifiedTime: '2026-10-07T12:00:00.000Z',
            appProperties: { ...appProperties },
          };
          files.push(file);
          payloads.set(file.id, blob);
          return structuredClone(file);
        },
        async createJsonFile({ name, data, appProperties }) {
          const text = JSON.stringify(data);
          const file = {
            id: `file-${files.length + 1}`,
            name,
            mimeType: 'application/json',
            size: String(new TextEncoder().encode(text).byteLength),
            modifiedTime: '2026-10-07T12:00:00.000Z',
            appProperties: { ...appProperties },
          };
          files.push(file);
          payloads.set(file.id, structuredClone(data));
          return structuredClone(file);
        },
        async getFileMetadata(fileId) {
          return structuredClone(files.find(file => file.id === fileId));
        },
        async downloadJson(fileId) {
          return structuredClone(payloads.get(fileId));
        },
        async downloadFile(fileId) {
          return payloads.get(fileId);
        },
        files,
        payloads,
      };

      return provider;
    };

    // Local-first setup used to exercise cycle-level retry behavior.
    await reset();
    await setFavorite('bank-retry', 'Q1', true);
    const provider = buildProvider();
    const inspected = await inspectFirstSync(provider, {
      profileId: 'profile-reliability',
      now: new Date('2026-10-07T12:01:00.000Z'),
    });
    await confirmFirstSyncReconciliation(
      inspected.reconciliation.reconciliationId,
      { now: new Date('2026-10-07T12:01:10.000Z') },
    );

    provider.setFailureMode('network');
    const networkFailure = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      now: () => new Date('2026-10-07T12:02:00.000Z'),
    });
    const metaAfterNetwork = await readMeta();

    const networkDeferred = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      now: () => new Date('2026-10-07T12:02:00.100Z'),
    });

    provider.setFailureMode('none');
    const networkRecovered = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      force: true,
      now: () => new Date('2026-10-07T12:03:00.000Z'),
    });
    const metaAfterNetworkRecovery = await readMeta();

    // 429 and 5xx must both create durable exponential-backoff gates.
    await setFavorite('bank-retry', 'Q2', true);
    provider.setFailureMode('rate-limit');
    const rateFailure = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      now: () => new Date('2026-10-07T12:04:00.000Z'),
    });
    const metaAfterRate = await readMeta();

    const rateDeferred = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      now: () => new Date('2026-10-07T12:04:00.100Z'),
    });

    provider.setFailureMode('server');
    const serverFailure = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      force: true,
      now: () => new Date('2026-10-07T12:05:00.000Z'),
    });
    const metaAfterServer = await readMeta();

    provider.setFailureMode('none');
    const transientRecovered = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      force: true,
      now: () => new Date('2026-10-07T12:06:00.000Z'),
    });

    // True offline remains a distinct normal Local-first runtime state.
    await setFavorite('bank-retry', 'Q3', true);
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    provider.setFailureMode('network');
    const offlineFailure = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      force: true,
      now: () => new Date('2026-10-07T12:07:00.000Z'),
    });

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    provider.setFailureMode('none');
    const reconnectRecovered = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      force: true,
      now: () => new Date('2026-10-07T12:08:00.000Z'),
    });

    // Object materialization failure must also participate in the cycle-level
    // retry gate, even before an immutable commit exists.
    const blob = new Blob(['b12-reliability-asset'], { type: 'image/png' });
    await saveBankPackage({
      sourceType: 'user',
      manifest: {
        id: 'bank-object-retry',
        name: 'Object Retry Bank',
        version: '1.0.0',
        updatedAt: '2026-10-07T12:09:00.000Z',
      },
      questions: [{
        id: 'Q1',
        type: 'true-false',
        question: 'retry?',
        answer: [true],
      }],
      assets: [{
        path: 'assets/retry.png',
        mimeType: 'image/png',
        blob,
      }],
    });

    provider.setFailureMode('asset-rate-limit');
    const objectFailure = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      force: true,
      now: () => new Date('2026-10-07T12:10:00.000Z'),
    });
    const metaAfterObjectFailure = await readMeta();

    const objectDeferred = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      now: () => new Date('2026-10-07T12:10:00.100Z'),
    });

    provider.setFailureMode('none');
    const objectRecovered = await runSyncCycle(provider, {
      profileId: 'profile-reliability',
      force: true,
      now: () => new Date('2026-10-07T12:11:00.000Z'),
    });
    const metaAfterObjectRecovery = await readMeta();

    // Fresh local database + existing cloud commit must select the
    // download-cloud first-sync plan and apply remote learning state.
    await reset();
    const cloudOnlyProvider = buildProvider();
    const remoteRevision = {
      revisionId: 'rev-cloud-only-favorite',
      parentRevisionIds: [],
      changedAt: '2026-10-07T13:00:00.000Z',
      changedByDeviceId: 'device-cloud-only',
      clock: {
        physicalMs: Date.parse('2026-10-07T13:00:00.000Z'),
        logical: 0,
        deviceId: 'device-cloud-only',
      },
    };
    const remoteCommit = await createCloudCommit({
      profileId: 'profile-cloud-only',
      deviceId: 'device-cloud-only',
      deviceSequence: 1,
      commitId: 'commit-cloud-only',
      createdAt: '2026-10-07T13:00:00.000Z',
      mutations: [{
        mutationId: 'mutation-cloud-only-favorite',
        type: 'favorite',
        key: 'bank-cloud::Q1',
        op: 'upsert',
        policy: 'coalescible',
        revision: remoteRevision,
        value: {
          key: 'bank-cloud::Q1',
          bankId: 'bank-cloud',
          questionId: 'Q1',
          isFavorite: true,
          firstAddedAt: '2026-10-07T13:00:00.000Z',
          changedAt: '2026-10-07T13:00:00.000Z',
          revision: remoteRevision,
        },
      }],
    });
    const remoteFile = {
      id: 'cloud-only-commit-file',
      name: 'cloud-only.json',
      mimeType: 'application/json',
      modifiedTime: '2026-10-07T13:00:00.000Z',
      appProperties: cloudAppProperties({
        profileId: 'profile-cloud-only',
        objectType: 'commit',
        objectId: remoteCommit.commitId,
        hash: remoteCommit.payloadHash,
      }),
    };
    cloudOnlyProvider.files.push(remoteFile);
    cloudOnlyProvider.payloads.set(remoteFile.id, remoteCommit);

    const cloudOnlyInspection = await inspectFirstSync(cloudOnlyProvider, {
      profileId: 'profile-cloud-only',
      now: new Date('2026-10-07T13:01:00.000Z'),
    });
    await confirmFirstSyncReconciliation(
      cloudOnlyInspection.reconciliation.reconciliationId,
      { now: new Date('2026-10-07T13:01:10.000Z') },
    );
    const cloudOnlyCycle = await runSyncCycle(cloudOnlyProvider, {
      profileId: 'profile-cloud-only',
      now: () => new Date('2026-10-07T13:02:00.000Z'),
    });
    const db = await openDatabase();
    const cloudOnlyFavorite = await requestToPromise(
      db.transaction('favorites', 'readonly')
        .objectStore('favorites')
        .get('bank-cloud::Q1'),
    );

    return {
      networkFailure: {
        status: networkFailure.status,
        runtimeState: networkFailure.runtimeState,
        retryable: networkFailure.retryable,
        nextRetryAt: networkFailure.nextRetryAt,
      },
      networkRetry: metaAfterNetwork.syncRetry,
      networkDeferred: {
        status: networkDeferred.status,
        reason: networkDeferred.reason,
        nextRetryAt: networkDeferred.nextRetryAt,
      },
      networkRecovered: networkRecovered.status,
      retryClearedAfterNetwork: metaAfterNetworkRecovery.syncRetry == null,
      rateFailure: {
        status: rateFailure.status,
        runtimeState: rateFailure.runtimeState,
      },
      rateRetry: metaAfterRate.syncRetry,
      rateDeferred: {
        status: rateDeferred.status,
        reason: rateDeferred.reason,
      },
      serverFailure: {
        status: serverFailure.status,
        runtimeState: serverFailure.runtimeState,
      },
      serverRetry: metaAfterServer.syncRetry,
      transientRecovered: transientRecovered.status,
      offlineFailure: {
        status: offlineFailure.status,
        runtimeState: offlineFailure.runtimeState,
      },
      reconnectRecovered: reconnectRecovered.status,
      objectFailure: {
        status: objectFailure.status,
        runtimeState: objectFailure.runtimeState,
      },
      objectRetry: metaAfterObjectFailure.syncRetry,
      objectDeferred: {
        status: objectDeferred.status,
        reason: objectDeferred.reason,
      },
      objectRecovered: objectRecovered.status,
      retryClearedAfterObject: metaAfterObjectRecovery.syncRetry == null,
      cloudOnlyPlan: cloudOnlyInspection.plan.plan,
      cloudOnlyCycle: cloudOnlyCycle.status,
      cloudOnlyFavorite: cloudOnlyFavorite?.isFavorite ?? null,
    };
  }, DB_NAME);

  assert.equal(result.networkFailure.status, 'error');
  assert.equal(result.networkFailure.runtimeState, 'ERROR');
  assert.equal(result.networkFailure.retryable, true);
  assert.ok(result.networkFailure.nextRetryAt);
  assert.equal(result.networkRetry.retryCount, 1);
  assert.ok(result.networkRetry.nextRetryAt);
  assert.equal(result.networkDeferred.status, 'deferred');
  assert.equal(result.networkDeferred.reason, 'retry-backoff');
  assert.equal(result.networkRecovered, 'synced');
  assert.equal(result.retryClearedAfterNetwork, true);

  assert.equal(result.rateFailure.status, 'error');
  assert.equal(result.rateFailure.runtimeState, 'ERROR');
  assert.equal(result.rateRetry.retryCount, 1);
  assert.equal(result.rateDeferred.status, 'deferred');
  assert.equal(result.rateDeferred.reason, 'retry-backoff');

  assert.equal(result.serverFailure.status, 'error');
  assert.equal(result.serverFailure.runtimeState, 'ERROR');
  assert.equal(result.serverRetry.retryCount, 2);
  assert.equal(result.transientRecovered, 'synced');

  assert.equal(result.offlineFailure.status, 'error');
  assert.equal(result.offlineFailure.runtimeState, 'OFFLINE');
  assert.equal(result.reconnectRecovered, 'synced');

  assert.equal(result.objectFailure.status, 'error');
  assert.equal(result.objectFailure.runtimeState, 'ERROR');
  assert.ok(result.objectRetry.nextRetryAt);
  assert.equal(result.objectDeferred.status, 'deferred');
  assert.equal(result.objectDeferred.reason, 'retry-backoff');
  assert.equal(result.objectRecovered, 'synced');
  assert.equal(result.retryClearedAfterObject, true);

  assert.equal(result.cloudOnlyPlan, 'download-cloud');
  assert.equal(result.cloudOnlyCycle, 'synced');
  assert.equal(result.cloudOnlyFavorite, true);

  console.log('V5 B12.5 sync reliability browser gate passed.');
} finally {
  await browser.close();
}

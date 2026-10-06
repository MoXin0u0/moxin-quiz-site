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
    const { closeDatabase, openDatabase, requestToPromise } = await import('/src/storage/db.js');
    const { runV5MigrationToCompletion } = await import('/src/storage/migrations/v5-migration.js');
    const { saveNote, setFavorite } = await import('/src/storage/repositories/learning.js');
    const {
      applyStagedCommits,
      prepareNextCloudCommit,
      publishPreparedCloudCommit,
      stageRemoteCommits,
    } = await import('/src/sync/commit-transport.js');
    const { createCloudCommit, cloudAppProperties } = await import('/src/sync/cloud-contract.js');
    const { CloudProviderError, CLOUD_ERROR_CODE } = await import('/src/cloud/provider.js');

    await closeDatabase();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB delete blocked.'));
    });
    await openDatabase();
    await runV5MigrationToCompletion();

    await saveNote('bank-a', 'Q1', 'first');
    await saveNote('bank-a', 'Q1', 'second');
    await setFavorite('bank-a', 'Q1', true);
    await setFavorite('bank-a', 'Q1', false);

    const db = await openDatabase();
    const readAll = storeName =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
    const readOne = (storeName, key) =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));

    const before = await readAll('syncOutbox');
    const noteRows = before
      .filter(item => item.entityType === 'note')
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const favoriteRows = before.filter(item => item.entityType === 'favorite');

    const firstPrepared = await prepareNextCloudCommit({
      profileId: 'profile-a',
      now: new Date('2026-10-06T08:00:00.000Z'),
    });
    const secondPrepared = await prepareNextCloudCommit({
      profileId: 'profile-a',
      now: new Date('2026-10-06T08:00:01.000Z'),
    });

    const remoteFiles = [];
    const remotePayloads = new Map();
    let createCalls = 0;
    let failAfterStore = true;

    const provider = {
      async listFiles({ appProperties = {}, pageToken = null } = {}) {
        if (pageToken) return { files: [], nextPageToken: null };
        return {
          files: remoteFiles.filter(file =>
            Object.entries(appProperties).every(([key, value]) =>
              String(file.appProperties?.[key] || '') === String(value)
            )
          ),
          nextPageToken: null,
        };
      },
      async downloadJson(fileId) {
        return structuredClone(remotePayloads.get(fileId));
      },
      async createJsonFile({ name, data, appProperties }) {
        createCalls += 1;
        const file = {
          id: `file-${remoteFiles.length + 1}`,
          name,
          modifiedTime: '2026-10-06T08:00:02.000Z',
          appProperties: { ...appProperties },
        };
        remoteFiles.push(file);
        remotePayloads.set(file.id, structuredClone(data));
        if (failAfterStore) {
          failAfterStore = false;
          throw new CloudProviderError('simulated lost upload response', {
            code: CLOUD_ERROR_CODE.NETWORK,
            retryable: true,
          });
        }
        return file;
      },
    };

    let firstPublishError = null;
    try {
      await publishPreparedCloudCommit(provider, {
        profileId: 'profile-a',
        now: new Date('2026-10-06T08:00:02.000Z'),
      });
    } catch (error) {
      firstPublishError = { code: error.code, retryable: error.retryable };
    }

    const pendingAfterFailure = await readOne('syncMeta', 'global');
    const published = await publishPreparedCloudCommit(provider, {
      profileId: 'profile-a',
      now: new Date('2026-10-06T08:00:03.000Z'),
    });

    const outboxAfterPublish = await readAll('syncOutbox');
    const receiptsAfterPublish = await readAll('syncReceipts');
    const metaAfterPublish = await readOne('syncMeta', 'global');

    const remoteCommit = await createCloudCommit({
      profileId: 'profile-a',
      deviceId: 'device-remote',
      deviceSequence: 1,
      commitId: 'commit-remote-1',
      createdAt: '2026-10-06T08:05:00.000Z',
      mutations: [{
        mutationId: 'remote-mutation-1',
        type: 'favorite',
        key: 'bank-z::Q9',
        op: 'upsert',
        policy: 'coalescible',
        revision: null,
        value: { key: 'bank-z::Q9', isFavorite: true },
      }],
    });
    const remoteFile = {
      id: 'file-remote-1',
      name: 'remote.json',
      modifiedTime: '2026-10-06T08:05:00.000Z',
      appProperties: cloudAppProperties({
        profileId: 'profile-a',
        objectType: 'commit',
        objectId: remoteCommit.commitId,
        hash: remoteCommit.payloadHash,
      }),
    };
    remoteFiles.push(remoteFile);
    remotePayloads.set(remoteFile.id, remoteCommit);

    const staged = await stageRemoteCommits(provider, { profileId: 'profile-a' });
    const appliedIds = [];
    const applied = await applyStagedCommits(staged, {
      async applyCommit(commit) {
        appliedIds.push(commit.commitId);
      },
      now: () => new Date('2026-10-06T08:06:00.000Z'),
    });
    const stagedAgain = await stageRemoteCommits(provider, { profileId: 'profile-a' });

    return {
      notePayloads: noteRows.map(item => item.payload?.text),
      favoriteCount: favoriteRows.length,
      favoritePayload: favoriteRows[0]?.payload?.isFavorite,
      allHavePayload: before.every(item => item.hasPayload === true),
      preparedStable: firstPrepared.commitId === secondPrepared.commitId,
      preparedSequence: firstPrepared.deviceSequence,
      firstPublishError,
      pendingAfterFailure: pendingAfterFailure.pendingCloudCommit?.commit?.commitId || null,
      createCalls,
      reusedExistingFile: published.reusedExistingFile,
      outboxAfterPublish: outboxAfterPublish.length,
      receiptsAfterPublish: receiptsAfterPublish.map(item => item.commitId).sort(),
      nextCommitSequence: metaAfterPublish.nextCommitSequence,
      stagedIds: staged.map(item => item.commit.commitId),
      applied,
      appliedIds,
      stagedAgainIds: stagedAgain.map(item => item.commit.commitId),
    };
  }, DB_NAME);

  assert.deepEqual(result.notePayloads, ['first', 'second']);
  assert.equal(result.favoriteCount, 1, 'coalescible favorite should retain only the latest pending mutation');
  assert.equal(result.favoritePayload, false);
  assert.equal(result.allHavePayload, true, 'new outbox mutations need durable payload snapshots');

  assert.equal(result.preparedStable, true, 're-preparing must reuse the same pending commit');
  assert.equal(result.preparedSequence, 1);
  assert.deepEqual(result.firstPublishError, { code: 'NETWORK', retryable: true });
  assert.ok(result.pendingAfterFailure);
  assert.equal(result.createCalls, 1, 'retry must discover the already-created immutable commit instead of duplicating it');
  assert.equal(result.reusedExistingFile, true);
  assert.equal(result.outboxAfterPublish, 0);
  assert.equal(result.nextCommitSequence, 2);
  assert.equal(result.receiptsAfterPublish.length, 1);

  assert.deepEqual(result.stagedIds, ['commit-remote-1']);
  assert.deepEqual(result.appliedIds, ['commit-remote-1']);
  assert.deepEqual(result.applied, [{ commitId: 'commit-remote-1', skipped: false }]);
  assert.deepEqual(result.stagedAgainIds, [], 'receipt must make pull idempotent');

  console.log('V5 B09 commit transport browser gate passed.');
} finally {
  await browser.close();
}

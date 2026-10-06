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
    const { saveStudioDraft } = await import('/src/storage/repositories/studio.js');
    const { saveBankPackage } = await import('/src/storage/repositories/banks.js');
    const {
      materializePendingObjectMutations,
    } = await import('/src/sync/object-mutation-transport.js');
    const { prepareNextCloudCommit } = await import('/src/sync/commit-transport.js');
    const { applyRemoteCommitAtomically } = await import('/src/sync/remote-apply.js');
    const { sha256Blob } = await import('/src/sync/hash.js');

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

    await reset();

    const sharedBlob = new Blob(['shared-object-asset'], { type: 'image/png' });
    const draft = await saveStudioDraft({
      id: 'draft-object-sync',
      bankId: 'bank-object-sync',
      manifest: {
        id: 'bank-object-sync',
        name: 'Object Sync Draft',
        version: '1.0.0',
      },
      questions: [{
        id: 'Q1',
        questionUid: 'uid-draft-q1',
        type: 'true-false',
        question: 'draft?',
        answer: [true],
      }],
      assets: [{
        path: 'assets/shared.png',
        mimeType: 'image/png',
        blob: sharedBlob,
      }],
      sourceBankVersion: '1.0.0',
    });

    await saveBankPackage({
      sourceType: 'user',
      sourceDraftId: draft.id,
      manifest: {
        id: 'bank-object-sync',
        name: 'Object Sync Bank',
        version: '1.0.0',
        updatedAt: '2026-10-06T12:00:00.000Z',
      },
      questions: [{
        id: 'Q1',
        type: 'true-false',
        question: 'bank?',
        answer: [true],
      }],
      assets: [{
        path: 'assets/shared.png',
        mimeType: 'image/png',
        blob: sharedBlob,
      }],
    });

    const files = [];
    const payloads = new Map();
    let createBlobCalls = 0;
    let createJsonCalls = 0;

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
      async createBlobFile({ name, blob, mimeType, appProperties }) {
        createBlobCalls += 1;
        const file = {
          id: `file-${files.length + 1}`,
          name,
          mimeType,
          size: String(blob.size),
          modifiedTime: '2026-10-06T12:01:00.000Z',
          appProperties: { ...appProperties },
        };
        files.push(file);
        payloads.set(file.id, blob);
        return structuredClone(file);
      },
      async createJsonFile({ name, data, appProperties }) {
        createJsonCalls += 1;
        const text = JSON.stringify(data);
        const file = {
          id: `file-${files.length + 1}`,
          name,
          mimeType: 'application/json',
          size: String(new TextEncoder().encode(text).byteLength),
          modifiedTime: '2026-10-06T12:01:00.000Z',
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
    };

    const materialized = await materializePendingObjectMutations(provider, {
      profileId: 'profile-object-sync',
      now: new Date('2026-10-06T12:02:00.000Z'),
    });

    let db = await openDatabase();
    const beforeCommitOutbox = await requestToPromise(
      db.transaction('syncOutbox', 'readonly').objectStore('syncOutbox').getAll(),
    );

    const commit = await prepareNextCloudCommit({
      profileId: 'profile-object-sync',
      now: new Date('2026-10-06T12:03:00.000Z'),
    });

    const objectMutations = commit.mutations.filter(item =>
      item.type === 'studio-draft' || item.type === 'user-bank'
    );

    const originalAssetHash = await sha256Blob(sharedBlob);

    // Simulate a second device with a fresh local database, while the fake
    // provider keeps the cloud object files created above.
    await reset();

    const applied = await applyRemoteCommitAtomically(commit, {
      provider,
      now: new Date('2026-10-06T12:04:00.000Z'),
    });

    db = await openDatabase();
    const readOne = (storeName, key) =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
    const byIndex = (storeName, indexName, key) =>
      requestToPromise(
        db.transaction(storeName, 'readonly')
          .objectStore(storeName)
          .index(indexName)
          .getAll(IDBKeyRange.only(key)),
      );

    const remoteDraft = await readOne('studioDrafts', 'draft-object-sync');
    const remoteBank = await readOne('banks', 'bank-object-sync');
    const remoteQuestions = await byIndex('questions', 'bankId', 'bank-object-sync');
    const remoteAssets = await byIndex('assets', 'bankId', 'bank-object-sync');
    const draftAssetHash = await sha256Blob(remoteDraft.assets[0].blob);
    const bankAssetHash = await sha256Blob(remoteAssets[0].blob);

    return {
      draftRevision: draft.revision?.revisionId || null,
      materialized,
      outboxObjectTypes: beforeCommitOutbox
        .filter(item => item.objectRef)
        .map(item => [item.entityType, item.objectRef.objectType])
        .sort((a, b) => a[0].localeCompare(b[0])),
      createBlobCalls,
      createJsonCalls,
      commitObjectMutations: objectMutations.map(item => ({
        type: item.type,
        value: item.value,
        objectType: item.objectRef?.objectType || null,
        revisionId: item.revision?.revisionId || null,
      })).sort((a, b) => a.type.localeCompare(b.type)),
      appliedResults: applied.results,
      remoteDraft: {
        id: remoteDraft?.id || null,
        bankId: remoteDraft?.bankId || null,
        revisionId: remoteDraft?.revision?.revisionId || null,
        assetCount: remoteDraft?.assets?.length || 0,
      },
      remoteBank: {
        id: remoteBank?.id || null,
        sourceType: remoteBank?.sourceType || null,
        revisionId: remoteBank?.revision?.revisionId || null,
        questionCount: remoteBank?.questionCount ?? null,
      },
      remoteQuestionCount: remoteQuestions.length,
      remoteAssetCount: remoteAssets.length,
      draftAssetHash,
      bankAssetHash,
      originalAssetHash,
    };
  }, DB_NAME);

  assert.ok(result.draftRevision);
  assert.equal(result.materialized.length, 2);
  assert.deepEqual(result.outboxObjectTypes, [
    ['studio-draft', 'draft'],
    ['user-bank', 'user-bank'],
  ]);

  assert.equal(
    result.createBlobCalls,
    1,
    'identical draft and user-bank assets must deduplicate by SHA-256',
  );
  assert.equal(result.createJsonCalls, 2);

  assert.deepEqual(
    result.commitObjectMutations.map(item => [item.type, item.value, item.objectType]),
    [
      ['studio-draft', null, 'draft'],
      ['user-bank', null, 'user-bank'],
    ],
  );
  assert.ok(result.commitObjectMutations.every(item => item.revisionId));

  assert.equal(result.remoteDraft.id, 'draft-object-sync');
  assert.equal(result.remoteDraft.bankId, 'bank-object-sync');
  assert.equal(result.remoteDraft.assetCount, 1);
  assert.ok(result.remoteDraft.revisionId);

  assert.equal(result.remoteBank.id, 'bank-object-sync');
  assert.equal(result.remoteBank.sourceType, 'user');
  assert.equal(result.remoteBank.questionCount, 1);
  assert.ok(result.remoteBank.revisionId);
  assert.equal(result.remoteQuestionCount, 1);
  assert.equal(result.remoteAssetCount, 1);
  assert.equal(result.draftAssetHash, result.originalAssetHash);
  assert.equal(result.bankAssetHash, result.originalAssetHash);

  assert.equal(
    result.appliedResults.filter(item => item.action === 'apply-remote').length,
    2,
  );

  console.log('V5 B11B object-backed Studio/User Bank browser gate passed.');
} finally {
  await browser.close();
}

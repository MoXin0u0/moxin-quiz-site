import { openDatabase, requestToPromise, transactionDone } from '../db.js';
import { assetKey, createUuid, questionKey } from '../../utils/ids.js';
import {
  computeAssetContentHash,
  computeBankFingerprint,
  computeQuestionFingerprint,
} from '../../content/fingerprints.js';
import {
  attachMutationPayloadInTransaction,
  createRevisionMutationInTransaction,
  getLatestTombstoneRevisionInTransaction,
} from '../transactions/sync-mutation.js';

export async function saveBankPackage(pkg) {
  const { manifest, questions = [], assets = [] } = pkg || {};
  const bankId = String(manifest?.id || '');
  if (!bankId) throw new Error('Cannot save a bank without manifest.id.');

  const sourceType = pkg.sourceType === 'author' ? 'author' : 'user';
  const now = new Date();
  const preparedQuestions = await prepareQuestions(bankId, questions);
  const preparedAssets = await prepareAssets(bankId, assets);
  const fingerprint = await computeBankFingerprint({
    bank: manifest,
    questions: preparedQuestions,
    assets: preparedAssets,
  });

  const db = await openDatabase();
  const stores = sourceType === 'user'
    ? [
        'banks',
        'questions',
        'assets',
        'syncMeta',
        'syncOutbox',
        'syncRevisions',
        'syncTombstones',
      ]
    : ['banks', 'questions', 'assets'];

  const tx = db.transaction(stores, 'readwrite');
  const done = transactionDone(tx);

  try {
    const bankStore = tx.objectStore('banks');
    const questionStore = tx.objectStore('questions');
    const assetStore = tx.objectStore('assets');
    const existing = await requestToPromise(bankStore.get(bankId));

    await deleteByIndex(questionStore, 'bankId', bankId);
    await deleteByIndex(assetStore, 'bankId', bankId);

    let revision = existing?.revision || null;
    let mutation = null;

    if (sourceType === 'user') {
      const tombstoneRevision = existing
        ? null
        : await getLatestTombstoneRevisionInTransaction(tx, {
            entityType: 'user-bank',
            entityKey: bankId,
          });

      const created = await createRevisionMutationInTransaction(tx, {
        entityType: 'user-bank',
        entityKey: bankId,
        previousRevision: existing?.revision || tombstoneRevision || null,
        operation: 'upsert',
        coalesceKey: `user-bank:${bankId}`,
        now,
      });
      revision = created.revision;
      mutation = created.mutation;
    }

    const timestamp = now.toISOString();
    const bankRecord = {
      ...manifest,
      id: bankId,
      questionCount: preparedQuestions.length,
      sourceType,
      sourceMetadata: pkg.sourceMetadata || existing?.sourceMetadata || null,
      importedAt: existing?.importedAt || pkg.importedAt || timestamp,
      storedAt: timestamp,
      contentFingerprint: fingerprint,
      ...(sourceType === 'user' ? { revision } : {}),
    };

    bankStore.put(bankRecord);
    for (const question of preparedQuestions) questionStore.put(question);
    for (const asset of preparedAssets) assetStore.put(asset);

    if (mutation) {
      attachMutationPayloadInTransaction(tx, mutation, {
        revision,
        bank: bankRecord,
        questions: preparedQuestions.map(stripQuestionStorageFields),
        assets: preparedAssets.map(stripAssetStorageFields),
        sourceDraftId: pkg.sourceDraftId || null,
      });
    }

    await done;
    return bankId;
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

export async function listBanks() {
  const db = await openDatabase();
  const tx = db.transaction('banks', 'readonly');
  const banks = await requestToPromise(tx.objectStore('banks').getAll());
  return (banks || []).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export async function getBank(bankId) {
  const db = await openDatabase();
  const tx = db.transaction('banks', 'readonly');
  return (await requestToPromise(tx.objectStore('banks').get(bankId))) ?? null;
}

export async function getQuestionsByBank(bankId) {
  const db = await openDatabase();
  const tx = db.transaction('questions', 'readonly');
  return (await requestToPromise(tx.objectStore('questions').index('bankId').getAll(IDBKeyRange.only(bankId)))) ?? [];
}

export async function getQuestion(bankId, questionId) {
  const db = await openDatabase();
  const tx = db.transaction('questions', 'readonly');
  return (await requestToPromise(tx.objectStore('questions').get(questionKey(bankId, questionId)))) ?? null;
}

export async function getAssetsByBank(bankId) {
  const db = await openDatabase();
  const tx = db.transaction('assets', 'readonly');
  return (await requestToPromise(tx.objectStore('assets').index('bankId').getAll(IDBKeyRange.only(bankId)))) ?? [];
}

export async function getAsset(bankId, path) {
  const db = await openDatabase();
  const tx = db.transaction('assets', 'readonly');
  return (await requestToPromise(tx.objectStore('assets').get(assetKey(bankId, path)))) ?? null;
}

export async function getBankPackage(bankId, { includeAssets = true } = {}) {
  const [manifest, questions, assets] = await Promise.all([
    getBank(bankId),
    getQuestionsByBank(bankId),
    includeAssets ? getAssetsByBank(bankId) : Promise.resolve([]),
  ]);
  if (!manifest) return null;
  return { manifest, questions: questions.map(stripStorageFields), assets };
}

// Local content removal only. This intentionally does not create a cloud tombstone.
export async function deleteBank(bankId) {
  const db = await openDatabase();
  const tx = db.transaction(['banks', 'questions', 'assets'], 'readwrite');
  const done = transactionDone(tx);

  try {
    tx.objectStore('banks').delete(bankId);
    await deleteByIndex(tx.objectStore('questions'), 'bankId', bankId);
    await deleteByIndex(tx.objectStore('assets'), 'bankId', bankId);
    await done;
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

// Explicit synced delete. This is deliberately separate from deleteBank() so
// "remove this device content" cannot become a cloud-wide destructive action.
export async function deleteUserBankFromSyncedLibrary(bankId) {
  const key = String(bankId || '');
  if (!key) return false;

  const db = await openDatabase();
  const tx = db.transaction([
    'banks',
    'questions',
    'assets',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
    'syncTombstones',
  ], 'readwrite');
  const done = transactionDone(tx);

  try {
    const bankStore = tx.objectStore('banks');
    const existing = await requestToPromise(bankStore.get(key));
    if (!existing) {
      await done;
      return false;
    }
    if (existing.sourceType === 'author') {
      throw new Error('Author catalog content cannot be deleted as a synced user bank.');
    }

    const now = new Date();
    const { revision, mutation } = await createRevisionMutationInTransaction(tx, {
      entityType: 'user-bank',
      entityKey: key,
      previousRevision: existing.revision || null,
      operation: 'delete',
      coalesceKey: `user-bank:${key}`,
      now,
    });

    const tombstone = {
      tombstoneId: createUuid('tombstone'),
      entityType: 'user-bank',
      entityKey: key,
      deletedAt: now.toISOString(),
      revision,
    };

    bankStore.delete(key);
    await deleteByIndex(tx.objectStore('questions'), 'bankId', key);
    await deleteByIndex(tx.objectStore('assets'), 'bankId', key);
    tx.objectStore('syncTombstones').put(tombstone);
    attachMutationPayloadInTransaction(tx, mutation, tombstone);

    await done;
    return true;
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

async function prepareQuestions(bankId, questions) {
  const output = [];
  for (const question of Array.isArray(questions) ? questions : []) {
    const questionId = String(question?.id || question?.questionId || '');
    if (!questionId) throw new Error('Question is missing id.');
    const record = {
      ...question,
      id: questionId,
      key: questionKey(bankId, questionId),
      bankId,
      questionId,
    };
    record.questionFingerprint = await computeQuestionFingerprint(record);
    output.push(record);
  }
  return output;
}

async function prepareAssets(bankId, assets) {
  const output = [];
  for (const asset of Array.isArray(assets) ? assets : []) {
    const path = String(asset?.path || '');
    if (!path) throw new Error('Asset is missing path.');

    const blob = typeof Blob !== 'undefined' && asset?.blob instanceof Blob
      ? asset.blob
      : null;
    const record = {
      ...asset,
      key: assetKey(bankId, path),
      bankId,
      path,
      mimeType: String(asset?.mimeType || blob?.type || 'application/octet-stream'),
      size: Number(asset?.size ?? blob?.size ?? 0) || 0,
      blob,
      contentHash: asset?.contentHash ? String(asset.contentHash) : null,
    };
    record.contentHash = record.contentHash || await computeAssetContentHash(record);
    record.hashStatus = record.contentHash ? 'ready' : 'failed';
    output.push(record);
  }
  return output;
}

function deleteByIndex(store, indexName, value) {
  return new Promise((resolve, reject) => {
    const request = store.index(indexName).openCursor(IDBKeyRange.only(value));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
  });
}

function stripStorageFields(record) {
  if (!record) return record;
  const { key, bankId, questionId, questionFingerprint, ...question } = record;
  return question;
}

function stripQuestionStorageFields(record) {
  if (!record) return record;
  const { key, bankId, questionId, ...question } = record;
  return question;
}

function stripAssetStorageFields(record) {
  if (!record) return record;
  const { key, bankId, ...asset } = record;
  return asset;
}

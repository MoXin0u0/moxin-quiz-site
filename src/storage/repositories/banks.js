import { openDatabase, requestToPromise, transactionDone } from '../db.js';
import { assetKey, questionKey } from '../../utils/ids.js';

export async function saveBankPackage(pkg) {
  const { manifest, questions, assets = [] } = pkg;
  const bankId = manifest.id;
  if (!bankId) throw new Error('Cannot save a bank without manifest.id.');

  const db = await openDatabase();
  const tx = db.transaction(['banks', 'questions', 'assets'], 'readwrite');
  const done = transactionDone(tx);
  const bankStore = tx.objectStore('banks');
  const questionStore = tx.objectStore('questions');
  const assetStore = tx.objectStore('assets');

  let cleanupPending = 2;
  const afterCleanup = () => {
    cleanupPending -= 1;
    if (cleanupPending !== 0) return;

    const now = new Date().toISOString();
    bankStore.put({
      ...manifest,
      id: bankId,
      questionCount: questions.length,
      sourceType: pkg.sourceType === 'author' ? 'author' : 'user',
      sourceMetadata: pkg.sourceMetadata || null,
      importedAt: pkg.importedAt || now,
      storedAt: now,
    });

    for (const question of questions) {
      questionStore.put({
        ...question,
        key: questionKey(bankId, question.id),
        bankId,
        questionId: question.id,
      });
    }

    for (const asset of assets) {
      assetStore.put({
        key: assetKey(bankId, asset.path),
        bankId,
        path: asset.path,
        mimeType: asset.mimeType || asset.blob?.type || 'application/octet-stream',
        size: asset.size ?? asset.blob?.size ?? 0,
        blob: asset.blob,
      });
    }
  };

  deleteByIndex(questionStore, 'bankId', bankId, afterCleanup, tx);
  deleteByIndex(assetStore, 'bankId', bankId, afterCleanup, tx);
  await done;
  return bankId;
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

export async function deleteBank(bankId) {
  const db = await openDatabase();
  const tx = db.transaction(['banks', 'questions', 'assets'], 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('banks').delete(bankId);
  deleteByIndex(tx.objectStore('questions'), 'bankId', bankId, null, tx);
  deleteByIndex(tx.objectStore('assets'), 'bankId', bankId, null, tx);
  await done;
}

function deleteByIndex(store, indexName, value, onComplete, tx) {
  const request = store.index(indexName).openCursor(IDBKeyRange.only(value));
  request.onerror = () => {
    try { tx.abort(); } catch { /* transaction may already be aborting */ }
  };
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) {
      onComplete?.();
      return;
    }
    cursor.delete();
    cursor.continue();
  };
}

function stripStorageFields(record) {
  if (!record) return record;
  const { key, bankId, questionId, ...question } = record;
  return question;
}

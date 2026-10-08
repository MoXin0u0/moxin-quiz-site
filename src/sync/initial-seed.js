import {
  openDatabase,
  requestToPromise,
  transactionDone,
} from '../storage/db.js';
import { buildOutboxMutation } from './outbox-service.js';
import { SYNC_RUNTIME_STATE } from './config.js';

const SOURCE_STORES = Object.freeze([
  'attempts',
  'favorites',
  'mastery',
  'notes',
  'learningGoals',
  'accountSettings',
  'authorLibrary',
  'devices',
  'sessions',
  'studioDrafts',
  'banks',
  'questions',
  'assets',
  'syncTombstones',
  'syncOutbox',
  'syncMeta',
]);

export async function seedInitialSyncOutbox({
  now = new Date(),
} = {}) {
  const db = await openDatabase();
  const tx = db.transaction(SOURCE_STORES, 'readwrite');
  const done = transactionDone(tx);

  try {
    const readAll = name => requestToPromise(tx.objectStore(name).getAll());
    const [
      attempts,
      favorites,
      unfamiliar,
      notes,
      goals,
      accountSettings,
      authorLibrary,
      devices,
      sessions,
      drafts,
      banks,
      questions,
      assets,
      tombstones,
      existingOutbox,
    ] = await Promise.all([
      readAll('attempts'),
      readAll('favorites'),
      readAll('mastery'),
      readAll('notes'),
      readAll('learningGoals'),
      readAll('accountSettings'),
      readAll('authorLibrary'),
      readAll('devices'),
      readAll('sessions'),
      readAll('studioDrafts'),
      readAll('banks'),
      readAll('questions'),
      readAll('assets'),
      readAll('syncTombstones'),
      readAll('syncOutbox'),
    ]);

    const metaStore = tx.objectStore('syncMeta');
    const meta = await requestToPromise(metaStore.get('global'));
    if (!meta?.deviceId) {
      throw new Error('Initial sync seed requires a local device identity.');
    }

    const existingKeys = new Set((existingOutbox || []).map(row => dedupeKey({
      entityType: row.entityType,
      entityKey: row.entityKey,
      operation: row.operation,
      revisionId: row.targetRevisionId,
    })));

    const currentEntities = new Set();
    const outboxStore = tx.objectStore('syncOutbox');
    let seededCount = 0;

    const enqueue = ({
      entityType,
      entityKey,
      operation = 'upsert',
      revision = null,
      payload,
      createdAt = now.toISOString(),
    }) => {
      const key = dedupeKey({
        entityType,
        entityKey,
        operation,
        revisionId: revision?.revisionId || null,
      });
      if (existingKeys.has(key)) return false;

      const mutation = buildOutboxMutation({
        entityType,
        entityKey,
        operation,
        targetRevisionId: revision?.revisionId || null,
        payload,
        coalesceKey: null,
        createdAt,
        deviceId: meta.deviceId,
      });
      outboxStore.put(mutation);
      existingKeys.add(key);
      seededCount += 1;
      return true;
    };

    for (const attempt of attempts || []) {
      const eventId = String(attempt?.eventId || '');
      if (!eventId) continue;
      const payload = { ...attempt };
      delete payload.id;
      enqueue({
        entityType: 'attempt',
        entityKey: eventId,
        operation: 'append',
        payload,
        createdAt: attempt.answeredAt || attempt.timestamp || now.toISOString(),
      });
    }

    for (const record of favorites || []) {
      seedMutable(enqueue, currentEntities, 'favorite', record.key, record);
    }
    for (const record of unfamiliar || []) {
      seedMutable(enqueue, currentEntities, 'unfamiliar', record.key, record);
    }
    for (const record of notes || []) {
      seedMutable(enqueue, currentEntities, 'note', record.key, record);
    }
    for (const record of goals || []) {
      seedMutable(enqueue, currentEntities, 'learning-goal', record.id, record);
    }
    for (const record of accountSettings || []) {
      seedMutable(enqueue, currentEntities, 'account-settings', record.id, record);
    }
    for (const record of authorLibrary || []) {
      seedMutable(enqueue, currentEntities, 'author-library', record.bankId, record);
    }
    for (const record of devices || []) {
      seedMutable(enqueue, currentEntities, 'device', record.deviceId, record);
    }
    for (const record of sessions || []) {
      const type = record?.sessionType === 'exam' || record?.mode === 'exam'
        ? 'exam-session'
        : 'practice-session';
      seedMutable(enqueue, currentEntities, type, record.id, record);
    }
    for (const record of drafts || []) {
      seedMutable(enqueue, currentEntities, 'studio-draft', record.id, record);
    }

    const questionsByBank = groupByBank(questions);
    const assetsByBank = groupByBank(assets);
    for (const bank of banks || []) {
      if (!bank?.id || bank.sourceType === 'author') continue;
      const bankId = String(bank.id);
      const payload = {
        revision: bank.revision || null,
        bank,
        questions: (questionsByBank.get(bankId) || []).map(stripQuestionStorageFields),
        assets: (assetsByBank.get(bankId) || []).map(stripAssetStorageFields),
        sourceDraftId: null,
      };
      seedMutable(enqueue, currentEntities, 'user-bank', bankId, payload, bank.revision);
    }

    for (const tombstone of tombstones || []) {
      const entityType = String(tombstone?.entityType || '');
      const entityKey = String(tombstone?.entityKey || '');
      if (!entityType || !entityKey || !tombstone?.revision?.revisionId) continue;
      if (currentEntities.has(`${entityType}:${entityKey}`)) continue;
      enqueue({
        entityType,
        entityKey,
        operation: 'delete',
        revision: tombstone.revision,
        payload: tombstone,
        createdAt: tombstone.deletedAt || tombstone.revision.changedAt || now.toISOString(),
      });
    }

    metaStore.put({
      ...meta,
      runtimeState: (existingOutbox?.length || 0) + seededCount > 0
        ? SYNC_RUNTIME_STATE.PENDING
        : meta.runtimeState,
    });

    await done;
    return {
      seededCount,
      existingCount: existingOutbox?.length || 0,
      pendingCount: (existingOutbox?.length || 0) + seededCount,
    };
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

function seedMutable(enqueue, currentEntities, entityType, entityKey, record, revision = record?.revision) {
  const key = String(entityKey || '');
  if (!key || !revision?.revisionId) return false;
  currentEntities.add(`${entityType}:${key}`);
  return enqueue({
    entityType,
    entityKey: key,
    operation: 'upsert',
    revision,
    payload: record,
    createdAt: revision.changedAt || record?.updatedAt || record?.changedAt || new Date().toISOString(),
  });
}

function groupByBank(records) {
  const map = new Map();
  for (const record of records || []) {
    const bankId = String(record?.bankId || '');
    if (!bankId) continue;
    if (!map.has(bankId)) map.set(bankId, []);
    map.get(bankId).push(record);
  }
  return map;
}

function stripQuestionStorageFields(record) {
  const { key, bankId, questionId, ...question } = record || {};
  return question;
}

function stripAssetStorageFields(record) {
  const { key, bankId, ...asset } = record || {};
  return asset;
}

function dedupeKey({
  entityType,
  entityKey,
  operation,
  revisionId,
}) {
  return [
    String(entityType || ''),
    String(entityKey || ''),
    String(operation || ''),
    String(revisionId || ''),
  ].join('|');
}

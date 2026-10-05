import {
  openDatabase,
  requestToPromise,
  transactionDone,
} from '../db.js';
import { APP_CONFIG } from '../../app/config.js';
import { createDeviceId } from '../../utils/ids.js';
import { sha256Canonical } from '../../sync/hash.js';
import {
  computeAssetContentHash,
  computeBankFingerprint,
  computeDraftFingerprint,
  computeQuestionFingerprint,
} from '../../content/fingerprints.js';
import { buildDerivedLearningRecords } from '../../learning/derived-state.js';

export const V5_MIGRATION_TARGET_DB_VERSION = 4;
export const V5_MIGRATION_BATCH_SIZE = 250;
export const LEGACY_MIGRATION_DEVICE_ID = 'legacy-migration';

export const V5_MIGRATION_PHASES = Object.freeze([
  'device-identity',
  'attempt-events',
  'boolean-states',
  'notes-goals',
  'sessions',
  'banks',
  'drafts',
  'asset-hashes',
  'derived-rebuild',
  'completed',
]);

const FALLBACK_INSTANT = '1970-01-01T00:00:00.000Z';

function isoOrFallback(value, fallback = FALLBACK_INSTANT) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function dateKeyFromLegacy(value) {
  const text = String(value || '').trim();
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function stripShaPrefix(value) {
  return String(value || '').replace(/^sha256:/, '');
}

function isEmptyLegacyAnswer(value) {
  if (value === null || value === undefined || value === '') return true;
  return Array.isArray(value) && value.length === 0;
}

function legacyAttemptOutcome(source = {}) {
  if (source.correct === true) return 'correct';

  const mode = String(source.mode || '').toLowerCase();
  const isExam = mode === 'exam' || mode.startsWith('exam:');
  if (isExam && isEmptyLegacyAnswer(source.selectedAnswer)) return 'unanswered';

  return 'wrong';
}

async function legacyRevisionMeta({
  entityType,
  entityKey,
  payload,
  changedAt,
}) {
  const instant = isoOrFallback(changedAt);
  const digest = await sha256Canonical({
    entityType,
    entityKey,
    payload,
    changedAt: instant,
  });

  return {
    revisionId: `legacy-revision:${stripShaPrefix(digest)}`,
    parentRevisionIds: [],
    changedAt: instant,
    changedByDeviceId: LEGACY_MIGRATION_DEVICE_ID,
    clock: {
      physicalMs: Math.max(0, new Date(instant).getTime() || 0),
      logical: 0,
      deviceId: LEGACY_MIGRATION_DEVICE_ID,
    },
  };
}

function revisionRecord(entityType, entityKey, revision) {
  return {
    ...revision,
    entityType,
    entityKey,
  };
}

function defaultMigrationState() {
  return {
    targetDbVersion: V5_MIGRATION_TARGET_DB_VERSION,
    phase: 'device-identity',
    scope: null,
    cursor: null,
    status: 'pending',
    startedAt: null,
    updatedAt: null,
    lastError: null,
  };
}

async function getSyncMeta(db) {
  const tx = db.transaction('syncMeta', 'readonly');
  return (await requestToPromise(tx.objectStore('syncMeta').get('global'))) || {
    key: 'global',
    nextCommitSequence: 1,
    runtimeState: 'LOCAL_ONLY',
    linkedProfileId: null,
    cloudSchemaVersion: null,
    lastSuccessfulSyncAt: null,
    lastSyncAttemptAt: null,
    lastCheckpointId: null,
    pendingCloudCommit: null,
    clock: { physicalMs: 0, logical: 0 },
    reconciliation: null,
    migration: defaultMigrationState(),
  };
}

async function saveSyncMeta(db, meta) {
  const tx = db.transaction('syncMeta', 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('syncMeta').put(meta);
  await done;
}

async function updateMigrationState(db, patch) {
  const meta = await getSyncMeta(db);
  const now = new Date().toISOString();
  const current = meta.migration || defaultMigrationState();
  const migration = {
    ...current,
    ...patch,
    targetDbVersion: V5_MIGRATION_TARGET_DB_VERSION,
    startedAt: current.startedAt || now,
    updatedAt: now,
  };
  await saveSyncMeta(db, { ...meta, key: 'global', migration });
  return migration;
}

async function readBatch(db, storeName, cursor = null, limit = V5_MIGRATION_BATCH_SIZE) {
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const range = cursor === null || cursor === undefined
    ? null
    : IDBKeyRange.lowerBound(cursor, true);

  return new Promise((resolve, reject) => {
    const rows = [];
    const request = store.openCursor(range);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const item = request.result;
      if (!item || rows.length >= limit) {
        resolve(rows);
        return;
      }
      rows.push({ key: item.primaryKey, value: item.value });
      item.continue();
    };
  });
}

async function writeRowsWithRevisions(db, {
  storeName,
  rows,
  revisions = [],
  migration,
}) {
  const stores = [...new Set([storeName, 'syncRevisions', 'syncMeta'])];
  const tx = db.transaction(stores, 'readwrite');
  const done = transactionDone(tx);
  const target = tx.objectStore(storeName);
  const revisionStore = tx.objectStore('syncRevisions');
  const syncMetaStore = tx.objectStore('syncMeta');

  for (const row of rows) target.put(row);
  for (const revision of revisions) revisionStore.put(revision);

  const currentMeta = await requestToPromise(syncMetaStore.get('global')) || { key: 'global' };
  syncMetaStore.put({ ...currentMeta, migration });
  await done;
}

function nextPhaseName(phase) {
  const index = V5_MIGRATION_PHASES.indexOf(phase);
  return V5_MIGRATION_PHASES[Math.min(index + 1, V5_MIGRATION_PHASES.length - 1)];
}

async function finishPhase(db, phase) {
  const next = nextPhaseName(phase);
  return updateMigrationState(db, {
    phase: next,
    scope: null,
    cursor: null,
    status: next === 'completed' ? 'completed' : 'pending',
    lastError: null,
  });
}

async function migrateDeviceIdentity(db) {
  const meta = await getSyncMeta(db);
  const deviceId = meta.deviceId || createDeviceId();
  const now = new Date().toISOString();
  const revision = {
    revisionId: `device-genesis:${deviceId}`,
    parentRevisionIds: [],
    changedAt: now,
    changedByDeviceId: deviceId,
    clock: {
      physicalMs: Date.now(),
      logical: 0,
      deviceId,
    },
  };

  const tx = db.transaction(['devices', 'syncRevisions', 'syncMeta'], 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('devices').put({
    deviceId,
    label: '此裝置',
    platformHint: globalThis.navigator?.platform || null,
    browserHint: globalThis.navigator?.userAgent || null,
    status: 'active',
    createdAt: now,
    lastSeenAt: now,
    lastSyncAt: null,
    appVersion: APP_CONFIG.appVersion,
    revision,
  });
  tx.objectStore('syncRevisions').put(revisionRecord('device', deviceId, revision));

  const migration = {
    ...(meta.migration || defaultMigrationState()),
    targetDbVersion: V5_MIGRATION_TARGET_DB_VERSION,
    phase: 'attempt-events',
    scope: null,
    cursor: null,
    status: 'pending',
    startedAt: meta.migration?.startedAt || now,
    updatedAt: now,
    lastError: null,
  };

  tx.objectStore('syncMeta').put({
    ...meta,
    key: 'global',
    deviceId,
    nextCommitSequence: Number(meta.nextCommitSequence) > 0 ? meta.nextCommitSequence : 1,
    runtimeState: meta.runtimeState || 'LOCAL_ONLY',
    migration,
  });
  await done;
  return migration;
}

async function migratedAttemptCounts(db) {
  const tx = db.transaction('attempts', 'readonly');
  const records = await requestToPromise(tx.objectStore('attempts').getAll());
  const counts = new Map();

  for (const record of records || []) {
    const match = String(record.eventId || '').match(/^legacy-sha256:([a-f0-9]+):(\d+)$/);
    if (!match) continue;
    const signature = match[1];
    counts.set(signature, Math.max(counts.get(signature) || 0, Number(match[2])));
  }
  return counts;
}

async function migrateAttemptBatch(db, migration) {
  const rows = await readBatch(db, 'attempts', migration.cursor);
  if (!rows.length) return finishPhase(db, 'attempt-events');

  const counts = await migratedAttemptCounts(db);
  const transformed = [];

  for (const row of rows) {
    const source = row.value;
    if (source.eventId) {
      transformed.push(source);
      continue;
    }

    const signatureHash = await sha256Canonical({
      bankId: source.bankId || null,
      questionId: source.questionId || null,
      timestamp: source.timestamp || null,
      selectedAnswer: source.selectedAnswer ?? null,
      correct: source.correct === true,
      responseTime: Number.isFinite(source.responseTime) ? source.responseTime : null,
      mode: source.mode || null,
    });
    const signature = stripShaPrefix(signatureHash);
    const ordinal = (counts.get(signature) || 0) + 1;
    counts.set(signature, ordinal);

    const answeredAt = isoOrFallback(source.timestamp);
    const mode = String(source.mode || 'practice');
    const activityType = mode === 'exam' || mode.startsWith('exam:')
      ? 'exam'
      : (
        ['review', 'due', 'wrong', 'unfamiliar', 'favorite', 'scheduled-review']
          .some(prefix => mode === prefix || mode.startsWith(`${prefix}:`))
          ? 'review'
          : 'practice'
      );

    transformed.push({
      ...source,
      eventVersion: 1,
      eventId: `legacy-sha256:${signature}:${ordinal}`,
      answeredAt,
      recordedAt: answeredAt,
      deviceId: LEGACY_MIGRATION_DEVICE_ID,
      activityType,
      outcome: legacyAttemptOutcome(source),
      responseTimeMs: Number.isFinite(source.responseTime) ? source.responseTime : null,
      context: source.context || {
        bankName: null,
        bankVersion: null,
        bankFingerprint: null,
        questionFingerprint: null,
        questionType: 'unknown',
        chapter: null,
        difficulty: null,
      },
    });
  }

  const next = {
    ...migration,
    status: 'running',
    cursor: rows.at(-1).key,
    updatedAt: new Date().toISOString(),
  };
  await writeRowsWithRevisions(db, {
    storeName: 'attempts',
    rows: transformed,
    migration: next,
  });
  return next;
}

async function migrateBooleanScope(db, migration, scope) {
  const storeName = scope === 'favorites' ? 'favorites' : 'mastery';
  const rows = await readBatch(db, storeName, migration.cursor);
  if (!rows.length) {
    if (scope === 'favorites') {
      return updateMigrationState(db, {
        phase: 'boolean-states',
        scope: 'mastery',
        cursor: null,
        status: 'pending',
      });
    }
    return finishPhase(db, 'boolean-states');
  }

  const transformed = [];
  const revisions = [];
  for (const row of rows) {
    const source = row.value;
    const entityType = scope === 'favorites' ? 'favorite' : 'unfamiliar';
    const entityKey = String(source.key || `${source.bankId}::${source.questionId}`);
    const changedAt = isoOrFallback(
      scope === 'favorites'
        ? source.changedAt || source.addedAt
        : source.changedAt || source.updatedAt || source.markedAt,
    );

    const migrated = scope === 'favorites'
      ? {
          ...source,
          key: entityKey,
          bankId: String(source.bankId || ''),
          questionId: String(source.questionId || ''),
          isFavorite: source.isFavorite !== false,
          firstAddedAt: isoOrFallback(source.firstAddedAt || source.addedAt),
          changedAt,
        }
      : {
          ...source,
          key: entityKey,
          bankId: String(source.bankId || ''),
          questionId: String(source.questionId || ''),
          isUnfamiliar: source.isUnfamiliar !== false && source.status !== 'familiar',
          firstMarkedAt: isoOrFallback(source.firstMarkedAt || source.markedAt || source.updatedAt),
          changedAt,
        };

    const revision = source.revision || await legacyRevisionMeta({
      entityType,
      entityKey,
      payload: migrated,
      changedAt,
    });
    migrated.revision = revision;
    transformed.push(migrated);
    revisions.push(revisionRecord(entityType, entityKey, revision));
  }

  const next = {
    ...migration,
    scope,
    status: 'running',
    cursor: rows.at(-1).key,
    updatedAt: new Date().toISOString(),
  };
  await writeRowsWithRevisions(db, {
    storeName,
    rows: transformed,
    revisions,
    migration: next,
  });
  return next;
}

async function migrateNotesGoalsScope(db, migration, scope) {
  const storeName = scope === 'notes' ? 'notes' : 'learningGoals';
  const rows = await readBatch(db, storeName, migration.cursor);
  if (!rows.length) {
    if (scope === 'notes') {
      return updateMigrationState(db, {
        phase: 'notes-goals',
        scope: 'learningGoals',
        cursor: null,
        status: 'pending',
      });
    }
    return finishPhase(db, 'notes-goals');
  }

  const transformed = [];
  const revisions = [];
  for (const row of rows) {
    const source = row.value;
    const entityType = scope === 'notes' ? 'note' : 'learning-goal';
    const entityKey = String(scope === 'notes' ? source.key : source.id);
    const changedAt = isoOrFallback(source.updatedAt || source.createdAt);
    const migrated = scope === 'notes'
      ? {
          ...source,
          createdAt: isoOrFallback(source.createdAt || source.updatedAt),
          updatedAt: changedAt,
        }
      : {
          ...source,
          examDateKey: source.examDateKey || dateKeyFromLegacy(source.examDate),
          updatedAt: changedAt,
          createdAt: isoOrFallback(source.createdAt || source.updatedAt),
        };

    const revision = source.revision || await legacyRevisionMeta({
      entityType,
      entityKey,
      payload: migrated,
      changedAt,
    });
    migrated.revision = revision;
    transformed.push(migrated);
    revisions.push(revisionRecord(entityType, entityKey, revision));
  }

  const next = {
    ...migration,
    scope,
    status: 'running',
    cursor: rows.at(-1).key,
    updatedAt: new Date().toISOString(),
  };
  await writeRowsWithRevisions(db, {
    storeName,
    rows: transformed,
    revisions,
    migration: next,
  });
  return next;
}

async function migrateSessionBatch(db, migration) {
  const rows = await readBatch(db, 'sessions', migration.cursor);
  if (!rows.length) return finishPhase(db, 'sessions');

  const transformed = [];
  const revisions = [];
  for (const row of rows) {
    const source = row.value;
    const entityType = source.sessionType === 'exam' || source.mode === 'exam'
      ? 'exam-session'
      : 'practice-session';
    const entityKey = String(source.id);
    const updatedAt = isoOrFallback(source.updatedAt || source.createdAt);
    const sessionType = entityType === 'exam-session' ? 'exam' : 'practice';
    const status = source.submittedAt
      ? 'submitted'
      : source.finishedAt
        ? 'finished'
        : source.abandonedAt
          ? 'abandoned'
          : 'active';

    const migrated = {
      ...source,
      sessionType,
      status,
      createdAt: isoOrFallback(source.createdAt || source.startedAt),
      updatedAt,
    };
    const revision = source.revision || await legacyRevisionMeta({
      entityType,
      entityKey,
      payload: migrated,
      changedAt: updatedAt,
    });
    migrated.revision = revision;
    transformed.push(migrated);
    revisions.push(revisionRecord(entityType, entityKey, revision));
  }

  const next = {
    ...migration,
    status: 'running',
    cursor: rows.at(-1).key,
    updatedAt: new Date().toISOString(),
  };
  await writeRowsWithRevisions(db, {
    storeName: 'sessions',
    rows: transformed,
    revisions,
    migration: next,
  });
  return next;
}

async function migrateBankBatch(db, migration) {
  const rows = await readBatch(db, 'banks', migration.cursor, 1);
  if (!rows.length) return finishPhase(db, 'banks');

  const bank = rows[0].value;
  const bankId = String(bank.id);
  const tx = db.transaction(['questions', 'assets'], 'readonly');
  const questions = await requestToPromise(
    tx.objectStore('questions').index('bankId').getAll(IDBKeyRange.only(bankId)),
  );
  const assets = await requestToPromise(
    tx.objectStore('assets').index('bankId').getAll(IDBKeyRange.only(bankId)),
  );

  const migratedQuestions = [];
  for (const question of questions || []) {
    migratedQuestions.push({
      ...question,
      questionFingerprint: question.questionFingerprint || await computeQuestionFingerprint(question),
    });
  }

  const migratedAssets = [];
  for (const asset of assets || []) {
    try {
      const contentHash = await computeAssetContentHash(asset);
      migratedAssets.push({
        ...asset,
        contentHash,
        hashStatus: contentHash ? 'ready' : 'failed',
      });
    } catch {
      migratedAssets.push({ ...asset, contentHash: null, hashStatus: 'failed' });
    }
  }

  const contentFingerprint = await computeBankFingerprint({
    bank,
    questions: migratedQuestions,
    assets: migratedAssets,
  });

  const migratedBank = {
    ...bank,
    contentFingerprint,
  };
  const revisions = [];
  if ((bank.sourceType || 'user') !== 'author') {
    const revision = bank.revision || await legacyRevisionMeta({
      entityType: 'user-bank',
      entityKey: bankId,
      payload: { bankId, contentFingerprint },
      changedAt: bank.updatedAt || bank.storedAt || bank.importedAt,
    });
    migratedBank.revision = revision;
    revisions.push(revisionRecord('user-bank', bankId, revision));
  }

  const currentMeta = await getSyncMeta(db);
  const next = {
    ...(currentMeta.migration || migration),
    status: 'running',
    cursor: rows[0].key,
    updatedAt: new Date().toISOString(),
  };
  const writeTx = db.transaction(
    ['banks', 'questions', 'assets', 'syncRevisions', 'syncMeta'],
    'readwrite',
  );
  const done = transactionDone(writeTx);
  writeTx.objectStore('banks').put(migratedBank);
  for (const question of migratedQuestions) writeTx.objectStore('questions').put(question);
  for (const asset of migratedAssets) writeTx.objectStore('assets').put(asset);
  for (const revision of revisions) writeTx.objectStore('syncRevisions').put(revision);
  const meta = await requestToPromise(writeTx.objectStore('syncMeta').get('global')) || { key: 'global' };
  writeTx.objectStore('syncMeta').put({ ...meta, migration: next });
  await done;
  return next;
}

async function deterministicDraftQuestionUid(draftId, questionId, ordinal) {
  const digest = await sha256Canonical({
    draftId,
    questionId,
    occurrence: ordinal,
  });
  return `legacy-question:${stripShaPrefix(digest)}`;
}

async function migrateDraftBatch(db, migration) {
  const rows = await readBatch(db, 'studioDrafts', migration.cursor, 1);
  if (!rows.length) return finishPhase(db, 'drafts');

  const source = rows[0].value;
  const draftId = String(source.id);
  const occurrences = new Map();
  const questions = [];
  for (const question of Array.isArray(source.questions) ? source.questions : []) {
    const id = String(question.id || '');
    const ordinal = (occurrences.get(id) || 0) + 1;
    occurrences.set(id, ordinal);
    questions.push({
      ...question,
      questionUid: question.questionUid || await deterministicDraftQuestionUid(draftId, id, ordinal),
    });
  }

  const assets = [];
  for (const asset of Array.isArray(source.assets) ? source.assets : []) {
    try {
      const contentHash = await computeAssetContentHash(asset);
      assets.push({
        ...asset,
        contentHash,
        hashStatus: contentHash ? 'ready' : 'failed',
      });
    } catch {
      assets.push({ ...asset, contentHash: null, hashStatus: 'failed' });
    }
  }

  let sourceBankFingerprint = source.sourceBankFingerprint || null;
  if (!sourceBankFingerprint && source.bankId) {
    const bankTx = db.transaction('banks', 'readonly');
    const bank = await requestToPromise(bankTx.objectStore('banks').get(source.bankId));
    sourceBankFingerprint = bank?.contentFingerprint || null;
  }

  const base = {
    ...source,
    questions,
    assets,
    sourceBankFingerprint,
    conflictOfDraftId: source.conflictOfDraftId || null,
  };
  const contentFingerprint = await computeDraftFingerprint(base);
  const updatedAt = isoOrFallback(source.updatedAt || source.createdAt);
  const revision = source.revision || await legacyRevisionMeta({
    entityType: 'studio-draft',
    entityKey: draftId,
    payload: { draftId, contentFingerprint },
    changedAt: updatedAt,
  });
  const migrated = {
    ...base,
    contentFingerprint,
    revision,
  };

  const next = {
    ...migration,
    status: 'running',
    cursor: rows[0].key,
    updatedAt: new Date().toISOString(),
  };
  await writeRowsWithRevisions(db, {
    storeName: 'studioDrafts',
    rows: [migrated],
    revisions: [revisionRecord('studio-draft', draftId, revision)],
    migration: next,
  });
  return next;
}

async function migrateAssetHashBatch(db, migration) {
  const rows = await readBatch(db, 'assets', migration.cursor);
  if (!rows.length) return finishPhase(db, 'asset-hashes');

  const transformed = [];
  for (const row of rows) {
    const asset = row.value;
    if (asset.contentHash && asset.hashStatus === 'ready') {
      transformed.push(asset);
      continue;
    }
    try {
      const contentHash = await computeAssetContentHash(asset);
      transformed.push({
        ...asset,
        contentHash,
        hashStatus: contentHash ? 'ready' : 'failed',
      });
    } catch {
      transformed.push({ ...asset, contentHash: null, hashStatus: 'failed' });
    }
  }

  const next = {
    ...migration,
    status: 'running',
    cursor: rows.at(-1).key,
    updatedAt: new Date().toISOString(),
  };
  await writeRowsWithRevisions(db, {
    storeName: 'assets',
    rows: transformed,
    migration: next,
  });
  return next;
}

async function rebuildDerivedLearningState(db, migration) {
  const readTx = db.transaction('attempts', 'readonly');
  const attempts = await requestToPromise(readTx.objectStore('attempts').getAll());
  const rebuiltAt = new Date().toISOString();
  const derived = buildDerivedLearningRecords(attempts, { rebuiltAt });

  const tx = db.transaction(['progress', 'reviewSchedule', 'syncMeta'], 'readwrite');
  const done = transactionDone(tx);
  const progressStore = tx.objectStore('progress');
  const reviewStore = tx.objectStore('reviewSchedule');
  const metaStore = tx.objectStore('syncMeta');

  progressStore.clear();
  reviewStore.clear();
  for (const record of derived.progress) progressStore.put(record);
  for (const record of derived.review) reviewStore.put(record);

  const currentMeta = await requestToPromise(metaStore.get('global')) || { key: 'global' };
  const completed = {
    ...migration,
    phase: 'completed',
    scope: null,
    cursor: null,
    status: 'completed',
    derivedRebuiltAt: rebuiltAt,
    updatedAt: rebuiltAt,
    lastError: null,
  };
  metaStore.put({ ...currentMeta, migration: completed });
  await done;
  return completed;
}

export async function runV5MigrationStep() {
  const db = await openDatabase();
  let meta = await getSyncMeta(db);
  let migration = meta.migration || defaultMigrationState();

  try {
    if (migration.phase === 'completed') {
      // Older/incomplete V5 migration states may say "completed" without ever
      // rebuilding derived progress/review material. Treat the rebuild marker
      // as part of the completion contract so stale V4 counters cannot survive.
      if (!migration.derivedRebuiltAt) {
        return rebuildDerivedLearningState(db, {
          ...migration,
          phase: 'derived-rebuild',
          status: 'pending',
        });
      }
      return migration;
    }
    if (migration.status === 'failed') {
      migration = await updateMigrationState(db, { status: 'pending', lastError: null });
    }

    switch (migration.phase) {
      case 'device-identity':
        return migrateDeviceIdentity(db);
      case 'attempt-events':
        return migrateAttemptBatch(db, migration);
      case 'boolean-states':
        return migrateBooleanScope(db, migration, migration.scope || 'favorites');
      case 'notes-goals':
        return migrateNotesGoalsScope(db, migration, migration.scope || 'notes');
      case 'sessions':
        return migrateSessionBatch(db, migration);
      case 'banks':
        return migrateBankBatch(db, migration);
      case 'drafts':
        return migrateDraftBatch(db, migration);
      case 'asset-hashes':
        return migrateAssetHashBatch(db, migration);
      case 'derived-rebuild':
        return rebuildDerivedLearningState(db, migration);
      default:
        return updateMigrationState(db, {
          phase: 'completed',
          scope: null,
          cursor: null,
          status: 'completed',
          lastError: null,
        });
    }
  } catch (error) {
    await updateMigrationState(db, {
      status: 'failed',
      lastError: String(error?.message || error),
    });
    throw error;
  }
}

export async function runV5MigrationToCompletion({ maxSteps = 100000 } = {}) {
  let state = null;
  for (let step = 0; step < maxSteps; step += 1) {
    state = await runV5MigrationStep();
    if (state.phase === 'completed' && state.status === 'completed') return state;
  }
  throw new Error(`V5 migration did not complete within ${maxSteps} steps.`);
}

export async function getV5MigrationState() {
  const db = await openDatabase();
  const meta = await getSyncMeta(db);
  return meta.migration || defaultMigrationState();
}

export { dateKeyFromLegacy, legacyRevisionMeta };

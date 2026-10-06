import {
  openDatabase,
  requestToPromise,
  transactionDone,
} from '../storage/db.js';
import { canonicalJson } from './canonical.js';
import { validateCloudCommit, SyncProtocolError, CLOUD_OBJECT_TYPE } from './cloud-contract.js';
import {
  MERGE_ACTION,
  SYNC_CONFLICT_KIND,
  decideMutableMerge,
} from './merge-policy.js';
import { MUTATION_POLICY } from './mutation-policy.js';
import { compareRevisionOrder } from './revision.js';
import { compareHybridClocks, nextHybridClock } from './clock.js';
import { SYNC_RUNTIME_STATE } from './config.js';
import {
  reduceQuestionProgress,
  reduceReviewSchedule,
} from '../learning/derived-state.js';
import { learningKey, questionKey } from '../utils/ids.js';

const REMOTE_APPLY_STORES = Object.freeze([
  'attempts',
  'progress',
  'reviewSchedule',
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
  'syncMeta',
  'syncOutbox',
  'syncReceipts',
  'syncRevisions',
  'syncConflicts',
  'syncTombstones',
  'cloudObjects',
]);

export async function applyRemoteCommitAtomically(commitInput, {
  file = null,
  now = new Date(),
} = {}) {
  const commit = await validateCloudCommit(commitInput);
  const db = await openDatabase();
  const tx = db.transaction(REMOTE_APPLY_STORES, 'readwrite');
  const done = transactionDone(tx);

  try {
    const receipts = tx.objectStore('syncReceipts');
    const existingReceipt = await requestToPromise(receipts.get(commit.commitId));
    if (existingReceipt) {
      await done;
      return {
        receiptRecorded: true,
        skipped: true,
        commitId: commit.commitId,
        results: [],
      };
    }

    const metaStore = tx.objectStore('syncMeta');
    const meta = await requestToPromise(metaStore.get('global'));
    if (!meta?.deviceId) {
      throw new SyncProtocolError('Local sync identity is missing.', {
        code: 'DEVICE_ID_REQUIRED',
      });
    }
    if (
      meta.linkedProfileId &&
      String(meta.linkedProfileId) !== String(commit.profileId)
    ) {
      throw new SyncProtocolError('Remote commit belongs to a different linked profile.', {
        code: 'PROFILE_MISMATCH',
      });
    }

    const affectedQuestions = new Map();
    const results = [];
    let newestRemoteClock = null;

    for (const mutation of commit.mutations) {
      const result = await applyRemoteMutationInTransaction(tx, mutation, commit, {
        affectedQuestions,
        now,
      });
      results.push(result);

      const revision = mutation.revision || mutation.value?.revision || null;
      if (revision?.clock && (
        !newestRemoteClock ||
        compareHybridClocks(newestRemoteClock, revision.clock) < 0
      )) {
        newestRemoteClock = revision.clock;
      }
    }

    await rebuildAffectedLearningMaterial(tx, affectedQuestions, now);

    const appliedAt = now.toISOString();
    receipts.put({
      commitId: commit.commitId,
      deviceId: commit.deviceId,
      deviceSequence: commit.deviceSequence,
      payloadHash: commit.payloadHash,
      appliedAt,
      source: 'remote-pull',
    });

    if (file?.id) {
      tx.objectStore('cloudObjects').put({
        objectKey: `commit:${commit.commitId}`,
        objectType: CLOUD_OBJECT_TYPE.COMMIT,
        logicalId: commit.commitId,
        contentHash: commit.payloadHash,
        driveFileId: file.id,
        modifiedTime: file.modifiedTime || null,
        verifiedAt: appliedAt,
      });
    }

    const pendingOutbox = await requestToPromise(tx.objectStore('syncOutbox').count());
    const mergedClock = newestRemoteClock
      ? nextHybridClock({
          local: meta.clock,
          remote: newestRemoteClock,
          deviceId: meta.deviceId,
          nowMs: now.getTime(),
        })
      : meta.clock;

    metaStore.put({
      ...meta,
      linkedProfileId: meta.linkedProfileId || commit.profileId,
      cloudSchemaVersion: commit.cloudSchema,
      lastSuccessfulSyncAt: appliedAt,
      runtimeState: pendingOutbox > 0
        ? SYNC_RUNTIME_STATE.PENDING
        : SYNC_RUNTIME_STATE.SYNCED,
      clock: mergedClock
        ? {
            physicalMs: mergedClock.physicalMs,
            logical: mergedClock.logical,
          }
        : meta.clock,
    });

    await done;
    return {
      receiptRecorded: true,
      skipped: false,
      commitId: commit.commitId,
      results,
    };
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

export async function applyRemoteMutationInTransaction(tx, mutation, commit, {
  affectedQuestions = new Map(),
  now = new Date(),
} = {}) {
  const entityType = String(mutation?.type || '');
  const entityKey = String(mutation?.key || '');
  const operation = String(mutation?.op || 'upsert');
  const remoteValue = mutation?.value ?? null;

  if (mutation.policy === MUTATION_POLICY.IMMUTABLE) {
    if (entityType !== 'attempt' || operation !== 'append') {
      throw new SyncProtocolError('Unsupported immutable remote mutation.', {
        code: 'INVALID_CLOUD_MUTATION',
        details: { entityType, operation },
      });
    }
    return applyRemoteAttempt(tx, mutation, commit, affectedQuestions, now);
  }

  const remoteRevision = mutation.revision || remoteValue?.revision || null;
  if (!remoteRevision?.revisionId) {
    throw new SyncProtocolError('Remote mutable mutation is missing revision metadata.', {
      code: 'INVALID_CLOUD_MUTATION',
      details: { entityType, entityKey },
    });
  }

  await persistRemoteRevision(tx, entityType, entityKey, remoteRevision);
  const local = await readLocalEntityState(tx, entityType, entityKey);

  const decision = await decideMutableMerge({
    entityType,
    localRevision: local.revision,
    remoteRevision,
    localValue: local.value,
    remoteValue,
    localDeleted: local.deleted,
    remoteDeleted: operation === 'delete',
    isAncestor: (ancestorId, descendantRevision) =>
      isKnownRevisionAncestor(tx, ancestorId, descendantRevision),
  });

  if (decision.action === MERGE_ACTION.SKIP_EQUAL ||
      decision.action === MERGE_ACTION.KEEP_LOCAL) {
    return {
      mutationId: mutation.mutationId,
      entityType,
      entityKey,
      action: decision.action,
      reason: decision.reason,
    };
  }

  if (decision.action === MERGE_ACTION.CONFLICT) {
    const conflict = buildConflictRecord({
      mutation,
      commit,
      local,
      remoteRevision,
      remoteValue,
      kind: decision.kind,
      now,
    });
    tx.objectStore('syncConflicts').put(conflict);
    return {
      mutationId: mutation.mutationId,
      entityType,
      entityKey,
      action: MERGE_ACTION.CONFLICT,
      reason: decision.reason,
      conflictId: conflict.conflictId,
      kind: conflict.kind,
    };
  }

  if (operation === 'delete') {
    await applyRemoteDelete(tx, entityType, entityKey, remoteValue, remoteRevision, commit, mutation, now);
  } else {
    await applyRemoteUpsert(tx, entityType, entityKey, remoteValue, remoteRevision);
  }

  return {
    mutationId: mutation.mutationId,
    entityType,
    entityKey,
    action: MERGE_ACTION.APPLY_REMOTE,
    reason: decision.reason,
  };
}

async function applyRemoteAttempt(tx, mutation, commit, affectedQuestions, now) {
  const payload = mutation?.value;
  const eventId = String(payload?.eventId || mutation.key || '');
  if (!payload || !eventId || eventId !== String(mutation.key || '')) {
    throw new SyncProtocolError('Attempt mutation eventId does not match its entity key.', {
      code: 'INVALID_CLOUD_MUTATION',
    });
  }

  const store = tx.objectStore('attempts');
  const existing = await requestToPromise(store.index('eventId').get(eventId));
  const incoming = {
    ...payload,
    eventId,
    bankId: String(payload.bankId || ''),
    questionId: String(payload.questionId || ''),
  };
  delete incoming.id;
  incoming.questionKey = incoming.questionKey ||
    questionKey(incoming.bankId, incoming.questionId);

  if (!incoming.bankId || !incoming.questionId) {
    throw new SyncProtocolError('Attempt mutation is missing bankId/questionId.', {
      code: 'INVALID_CLOUD_MUTATION',
    });
  }

  if (existing) {
    const left = { ...existing };
    delete left.id;
    if (canonicalJson(left) !== canonicalJson(incoming)) {
      const conflict = {
        conflictId: `conflict:${commit.commitId}:${mutation.mutationId}`,
        entityType: 'attempt',
        entityKey: eventId,
        kind: SYNC_CONFLICT_KIND.CONTENT_ID_COLLISION,
        localRevision: null,
        remoteRevision: null,
        commonParentRevisionId: null,
        localValue: left,
        remoteValue: incoming,
        baseValue: null,
        sourceCommitId: commit.commitId,
        sourceMutationId: mutation.mutationId,
        createdAt: now.toISOString(),
        status: 'open',
        resolutionRevisionId: null,
      };
      tx.objectStore('syncConflicts').put(conflict);
      return {
        mutationId: mutation.mutationId,
        entityType: 'attempt',
        entityKey: eventId,
        action: MERGE_ACTION.CONFLICT,
        conflictId: conflict.conflictId,
        kind: conflict.kind,
      };
    }

    return {
      mutationId: mutation.mutationId,
      entityType: 'attempt',
      entityKey: eventId,
      action: MERGE_ACTION.SKIP_EQUAL,
      reason: 'existing-event',
    };
  }

  store.add(incoming);
  affectedQuestions.set(
    learningKey(incoming.bankId, incoming.questionId),
    { bankId: incoming.bankId, questionId: incoming.questionId },
  );

  return {
    mutationId: mutation.mutationId,
    entityType: 'attempt',
    entityKey: eventId,
    action: MERGE_ACTION.APPLY_REMOTE,
    reason: 'immutable-union',
  };
}

async function readLocalEntityState(tx, entityType, entityKey) {
  let value = null;

  switch (entityType) {
    case 'favorite':
      value = await requestToPromise(tx.objectStore('favorites').get(entityKey));
      break;
    case 'unfamiliar':
      value = await requestToPromise(tx.objectStore('mastery').get(entityKey));
      break;
    case 'note':
      value = await requestToPromise(tx.objectStore('notes').get(entityKey));
      break;
    case 'learning-goal':
      value = await requestToPromise(tx.objectStore('learningGoals').get(entityKey));
      break;
    case 'account-settings':
      value = await requestToPromise(tx.objectStore('accountSettings').get(entityKey));
      break;
    case 'author-library':
      value = await requestToPromise(tx.objectStore('authorLibrary').get(entityKey));
      break;
    case 'device':
      value = await requestToPromise(tx.objectStore('devices').get(entityKey));
      break;
    case 'practice-session':
    case 'exam-session':
      value = await requestToPromise(tx.objectStore('sessions').get(entityKey));
      break;
    case 'exam-answer':
      value = await readExamAnswer(tx, entityKey);
      break;
    case 'studio-draft':
      value = await requestToPromise(tx.objectStore('studioDrafts').get(entityKey));
      break;
    case 'user-bank':
      value = await requestToPromise(tx.objectStore('banks').get(entityKey));
      break;
    default:
      throw new SyncProtocolError(`Unsupported remote entity type: ${entityType}`, {
        code: 'UNSUPPORTED_REMOTE_ENTITY',
      });
  }

  if (value?.revision?.revisionId) {
    return { value, revision: value.revision, deleted: false, tombstone: null };
  }

  const tombstone = await latestTombstone(tx, entityType, entityKey);
  if (tombstone?.revision?.revisionId) {
    return {
      value: null,
      revision: tombstone.revision,
      deleted: true,
      tombstone,
    };
  }

  return { value, revision: null, deleted: false, tombstone: null };
}

async function applyRemoteUpsert(tx, entityType, entityKey, remoteValue, remoteRevision) {
  if (!remoteValue || typeof remoteValue !== 'object') {
    throw new SyncProtocolError('Remote upsert payload is missing.', {
      code: 'INVALID_CLOUD_MUTATION',
      details: { entityType, entityKey },
    });
  }

  const value = { ...remoteValue, revision: remoteRevision };

  switch (entityType) {
    case 'favorite':
      tx.objectStore('favorites').put({ ...value, key: entityKey });
      return;
    case 'unfamiliar':
      tx.objectStore('mastery').put({ ...value, key: entityKey });
      return;
    case 'note':
      tx.objectStore('notes').put({ ...value, key: entityKey });
      return;
    case 'learning-goal':
      tx.objectStore('learningGoals').put({ ...value, id: entityKey });
      return;
    case 'account-settings':
      tx.objectStore('accountSettings').put({ ...value, id: entityKey });
      return;
    case 'author-library':
      tx.objectStore('authorLibrary').put({ ...value, bankId: entityKey });
      return;
    case 'device':
      tx.objectStore('devices').put({ ...value, deviceId: entityKey });
      return;
    case 'practice-session':
    case 'exam-session':
      tx.objectStore('sessions').put({ ...value, id: entityKey });
      return;
    case 'exam-answer':
      await writeExamAnswer(tx, entityKey, value);
      return;
    case 'studio-draft':
      tx.objectStore('studioDrafts').put({ ...value, id: entityKey });
      return;
    case 'user-bank':
      throw new SyncProtocolError(
        'Inline remote user-bank application is intentionally deferred to object transport.',
        { code: 'REMOTE_OBJECT_REQUIRED', details: { entityKey } },
      );
    default:
      throw new SyncProtocolError(`Unsupported remote upsert entity: ${entityType}`, {
        code: 'UNSUPPORTED_REMOTE_ENTITY',
      });
  }
}

async function applyRemoteDelete(
  tx,
  entityType,
  entityKey,
  remoteValue,
  remoteRevision,
  commit,
  mutation,
  now,
) {
  switch (entityType) {
    case 'note':
      tx.objectStore('notes').delete(entityKey);
      break;
    case 'learning-goal':
      tx.objectStore('learningGoals').delete(entityKey);
      break;
    case 'practice-session':
    case 'exam-session':
      tx.objectStore('sessions').delete(entityKey);
      break;
    case 'studio-draft':
      tx.objectStore('studioDrafts').delete(entityKey);
      break;
    case 'user-bank':
      await deleteUserBankContent(tx, entityKey);
      break;
    default:
      throw new SyncProtocolError(`Remote delete is unsupported for ${entityType}.`, {
        code: 'INVALID_CLOUD_MUTATION',
      });
  }

  const tombstone = {
    ...(remoteValue && typeof remoteValue === 'object' ? remoteValue : {}),
    tombstoneId: remoteValue?.tombstoneId ||
      `remote-tombstone:${commit.commitId}:${mutation.mutationId}`,
    entityType,
    entityKey,
    deletedAt: remoteValue?.deletedAt || now.toISOString(),
    revision: remoteRevision,
  };
  tx.objectStore('syncTombstones').put(tombstone);
}

async function persistRemoteRevision(tx, entityType, entityKey, revision) {
  const store = tx.objectStore('syncRevisions');
  const existing = await requestToPromise(store.get(revision.revisionId));
  const record = {
    ...revision,
    entityType,
    entityKey,
  };

  if (existing && canonicalJson(existing) !== canonicalJson(record)) {
    throw new SyncProtocolError('Revision ID collision detected.', {
      code: 'REVISION_ID_COLLISION',
      details: { revisionId: revision.revisionId },
    });
  }
  if (!existing) store.put(record);
}

async function isKnownRevisionAncestor(tx, ancestorRevisionId, descendantRevision) {
  const ancestor = String(ancestorRevisionId || '');
  if (!ancestor || !descendantRevision?.revisionId) return false;
  if (ancestor === String(descendantRevision.revisionId)) return true;

  const store = tx.objectStore('syncRevisions');
  const queue = [...(descendantRevision.parentRevisionIds || [])].map(String);
  const seen = new Set();

  while (queue.length) {
    const revisionId = queue.shift();
    if (!revisionId || seen.has(revisionId)) continue;
    if (revisionId === ancestor) return true;
    seen.add(revisionId);

    const record = await requestToPromise(store.get(revisionId));
    for (const parent of record?.parentRevisionIds || []) {
      if (!seen.has(String(parent))) queue.push(String(parent));
    }
  }
  return false;
}

async function latestTombstone(tx, entityType, entityKey) {
  const rows = await requestToPromise(
    tx.objectStore('syncTombstones').index('entityKey').getAll(IDBKeyRange.only(entityKey)),
  );
  return (rows || [])
    .filter(item => item?.entityType === entityType && item?.revision)
    .sort((left, right) => compareRevisionOrder(left.revision, right.revision))
    .at(-1) || null;
}

function buildConflictRecord({
  mutation,
  commit,
  local,
  remoteRevision,
  remoteValue,
  kind,
  now,
}) {
  return {
    conflictId: `conflict:${commit.commitId}:${mutation.mutationId}`,
    entityType: mutation.type,
    entityKey: mutation.key,
    kind: kind || SYNC_CONFLICT_KIND.CONCURRENT_EDIT,
    localRevision: local.revision || null,
    remoteRevision,
    commonParentRevisionId: commonDirectParent(local.revision, remoteRevision),
    localValue: local.deleted ? local.tombstone : local.value,
    remoteValue,
    baseValue: null,
    sourceCommitId: commit.commitId,
    sourceMutationId: mutation.mutationId,
    createdAt: now.toISOString(),
    status: 'open',
    resolutionRevisionId: null,
  };
}

function commonDirectParent(left, right) {
  const leftParents = new Set((left?.parentRevisionIds || []).map(String));
  return (right?.parentRevisionIds || []).map(String)
    .find(id => leftParents.has(id)) || null;
}

async function readExamAnswer(tx, entityKey) {
  const { sessionId, questionId } = splitExamAnswerKey(entityKey);
  const session = await requestToPromise(tx.objectStore('sessions').get(sessionId));
  return session?.answers?.[questionId] || null;
}

async function writeExamAnswer(tx, entityKey, answerState) {
  const { sessionId, questionId } = splitExamAnswerKey(entityKey);
  const store = tx.objectStore('sessions');
  const session = await requestToPromise(store.get(sessionId));
  if (!session) {
    throw new SyncProtocolError('Remote exam answer references a missing exam session.', {
      code: 'REMOTE_PARENT_MISSING',
      details: { sessionId, questionId },
    });
  }
  if (session.status === 'submitted' || session.submittedAt) {
    throw new SyncProtocolError('Submitted exam answers cannot be changed by remote sync.', {
      code: 'TERMINAL_SESSION',
      details: { sessionId, questionId },
    });
  }

  store.put({
    ...session,
    answers: {
      ...(session.answers || {}),
      [questionId]: {
        ...answerState,
        questionId,
      },
    },
    updatedAt: answerState.updatedAt || session.updatedAt,
  });
}

function splitExamAnswerKey(entityKey) {
  const key = String(entityKey || '');
  const separator = key.lastIndexOf('::');
  if (separator <= 0 || separator >= key.length - 2) {
    throw new SyncProtocolError('Invalid exam-answer entity key.', {
      code: 'INVALID_CLOUD_MUTATION',
      details: { entityKey },
    });
  }
  return {
    sessionId: key.slice(0, separator),
    questionId: key.slice(separator + 2),
  };
}

async function deleteUserBankContent(tx, bankId) {
  const bank = await requestToPromise(tx.objectStore('banks').get(bankId));
  if (bank?.sourceType === 'author') {
    throw new SyncProtocolError('Author catalog content cannot be cloud-deleted as a user bank.', {
      code: 'INVALID_CLOUD_MUTATION',
    });
  }

  tx.objectStore('banks').delete(bankId);
  await deleteByIndex(tx.objectStore('questions'), 'bankId', bankId);
  await deleteByIndex(tx.objectStore('assets'), 'bankId', bankId);
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

async function rebuildAffectedLearningMaterial(tx, affectedQuestions, now) {
  const attemptsStore = tx.objectStore('attempts');
  const progressStore = tx.objectStore('progress');
  const reviewStore = tx.objectStore('reviewSchedule');
  const rebuiltAt = now.toISOString();

  for (const { bankId, questionId } of affectedQuestions.values()) {
    const key = learningKey(bankId, questionId);
    const attempts = await requestToPromise(
      attemptsStore.index('questionKey').getAll(IDBKeyRange.only(key)),
    );
    const progress = reduceQuestionProgress(attempts, { bankId, questionId, rebuiltAt });
    const review = reduceReviewSchedule(attempts, { bankId, questionId, rebuiltAt });

    if (progress) progressStore.put(progress);
    else progressStore.delete(key);

    if (review) reviewStore.put(review);
    else reviewStore.delete(key);
  }
}

import {
  openDatabase,
  requestToPromise,
  transactionDone,
} from '../storage/db.js';
import {
  attachMutationPayloadInTransaction,
  createRevisionMutationInTransaction,
} from '../storage/transactions/sync-mutation.js';
import { createUuid, questionKey, assetKey } from '../utils/ids.js';
import {
  getMutationPolicy,
  MUTATION_POLICY,
} from './mutation-policy.js';
import { SYNC_RUNTIME_STATE } from './config.js';

export const CONFLICT_RESOLUTION_CHOICE = Object.freeze({
  LOCAL: 'local',
  REMOTE: 'remote',
  MERGED: 'merged',
});

const RESOLVABLE_ENTITY_TYPES = new Set([
  'note',
  'learning-goal',
  'account-settings',
  'practice-session',
  'exam-session',
  'exam-answer',
  'studio-draft',
  'user-bank',
]);

const DELETE_ENTITY_TYPES = new Set([
  'note',
  'learning-goal',
  'practice-session',
  'exam-session',
  'studio-draft',
  'user-bank',
]);

const CONFLICT_STORES = Object.freeze([
  'notes',
  'learningGoals',
  'accountSettings',
  'sessions',
  'studioDrafts',
  'banks',
  'questions',
  'assets',
  'syncMeta',
  'syncOutbox',
  'syncRevisions',
  'syncConflicts',
  'syncTombstones',
]);

export function isConflictDirectlyResolvable(conflict) {
  const type = String(conflict?.entityType || '');
  return (
    conflict?.status === 'open' &&
    RESOLVABLE_ENTITY_TYPES.has(type) &&
    getMutationPolicy(type) === MUTATION_POLICY.CONFLICT_SENSITIVE
  );
}

export async function resolveSyncConflict(conflictId, {
  choice = CONFLICT_RESOLUTION_CHOICE.LOCAL,
  mergedValue = null,
  now = new Date(),
} = {}) {
  const id = String(conflictId || '');
  const selectedChoice = String(choice || '');
  if (!id) throw conflictError('conflictId is required.', 'CONFLICT_ID_REQUIRED');
  if (!Object.values(CONFLICT_RESOLUTION_CHOICE).includes(selectedChoice)) {
    throw conflictError(
      'Conflict resolution choice must be local or remote.',
      'CONFLICT_RESOLUTION_INVALID',
    );
  }

  const db = await openDatabase();
  const tx = db.transaction(CONFLICT_STORES, 'readwrite');
  const done = transactionDone(tx);

  try {
    const conflictStore = tx.objectStore('syncConflicts');
    const conflict = await requestToPromise(conflictStore.get(id));
    if (!conflict) {
      throw conflictError('Sync conflict was not found.', 'CONFLICT_NOT_FOUND');
    }
    if (conflict.status !== 'open') {
      await done;
      return {
        status: 'already-resolved',
        conflict,
        resolutionRevisionId: conflict.resolutionRevisionId || null,
      };
    }

    if (!isConflictDirectlyResolvable(conflict)) {
      throw conflictError(
        'This conflict cannot be directly resolved without changing immutable identity.',
        'CONFLICT_REQUIRES_MANUAL_RECOVERY',
        { entityType: conflict.entityType, kind: conflict.kind },
      );
    }

    const entityType = String(conflict.entityType);
    const entityKey = String(conflict.entityKey);
    const currentLocal = await readCurrentEntityState(
      tx,
      entityType,
      entityKey,
    );
    const localBranch = currentLocal.revision
      ? currentLocal
      : branchFromConflict(conflict, 'local');
    const remoteBranch = branchFromConflict(conflict, 'remote');
    const mergedBranch = selectedChoice === CONFLICT_RESOLUTION_CHOICE.MERGED
      ? buildMergedBranch(conflict, {
          localBranch,
          remoteBranch,
          mergedValue,
        })
      : null;
    const selected = mergedBranch || (
      selectedChoice === CONFLICT_RESOLUTION_CHOICE.LOCAL
        ? localBranch
        : remoteBranch
    );
    const losing = selectedChoice === CONFLICT_RESOLUTION_CHOICE.LOCAL
      ? remoteBranch
      : selectedChoice === CONFLICT_RESOLUTION_CHOICE.REMOTE
        ? localBranch
        : null;

    if (
      selectedChoice !== CONFLICT_RESOLUTION_CHOICE.MERGED &&
      !selected.revision?.revisionId
    ) {
      throw conflictError(
        'Selected conflict branch is missing revision metadata.',
        'CONFLICT_REVISION_MISSING',
      );
    }
    if (selected.deleted && !DELETE_ENTITY_TYPES.has(entityType)) {
      throw conflictError(
        'Deletion is not supported for this conflict entity type.',
        'CONFLICT_DELETE_UNSUPPORTED',
        { entityType },
      );
    }

    const parents = [
      localBranch.revision?.revisionId,
      remoteBranch.revision?.revisionId,
    ].filter(Boolean);

    const { revision, mutation } =
      await createRevisionMutationInTransaction(tx, {
        entityType,
        entityKey,
        parentRevisionIds: parents,
        remoteClock: remoteBranch.revision?.clock || null,
        operation: selected.deleted ? 'delete' : 'upsert',
        now,
      });

    let payload;
    if (selected.deleted) {
      payload = await applyResolvedDelete(
        tx,
        entityType,
        entityKey,
        revision,
        now,
      );
    } else {
      payload = await applyResolvedUpsert(
        tx,
        entityType,
        entityKey,
        selected.value,
        revision,
        now,
      );
    }
    attachMutationPayloadInTransaction(tx, mutation, payload);

    const preservedCopy = await preserveLosingBranchIfRequired(
      tx,
      conflict,
      losing,
      now,
    );

    const resolvedAt = now.toISOString();
    const resolvedConflict = {
      ...conflict,
      status: 'resolved',
      resolvedAt,
      resolutionChoice: selectedChoice,
      resolutionRevisionId: revision.revisionId,
      preservedCopyEntityKey: preservedCopy?.entityKey || null,
      preservedCopyRevisionId: preservedCopy?.revisionId || null,
    };
    conflictStore.put(resolvedConflict);

    const metaStore = tx.objectStore('syncMeta');
    const meta = await requestToPromise(metaStore.get('global'));
    if (meta) {
      metaStore.put({
        ...meta,
        runtimeState: SYNC_RUNTIME_STATE.PENDING,
        blockReason: null,
      });
    }

    await done;
    return {
      status: 'resolved',
      conflict: resolvedConflict,
      resolutionRevision: revision,
      preservedCopy,
    };
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

function buildMergedBranch(conflict, {
  localBranch,
  remoteBranch,
  mergedValue,
} = {}) {
  if (String(conflict?.entityType || '') !== 'note') {
    throw conflictError(
      'Manual merged content is only supported for note conflicts.',
      'CONFLICT_MERGE_UNSUPPORTED',
      { entityType: conflict?.entityType || null },
    );
  }

  const content = typeof mergedValue === 'string'
    ? mergedValue
    : mergedValue?.content;
  const normalizedContent = String(content ?? '').trim();
  if (!normalizedContent) {
    throw conflictError(
      'Merged note content cannot be empty.',
      'CONFLICT_MERGE_EMPTY',
    );
  }

  const source =
    (localBranch?.value && typeof localBranch.value === 'object'
      ? localBranch.value
      : null) ||
    (remoteBranch?.value && typeof remoteBranch.value === 'object'
      ? remoteBranch.value
      : null) ||
    {};

  return {
    revision: null,
    deleted: false,
    value: {
      ...source,
      content: normalizedContent,
    },
  };
}

function branchFromConflict(conflict, side) {
  const remote = side === 'remote';
  const revision = remote
    ? conflict.remoteRevision
    : conflict.localRevision;
  const value = remote
    ? conflict.remoteValue
    : conflict.localValue;
  return {
    revision: revision || value?.revision || null,
    value,
    deleted: isTombstoneValue(value, conflict.entityType, conflict.entityKey),
  };
}

async function readCurrentEntityState(tx, entityType, entityKey) {
  let value = null;

  switch (entityType) {
    case 'note':
      value = await requestToPromise(tx.objectStore('notes').get(entityKey));
      break;
    case 'learning-goal':
      value = await requestToPromise(
        tx.objectStore('learningGoals').get(entityKey),
      );
      break;
    case 'account-settings':
      value = await requestToPromise(
        tx.objectStore('accountSettings').get(entityKey),
      );
      break;
    case 'practice-session':
    case 'exam-session':
      value = await requestToPromise(
        tx.objectStore('sessions').get(entityKey),
      );
      break;
    case 'exam-answer':
      value = await readExamAnswer(tx, entityKey);
      break;
    case 'studio-draft':
      value = await requestToPromise(
        tx.objectStore('studioDrafts').get(entityKey),
      );
      break;
    case 'user-bank':
      value = await readUserBankPayload(tx, entityKey);
      break;
    default:
      return { value: null, revision: null, deleted: false };
  }

  const revision = entityType === 'user-bank'
    ? value?.revision || value?.bank?.revision || null
    : value?.revision || null;
  if (revision?.revisionId) {
    return { value, revision, deleted: false };
  }

  const tombstone = await latestTombstone(tx, entityType, entityKey);
  if (tombstone?.revision?.revisionId) {
    return {
      value: tombstone,
      revision: tombstone.revision,
      deleted: true,
    };
  }

  return { value, revision: null, deleted: false };
}

async function applyResolvedUpsert(
  tx,
  entityType,
  entityKey,
  selectedValue,
  revision,
  now,
) {
  const timestamp = now.toISOString();
  const value = selectedValue && typeof selectedValue === 'object'
    ? selectedValue
    : {};

  switch (entityType) {
    case 'note': {
      const record = { ...value, key: entityKey, revision, updatedAt: timestamp };
      tx.objectStore('notes').put(record);
      return record;
    }
    case 'learning-goal': {
      const record = { ...value, id: entityKey, revision, updatedAt: timestamp };
      tx.objectStore('learningGoals').put(record);
      return record;
    }
    case 'account-settings': {
      const record = { ...value, id: entityKey, revision, updatedAt: timestamp };
      tx.objectStore('accountSettings').put(record);
      return record;
    }
    case 'practice-session':
    case 'exam-session': {
      const record = { ...value, id: entityKey, revision, updatedAt: timestamp };
      tx.objectStore('sessions').put(record);
      return record;
    }
    case 'exam-answer':
      return writeExamAnswer(tx, entityKey, value, revision, timestamp);
    case 'studio-draft': {
      const record = { ...value, id: entityKey, revision, updatedAt: timestamp };
      tx.objectStore('studioDrafts').put(record);
      return record;
    }
    case 'user-bank':
      return writeUserBankPayload(
        tx,
        entityKey,
        value,
        revision,
        timestamp,
      );
    default:
      throw conflictError(
        'Unsupported conflict upsert entity type.',
        'CONFLICT_ENTITY_UNSUPPORTED',
        { entityType },
      );
  }
}

async function applyResolvedDelete(
  tx,
  entityType,
  entityKey,
  revision,
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
      throw conflictError(
        'Unsupported conflict delete entity type.',
        'CONFLICT_DELETE_UNSUPPORTED',
        { entityType },
      );
  }

  const tombstone = {
    tombstoneId: createUuid('tombstone'),
    entityType,
    entityKey,
    deletedAt: now.toISOString(),
    revision,
  };
  tx.objectStore('syncTombstones').put(tombstone);
  return tombstone;
}

async function preserveLosingBranchIfRequired(
  tx,
  conflict,
  losing,
  now,
) {
  if (!losing?.value || losing.deleted) return null;

  const entityType = String(conflict.entityType);
  if (entityType === 'studio-draft') {
    return preserveStudioDraftCopy(tx, conflict, losing, now);
  }
  if (entityType === 'practice-session') {
    return preservePracticeSessionCopy(tx, conflict, losing, now);
  }
  if (entityType === 'user-bank') {
    return preserveUserBankCopy(tx, conflict, losing, now);
  }
  return null;
}

async function preserveStudioDraftCopy(tx, conflict, losing, now) {
  const id = createUuid('draft-conflict');
  const { revision, mutation } =
    await createRevisionMutationInTransaction(tx, {
      entityType: 'studio-draft',
      entityKey: id,
      parentRevisionIds: [],
      operation: 'upsert',
      now,
    });
  const record = {
    ...losing.value,
    id,
    conflictOfDraftId: String(conflict.entityKey),
    conflictSourceRevisionId: losing.revision?.revisionId || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    revision,
  };
  tx.objectStore('studioDrafts').put(record);
  attachMutationPayloadInTransaction(tx, mutation, record);
  return {
    entityType: 'studio-draft',
    entityKey: id,
    revisionId: revision.revisionId,
  };
}

async function preservePracticeSessionCopy(tx, conflict, losing, now) {
  const id = createUuid('session-conflict');
  const { revision, mutation } =
    await createRevisionMutationInTransaction(tx, {
      entityType: 'practice-session',
      entityKey: id,
      parentRevisionIds: [],
      operation: 'upsert',
      now,
    });
  const record = {
    ...losing.value,
    id,
    sessionType: 'practice',
    conflictOfSessionId: String(conflict.entityKey),
    conflictSourceRevisionId: losing.revision?.revisionId || null,
    status: 'abandoned',
    abandonedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    revision,
  };
  tx.objectStore('sessions').put(record);
  attachMutationPayloadInTransaction(tx, mutation, record);
  return {
    entityType: 'practice-session',
    entityKey: id,
    revisionId: revision.revisionId,
  };
}

async function preserveUserBankCopy(tx, conflict, losing, now) {
  const source = losing.value?.bank
    ? losing.value
    : await readUserBankPayload(tx, String(conflict.entityKey));
  if (!source?.bank) return null;

  const id = createUuid('bank-conflict');
  const { revision, mutation } =
    await createRevisionMutationInTransaction(tx, {
      entityType: 'user-bank',
      entityKey: id,
      parentRevisionIds: [],
      operation: 'upsert',
      now,
    });

  const title = String(
    source.bank.title || source.bank.name || '未命名題庫',
  );
  const bank = {
    ...source.bank,
    id,
    sourceType: 'user',
    title: source.bank.title ? title + '（衝突副本）' : source.bank.title,
    name: !source.bank.title && source.bank.name
      ? title + '（衝突副本）'
      : source.bank.name,
    conflictOfBankId: String(conflict.entityKey),
    conflictSourceRevisionId: losing.revision?.revisionId || null,
    storedAt: now.toISOString(),
    revision,
  };
  const questions = normalizeQuestions(id, source.questions || []);
  const assets = normalizeAssets(id, source.assets || []);

  tx.objectStore('banks').put(bank);
  for (const question of questions) tx.objectStore('questions').put(question);
  for (const asset of assets) tx.objectStore('assets').put(asset);

  const payload = {
    revision,
    bank,
    questions: questions.map(stripQuestionStorageFields),
    assets: assets.map(stripAssetStorageFields),
    sourceDraftId: source.sourceDraftId || null,
  };
  attachMutationPayloadInTransaction(tx, mutation, payload);
  return {
    entityType: 'user-bank',
    entityKey: id,
    revisionId: revision.revisionId,
  };
}

async function writeUserBankPayload(
  tx,
  entityKey,
  selectedValue,
  revision,
  timestamp,
) {
  const source = selectedValue?.bank
    ? selectedValue
    : await readUserBankPayload(tx, entityKey);
  if (!source?.bank) {
    throw conflictError(
      'Selected user-bank branch is incomplete.',
      'CONFLICT_VALUE_INCOMPLETE',
      { entityKey },
    );
  }

  const bank = {
    ...source.bank,
    id: entityKey,
    sourceType: 'user',
    storedAt: timestamp,
    revision,
  };
  const questions = normalizeQuestions(entityKey, source.questions || []);
  const assets = normalizeAssets(entityKey, source.assets || []);

  await deleteByIndex(tx.objectStore('questions'), 'bankId', entityKey);
  await deleteByIndex(tx.objectStore('assets'), 'bankId', entityKey);
  tx.objectStore('banks').put(bank);
  for (const question of questions) tx.objectStore('questions').put(question);
  for (const asset of assets) tx.objectStore('assets').put(asset);

  return {
    revision,
    bank,
    questions: questions.map(stripQuestionStorageFields),
    assets: assets.map(stripAssetStorageFields),
    sourceDraftId: source.sourceDraftId || null,
  };
}

async function readUserBankPayload(tx, bankId) {
  const bank = await requestToPromise(
    tx.objectStore('banks').get(bankId),
  );
  if (!bank || bank.sourceType === 'author') return null;
  const [questions, assets] = await Promise.all([
    requestToPromise(
      tx.objectStore('questions')
        .index('bankId')
        .getAll(IDBKeyRange.only(bankId)),
    ),
    requestToPromise(
      tx.objectStore('assets')
        .index('bankId')
        .getAll(IDBKeyRange.only(bankId)),
    ),
  ]);
  return {
    revision: bank.revision || null,
    bank,
    questions: questions || [],
    assets: assets || [],
    sourceDraftId: null,
  };
}

async function deleteUserBankContent(tx, bankId) {
  const bank = await requestToPromise(tx.objectStore('banks').get(bankId));
  if (bank?.sourceType === 'author') {
    throw conflictError(
      'Author catalog content cannot be conflict-resolved as a user bank.',
      'CONFLICT_ENTITY_UNSUPPORTED',
    );
  }
  tx.objectStore('banks').delete(bankId);
  await deleteByIndex(tx.objectStore('questions'), 'bankId', bankId);
  await deleteByIndex(tx.objectStore('assets'), 'bankId', bankId);
}

async function readExamAnswer(tx, entityKey) {
  const { sessionId, questionId } = splitExamAnswerKey(entityKey);
  const session = await requestToPromise(
    tx.objectStore('sessions').get(sessionId),
  );
  return session?.answers?.[questionId] || null;
}

async function writeExamAnswer(
  tx,
  entityKey,
  selectedValue,
  revision,
  timestamp,
) {
  const { sessionId, questionId } = splitExamAnswerKey(entityKey);
  const store = tx.objectStore('sessions');
  const session = await requestToPromise(store.get(sessionId));
  if (!session) {
    throw conflictError(
      'Exam answer references a missing exam session.',
      'REMOTE_PARENT_MISSING',
      { sessionId, questionId },
    );
  }
  if (session.status === 'submitted' || session.submittedAt) {
    throw conflictError(
      'Submitted exam answers cannot be changed during conflict resolution.',
      'TERMINAL_SESSION',
      { sessionId, questionId },
    );
  }

  const answer = {
    ...selectedValue,
    questionId,
    updatedAt: timestamp,
    revision,
  };
  store.put({
    ...session,
    answers: {
      ...(session.answers || {}),
      [questionId]: answer,
    },
    updatedAt: timestamp,
  });
  return answer;
}

function splitExamAnswerKey(entityKey) {
  const key = String(entityKey || '');
  const separator = key.lastIndexOf('::');
  if (separator <= 0 || separator >= key.length - 2) {
    throw conflictError(
      'Invalid exam-answer entity key.',
      'CONFLICT_ENTITY_KEY_INVALID',
      { entityKey },
    );
  }
  return {
    sessionId: key.slice(0, separator),
    questionId: key.slice(separator + 2),
  };
}

async function latestTombstone(tx, entityType, entityKey) {
  const rows = await requestToPromise(
    tx.objectStore('syncTombstones')
      .index('entityKey')
      .getAll(IDBKeyRange.only(entityKey)),
  );
  return (rows || [])
    .filter(item =>
      item?.entityType === entityType &&
      item?.revision?.revisionId
    )
    .sort((a, b) =>
      String(a.deletedAt || '').localeCompare(String(b.deletedAt || ''))
    )
    .at(-1) || null;
}

function isTombstoneValue(value, entityType, entityKey) {
  return Boolean(
    value &&
    value.deletedAt &&
    String(value.entityType || '') === String(entityType || '') &&
    String(value.entityKey || '') === String(entityKey || ''),
  );
}

function normalizeQuestions(bankId, questions) {
  return (questions || []).map(question => {
    const questionId = String(
      question?.id || question?.questionId || '',
    );
    if (!questionId) {
      throw conflictError(
        'User-bank conflict question is missing id.',
        'CONFLICT_VALUE_INCOMPLETE',
      );
    }
    return {
      ...question,
      id: questionId,
      questionId,
      bankId,
      key: questionKey(bankId, questionId),
    };
  });
}

function normalizeAssets(bankId, assets) {
  return (assets || []).map(asset => {
    const path = String(asset?.path || '');
    if (!path) {
      throw conflictError(
        'User-bank conflict asset is missing path.',
        'CONFLICT_VALUE_INCOMPLETE',
      );
    }
    return {
      ...asset,
      bankId,
      path,
      key: assetKey(bankId, path),
    };
  });
}

function stripQuestionStorageFields(record) {
  const { key, bankId, questionId, ...question } = record;
  return question;
}

function stripAssetStorageFields(record) {
  const { key, bankId, ...asset } = record;
  return asset;
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

function conflictError(message, code, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

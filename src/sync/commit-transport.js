import { APP_CONFIG } from '../app/config.js';
import {
  openDatabase,
  requestToPromise,
  transactionDone,
} from '../storage/db.js';
import {
  CLOUD_OBJECT_TYPE,
  SyncProtocolError,
  cloudAppProperties,
  cloudCommitByteLength,
  cloudCommitFileName,
  createCloudCommit,
  validateCloudCommit,
} from './cloud-contract.js';
import { SYNC_RUNTIME_STATE } from './config.js';
import { OUTBOX_STATUS } from './outbox-service.js';
import { withSyncLock } from './sync-lock.js';

const encoder = new TextEncoder();

export async function prepareNextCloudCommit({
  profileId,
  now = new Date(),
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) throw new SyncProtocolError('profileId is required.', { code: 'PROFILE_REQUIRED' });

  return withSyncLock(async () => {
    const db = await openDatabase();
    const snapshotTx = db.transaction(['syncMeta', 'syncOutbox'], 'readonly');
    const meta = await requestToPromise(snapshotTx.objectStore('syncMeta').get('global'));
    if (!meta?.deviceId) {
      throw new SyncProtocolError('Local sync identity is missing.', { code: 'DEVICE_ID_REQUIRED' });
    }
    if (meta.linkedProfileId && String(meta.linkedProfileId) !== profile) {
      throw new SyncProtocolError('This device is linked to a different cloud profile.', {
        code: 'PROFILE_MISMATCH',
        details: {
          linkedProfileId: meta.linkedProfileId,
          requestedProfileId: profile,
        },
      });
    }

    if (meta.pendingCloudCommit?.commit) {
      if (String(meta.pendingCloudCommit.commit.profileId) !== profile) {
        throw new SyncProtocolError('Pending commit belongs to another profile.', {
          code: 'PROFILE_MISMATCH',
        });
      }
      return meta.pendingCloudCommit.commit;
    }

    const allOutbox = await requestToPromise(snapshotTx.objectStore('syncOutbox').getAll());
    const eligible = (allOutbox || [])
      .filter(isEligibleMutation)
      .sort(compareOutboxRows);

    if (!eligible.length) return null;

    const selected = selectMutationBatch(eligible);
    const cloudMutations = selected.map(toCloudMutation);
    const commit = await createCloudCommit({
      profileId: profile,
      deviceId: meta.deviceId,
      deviceSequence: Math.max(1, Number(meta.nextCommitSequence) || 1),
      mutations: cloudMutations,
      createdAt: now.toISOString(),
    });

    const tx = db.transaction(['syncMeta', 'syncOutbox'], 'readwrite');
    const done = transactionDone(tx);
    const metaStore = tx.objectStore('syncMeta');
    const outboxStore = tx.objectStore('syncOutbox');
    const freshMeta = await requestToPromise(metaStore.get('global'));

    if (freshMeta?.pendingCloudCommit?.commit) {
      await done;
      return freshMeta.pendingCloudCommit.commit;
    }

    for (const row of selected) {
      const fresh = await requestToPromise(outboxStore.get(row.mutationId));
      if (!fresh || !isEligibleMutation(fresh)) {
        try { tx.abort(); } catch {}
        await done.catch(() => {});
        throw new SyncProtocolError(
          'Outbox changed while preparing the commit; retry the prepare step.',
          {
            code: 'OUTBOX_CHANGED_DURING_PREPARE',
            details: { mutationId: row.mutationId },
          },
        );
      }
      outboxStore.put({
        ...fresh,
        status: OUTBOX_STATUS.INFLIGHT,
        lastError: null,
      });
    }

    metaStore.put({
      ...freshMeta,
      key: 'global',
      linkedProfileId: freshMeta?.linkedProfileId || profile,
      cloudSchemaVersion: APP_CONFIG.cloudSyncSchemaVersion,
      runtimeState: SYNC_RUNTIME_STATE.PENDING,
      pendingCloudCommit: {
        commit,
        mutationIds: selected.map(row => row.mutationId),
        preparedAt: now.toISOString(),
      },
    });

    await done;
    return commit;
  });
}

export async function publishPreparedCloudCommit(provider, {
  profileId,
  now = new Date(),
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) throw new SyncProtocolError('profileId is required.', { code: 'PROFILE_REQUIRED' });

  let prepared = await getPendingCommit();
  if (!prepared) {
    prepared = await prepareNextCloudCommit({ profileId: profile, now });
  }
  if (!prepared) return null;

  return withSyncLock(async () => {
    // Another tab may have published the prepared commit before this tab
    // acquired the transport lock. Re-read the durable pending state.
    const commit = await getPendingCommit();
    if (!commit) return null;

    if (String(commit.profileId) !== profile) {
      throw new SyncProtocolError('Pending commit belongs to another profile.', {
        code: 'PROFILE_MISMATCH',
      });
    }

    try {
      const remote = await ensureRemoteCommit(provider, commit);
      await acknowledgePublishedCommit(commit, remote.file, { now });
      return {
        commit,
        file: remote.file,
        reusedExistingFile: remote.reusedExistingFile,
      };
    } catch (error) {
      await markPendingCommitFailure(commit, error, { now });
      throw error;
    }
  });
}

export async function ensureRemoteCommit(provider, commit) {
  const validated = await validateCloudCommit(commit, {
    expectedProfileId: commit.profileId,
  });
  const properties = cloudAppProperties({
    profileId: validated.profileId,
    objectType: CLOUD_OBJECT_TYPE.COMMIT,
    objectId: validated.commitId,
    hash: validated.payloadHash,
  });

  const matching = await listAllProviderFiles(provider, {
    appProperties: {
      moxinApp: properties.moxinApp,
      cloudSchema: properties.cloudSchema,
      profileId: properties.profileId,
      objectType: properties.objectType,
      objectId: properties.objectId,
    },
  });

  if (matching.length) {
    const exact = matching.find(file => file?.appProperties?.hash === validated.payloadHash);
    if (!exact) {
      throw new SyncProtocolError(
        'A cloud commit with the same ID but different content already exists.',
        {
          code: 'COMMIT_ID_COLLISION',
          details: { commitId: validated.commitId },
        },
      );
    }

    const remotePayload = await provider.downloadJson(exact.id);
    const remoteCommit = await validateCloudCommit(remotePayload, {
      expectedProfileId: validated.profileId,
    });
    assertSameCommitIdentity(validated, remoteCommit);
    return { file: exact, reusedExistingFile: true };
  }

  const file = await provider.createJsonFile({
    name: cloudCommitFileName(validated),
    data: validated,
    appProperties: properties,
  });

  const roundTrip = await provider.downloadJson(file.id);
  const remoteCommit = await validateCloudCommit(roundTrip, {
    expectedProfileId: validated.profileId,
  });
  assertSameCommitIdentity(validated, remoteCommit);

  return { file, reusedExistingFile: false };
}

export async function stageRemoteCommits(provider, {
  profileId,
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) throw new SyncProtocolError('profileId is required.', { code: 'PROFILE_REQUIRED' });

  const db = await openDatabase();
  const stateTx = db.transaction(['syncMeta', 'syncReceipts'], 'readonly');
  const localMeta = await requestToPromise(stateTx.objectStore('syncMeta').get('global'));
  if (localMeta?.linkedProfileId && String(localMeta.linkedProfileId) !== profile) {
    throw new SyncProtocolError('This device is linked to a different cloud profile.', {
      code: 'PROFILE_MISMATCH',
      details: {
        linkedProfileId: localMeta.linkedProfileId,
        requestedProfileId: profile,
      },
    });
  }
  const receipts = await requestToPromise(stateTx.objectStore('syncReceipts').getAll());
  const applied = new Set((receipts || []).map(item => String(item.commitId)));

  const files = await listAllProviderFiles(provider, {
    appProperties: {
      moxinApp: 'moxin-quiz',
      cloudSchema: String(APP_CONFIG.cloudSyncSchemaVersion),
      profileId: profile,
      objectType: CLOUD_OBJECT_TYPE.COMMIT,
    },
  });

  const byCommitId = new Map();
  for (const file of files) {
    const commitId = String(file?.appProperties?.objectId || '');
    if (!commitId || applied.has(commitId)) continue;

    if (byCommitId.has(commitId)) {
      const previous = byCommitId.get(commitId);
      if (previous?.appProperties?.hash !== file?.appProperties?.hash) {
        throw new SyncProtocolError(
          'Duplicate cloud commit IDs have different hashes.',
          {
            code: 'COMMIT_ID_COLLISION',
            details: { commitId },
          },
        );
      }
      continue;
    }
    byCommitId.set(commitId, file);
  }

  const staged = [];
  for (const file of byCommitId.values()) {
    const payload = await provider.downloadJson(file.id);
    const commit = await validateCloudCommit(payload, {
      expectedProfileId: profile,
    });
    if (file?.appProperties?.hash && file.appProperties.hash !== commit.payloadHash) {
      throw new SyncProtocolError('Drive metadata hash does not match commit content.', {
        code: 'COMMIT_HASH_MISMATCH',
        details: { fileId: file.id, commitId: commit.commitId },
      });
    }
    staged.push({ file, commit });
  }

  staged.sort(compareStagedCommits);
  return staged;
}

export async function applyStagedCommits(staged, {
  applyCommit,
  now = () => new Date(),
} = {}) {
  if (typeof applyCommit !== 'function') {
    throw new TypeError('applyStagedCommits requires an applyCommit callback.');
  }

  const results = [];
  for (const item of Array.isArray(staged) ? staged : []) {
    const commit = item?.commit;
    if (!commit?.commitId) continue;

    const db = await openDatabase();
    const receiptTx = db.transaction('syncReceipts', 'readonly');
    const existing = await requestToPromise(
      receiptTx.objectStore('syncReceipts').get(commit.commitId),
    );
    if (existing) {
      results.push({ commitId: commit.commitId, skipped: true });
      continue;
    }

    await applyCommit(commit, item);
    await recordAppliedCommitReceipt(commit, item.file, {
      appliedAt: now().toISOString(),
      source: 'remote-pull',
    });
    results.push({ commitId: commit.commitId, skipped: false });
  }
  return results;
}

export async function recordAppliedCommitReceipt(commit, file = null, {
  appliedAt = new Date().toISOString(),
  source = 'remote-pull',
} = {}) {
  const db = await openDatabase();
  const tx = db.transaction(['syncReceipts', 'cloudObjects', 'syncMeta'], 'readwrite');
  const done = transactionDone(tx);

  tx.objectStore('syncReceipts').put({
    commitId: commit.commitId,
    deviceId: commit.deviceId,
    deviceSequence: commit.deviceSequence,
    payloadHash: commit.payloadHash,
    appliedAt,
    source,
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

  const metaStore = tx.objectStore('syncMeta');
  const meta = await requestToPromise(metaStore.get('global'));
  if (meta?.linkedProfileId && String(meta.linkedProfileId) !== String(commit.profileId)) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw new SyncProtocolError('Refusing to record a receipt for a different cloud profile.', {
      code: 'PROFILE_MISMATCH',
    });
  }
  if (meta) {
    metaStore.put({
      ...meta,
      lastSuccessfulSyncAt: appliedAt,
    });
  }

  await done;
}

export async function getPendingCommit() {
  const db = await openDatabase();
  const tx = db.transaction('syncMeta', 'readonly');
  const meta = await requestToPromise(tx.objectStore('syncMeta').get('global'));
  return meta?.pendingCloudCommit?.commit || null;
}

async function acknowledgePublishedCommit(commit, file, {
  now = new Date(),
} = {}) {
  const db = await openDatabase();
  const tx = db.transaction(
    ['syncMeta', 'syncOutbox', 'syncReceipts', 'cloudObjects'],
    'readwrite',
  );
  const done = transactionDone(tx);
  const metaStore = tx.objectStore('syncMeta');
  const outboxStore = tx.objectStore('syncOutbox');
  const meta = await requestToPromise(metaStore.get('global'));
  const pending = meta?.pendingCloudCommit;

  if (!pending?.commit || pending.commit.commitId !== commit.commitId) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw new SyncProtocolError('Pending local commit changed before acknowledgement.', {
      code: 'PENDING_COMMIT_CHANGED',
    });
  }

  for (const mutationId of pending.mutationIds || []) {
    outboxStore.delete(mutationId);
  }

  const remainingCount = await requestToPromise(outboxStore.count());
  const timestamp = now.toISOString();

  tx.objectStore('syncReceipts').put({
    commitId: commit.commitId,
    deviceId: commit.deviceId,
    deviceSequence: commit.deviceSequence,
    payloadHash: commit.payloadHash,
    appliedAt: timestamp,
    source: 'local-publish',
  });

  if (file?.id) {
    tx.objectStore('cloudObjects').put({
      objectKey: `commit:${commit.commitId}`,
      objectType: CLOUD_OBJECT_TYPE.COMMIT,
      logicalId: commit.commitId,
      contentHash: commit.payloadHash,
      driveFileId: file.id,
      modifiedTime: file.modifiedTime || null,
      verifiedAt: timestamp,
    });
  }

  metaStore.put({
    ...meta,
    nextCommitSequence: Math.max(
      Number(meta.nextCommitSequence) || 1,
      Number(commit.deviceSequence) + 1,
    ),
    pendingCloudCommit: null,
    lastSyncAttemptAt: timestamp,
    lastSuccessfulSyncAt: timestamp,
    runtimeState: remainingCount > 0
      ? SYNC_RUNTIME_STATE.PENDING
      : SYNC_RUNTIME_STATE.SYNCED,
  });

  await done;
}

async function markPendingCommitFailure(commit, error, {
  now = new Date(),
} = {}) {
  const db = await openDatabase();
  const tx = db.transaction(['syncMeta', 'syncOutbox'], 'readwrite');
  const done = transactionDone(tx);
  const metaStore = tx.objectStore('syncMeta');
  const outboxStore = tx.objectStore('syncOutbox');
  const meta = await requestToPromise(metaStore.get('global'));

  if (meta?.pendingCloudCommit?.commit?.commitId !== commit.commitId) {
    await done;
    return;
  }

  for (const mutationId of meta.pendingCloudCommit.mutationIds || []) {
    const row = await requestToPromise(outboxStore.get(mutationId));
    if (!row) continue;
    outboxStore.put({
      ...row,
      status: OUTBOX_STATUS.RETRY,
      retryCount: (Number(row.retryCount) || 0) + 1,
      lastError: String(error?.message || error),
      nextRetryAt: null,
    });
  }

  const runtimeState = error?.code === 'AUTH_REQUIRED'
    ? SYNC_RUNTIME_STATE.AUTH_REQUIRED
    : SYNC_RUNTIME_STATE.ERROR;

  metaStore.put({
    ...meta,
    lastSyncAttemptAt: now.toISOString(),
    runtimeState,
  });
  await done;
}

async function listAllProviderFiles(provider, options) {
  const files = [];
  let pageToken = null;
  do {
    const page = await provider.listFiles({ ...options, pageToken });
    files.push(...(page?.files || []));
    pageToken = page?.nextPageToken || null;
  } while (pageToken);
  return files;
}

function selectMutationBatch(rows) {
  const selected = [];
  let bytes = 2;
  const maxCount = Math.max(1, Number(APP_CONFIG.syncLimits.maxCommitMutations) || 1);
  const maxBytes = Math.max(1024, Number(APP_CONFIG.syncLimits.maxCommitJsonBytes) || 1024);

  for (const row of rows) {
    if (row.hasPayload !== true) {
      throw new SyncProtocolError(
        `Outbox mutation ${row.mutationId} does not contain a durable payload snapshot.`,
        {
          code: 'OUTBOX_PAYLOAD_MISSING',
          details: { mutationId: row.mutationId },
        },
      );
    }

    const mutation = toCloudMutation(row);
    const mutationBytes = encoder.encode(JSON.stringify(mutation)).byteLength + 1;
    if (selected.length && (selected.length >= maxCount || bytes + mutationBytes > maxBytes)) break;
    if (!selected.length && mutationBytes > maxBytes) {
      throw new SyncProtocolError(
        `Outbox mutation ${row.mutationId} exceeds the inline commit size limit.`,
        {
          code: 'OUTBOX_PAYLOAD_TOO_LARGE',
          details: { mutationId: row.mutationId, mutationBytes, maxBytes },
        },
      );
    }

    selected.push(row);
    bytes += mutationBytes;
  }

  return selected;
}

function toCloudMutation(row) {
  return {
    mutationId: row.mutationId,
    type: row.entityType,
    key: row.entityKey,
    op: row.operation,
    policy: row.policy,
    revision: row.payload?.revision || null,
    value: row.payload,
  };
}

function isEligibleMutation(row) {
  if (!row) return false;
  if (![OUTBOX_STATUS.PENDING, OUTBOX_STATUS.RETRY].includes(row.status)) return false;
  if (row.nextRetryAt) {
    const retryAt = new Date(row.nextRetryAt).getTime();
    if (Number.isFinite(retryAt) && retryAt > Date.now()) return false;
  }
  return true;
}

function compareOutboxRows(left, right) {
  return (
    String(left.createdAt || '').localeCompare(String(right.createdAt || '')) ||
    String(left.mutationId || '').localeCompare(String(right.mutationId || ''))
  );
}

function compareStagedCommits(left, right) {
  const a = left.commit;
  const b = right.commit;
  return (
    String(a.createdAt || '').localeCompare(String(b.createdAt || '')) ||
    String(a.deviceId || '').localeCompare(String(b.deviceId || '')) ||
    Number(a.deviceSequence || 0) - Number(b.deviceSequence || 0) ||
    String(a.commitId || '').localeCompare(String(b.commitId || ''))
  );
}

function assertSameCommitIdentity(expected, actual) {
  if (
    expected.commitId !== actual.commitId ||
    expected.payloadHash !== actual.payloadHash ||
    expected.deviceId !== actual.deviceId ||
    Number(expected.deviceSequence) !== Number(actual.deviceSequence)
  ) {
    throw new SyncProtocolError('Remote commit does not match the prepared local commit.', {
      code: 'COMMIT_HASH_MISMATCH',
      details: {
        expectedCommitId: expected.commitId,
        actualCommitId: actual.commitId,
        expectedHash: expected.payloadHash,
        actualHash: actual.payloadHash,
      },
    });
  }
}

export { selectMutationBatch, toCloudMutation };

import {
  openDatabase,
  requestToPromise,
  transactionDone,
} from '../storage/db.js';
import { createUuid } from '../utils/ids.js';
import {
  buildLocalSyncInventory,
  discoverRemoteSyncInventory,
  planFirstSync,
  RECONCILIATION_KIND,
} from './reconciliation.js';
import { stageRemoteCommits, publishPreparedCloudCommit } from './commit-transport.js';
import { applyRemoteCommitAtomically } from './remote-apply.js';
import { seedInitialSyncOutbox } from './initial-seed.js';
import { classifySyncFailure } from './retry-policy.js';
import { SYNC_RUNTIME_STATE } from './config.js';
import { withSyncLock } from './sync-lock.js';

export async function inspectFirstSync(provider, {
  profileId,
  kind = RECONCILIATION_KIND.FIRST_SYNC,
  now = new Date(),
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) throw new Error('profileId is required.');

  const [localInventory, remoteInventory] = await Promise.all([
    buildLocalSyncInventory(),
    discoverRemoteSyncInventory(provider, { profileId: profile }),
  ]);
  const plan = planFirstSync(localInventory, remoteInventory);
  const reconciliation = {
    reconciliationId: createUuid('reconciliation'),
    kind,
    phase: 'planning',
    plan: plan.plan,
    requiresConflictScan: plan.requiresConflictScan,
    localInventoryHash: localInventory.hash,
    remoteInventoryHash: remoteInventory.hash,
    remoteFileCount: remoteInventory.fileCount,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    seededAt: null,
    completedAt: null,
  };

  await updateSyncMeta(meta => {
    assertProfileCompatible(meta, profile);
    return {
      ...meta,
      linkedProfileId: meta.linkedProfileId || profile,
      reconciliation,
      runtimeState: localInventory.isEmpty && remoteInventory.isEmpty
        ? SYNC_RUNTIME_STATE.LOCAL_ONLY
        : SYNC_RUNTIME_STATE.PENDING,
    };
  });

  return {
    reconciliation,
    localInventory,
    remoteInventory,
    plan,
  };
}

export async function confirmFirstSyncReconciliation(reconciliationId, {
  now = new Date(),
} = {}) {
  const id = String(reconciliationId || '');
  if (!id) throw new Error('reconciliationId is required.');

  const meta = await getSyncMeta();
  const reconciliation = meta?.reconciliation;
  if (!reconciliation || reconciliation.reconciliationId !== id) {
    throw new Error('First-sync reconciliation was not found.');
  }
  if (!['planning', 'conflicts'].includes(reconciliation.phase)) {
    return reconciliation;
  }

  let seedResult = null;
  if (!reconciliation.seededAt) {
    seedResult = await seedInitialSyncOutbox({ now });
  }

  const next = {
    ...reconciliation,
    phase: 'applying',
    seededAt: reconciliation.seededAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await updateSyncMeta(meta => ({
    ...meta,
    reconciliation: next,
    runtimeState: SYNC_RUNTIME_STATE.PENDING,
  }));

  return {
    reconciliation: next,
    seedResult,
  };
}

export async function runSyncCycle(provider, {
  profileId,
  maxPushCommits = 10,
  force = false,
  now = () => new Date(),
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) throw new Error('profileId is required.');

  return withSyncLock(async () => {
    const startedAt = now();
    let meta = await getSyncMeta();
    assertProfileCompatible(meta, profile);

    if (meta?.migration?.phase && meta.migration.phase !== 'completed') {
      return {
        status: 'blocked',
        reason: 'migration-incomplete',
        runtimeState: meta.runtimeState,
      };
    }

    if (!meta?.linkedProfileId) {
      return {
        status: 'blocked',
        reason: 'first-sync-required',
        runtimeState: meta?.runtimeState || SYNC_RUNTIME_STATE.LOCAL_ONLY,
      };
    }

    if (meta?.reconciliation?.phase === 'planning') {
      return {
        status: 'blocked',
        reason: 'reconciliation-required',
        reconciliation: meta.reconciliation,
        runtimeState: meta.runtimeState,
      };
    }

    const deferredRetryAt = await getDeferredRetryAt(startedAt);
    if (deferredRetryAt && !force) {
      return {
        status: 'deferred',
        reason: 'retry-backoff',
        nextRetryAt: deferredRetryAt,
        runtimeState: meta.runtimeState,
      };
    }

    if (force) await resumeBlockedOutboxMutations();

    await updateSyncMeta(current => ({
      ...current,
      lastSyncAttemptAt: startedAt.toISOString(),
      runtimeState: SYNC_RUNTIME_STATE.SYNCING,
    }));

    const pulled = [];
    const pushed = [];

    try {
      const staged = await stageRemoteCommits(provider, { profileId: profile });
      for (const item of staged) {
        const applied = await applyRemoteCommitAtomically(item.commit, {
          provider,
          file: item.file,
          now: now(),
        });
        pulled.push(applied);
      }

      const openConflicts = await countOpenConflicts();
      if (openConflicts > 0) {
        await updateSyncMeta(current => ({
          ...current,
          runtimeState: SYNC_RUNTIME_STATE.CONFLICT,
          reconciliation: current.reconciliation
            ? {
                ...current.reconciliation,
                phase: 'conflicts',
                updatedAt: now().toISOString(),
              }
            : current.reconciliation,
        }));

        return {
          status: 'conflict',
          pulled,
          pushed,
          openConflicts,
          runtimeState: SYNC_RUNTIME_STATE.CONFLICT,
        };
      }

      const limit = Math.max(1, Number(maxPushCommits) || 1);
      for (let index = 0; index < limit; index += 1) {
        const published = await publishPreparedCloudCommit(provider, {
          profileId: profile,
          now: now(),
        });
        if (!published) break;
        pushed.push(published);
      }

      const [pendingCount, conflictsAfter] = await Promise.all([
        countOutbox(),
        countOpenConflicts(),
      ]);
      const runtimeState = conflictsAfter > 0
        ? SYNC_RUNTIME_STATE.CONFLICT
        : pendingCount > 0
          ? SYNC_RUNTIME_STATE.PENDING
          : SYNC_RUNTIME_STATE.SYNCED;

      await updateSyncMeta(current => ({
        ...current,
        lastSuccessfulSyncAt: now().toISOString(),
        runtimeState,
        reconciliation:
          current.reconciliation?.phase === 'applying' && runtimeState === SYNC_RUNTIME_STATE.SYNCED
            ? {
                ...current.reconciliation,
                phase: 'completed',
                completedAt: now().toISOString(),
                updatedAt: now().toISOString(),
              }
            : current.reconciliation,
      }));

      return {
        status: runtimeState === SYNC_RUNTIME_STATE.SYNCED ? 'synced' : 'pending',
        pulled,
        pushed,
        pendingCount,
        openConflicts: conflictsAfter,
        runtimeState,
      };
    } catch (error) {
      const failure = classifySyncFailure(error);
      await updateSyncMeta(current => ({
        ...current,
        lastSyncAttemptAt: now().toISOString(),
        runtimeState: failure.runtimeState,
      }));

      return {
        status: 'error',
        pulled,
        pushed,
        runtimeState: failure.runtimeState,
        retryable: failure.retryable,
        error,
      };
    }
  }, { name: 'moxin-quiz-v5-sync-cycle' });
}

export async function resumeBlockedOutboxMutations() {
  const db = await openDatabase();
  const tx = db.transaction(['syncOutbox', 'syncMeta'], 'readwrite');
  const done = transactionDone(tx);

  try {
    const store = tx.objectStore('syncOutbox');
    const rows = await requestToPromise(store.getAll());
    let resumed = 0;

    for (const row of rows || []) {
      if (row?.status !== 'blocked') continue;
      store.put({
        ...row,
        status: 'retry',
        nextRetryAt: null,
        lastError: null,
      });
      resumed += 1;
    }

    const metaStore = tx.objectStore('syncMeta');
    const meta = await requestToPromise(metaStore.get('global'));
    if (meta && resumed > 0) {
      metaStore.put({
        ...meta,
        runtimeState: SYNC_RUNTIME_STATE.PENDING,
      });
    }

    await done;
    return resumed;
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

async function getDeferredRetryAt(now) {
  const db = await openDatabase();
  const tx = db.transaction(['syncMeta', 'syncOutbox'], 'readonly');
  const meta = await requestToPromise(tx.objectStore('syncMeta').get('global'));
  const pendingIds = new Set(meta?.pendingCloudCommit?.mutationIds || []);
  if (!pendingIds.size) return null;

  const rows = await requestToPromise(tx.objectStore('syncOutbox').getAll());
  const future = (rows || [])
    .filter(row => pendingIds.has(row.mutationId) && row.nextRetryAt)
    .map(row => new Date(row.nextRetryAt))
    .filter(date => Number.isFinite(date.getTime()) && date > now)
    .sort((a, b) => a - b);

  return future[0]?.toISOString() || null;
}

async function countOutbox() {
  const db = await openDatabase();
  return requestToPromise(
    db.transaction('syncOutbox', 'readonly').objectStore('syncOutbox').count(),
  );
}

async function countOpenConflicts() {
  const db = await openDatabase();
  return requestToPromise(
    db.transaction('syncConflicts', 'readonly')
      .objectStore('syncConflicts')
      .index('status')
      .count(IDBKeyRange.only('open')),
  );
}

async function getSyncMeta() {
  const db = await openDatabase();
  return requestToPromise(
    db.transaction('syncMeta', 'readonly').objectStore('syncMeta').get('global'),
  );
}

async function updateSyncMeta(updater) {
  const db = await openDatabase();
  const tx = db.transaction('syncMeta', 'readwrite');
  const done = transactionDone(tx);

  try {
    const store = tx.objectStore('syncMeta');
    const current = await requestToPromise(store.get('global'));
    const next = updater(current || { key: 'global' });
    store.put({
      ...(current || {}),
      ...(next || {}),
      key: 'global',
    });
    await done;
    return next;
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

function assertProfileCompatible(meta, profileId) {
  if (meta?.linkedProfileId && String(meta.linkedProfileId) !== String(profileId)) {
    const error = new Error('This device is linked to a different cloud profile.');
    error.code = 'PROFILE_MISMATCH';
    throw error;
  }
}

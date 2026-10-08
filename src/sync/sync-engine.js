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
import { classifySyncFailure, nextRetryInstant } from './retry-policy.js';
import { SYNC_RUNTIME_STATE } from './config.js';
import { withSyncLock } from './sync-lock.js';
import { publishCheckpointIfDue } from './checkpoint.js';
import { ensureCloudProfile } from './cloud-profile.js';
import {
  getCurrentDeviceSyncPermission,
  verifyLinkedCloudContext,
} from './account-lifecycle.js';

export async function inspectFirstSync(provider, {
  profileId,
  kind = RECONCILIATION_KIND.FIRST_SYNC,
  now = new Date(),
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) throw new Error('profileId is required.');

  const previousMeta = await getSyncMeta();
  assertProfileCompatible(previousMeta, profile);

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
    targetProfileId: profile,
    previousLinkedProfileId: previousMeta?.linkedProfileId || null,
    previousRuntimeState:
      previousMeta?.runtimeState || SYNC_RUNTIME_STATE.LOCAL_ONLY,
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
  provider = null,
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

  let cloudProfile = null;
  let account = null;
  if (provider) {
    const targetProfileId = String(
      reconciliation.targetProfileId || meta.linkedProfileId || '',
    );
    if (!targetProfileId) {
      throw new Error('First-sync target profile is missing.');
    }

    if (typeof provider.getAccountProfile === 'function') {
      account = await provider.getAccountProfile({ interactive: false });
    }
    const ensured = await ensureCloudProfile(provider, {
      profileId: targetProfileId,
      now,
    });
    cloudProfile = ensured.profile;

    await updateSyncMeta(current => ({
      ...current,
      linkedProfileId: targetProfileId,
      cloudSchemaVersion:
        cloudProfile?.cloudSchema || current.cloudSchemaVersion,
      cloudAccount: account
        ? {
            provider: account.provider || 'google',
            providerSubject: account.providerSubject || null,
            displayName: account.displayName || null,
            displayEmail: account.displayEmail || null,
            photoUrl: account.photoUrl || null,
          }
        : current.cloudAccount,
      blockReason: null,
    }));
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
    cloudProfile,
    account,
  };
}

export async function cancelFirstSyncReconciliation(reconciliationId) {
  const id = String(reconciliationId || '');
  if (!id) throw new Error('reconciliationId is required.');

  const meta = await getSyncMeta();
  const reconciliation = meta?.reconciliation;
  if (
    !reconciliation ||
    reconciliation.reconciliationId !== id ||
    reconciliation.kind !== RECONCILIATION_KIND.FIRST_SYNC
  ) {
    throw new Error('First-sync reconciliation was not found.');
  }

  if (reconciliation.phase !== 'planning') {
    return { status: 'not-cancellable', reconciliation };
  }

  const previousLinkedProfileId =
    reconciliation.previousLinkedProfileId || null;
  const previousRuntimeState =
    reconciliation.previousRuntimeState ||
    (previousLinkedProfileId
      ? meta.runtimeState
      : SYNC_RUNTIME_STATE.LOCAL_ONLY);

  await updateSyncMeta(current => ({
    ...current,
    linkedProfileId: previousLinkedProfileId,
    reconciliation: null,
    runtimeState: previousRuntimeState,
    cloudAccount: previousLinkedProfileId ? current.cloudAccount : null,
    cloudSchemaVersion:
      previousLinkedProfileId ? current.cloudSchemaVersion : null,
    blockReason: null,
  }));

  return {
    status: 'cancelled',
    previousLinkedProfileId,
    runtimeState: previousRuntimeState,
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

    if (['planning', 'seeding'].includes(meta?.reconciliation?.phase)) {
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

    const localPermission = await getCurrentDeviceSyncPermission();
    if (!localPermission.allowed) {
      await updateSyncMeta(current => ({
        ...current,
        runtimeState: SYNC_RUNTIME_STATE.ERROR,
        blockReason: localPermission.reason,
      }));
      return {
        status: 'blocked',
        reason: localPermission.reason,
        runtimeState: SYNC_RUNTIME_STATE.ERROR,
      };
    }

    try {
      const context = await verifyLinkedCloudContext(provider, {
        profileId: profile,
      });
      if (context.verified) {
        await updateSyncMeta(current => ({
          ...current,
          cloudAccount: {
            provider: context.account?.provider || 'google',
            providerSubject: context.account?.providerSubject || null,
            displayName: context.account?.displayName || null,
            displayEmail: context.account?.displayEmail || null,
            photoUrl: context.account?.photoUrl || null,
          },
          cloudSchemaVersion:
            context.cloudProfile?.cloudSchema || current.cloudSchemaVersion,
          blockReason: null,
        }));
      }
    } catch (contextError) {
      if (contextError?.code === 'ACCOUNT_SWITCH_REQUIRED') {
        await updateSyncMeta(current => ({
          ...current,
          runtimeState: SYNC_RUNTIME_STATE.ERROR,
          blockReason: 'account-switch-required',
          lastSyncAttemptAt: startedAt.toISOString(),
        }));
        return {
          status: 'blocked',
          reason: 'account-switch-required',
          runtimeState: SYNC_RUNTIME_STATE.ERROR,
          error: contextError,
        };
      }

      const failure = classifySyncFailure(contextError);
      await updateSyncMeta(current => ({
        ...current,
        runtimeState: failure.runtimeState,
        blockReason: failure.code || 'cloud-context-error',
        lastSyncAttemptAt: startedAt.toISOString(),
      }));
      return {
        status: 'error',
        reason: 'cloud-context-error',
        runtimeState: failure.runtimeState,
        retryable: failure.retryable,
        error: contextError,
      };
    }

    await updateSyncMeta(current => ({
      ...current,
      lastSyncAttemptAt: startedAt.toISOString(),
      runtimeState: SYNC_RUNTIME_STATE.SYNCING,
      blockReason: null,
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
          syncRetry: null,
          reconciliation: current.reconciliation
            ? {
                ...current.reconciliation,
                phase: 'conflicts',
                updatedAt: now().toISOString(),
              }
            : current.reconciliation,
          accountSwitch: current.accountSwitch
            ? {
                ...current.accountSwitch,
                phase: 'conflicts',
                updatedAt: now().toISOString(),
              }
            : current.accountSwitch,
        }));

        return {
          status: 'conflict',
          pulled,
          pushed,
          openConflicts,
          runtimeState: SYNC_RUNTIME_STATE.CONFLICT,
        };
      }

      const permissionAfterPull = await getCurrentDeviceSyncPermission();
      if (!permissionAfterPull.allowed) {
        await updateSyncMeta(current => ({
          ...current,
          runtimeState: SYNC_RUNTIME_STATE.ERROR,
          blockReason: permissionAfterPull.reason,
        }));
        return {
          status: 'blocked',
          reason: permissionAfterPull.reason,
          pulled,
          pushed,
          runtimeState: SYNC_RUNTIME_STATE.ERROR,
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

      let checkpoint = null;
      try {
        checkpoint = await publishCheckpointIfDue(provider, {
          profileId: profile,
          now,
        });
      } catch (checkpointError) {
        checkpoint = {
          status: 'error',
          error: checkpointError,
        };
        await updateSyncMeta(current => ({
          ...current,
          lastCheckpointError: String(
            checkpointError?.message || checkpointError,
          ),
        }));
      }

      await updateSyncMeta(current => {
        const completedAt = now().toISOString();
        const completedReconciliation =
          current.reconciliation?.phase === 'applying' &&
          runtimeState === SYNC_RUNTIME_STATE.SYNCED
            ? {
                ...current.reconciliation,
                phase: 'completed',
                completedAt,
                updatedAt: completedAt,
              }
            : current.reconciliation;
        const completedAccountSwitch =
          current.accountSwitch?.phase === 'applying' &&
          runtimeState === SYNC_RUNTIME_STATE.SYNCED
            ? {
                ...current.accountSwitch,
                phase: 'completed',
                completedAt,
                updatedAt: completedAt,
              }
            : current.accountSwitch;

        return {
          ...current,
          lastSuccessfulSyncAt: completedAt,
          runtimeState,
          syncRetry: null,
          blockReason: null,
          reconciliation: completedReconciliation,
          accountSwitch: completedAccountSwitch,
        };
      });

      return {
        status: runtimeState === SYNC_RUNTIME_STATE.SYNCED ? 'synced' : 'pending',
        pulled,
        pushed,
        pendingCount,
        openConflicts: conflictsAfter,
        checkpoint,
        runtimeState,
      };
    } catch (error) {
      const failedAt = now();
      const failure = classifySyncFailure(error);
      let retryState = null;

      await updateSyncMeta(current => {
        const retryCount = failure.retryable
          ? Math.max(0, Number(current?.syncRetry?.retryCount) || 0) + 1
          : 0;
        retryState = {
          retryCount,
          nextRetryAt: failure.retryable
            ? nextRetryInstant(retryCount, { now: failedAt })
            : null,
          code: failure.code || null,
          message: String(error?.message || error),
          updatedAt: failedAt.toISOString(),
        };

        return {
          ...current,
          lastSyncAttemptAt: failedAt.toISOString(),
          runtimeState: failure.runtimeState,
          syncRetry: retryState,
        };
      });

      return {
        status: 'error',
        pulled,
        pushed,
        runtimeState: failure.runtimeState,
        retryable: failure.retryable,
        nextRetryAt: retryState?.nextRetryAt || null,
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
  const future = [];

  const cycleRetryAt = new Date(meta?.syncRetry?.nextRetryAt || '');
  if (Number.isFinite(cycleRetryAt.getTime()) && cycleRetryAt > now) {
    future.push(cycleRetryAt);
  }

  const pendingIds = new Set(meta?.pendingCloudCommit?.mutationIds || []);
  if (pendingIds.size) {
    const rows = await requestToPromise(tx.objectStore('syncOutbox').getAll());
    for (const row of rows || []) {
      if (!pendingIds.has(row.mutationId) || !row.nextRetryAt) continue;
      const retryAt = new Date(row.nextRetryAt);
      if (Number.isFinite(retryAt.getTime()) && retryAt > now) {
        future.push(retryAt);
      }
    }
  }

  // All active retry gates must have elapsed before an automatic cycle runs.
  // Returning the latest gate avoids retrying pull/object/push work too early.
  future.sort((a, b) => b - a);
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

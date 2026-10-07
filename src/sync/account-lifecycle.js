import {
  openDatabase,
  requestToPromise,
  transactionDone,
} from '../storage/db.js';
import { APP_CONFIG } from '../app/config.js';
import { createUuid } from '../utils/ids.js';
import { nextHybridClock } from './clock.js';
import { createRevisionMeta } from './revision.js';
import { sha256Canonical } from './hash.js';
import {
  buildLocalSyncInventory,
  discoverRemoteSyncInventory,
  planFirstSync,
  RECONCILIATION_KIND,
} from './reconciliation.js';
import {
  discoverCloudProfile,
  ensureCloudProfile,
} from './cloud-profile.js';
import { seedInitialSyncOutbox } from './initial-seed.js';
import { SyncProtocolError } from './cloud-contract.js';
import { SYNC_RUNTIME_STATE } from './config.js';

export async function verifyLinkedCloudContext(provider, {
  profileId,
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) {
    throw new SyncProtocolError('Linked cloud verification requires profileId.', {
      code: 'PROFILE_REQUIRED',
    });
  }

  // Older test/fallback providers do not expose account identity. They retain
  // B12 compatibility, while the production Google provider is verified.
  if (typeof provider?.getAccountProfile !== 'function') {
    return {
      verified: false,
      reason: 'provider-account-identity-unavailable',
      profileId: profile,
      account: null,
      cloudProfile: null,
    };
  }

  const account = await provider.getAccountProfile({ interactive: false });
  const cloud = await discoverCloudProfile(provider);
  if (!cloud || cloud.profile.profileId !== profile) {
    throw new SyncProtocolError(
      'The active Google account does not match this device cloud link.',
      {
        code: 'ACCOUNT_SWITCH_REQUIRED',
        details: {
          linkedProfileId: profile,
          activeProfileId: cloud?.profile?.profileId || null,
          providerSubject: account?.providerSubject || null,
        },
      },
    );
  }

  return {
    verified: true,
    profileId: profile,
    account,
    cloudProfile: cloud.profile,
    cloudProfileFile: cloud.file,
  };
}

export async function inspectAccountSwitch(provider, {
  now = new Date(),
} = {}) {
  if (typeof provider?.getAccountProfile !== 'function') {
    throw new SyncProtocolError(
      'Cloud provider cannot identify the active account.',
      { code: 'UNSUPPORTED' },
    );
  }

  const meta = await getSyncMeta();
  if (!meta?.linkedProfileId) {
    throw new SyncProtocolError(
      'Account switching requires an existing cloud link.',
      { code: 'FIRST_SYNC_REQUIRED' },
    );
  }

  const account = await provider.getAccountProfile({ interactive: false });
  const cloud = await discoverCloudProfile(provider);
  const targetProfileId =
    cloud?.profile?.profileId || createUuid('profile');

  if (targetProfileId === String(meta.linkedProfileId)) {
    return {
      status: 'already-linked',
      account,
      profileId: targetProfileId,
      cloudProfile: cloud?.profile || null,
    };
  }

  const localInventory = await buildLocalSyncInventory();
  const remoteInventory = cloud
    ? await discoverRemoteSyncInventory(provider, {
        profileId: targetProfileId,
      })
    : await emptyRemoteInventory(targetProfileId);
  const plan = planFirstSync(localInventory, remoteInventory);
  const timestamp = now.toISOString();
  const reconciliation = {
    reconciliationId: createUuid('reconciliation'),
    kind: RECONCILIATION_KIND.ACCOUNT_SWITCH,
    phase: 'planning',
    plan: plan.plan,
    requiresConflictScan: plan.requiresConflictScan,
    sourceProfileId: String(meta.linkedProfileId),
    targetProfileId,
    targetProfileExists: Boolean(cloud),
    providerSubject: account?.providerSubject || null,
    displayName: account?.displayName || null,
    displayEmail: account?.displayEmail || null,
    localInventoryHash: localInventory.hash,
    remoteInventoryHash: remoteInventory.hash,
    remoteFileCount: remoteInventory.fileCount,
    createdAt: timestamp,
    updatedAt: timestamp,
    seededAt: null,
    completedAt: null,
  };

  await updateSyncMeta(current => ({
    ...current,
    accountSwitch: reconciliation,
  }));

  return {
    status: 'planning',
    reconciliation,
    account,
    cloudProfile: cloud?.profile || null,
    localInventory,
    remoteInventory,
    plan,
  };
}

export async function confirmAccountSwitch(
  provider,
  reconciliationId,
  { now = new Date() } = {},
) {
  const id = String(reconciliationId || '');
  if (!id) throw new Error('reconciliationId is required.');

  let meta = await getSyncMeta();
  let reconciliation = meta?.accountSwitch;
  if (
    !reconciliation ||
    reconciliation.reconciliationId !== id ||
    reconciliation.kind !== RECONCILIATION_KIND.ACCOUNT_SWITCH
  ) {
    throw new SyncProtocolError(
      'Account-switch reconciliation was not found.',
      { code: 'RECONCILIATION_REQUIRED' },
    );
  }

  if (['applying', 'completed'].includes(reconciliation.phase)) {
    return { reconciliation, seedResult: null, resumed: true };
  }

  const openConflicts = await countOpenConflicts();
  if (openConflicts > 0) {
    throw new SyncProtocolError(
      'Resolve existing sync conflicts before switching cloud accounts.',
      {
        code: 'ACCOUNT_SWITCH_CONFLICTS_OPEN',
        details: { openConflicts },
      },
    );
  }

  const account = await provider.getAccountProfile({ interactive: false });
  if (
    reconciliation.providerSubject &&
    String(account?.providerSubject || '') !==
      String(reconciliation.providerSubject)
  ) {
    throw new SyncProtocolError(
      'The active Google account changed during reconciliation.',
      { code: 'ACCOUNT_SWITCH_REQUIRED' },
    );
  }

  let cloud = await discoverCloudProfile(provider);
  if (cloud && cloud.profile.profileId !== reconciliation.targetProfileId) {
    throw new SyncProtocolError(
      'The target cloud profile changed during reconciliation.',
      { code: 'ACCOUNT_SWITCH_REQUIRED' },
    );
  }
  if (!cloud) {
    cloud = await ensureCloudProfile(provider, {
      profileId: reconciliation.targetProfileId,
      now,
    });
  }

  if (reconciliation.phase === 'planning') {
    reconciliation = await resetOperationalStateForAccountSwitch(
      reconciliation,
      cloud.profile,
      account,
      { now },
    );
  }

  const seedResult = await seedInitialSyncOutbox({ now });
  const next = {
    ...reconciliation,
    phase: 'applying',
    seededAt: reconciliation.seededAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await updateSyncMeta(current => ({
    ...current,
    accountSwitch: next,
    reconciliation: next,
    runtimeState: SYNC_RUNTIME_STATE.PENDING,
  }));

  return {
    reconciliation: next,
    seedResult,
    account,
    cloudProfile: cloud.profile,
    resumed: reconciliation.phase === 'seeding',
  };
}

export async function unlinkCurrentCloudProfile({
  now = new Date(),
} = {}) {
  const db = await openDatabase();
  const tx = db.transaction(
    [
      'syncMeta',
      'syncOutbox',
      'syncReceipts',
      'syncConflicts',
      'cloudObjects',
      'devices',
      'syncRevisions',
    ],
    'readwrite',
  );
  const done = transactionDone(tx);

  try {
    const metaStore = tx.objectStore('syncMeta');
    const meta =
      (await requestToPromise(metaStore.get('global'))) || { key: 'global' };
    const deviceStore = tx.objectStore('devices');
    const currentDevice = meta.deviceId
      ? await requestToPromise(deviceStore.get(meta.deviceId))
      : null;
    const timestamp = now.toISOString();

    tx.objectStore('syncOutbox').clear();
    tx.objectStore('syncReceipts').clear();
    tx.objectStore('syncConflicts').clear();
    tx.objectStore('cloudObjects').clear();

    if (currentDevice) {
      deviceStore.clear();
      deviceStore.put({
        ...currentDevice,
        status: 'active',
        revokedAt: null,
        lastSyncAt: null,
        lastSeenAt: timestamp,
      });
    }

    metaStore.put({
      ...meta,
      key: 'global',
      linkedProfileId: null,
      cloudAccount: null,
      cloudSchemaVersion: null,
      runtimeState: SYNC_RUNTIME_STATE.LOCAL_ONLY,
      nextCommitSequence: 1,
      pendingCloudCommit: null,
      syncRetry: null,
      reconciliation: null,
      accountSwitch: null,
      pendingCheckpoint: null,
      lastCheckpointId: null,
      lastCheckpointCreatedAt: null,
      lastCheckpointReceiptCount: 0,
      lastCheckpointError: null,
      lastSuccessfulSyncAt: null,
      lastSyncAttemptAt: null,
      unlinkedAt: timestamp,
    });

    await done;
    return {
      status: 'unlinked',
      preservedLocalData: true,
      revokedRemoteData: false,
    };
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

export async function getCurrentDeviceSyncPermission() {
  const meta = await getSyncMeta();
  if (!meta?.deviceId) {
    return { allowed: false, reason: 'device-identity-missing', device: null };
  }

  const db = await openDatabase();
  const device = await requestToPromise(
    db
      .transaction('devices', 'readonly')
      .objectStore('devices')
      .get(meta.deviceId),
  );

  if (device?.status === 'revoked') {
    return { allowed: false, reason: 'device-revoked', device };
  }
  return { allowed: true, reason: null, device: device || null };
}

async function resetOperationalStateForAccountSwitch(
  reconciliation,
  cloudProfile,
  account,
  { now },
) {
  const db = await openDatabase();
  const tx = db.transaction(
    [
      'syncMeta',
      'syncOutbox',
      'syncReceipts',
      'syncConflicts',
      'cloudObjects',
      'devices',
      'syncRevisions',
    ],
    'readwrite',
  );
  const done = transactionDone(tx);

  try {
    const metaStore = tx.objectStore('syncMeta');
    const meta =
      (await requestToPromise(metaStore.get('global'))) || { key: 'global' };
    const deviceStore = tx.objectStore('devices');
    const currentDevice = meta.deviceId
      ? await requestToPromise(deviceStore.get(meta.deviceId))
      : null;

    if (!meta.deviceId || !currentDevice) {
      throw new SyncProtocolError(
        'Current device identity is missing for account switch.',
        { code: 'DEVICE_ID_REQUIRED' },
      );
    }

    tx.objectStore('syncOutbox').clear();
    tx.objectStore('syncReceipts').clear();
    tx.objectStore('syncConflicts').clear();
    tx.objectStore('cloudObjects').clear();

    const timestamp = now.toISOString();
    const clock = nextHybridClock({
      local: meta.clock,
      deviceId: meta.deviceId,
      nowMs: now.getTime(),
    });
    const revision = createRevisionMeta({
      parentRevisionIds: [],
      changedAt: timestamp,
      changedByDeviceId: meta.deviceId,
      clock,
    });
    deviceStore.clear();
    deviceStore.put({
      ...currentDevice,
      status: 'active',
      revokedAt: null,
      lastSyncAt: null,
      lastSeenAt: timestamp,
      appVersion: APP_CONFIG.appVersion,
      revision,
    });
    tx.objectStore('syncRevisions').put({
      ...revision,
      entityType: 'device',
      entityKey: meta.deviceId,
    });

    const nextReconciliation = {
      ...reconciliation,
      phase: 'seeding',
      targetProfileExists: true,
      updatedAt: timestamp,
    };
    metaStore.put({
      ...meta,
      key: 'global',
      linkedProfileId: reconciliation.targetProfileId,
      cloudSchemaVersion: cloudProfile.cloudSchema,
      cloudAccount: {
        provider: account?.provider || 'google',
        providerSubject: account?.providerSubject || null,
        displayName: account?.displayName || null,
        displayEmail: account?.displayEmail || null,
        photoUrl: account?.photoUrl || null,
      },
      runtimeState: SYNC_RUNTIME_STATE.PENDING,
      nextCommitSequence: 1,
      pendingCloudCommit: null,
      syncRetry: null,
      reconciliation: nextReconciliation,
      accountSwitch: nextReconciliation,
      pendingCheckpoint: null,
      lastCheckpointId: null,
      lastCheckpointCreatedAt: null,
      lastCheckpointReceiptCount: 0,
      lastCheckpointError: null,
      lastSuccessfulSyncAt: null,
      lastSyncAttemptAt: null,
      clock: {
        physicalMs: clock.physicalMs,
        logical: clock.logical,
      },
    });

    await done;
    return nextReconciliation;
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

async function emptyRemoteInventory(profileId) {
  const counts = {};
  const fileIds = [];
  return {
    inventoryVersion: 1,
    profileId: String(profileId),
    fileCount: 0,
    counts,
    meaningfulCount: 0,
    isEmpty: true,
    fileIds,
    hash: await sha256Canonical({ counts, fileIds }),
  };
}

async function countOpenConflicts() {
  const db = await openDatabase();
  return requestToPromise(
    db
      .transaction('syncConflicts', 'readonly')
      .objectStore('syncConflicts')
      .index('status')
      .count(IDBKeyRange.only('open')),
  );
}

async function getSyncMeta() {
  const db = await openDatabase();
  return requestToPromise(
    db
      .transaction('syncMeta', 'readonly')
      .objectStore('syncMeta')
      .get('global'),
  );
}

async function updateSyncMeta(updater) {
  const db = await openDatabase();
  const tx = db.transaction('syncMeta', 'readwrite');
  const done = transactionDone(tx);
  try {
    const store = tx.objectStore('syncMeta');
    const current =
      (await requestToPromise(store.get('global'))) || { key: 'global' };
    const next = updater(current) || current;
    store.put({ ...current, ...next, key: 'global' });
    await done;
    return next;
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

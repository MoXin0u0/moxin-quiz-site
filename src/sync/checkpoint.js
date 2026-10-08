import { APP_CONFIG } from '../app/config.js';
import {
  openDatabase,
  requestToPromise,
  transactionDone,
} from '../storage/db.js';
import { createUuid } from '../utils/ids.js';
import {
  CLOUD_OBJECT_TYPE,
  SyncProtocolError,
  cloudAppProperties,
} from './cloud-contract.js';
import { sha256Canonical } from './hash.js';
import { compareRevisionOrder } from './revision.js';
import {
  discoverCloudProfile,
  updateCloudProfileCheckpointPointer,
} from './cloud-profile.js';

export const CLOUD_CHECKPOINT_FORMAT = 'moxin-quiz-checkpoint';
export const CLOUD_CHECKPOINT_VERSION = 1;

export async function buildLocalCheckpoint({
  profileId,
  checkpointId = createUuid('checkpoint'),
  now = new Date(),
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) {
    throw new SyncProtocolError('Checkpoint requires profileId.', {
      code: 'PROFILE_REQUIRED',
    });
  }

  const db = await openDatabase();
  const tx = db.transaction(
    ['syncMeta', 'syncReceipts', 'syncRevisions', 'syncTombstones', 'devices'],
    'readonly',
  );
  const [meta, receipts, revisions, tombstones, devices] = await Promise.all([
    requestToPromise(tx.objectStore('syncMeta').get('global')),
    requestToPromise(tx.objectStore('syncReceipts').getAll()),
    requestToPromise(tx.objectStore('syncRevisions').getAll()),
    requestToPromise(tx.objectStore('syncTombstones').getAll()),
    requestToPromise(tx.objectStore('devices').getAll()),
  ]);

  if (meta?.linkedProfileId && String(meta.linkedProfileId) !== profile) {
    throw new SyncProtocolError(
      'Checkpoint profile does not match the linked cloud profile.',
      { code: 'PROFILE_MISMATCH' },
    );
  }

  const createdAt = now.toISOString();
  const base = {
    format: CLOUD_CHECKPOINT_FORMAT,
    version: CLOUD_CHECKPOINT_VERSION,
    cloudSchema: Number(APP_CONFIG.cloudSyncSchemaVersion),
    checkpointId: String(checkpointId),
    profileId: profile,
    createdAt,
    createdByDeviceId: String(meta?.deviceId || ''),
    receiptCount: (receipts || []).length,
    commitFrontier: buildCommitFrontier(receipts),
    entityHeadIndex: buildEntityHeadIndex(revisions),
    tombstoneHeadIndex: buildTombstoneHeadIndex(tombstones),
    deviceIndex: buildDeviceIndex(devices),
  };
  if (!base.createdByDeviceId) {
    throw new SyncProtocolError('Checkpoint requires a local device identity.', {
      code: 'DEVICE_ID_REQUIRED',
    });
  }

  return {
    ...base,
    payloadHash: await sha256Canonical(base),
  };
}

export async function validateCloudCheckpoint(checkpoint, {
  expectedProfileId = null,
  maxCloudSchema = APP_CONFIG.cloudSyncSchemaVersion,
} = {}) {
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
    throw new SyncProtocolError('Cloud checkpoint must be an object.', {
      code: 'INVALID_CHECKPOINT',
    });
  }
  if (
    checkpoint.format !== CLOUD_CHECKPOINT_FORMAT ||
    checkpoint.version !== CLOUD_CHECKPOINT_VERSION
  ) {
    throw new SyncProtocolError('Unsupported cloud checkpoint format.', {
      code: 'UNSUPPORTED_CHECKPOINT_FORMAT',
    });
  }

  const cloudSchema = Number(checkpoint.cloudSchema);
  if (!Number.isInteger(cloudSchema) || cloudSchema < 1) {
    throw new SyncProtocolError('Cloud checkpoint schema is invalid.', {
      code: 'INVALID_CLOUD_SCHEMA',
    });
  }
  if (cloudSchema > Number(maxCloudSchema)) {
    throw new SyncProtocolError('Cloud checkpoint schema is newer than this client.', {
      code: 'CLOUD_SCHEMA_NEWER',
    });
  }

  const base = {
    format: checkpoint.format,
    version: checkpoint.version,
    cloudSchema,
    checkpointId: String(checkpoint.checkpointId || ''),
    profileId: String(checkpoint.profileId || ''),
    createdAt: String(checkpoint.createdAt || ''),
    createdByDeviceId: String(checkpoint.createdByDeviceId || ''),
    receiptCount: Number(checkpoint.receiptCount) || 0,
    commitFrontier: checkpoint.commitFrontier || {},
    entityHeadIndex: Array.isArray(checkpoint.entityHeadIndex)
      ? checkpoint.entityHeadIndex
      : [],
    tombstoneHeadIndex: Array.isArray(checkpoint.tombstoneHeadIndex)
      ? checkpoint.tombstoneHeadIndex
      : [],
    deviceIndex: Array.isArray(checkpoint.deviceIndex)
      ? checkpoint.deviceIndex
      : [],
  };

  if (!base.checkpointId || !base.profileId || !base.createdByDeviceId) {
    throw new SyncProtocolError('Cloud checkpoint identity is incomplete.', {
      code: 'INVALID_CHECKPOINT',
    });
  }
  if (expectedProfileId && base.profileId !== String(expectedProfileId)) {
    throw new SyncProtocolError('Cloud checkpoint belongs to a different profile.', {
      code: 'PROFILE_MISMATCH',
    });
  }

  const expectedHash = await sha256Canonical(base);
  if (String(checkpoint.payloadHash || '') !== expectedHash) {
    throw new SyncProtocolError(
      'Cloud checkpoint payload hash does not match its contents.',
      {
        code: 'CHECKPOINT_HASH_MISMATCH',
        details: {
          expectedHash,
          actualHash: checkpoint.payloadHash || null,
        },
      },
    );
  }
  return { ...base, payloadHash: expectedHash };
}

export async function getCheckpointDueState({
  now = new Date(),
} = {}) {
  const db = await openDatabase();
  const tx = db.transaction(['syncMeta', 'syncReceipts'], 'readonly');
  const [meta, receiptCount] = await Promise.all([
    requestToPromise(tx.objectStore('syncMeta').get('global')),
    requestToPromise(tx.objectStore('syncReceipts').count()),
  ]);

  const lastReceiptCount = Math.max(
    0,
    Number(meta?.lastCheckpointReceiptCount) || 0,
  );
  const commitsSince = Math.max(0, receiptCount - lastReceiptCount);
  const everyCommits = Math.max(
    1,
    Number(APP_CONFIG.syncLimits.checkpointEveryCommits) || 100,
  );
  const maxAgeMs = Math.max(
    60 * 1000,
    Number(APP_CONFIG.syncLimits.checkpointMaxAgeMs) ||
      7 * 24 * 60 * 60 * 1000,
  );
  const referenceInstant =
    meta?.lastCheckpointCreatedAt ||
    meta?.lastSuccessfulSyncAt ||
    null;
  const referenceMs = referenceInstant
    ? new Date(referenceInstant).getTime()
    : NaN;
  const ageMs = Number.isFinite(referenceMs)
    ? Math.max(0, now.getTime() - referenceMs)
    : 0;

  return {
    due:
      Boolean(meta?.pendingCheckpoint) ||
      commitsSince >= everyCommits ||
      (Boolean(referenceInstant) && ageMs >= maxAgeMs),
    pending: Boolean(meta?.pendingCheckpoint),
    receiptCount,
    lastReceiptCount,
    commitsSince,
    everyCommits,
    ageMs,
    maxAgeMs,
  };
}

export async function publishCheckpointIfDue(provider, {
  profileId,
  force = false,
  now = () => new Date(),
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) {
    throw new SyncProtocolError('Checkpoint publish requires profileId.', {
      code: 'PROFILE_REQUIRED',
    });
  }

  const due = await getCheckpointDueState({ now: now() });
  if (!force && !due.due) {
    return { status: 'skipped', reason: 'not-due', due };
  }

  const cloudProfile = await discoverCloudProfile(provider);
  if (!cloudProfile) {
    return { status: 'skipped', reason: 'profile-missing', due };
  }
  if (cloudProfile.profile.profileId !== profile) {
    throw new SyncProtocolError(
      'Linked profile does not match the Google account cloud profile.',
      { code: 'PROFILE_MISMATCH' },
    );
  }

  let pending = await readPendingCheckpoint();
  if (pending && pending.checkpoint?.profileId !== profile) {
    throw new SyncProtocolError(
      'Pending checkpoint belongs to another cloud profile.',
      { code: 'PROFILE_MISMATCH' },
    );
  }

  if (!pending) {
    const checkpoint = await buildLocalCheckpoint({
      profileId: profile,
      now: now(),
    });
    pending = {
      checkpoint,
      receiptCount: checkpoint.receiptCount,
      preparedAt: checkpoint.createdAt,
    };
    await writePendingCheckpoint(pending);
  }

  const checkpoint = await validateCloudCheckpoint(pending.checkpoint, {
    expectedProfileId: profile,
  });
  const properties = cloudAppProperties({
    profileId: profile,
    objectType: CLOUD_OBJECT_TYPE.CHECKPOINT,
    objectId: checkpoint.checkpointId,
    hash: checkpoint.payloadHash,
  });

  const existing = await listAllProviderFiles(provider, {
    appProperties: {
      moxinApp: properties.moxinApp,
      profileId: properties.profileId,
      objectType: properties.objectType,
      objectId: properties.objectId,
    },
  });

  let file = null;
  if (existing.length) {
    file =
      existing.find(
        item => item?.appProperties?.hash === checkpoint.payloadHash,
      ) || null;
    if (!file) {
      throw new SyncProtocolError('Cloud checkpoint ID collision detected.', {
        code: 'CHECKPOINT_ID_COLLISION',
        details: { checkpointId: checkpoint.checkpointId },
      });
    }
    await validateCloudCheckpoint(await provider.downloadJson(file.id), {
      expectedProfileId: profile,
    });
  } else {
    file = await provider.createJsonFile({
      name: `checkpoint-${checkpoint.checkpointId}.json`,
      data: checkpoint,
      appProperties: properties,
    });
    const roundTrip = await validateCloudCheckpoint(
      await provider.downloadJson(file.id),
      { expectedProfileId: profile },
    );
    if (roundTrip.payloadHash !== checkpoint.payloadHash) {
      throw new SyncProtocolError(
        'Uploaded checkpoint failed round-trip verification.',
        { code: 'CHECKPOINT_HASH_MISMATCH' },
      );
    }
  }

  const pointer = {
    checkpointId: checkpoint.checkpointId,
    payloadHash: checkpoint.payloadHash,
    driveFileId: String(file.id),
    createdAt: checkpoint.createdAt,
  };
  const updatedProfile = await updateCloudProfileCheckpointPointer(provider, {
    file: cloudProfile.file,
    profile: cloudProfile.profile,
    checkpoint: pointer,
    updatedAt: checkpoint.createdAt,
  });

  await acknowledgeCheckpoint(checkpoint, file, pending.receiptCount);

  return {
    status: 'published',
    checkpoint,
    file,
    profile: updatedProfile.profile,
    reusedExistingFile: existing.length > 0,
    due,
  };
}

function buildCommitFrontier(receipts) {
  const frontier = {};
  for (const receipt of receipts || []) {
    const deviceId = String(receipt?.deviceId || '');
    const sequence = Number(receipt?.deviceSequence);
    if (!deviceId || !Number.isInteger(sequence) || sequence < 1) continue;
    frontier[deviceId] = Math.max(frontier[deviceId] || 0, sequence);
  }
  return Object.fromEntries(
    Object.entries(frontier).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function buildEntityHeadIndex(revisions) {
  const heads = new Map();
  for (const revision of revisions || []) {
    if (
      !revision?.revisionId ||
      !revision?.entityType ||
      !revision?.entityKey
    ) continue;
    const key = `${revision.entityType}\u0000${revision.entityKey}`;
    const current = heads.get(key);
    if (!current || compareRevisionOrder(current, revision) < 0) {
      heads.set(key, revision);
    }
  }

  return [...heads.values()]
    .map(revision => ({
      entityType: String(revision.entityType),
      entityKey: String(revision.entityKey),
      revisionId: String(revision.revisionId),
      changedAt: revision.changedAt || null,
    }))
    .sort((a, b) => (
      a.entityType.localeCompare(b.entityType) ||
      a.entityKey.localeCompare(b.entityKey)
    ));
}

function buildTombstoneHeadIndex(tombstones) {
  const latest = new Map();
  for (const item of tombstones || []) {
    if (
      !item?.entityType ||
      !item?.entityKey ||
      !item?.revision?.revisionId
    ) continue;
    const key = `${item.entityType}\u0000${item.entityKey}`;
    const current = latest.get(key);
    if (!current || compareRevisionOrder(current.revision, item.revision) < 0) {
      latest.set(key, item);
    }
  }
  return [...latest.values()]
    .map(item => ({
      entityType: String(item.entityType),
      entityKey: String(item.entityKey),
      revisionId: String(item.revision.revisionId),
      deletedAt: item.deletedAt || item.revision.changedAt || null,
    }))
    .sort((a, b) => (
      a.entityType.localeCompare(b.entityType) ||
      a.entityKey.localeCompare(b.entityKey)
    ));
}

function buildDeviceIndex(devices) {
  return (devices || [])
    .filter(item => item?.deviceId)
    .map(item => ({
      deviceId: String(item.deviceId),
      revisionId: item?.revision?.revisionId || null,
      status: item.status || 'active',
      label: item.label || null,
      lastSeenAt: item.lastSeenAt || null,
      lastSyncAt: item.lastSyncAt || null,
      appVersion: item.appVersion || null,
    }))
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId));
}

async function readPendingCheckpoint() {
  const db = await openDatabase();
  const meta = await requestToPromise(
    db
      .transaction('syncMeta', 'readonly')
      .objectStore('syncMeta')
      .get('global'),
  );
  return meta?.pendingCheckpoint || null;
}

async function writePendingCheckpoint(pendingCheckpoint) {
  const db = await openDatabase();
  const tx = db.transaction('syncMeta', 'readwrite');
  const done = transactionDone(tx);
  const store = tx.objectStore('syncMeta');
  const meta =
    (await requestToPromise(store.get('global'))) || { key: 'global' };
  store.put({ ...meta, key: 'global', pendingCheckpoint });
  await done;
}

async function acknowledgeCheckpoint(checkpoint, file, receiptCount) {
  const db = await openDatabase();
  const tx = db.transaction(['syncMeta', 'cloudObjects'], 'readwrite');
  const done = transactionDone(tx);
  const metaStore = tx.objectStore('syncMeta');
  const meta =
    (await requestToPromise(metaStore.get('global'))) || { key: 'global' };

  tx.objectStore('cloudObjects').put({
    objectKey: `checkpoint:${checkpoint.checkpointId}`,
    objectType: CLOUD_OBJECT_TYPE.CHECKPOINT,
    logicalId: checkpoint.checkpointId,
    contentHash: checkpoint.payloadHash,
    driveFileId: String(file.id),
    modifiedTime: file.modifiedTime || null,
    verifiedAt: checkpoint.createdAt,
  });
  metaStore.put({
    ...meta,
    key: 'global',
    pendingCheckpoint: null,
    lastCheckpointId: checkpoint.checkpointId,
    lastCheckpointCreatedAt: checkpoint.createdAt,
    lastCheckpointReceiptCount: Math.max(0, Number(receiptCount) || 0),
    lastCheckpointError: null,
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

export {
  buildCommitFrontier,
  buildEntityHeadIndex,
  buildTombstoneHeadIndex,
  buildDeviceIndex,
};

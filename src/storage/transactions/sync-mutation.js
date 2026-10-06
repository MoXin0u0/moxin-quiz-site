import { requestToPromise } from '../db.js';
import { createDeviceId } from '../../utils/ids.js';
import { nextHybridClock } from '../../sync/clock.js';
import { compareRevisionOrder, createRevisionMeta } from '../../sync/revision.js';
import {
  enqueueOutboxMutation,
  setOutboxMutationPayload,
} from '../../sync/outbox-service.js';

function createBaseSyncMeta(deviceId) {
  return {
    key: 'global',
    deviceId,
    linkedProfileId: null,
    cloudSchemaVersion: null,
    nextCommitSequence: 1,
    lastSuccessfulSyncAt: null,
    lastSyncAttemptAt: null,
    lastCheckpointId: null,
    runtimeState: 'LOCAL_ONLY',
    pendingCloudCommit: null,
    clock: {
      physicalMs: 0,
      logical: 0,
    },
    migration: null,
    reconciliation: null,
  };
}

export async function ensureSyncIdentityInTransaction(tx) {
  const store = tx.objectStore('syncMeta');
  let meta = await requestToPromise(store.get('global'));

  if (!meta?.deviceId) {
    const deviceId = createDeviceId();
    meta = {
      ...createBaseSyncMeta(deviceId),
      ...(meta || {}),
      key: 'global',
      deviceId,
    };
    store.put(meta);
  }

  return meta;
}

export async function getLatestTombstoneRevisionInTransaction(tx, {
  entityType,
  entityKey,
} = {}) {
  if (!tx.objectStoreNames.contains('syncTombstones')) return null;

  const key = String(entityKey || '');
  const type = String(entityType || '');
  if (!key || !type) return null;

  const tombstones = await requestToPromise(
    tx.objectStore('syncTombstones')
      .index('entityKey')
      .getAll(IDBKeyRange.only(key)),
  );

  const matching = (tombstones || [])
    .filter(item => item?.entityType === type && item?.revision)
    .sort((left, right) => compareRevisionOrder(left.revision, right.revision));

  return matching.at(-1)?.revision || null;
}

export async function createRevisionMutationInTransaction(tx, {
  entityType,
  entityKey,
  previousRevision = null,
  operation = 'upsert',
  coalesceKey = null,
  now = new Date(),
} = {}) {
  const metaStore = tx.objectStore('syncMeta');
  const revisionStore = tx.objectStore('syncRevisions');

  const meta = await ensureSyncIdentityInTransaction(tx);
  const clock = nextHybridClock({
    local: meta.clock,
    deviceId: meta.deviceId,
    nowMs: now.getTime(),
  });

  const revision = createRevisionMeta({
    parentRevisionIds: previousRevision?.revisionId
      ? [previousRevision.revisionId]
      : [],
    changedAt: now.toISOString(),
    changedByDeviceId: meta.deviceId,
    clock,
  });

  metaStore.put({
    ...meta,
    clock: {
      physicalMs: clock.physicalMs,
      logical: clock.logical,
    },
  });

  revisionStore.put({
    ...revision,
    entityType: String(entityType),
    entityKey: String(entityKey),
  });

  const mutation = await enqueueOutboxMutation(tx, {
    entityType,
    entityKey,
    operation,
    targetRevisionId: revision.revisionId,
    coalesceKey,
    createdAt: revision.changedAt,
    deviceId: meta.deviceId,
  });

  return {
    revision,
    mutation,
    deviceId: meta.deviceId,
  };
}

export async function enqueueImmutableMutationInTransaction(tx, {
  entityType,
  entityKey,
  operation = 'append',
  createdAt = new Date().toISOString(),
} = {}) {
  const meta = await ensureSyncIdentityInTransaction(tx);
  const mutation = await enqueueOutboxMutation(tx, {
    entityType,
    entityKey,
    operation,
    targetRevisionId: null,
    coalesceKey: null,
    createdAt,
    deviceId: meta.deviceId,
  });

  return {
    mutation,
    deviceId: meta.deviceId,
  };
}


export function attachMutationPayloadInTransaction(tx, mutation, payload) {
  return setOutboxMutationPayload(tx, mutation, payload);
}

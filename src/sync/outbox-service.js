import { createMutationId } from '../utils/ids.js';
import {
  getMutationPolicy,
  MUTATION_POLICY,
} from './mutation-policy.js';
import { requestToPromise } from '../storage/db.js';

export const OUTBOX_STATUS = Object.freeze({
  PENDING: 'pending',
  INFLIGHT: 'inflight',
  RETRY: 'retry',
  BLOCKED: 'blocked',
});

export function buildOutboxMutation({
  entityType,
  entityKey,
  operation,
  targetRevisionId = null,
  payloadHash = null,
  payload,
  coalesceKey = null,
  createdAt = new Date().toISOString(),
  deviceId,
} = {}) {
  const type = String(entityType || '');
  const key = String(entityKey || '');
  const device = String(deviceId || '');
  if (!type || !key || !device) {
    throw new Error('Outbox mutation requires entityType, entityKey, and deviceId.');
  }

  const policy = getMutationPolicy(type);
  return {
    mutationId: createMutationId(),
    entityType: type,
    entityKey: key,
    operation: String(operation || 'upsert'),
    policy,
    targetRevisionId: targetRevisionId ? String(targetRevisionId) : null,
    payloadHash: payloadHash ? String(payloadHash) : null,
    hasPayload: payload !== undefined,
    ...(payload !== undefined ? { payload } : {}),
    coalesceKey:
      policy === MUTATION_POLICY.COALESCIBLE && coalesceKey
        ? String(coalesceKey)
        : null,
    createdAt: String(createdAt),
    deviceId: device,
    status: OUTBOX_STATUS.PENDING,
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
  };
}

export async function enqueueOutboxMutation(tx, input) {
  const store = tx.objectStore('syncOutbox');
  const mutation = buildOutboxMutation(input);

  if (mutation.coalesceKey) {
    const existing = await requestToPromise(
      store.index('coalesceKey').getAll(IDBKeyRange.only(mutation.coalesceKey)),
    );

    for (const record of existing || []) {
      if (
        record?.mutationId !== mutation.mutationId &&
        (record?.status === OUTBOX_STATUS.PENDING || record?.status === OUTBOX_STATUS.RETRY)
      ) {
        store.delete(record.mutationId);
      }
    }
  }

  store.put(mutation);
  return mutation;
}


export function setOutboxMutationPayload(tx, mutation, payload) {
  if (!mutation?.mutationId) {
    throw new Error('Cannot attach an outbox payload without mutationId.');
  }
  const next = {
    ...mutation,
    hasPayload: true,
    payload,
  };
  tx.objectStore('syncOutbox').put(next);
  return next;
}

import {
  getAllRecords,
  getRecord,
  openDatabase,
  requestToPromise,
  transactionDone,
  putRecord,
} from '../db.js';
import { APP_CONFIG } from '../../app/config.js';
import { nextHybridClock } from '../../sync/clock.js';
import { createRevisionMeta } from '../../sync/revision.js';
import { enqueueOutboxMutation } from '../../sync/outbox-service.js';

export function getDeviceProfile(deviceId) {
  return getRecord('devices', String(deviceId));
}

export function listDeviceProfiles() {
  return getAllRecords('devices');
}

export async function saveDeviceProfile(profile) {
  if (!profile?.deviceId) throw new Error('device profile requires deviceId.');
  await putRecord('devices', profile);
  return profile;
}

export async function renameDeviceProfile(deviceId, label, {
  now = new Date(),
} = {}) {
  const nextLabel = String(label || '').trim();
  if (!nextLabel) throw new Error('Device label cannot be empty.');
  return mutateDeviceProfile(
    deviceId,
    current => ({ ...current, label: nextLabel.slice(0, 80) }),
    { now },
  );
}

export async function revokeRemoteDeviceProfile(deviceId, {
  now = new Date(),
} = {}) {
  const target = String(deviceId || '');
  if (!target) throw new Error('deviceId is required.');

  const meta = await readSyncMeta();
  if (String(meta?.deviceId || '') === target) {
    throw new Error(
      'The current device must be unlinked locally instead of revoking itself.',
    );
  }

  return mutateDeviceProfile(
    target,
    current => ({
      ...current,
      status: 'revoked',
      revokedAt: now.toISOString(),
    }),
    { now },
  );
}

export async function mutateDeviceProfile(deviceId, updater, {
  now = new Date(),
} = {}) {
  const target = String(deviceId || '');
  if (!target) throw new Error('deviceId is required.');
  if (typeof updater !== 'function') {
    throw new TypeError('Device updater must be a function.');
  }

  const db = await openDatabase();
  const tx = db.transaction(
    ['devices', 'syncMeta', 'syncRevisions', 'syncOutbox'],
    'readwrite',
  );
  const done = transactionDone(tx);

  try {
    const deviceStore = tx.objectStore('devices');
    const metaStore = tx.objectStore('syncMeta');
    const [current, meta] = await Promise.all([
      requestToPromise(deviceStore.get(target)),
      requestToPromise(metaStore.get('global')),
    ]);
    if (!current) throw new Error(`Device was not found: ${target}`);
    if (!meta?.deviceId) throw new Error('Local device identity is missing.');

    const timestamp = now.toISOString();
    const clock = nextHybridClock({
      local: meta.clock,
      deviceId: meta.deviceId,
      nowMs: now.getTime(),
    });
    const revision = createRevisionMeta({
      parentRevisionIds: current?.revision?.revisionId
        ? [current.revision.revisionId]
        : [],
      changedAt: timestamp,
      changedByDeviceId: meta.deviceId,
      clock,
    });
    const proposed = updater({ ...current });
    const next = {
      ...current,
      ...(proposed || {}),
      deviceId: target,
      appVersion: current.appVersion || APP_CONFIG.appVersion,
      lastSeenAt:
        target === meta.deviceId
          ? timestamp
          : current.lastSeenAt || null,
      updatedAt: timestamp,
      revision,
    };

    deviceStore.put(next);
    tx.objectStore('syncRevisions').put({
      ...revision,
      entityType: 'device',
      entityKey: target,
    });
    await enqueueOutboxMutation(tx, {
      entityType: 'device',
      entityKey: target,
      operation: 'upsert',
      targetRevisionId: revision.revisionId,
      payload: next,
      coalesceKey: `device:${target}`,
      createdAt: timestamp,
      deviceId: meta.deviceId,
    });
    metaStore.put({
      ...meta,
      clock: {
        physicalMs: clock.physicalMs,
        logical: clock.logical,
      },
      runtimeState: meta.linkedProfileId ? 'PENDING' : meta.runtimeState,
    });

    await done;
    return next;
  } catch (error) {
    try { tx.abort(); } catch {}
    await done.catch(() => {});
    throw error;
  }
}

async function readSyncMeta() {
  const db = await openDatabase();
  return requestToPromise(
    db
      .transaction('syncMeta', 'readonly')
      .objectStore('syncMeta')
      .get('global'),
  );
}

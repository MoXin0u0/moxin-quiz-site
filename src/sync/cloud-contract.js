import { APP_CONFIG } from '../app/config.js';
import { createCommitId } from '../utils/ids.js';
import { canonicalJson } from './canonical.js';
import { sha256Canonical } from './hash.js';

export const CLOUD_SYNC_FORMAT = 'moxin-quiz-sync';
export const CLOUD_COMMIT_VERSION = 1;
export const CLOUD_APP_ID = 'moxin-quiz';

export const CLOUD_OBJECT_TYPE = Object.freeze({
  PROFILE: 'profile',
  COMMIT: 'commit',
  CHECKPOINT: 'checkpoint',
  ASSET: 'asset',
  DRAFT: 'draft',
  USER_BANK: 'user-bank',
  SESSION: 'session',
});

export class SyncProtocolError extends Error {
  constructor(message, {
    code = 'SYNC_PROTOCOL_ERROR',
    details = null,
  } = {}) {
    super(message);
    this.name = 'SyncProtocolError';
    this.code = code;
    this.details = details;
  }
}

export function cloudAppProperties({
  profileId,
  objectType,
  objectId,
  hash = null,
  cloudSchema = APP_CONFIG.cloudSyncSchemaVersion,
} = {}) {
  const profile = String(profileId || '').trim();
  const type = String(objectType || '').trim();
  const id = String(objectId || '').trim();
  if (!profile || !type || !id) {
    throw new SyncProtocolError(
      'Cloud appProperties require profileId, objectType, and objectId.',
      { code: 'INVALID_CLOUD_PROPERTIES' },
    );
  }

  return {
    moxinApp: CLOUD_APP_ID,
    cloudSchema: String(cloudSchema),
    profileId: profile,
    objectType: type,
    objectId: id,
    ...(hash ? { hash: String(hash) } : {}),
  };
}

export function cloudCommitFileName(commit) {
  const device = safeFileToken(commit?.deviceId || 'device');
  const sequence = String(Math.max(0, Number(commit?.deviceSequence) || 0)).padStart(12, '0');
  const commitId = safeFileToken(commit?.commitId || 'commit');
  return `commit-${device}-${sequence}-${commitId}.json`;
}

export async function createCloudCommit({
  profileId,
  deviceId,
  deviceSequence,
  mutations,
  commitId = createCommitId(),
  createdAt = new Date().toISOString(),
  appVersion = APP_CONFIG.appVersion,
  cloudSchema = APP_CONFIG.cloudSyncSchemaVersion,
} = {}) {
  const profile = String(profileId || '').trim();
  const device = String(deviceId || '').trim();
  const sequence = Number(deviceSequence);
  const rows = Array.isArray(mutations) ? mutations : [];

  if (!profile || !device || !Number.isInteger(sequence) || sequence < 1) {
    throw new SyncProtocolError(
      'Cloud commit requires profileId, deviceId, and a positive deviceSequence.',
      { code: 'INVALID_COMMIT_IDENTITY' },
    );
  }
  if (!rows.length) {
    throw new SyncProtocolError(
      'Cloud commit requires at least one mutation.',
      { code: 'EMPTY_COMMIT' },
    );
  }

  const base = {
    format: CLOUD_SYNC_FORMAT,
    version: CLOUD_COMMIT_VERSION,
    cloudSchema: Number(cloudSchema),
    commitId: String(commitId),
    profileId: profile,
    deviceId: device,
    deviceSequence: sequence,
    appVersion: String(appVersion || ''),
    createdAt: String(createdAt),
    mutations: rows.map(normalizeCloudMutation),
  };

  return {
    ...base,
    payloadHash: await sha256Canonical(base),
  };
}

export async function validateCloudCommit(commit, {
  expectedProfileId = null,
  maxCloudSchema = APP_CONFIG.cloudSyncSchemaVersion,
} = {}) {
  if (!commit || typeof commit !== 'object' || Array.isArray(commit)) {
    throw new SyncProtocolError('Cloud commit must be an object.', { code: 'INVALID_COMMIT' });
  }

  if (commit.format !== CLOUD_SYNC_FORMAT || commit.version !== CLOUD_COMMIT_VERSION) {
    throw new SyncProtocolError('Unsupported cloud commit format.', { code: 'UNSUPPORTED_COMMIT_FORMAT' });
  }

  const schema = Number(commit.cloudSchema);
  if (!Number.isInteger(schema) || schema < 1) {
    throw new SyncProtocolError('Cloud commit schema is invalid.', { code: 'INVALID_CLOUD_SCHEMA' });
  }
  if (schema > Number(maxCloudSchema)) {
    throw new SyncProtocolError(
      `Cloud schema ${schema} is newer than this client supports.`,
      {
        code: 'CLOUD_SCHEMA_NEWER',
        details: { cloudSchema: schema, maxCloudSchema: Number(maxCloudSchema) },
      },
    );
  }

  if (expectedProfileId && String(commit.profileId) !== String(expectedProfileId)) {
    throw new SyncProtocolError('Cloud commit belongs to a different profile.', {
      code: 'PROFILE_MISMATCH',
    });
  }

  if (!commit.commitId || !commit.profileId || !commit.deviceId) {
    throw new SyncProtocolError('Cloud commit identity is incomplete.', { code: 'INVALID_COMMIT_IDENTITY' });
  }
  if (!Number.isInteger(Number(commit.deviceSequence)) || Number(commit.deviceSequence) < 1) {
    throw new SyncProtocolError('Cloud commit sequence is invalid.', { code: 'INVALID_COMMIT_SEQUENCE' });
  }
  if (!Array.isArray(commit.mutations) || !commit.mutations.length) {
    throw new SyncProtocolError('Cloud commit mutations are missing.', { code: 'EMPTY_COMMIT' });
  }

  const base = {
    format: commit.format,
    version: commit.version,
    cloudSchema: schema,
    commitId: String(commit.commitId),
    profileId: String(commit.profileId),
    deviceId: String(commit.deviceId),
    deviceSequence: Number(commit.deviceSequence),
    appVersion: String(commit.appVersion || ''),
    createdAt: String(commit.createdAt || ''),
    mutations: commit.mutations.map(normalizeCloudMutation),
  };
  const expectedHash = await sha256Canonical(base);

  if (String(commit.payloadHash || '') !== expectedHash) {
    throw new SyncProtocolError('Cloud commit payload hash does not match its contents.', {
      code: 'COMMIT_HASH_MISMATCH',
      details: {
        expectedHash,
        actualHash: commit.payloadHash || null,
      },
    });
  }

  return {
    ...base,
    payloadHash: expectedHash,
  };
}

export function cloudCommitByteLength(commit) {
  const json = canonicalJson(commit);
  return new TextEncoder().encode(json || '').byteLength;
}

function normalizeCloudMutation(mutation = {}) {
  const type = String(mutation.type || mutation.entityType || '');
  const key = String(mutation.key || mutation.entityKey || '');
  const op = String(mutation.op || mutation.operation || 'upsert');
  if (!mutation.mutationId || !type || !key) {
    throw new SyncProtocolError('Cloud mutation identity is incomplete.', {
      code: 'INVALID_CLOUD_MUTATION',
    });
  }

  return {
    mutationId: String(mutation.mutationId),
    type,
    key,
    op,
    policy: String(mutation.policy || ''),
    revision: mutation.revision || null,
    value: Object.prototype.hasOwnProperty.call(mutation, 'value')
      ? mutation.value
      : null,
  };
}

function safeFileToken(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';
}

import { APP_CONFIG } from '../app/config.js';
import { createUuid } from '../utils/ids.js';
import {
  CLOUD_OBJECT_TYPE,
  SyncProtocolError,
  cloudAppProperties,
} from './cloud-contract.js';
import { sha256Canonical } from './hash.js';

export const CLOUD_PROFILE_FORMAT = 'moxin-quiz-profile';
export const CLOUD_PROFILE_VERSION = 1;
export const CLOUD_PROFILE_OBJECT_ID = 'moxin-profile';

export async function createCloudProfileDocument({
  profileId = createUuid('profile'),
  createdAt = new Date().toISOString(),
  updatedAt = createdAt,
  latestCheckpoint = null,
  cloudSchema = APP_CONFIG.cloudSyncSchemaVersion,
  minimumClientVersion = APP_CONFIG.cloud.minimumClientVersion || '5.0.0',
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) {
    throw new SyncProtocolError('Cloud profile requires profileId.', {
      code: 'PROFILE_REQUIRED',
    });
  }

  const base = {
    format: CLOUD_PROFILE_FORMAT,
    version: CLOUD_PROFILE_VERSION,
    profileId: profile,
    cloudSchema: Number(cloudSchema),
    minimumClientVersion: String(minimumClientVersion || '5.0.0'),
    latestCheckpoint: latestCheckpoint || null,
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
  };

  return {
    ...base,
    payloadHash: await sha256Canonical(base),
  };
}

export async function validateCloudProfile(profile, {
  maxCloudSchema = APP_CONFIG.cloudSyncSchemaVersion,
  clientVersion = APP_CONFIG.appVersion,
} = {}) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new SyncProtocolError('Cloud profile must be an object.', {
      code: 'INVALID_CLOUD_PROFILE',
    });
  }
  if (profile.format !== CLOUD_PROFILE_FORMAT || profile.version !== CLOUD_PROFILE_VERSION) {
    throw new SyncProtocolError('Unsupported cloud profile format.', {
      code: 'UNSUPPORTED_CLOUD_PROFILE',
    });
  }

  const cloudSchema = Number(profile.cloudSchema);
  if (!Number.isInteger(cloudSchema) || cloudSchema < 1) {
    throw new SyncProtocolError('Cloud profile schema is invalid.', {
      code: 'INVALID_CLOUD_SCHEMA',
    });
  }
  if (cloudSchema > Number(maxCloudSchema)) {
    throw new SyncProtocolError(
      `Cloud schema ${cloudSchema} is newer than this client supports.`,
      {
        code: 'CLOUD_SCHEMA_NEWER',
        details: { cloudSchema, maxCloudSchema: Number(maxCloudSchema) },
      },
    );
  }

  const minimumClientVersion = String(profile.minimumClientVersion || '0.0.0');
  if (compareClientVersions(clientVersion, minimumClientVersion) < 0) {
    throw new SyncProtocolError(
      `Cloud profile requires client ${minimumClientVersion} or newer.`,
      {
        code: 'CLIENT_VERSION_TOO_OLD',
        details: { clientVersion, minimumClientVersion },
      },
    );
  }

  const base = {
    format: profile.format,
    version: profile.version,
    profileId: String(profile.profileId || ''),
    cloudSchema,
    minimumClientVersion,
    latestCheckpoint: profile.latestCheckpoint || null,
    createdAt: String(profile.createdAt || ''),
    updatedAt: String(profile.updatedAt || ''),
  };
  if (!base.profileId) {
    throw new SyncProtocolError('Cloud profile identity is missing.', {
      code: 'INVALID_CLOUD_PROFILE',
    });
  }

  const expectedHash = await sha256Canonical(base);
  if (String(profile.payloadHash || '') !== expectedHash) {
    throw new SyncProtocolError('Cloud profile payload hash does not match its contents.', {
      code: 'CLOUD_PROFILE_HASH_MISMATCH',
      details: {
        expectedHash,
        actualHash: profile.payloadHash || null,
      },
    });
  }

  return { ...base, payloadHash: expectedHash };
}

export async function discoverCloudProfile(provider) {
  const files = await listAllProviderFiles(provider, {
    appProperties: {
      moxinApp: 'moxin-quiz',
      objectType: CLOUD_OBJECT_TYPE.PROFILE,
      objectId: CLOUD_PROFILE_OBJECT_ID,
    },
  });

  if (!files.length) return null;

  const candidates = [];
  for (const file of files) {
    const payload = await provider.downloadJson(file.id);
    const profile = await validateCloudProfile(payload);
    const advertisedProfileId = String(file?.appProperties?.profileId || '');
    if (advertisedProfileId && advertisedProfileId !== profile.profileId) {
      throw new SyncProtocolError('Cloud profile metadata does not match its payload.', {
        code: 'CLOUD_PROFILE_METADATA_MISMATCH',
        details: { fileId: file.id },
      });
    }
    if (file?.appProperties?.hash && file.appProperties.hash !== profile.payloadHash) {
      throw new SyncProtocolError('Cloud profile metadata hash does not match its payload.', {
        code: 'CLOUD_PROFILE_HASH_MISMATCH',
        details: { fileId: file.id },
      });
    }
    candidates.push({ file, profile });
  }

  const profileIds = new Set(candidates.map(item => item.profile.profileId));
  if (profileIds.size > 1) {
    throw new SyncProtocolError(
      'Multiple independent MoXin cloud profiles were found in one appDataFolder.',
      {
        code: 'MULTIPLE_CLOUD_PROFILES',
        details: { profileIds: [...profileIds].sort() },
      },
    );
  }

  candidates.sort((left, right) => (
    String(right.profile.updatedAt || '').localeCompare(String(left.profile.updatedAt || '')) ||
    String(right.file.modifiedTime || '').localeCompare(String(left.file.modifiedTime || '')) ||
    String(left.file.id || '').localeCompare(String(right.file.id || ''))
  ));
  return candidates[0];
}

export async function ensureCloudProfile(provider, {
  profileId = null,
  now = new Date(),
} = {}) {
  const existing = await discoverCloudProfile(provider);
  if (existing) {
    if (profileId && String(profileId) !== existing.profile.profileId) {
      throw new SyncProtocolError(
        'Requested profile does not match the Google account cloud profile.',
        {
          code: 'PROFILE_MISMATCH',
          details: {
            requestedProfileId: String(profileId),
            cloudProfileId: existing.profile.profileId,
          },
        },
      );
    }
    return { ...existing, created: false };
  }

  const profile = await createCloudProfileDocument({
    profileId: profileId || createUuid('profile'),
    createdAt: now.toISOString(),
  });
  const appProperties = profileAppProperties(profile);
  const file = await provider.createJsonFile({
    name: 'moxin-profile.json',
    data: profile,
    appProperties,
  });

  const roundTrip = await validateCloudProfile(await provider.downloadJson(file.id));
  if (roundTrip.profileId !== profile.profileId || roundTrip.payloadHash !== profile.payloadHash) {
    throw new SyncProtocolError('New cloud profile failed round-trip verification.', {
      code: 'CLOUD_PROFILE_HASH_MISMATCH',
    });
  }

  return { file, profile: roundTrip, created: true };
}

export async function updateCloudProfileCheckpointPointer(provider, {
  file,
  profile,
  checkpoint,
  updatedAt = checkpoint?.createdAt || new Date().toISOString(),
} = {}) {
  if (!file?.id || !profile?.profileId || !checkpoint?.checkpointId) {
    throw new SyncProtocolError('Profile checkpoint update is missing required identity.', {
      code: 'INVALID_CLOUD_PROFILE',
    });
  }
  if (typeof provider.updateJsonFile !== 'function') {
    throw new SyncProtocolError(
      'Cloud provider cannot update the profile checkpoint pointer.',
      { code: 'UNSUPPORTED' },
    );
  }

  const next = await createCloudProfileDocument({
    profileId: profile.profileId,
    createdAt: profile.createdAt,
    updatedAt,
    latestCheckpoint: {
      checkpointId: String(checkpoint.checkpointId),
      contentHash: String(checkpoint.payloadHash),
      driveFileId: String(checkpoint.driveFileId),
      createdAt: String(checkpoint.createdAt),
    },
    cloudSchema: profile.cloudSchema,
    minimumClientVersion: profile.minimumClientVersion,
  });

  const updatedFile = await provider.updateJsonFile(file.id, {
    name: file.name || 'moxin-profile.json',
    data: next,
    appProperties: profileAppProperties(next),
  });
  const roundTrip = await validateCloudProfile(await provider.downloadJson(file.id));
  if (
    roundTrip.payloadHash !== next.payloadHash ||
    roundTrip.latestCheckpoint?.checkpointId !== checkpoint.checkpointId
  ) {
    throw new SyncProtocolError(
      'Cloud profile checkpoint pointer failed round-trip verification.',
      { code: 'CLOUD_PROFILE_HASH_MISMATCH' },
    );
  }

  return { file: updatedFile || file, profile: roundTrip };
}

export function compareClientVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function parseVersion(value) {
  const match = String(value || '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return [
    Number(match?.[1] || 0),
    Number(match?.[2] || 0),
    Number(match?.[3] || 0),
  ];
}

function profileAppProperties(profile) {
  return cloudAppProperties({
    profileId: profile.profileId,
    objectType: CLOUD_OBJECT_TYPE.PROFILE,
    objectId: CLOUD_PROFILE_OBJECT_ID,
    hash: profile.payloadHash,
    cloudSchema: profile.cloudSchema,
  });
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

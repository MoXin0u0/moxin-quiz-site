import { APP_CONFIG } from '../app/config.js';
import {
  CLOUD_OBJECT_TYPE,
  SyncProtocolError,
  cloudAppProperties,
} from './cloud-contract.js';
import {
  sha256Blob,
  sha256Canonical,
} from './hash.js';

export async function ensureCloudAsset(provider, {
  profileId,
  blob,
  contentHash = null,
  mimeType = blob?.type || 'application/octet-stream',
  name = null,
} = {}) {
  if (!(blob instanceof Blob)) {
    throw new TypeError('ensureCloudAsset requires a Blob.');
  }

  const hash = contentHash || await sha256Blob(blob);
  const actualHash = await sha256Blob(blob);
  if (hash !== actualHash) {
    throw new SyncProtocolError('Local asset content hash does not match its Blob.', {
      code: 'LOCAL_OBJECT_HASH_MISMATCH',
      details: { expectedHash: hash, actualHash },
    });
  }

  const properties = cloudAppProperties({
    profileId,
    objectType: CLOUD_OBJECT_TYPE.ASSET,
    objectId: hash,
    hash,
  });

  const existing = await findExistingObject(provider, properties);
  if (existing) {
    return objectRefFromFile(existing, {
      objectType: CLOUD_OBJECT_TYPE.ASSET,
      objectId: hash,
      contentHash: hash,
      size: blob.size,
      mimeType,
    });
  }

  const file = await provider.createBlobFile({
    name: name || `asset-${hash.replace(/^sha256:/, '')}`,
    blob,
    mimeType,
    appProperties: properties,
  });

  assertObjectMetadata(file, properties);
  return objectRefFromFile(file, {
    objectType: CLOUD_OBJECT_TYPE.ASSET,
    objectId: hash,
    contentHash: hash,
    size: blob.size,
    mimeType,
  });
}

export async function ensureJsonDocumentObject(provider, {
  profileId,
  objectType,
  logicalId,
  revisionId = null,
  document,
  name = null,
} = {}) {
  const type = String(objectType || '');
  if (![CLOUD_OBJECT_TYPE.DRAFT, CLOUD_OBJECT_TYPE.USER_BANK, CLOUD_OBJECT_TYPE.SESSION, CLOUD_OBJECT_TYPE.CHECKPOINT].includes(type)) {
    throw new SyncProtocolError(`Unsupported JSON cloud object type: ${type}`, {
      code: 'INVALID_OBJECT_TYPE',
    });
  }

  const logical = String(logicalId || '').trim();
  if (!logical) {
    throw new SyncProtocolError('JSON cloud object requires logicalId.', {
      code: 'INVALID_OBJECT_ID',
    });
  }

  const contentHash = await sha256Canonical(document);
  const objectId = revisionId
    ? `${logical}:${String(revisionId)}`
    : `${logical}:${contentHash}`;
  const properties = cloudAppProperties({
    profileId,
    objectType: type,
    objectId,
    hash: contentHash,
  });

  const existing = await findExistingObject(provider, properties);
  if (existing) {
    const payload = await provider.downloadJson(existing.id);
    const actualHash = await sha256Canonical(payload);
    if (actualHash !== contentHash) {
      throw new SyncProtocolError('Existing cloud document content does not match its metadata hash.', {
        code: 'CLOUD_OBJECT_HASH_MISMATCH',
        details: { objectId, expectedHash: contentHash, actualHash },
      });
    }
    return objectRefFromFile(existing, {
      objectType: type,
      objectId,
      contentHash,
      mimeType: 'application/json',
    });
  }

  const file = await provider.createJsonFile({
    name: name || `${safeFileToken(type)}-${safeFileToken(logical)}-${safeFileToken(revisionId || contentHash)}.json`,
    data: document,
    appProperties: properties,
  });
  assertObjectMetadata(file, properties);

  const roundTrip = await provider.downloadJson(file.id);
  const roundTripHash = await sha256Canonical(roundTrip);
  if (roundTripHash !== contentHash) {
    throw new SyncProtocolError('Uploaded cloud document failed round-trip hash verification.', {
      code: 'CLOUD_OBJECT_HASH_MISMATCH',
      details: { objectId, expectedHash: contentHash, actualHash: roundTripHash },
    });
  }

  return objectRefFromFile(file, {
    objectType: type,
    objectId,
    contentHash,
    mimeType: 'application/json',
  });
}

export async function downloadJsonObject(provider, objectRef, {
  expectedProfileId = null,
} = {}) {
  validateObjectRef(objectRef, { jsonOnly: true });
  const metadata = await provider.getFileMetadata(objectRef.driveFileId);
  assertRefMetadata(metadata, objectRef, expectedProfileId);
  const payload = await provider.downloadJson(objectRef.driveFileId);
  const actualHash = await sha256Canonical(payload);
  if (actualHash !== objectRef.contentHash) {
    throw new SyncProtocolError('Downloaded JSON object failed SHA-256 verification.', {
      code: 'CLOUD_OBJECT_HASH_MISMATCH',
      details: {
        objectId: objectRef.objectId,
        expectedHash: objectRef.contentHash,
        actualHash,
      },
    });
  }
  return payload;
}

export async function downloadAssetObject(provider, objectRef, {
  expectedProfileId = null,
} = {}) {
  validateObjectRef(objectRef, { assetOnly: true });
  const metadata = await provider.getFileMetadata(objectRef.driveFileId);
  assertRefMetadata(metadata, objectRef, expectedProfileId);
  const blob = await provider.downloadFile(objectRef.driveFileId, { responseType: 'blob' });
  const actualHash = await sha256Blob(blob);
  if (actualHash !== objectRef.contentHash) {
    throw new SyncProtocolError('Downloaded asset failed SHA-256 verification.', {
      code: 'CLOUD_OBJECT_HASH_MISMATCH',
      details: {
        objectId: objectRef.objectId,
        expectedHash: objectRef.contentHash,
        actualHash,
      },
    });
  }
  return blob;
}

export function buildStudioDraftDocument(draft = {}) {
  const revisionId = draft?.revision?.revisionId || null;
  const assets = normalizeDocumentAssets(draft.assets || []);

  return {
    documentVersion: 1,
    draftId: String(draft.id || ''),
    bankId: draft.bankId ? String(draft.bankId) : null,
    manifest: draft.manifest || {},
    questions: Array.isArray(draft.questions) ? draft.questions : [],
    assets,
    sourceBankVersion: draft.sourceBankVersion || null,
    sourceBankFingerprint: draft.sourceBankFingerprint || null,
    contentFingerprint: draft.contentFingerprint || null,
    conflictOfDraftId: draft.conflictOfDraftId || null,
    createdAt: draft.createdAt || null,
    updatedAt: draft.updatedAt || null,
    revision: draft.revision || null,
    revisionId,
  };
}

export function buildUserBankDocument({
  bank,
  questions = [],
  assets = [],
  sourceDraftId = null,
} = {}) {
  if (!bank?.id) throw new Error('User bank document requires bank.id.');

  return {
    documentVersion: 1,
    bankId: String(bank.id),
    manifest: stripBankStorageFields(bank),
    questions: questions.map(stripQuestionStorageFields),
    assets: normalizeDocumentAssets(assets),
    contentFingerprint: bank.contentFingerprint || null,
    publishedAt: bank.updatedAt || bank.storedAt || null,
    sourceDraftId: sourceDraftId || null,
    revision: bank.revision || null,
  };
}

export function attachUploadedAssetRefs(document, refsByHash = new Map()) {
  const refs = refsByHash instanceof Map
    ? refsByHash
    : new Map(Object.entries(refsByHash || {}));

  return {
    ...document,
    assets: (document.assets || []).map(asset => {
      const ref = refs.get(asset.contentHash);
      if (!ref) {
        throw new SyncProtocolError(
          `Cloud asset reference is missing for ${asset.path || asset.contentHash || 'asset'}.`,
          { code: 'CLOUD_ASSET_REF_MISSING' },
        );
      }
      return {
        ...asset,
        objectRef: ref,
      };
    }),
  };
}

async function findExistingObject(provider, properties) {
  const files = [];
  let pageToken = null;
  do {
    const page = await provider.listFiles({
      appProperties: {
        moxinApp: properties.moxinApp,
        cloudSchema: properties.cloudSchema,
        profileId: properties.profileId,
        objectType: properties.objectType,
        objectId: properties.objectId,
      },
      pageToken,
    });
    files.push(...(page?.files || []));
    pageToken = page?.nextPageToken || null;
  } while (pageToken);

  if (!files.length) return null;

  const exact = files.find(file => file?.appProperties?.hash === properties.hash);
  if (!exact) {
    throw new SyncProtocolError('Cloud object ID collision detected.', {
      code: 'CLOUD_OBJECT_ID_COLLISION',
      details: {
        objectType: properties.objectType,
        objectId: properties.objectId,
      },
    });
  }
  return exact;
}

function assertObjectMetadata(file, properties) {
  if (!file?.id) {
    throw new SyncProtocolError('Cloud provider did not return a file ID.', {
      code: 'INVALID_CLOUD_OBJECT_RESPONSE',
    });
  }
  for (const [key, value] of Object.entries(properties)) {
    if (String(file?.appProperties?.[key] || '') !== String(value)) {
      throw new SyncProtocolError('Cloud provider returned mismatched object metadata.', {
        code: 'CLOUD_OBJECT_METADATA_MISMATCH',
        details: { key, expected: value, actual: file?.appProperties?.[key] || null },
      });
    }
  }
}

function assertRefMetadata(metadata, objectRef, expectedProfileId) {
  if (!metadata?.id || String(metadata.id) !== String(objectRef.driveFileId)) {
    throw new SyncProtocolError('Cloud object metadata file ID mismatch.', {
      code: 'CLOUD_OBJECT_METADATA_MISMATCH',
    });
  }
  const props = metadata.appProperties || {};
  if (props.objectType !== objectRef.objectType ||
      props.objectId !== objectRef.objectId ||
      props.hash !== objectRef.contentHash) {
    throw new SyncProtocolError('Cloud object metadata does not match its reference.', {
      code: 'CLOUD_OBJECT_METADATA_MISMATCH',
    });
  }
  if (expectedProfileId && props.profileId !== String(expectedProfileId)) {
    throw new SyncProtocolError('Cloud object belongs to another profile.', {
      code: 'PROFILE_MISMATCH',
    });
  }
}

function objectRefFromFile(file, {
  objectType,
  objectId,
  contentHash,
  size = null,
  mimeType = null,
}) {
  return {
    objectType,
    objectId,
    contentHash,
    size: size ?? nullableNumber(file?.size),
    mimeType: mimeType || file?.mimeType || null,
    driveFileId: String(file.id),
  };
}

function validateObjectRef(ref, {
  jsonOnly = false,
  assetOnly = false,
} = {}) {
  if (!ref?.driveFileId || !ref?.objectType || !ref?.objectId || !ref?.contentHash) {
    throw new SyncProtocolError('Cloud object reference is incomplete.', {
      code: 'INVALID_OBJECT_REF',
    });
  }
  if (jsonOnly && ref.objectType === CLOUD_OBJECT_TYPE.ASSET) {
    throw new SyncProtocolError('Expected a JSON document object reference.', {
      code: 'INVALID_OBJECT_REF',
    });
  }
  if (assetOnly && ref.objectType !== CLOUD_OBJECT_TYPE.ASSET) {
    throw new SyncProtocolError('Expected an asset object reference.', {
      code: 'INVALID_OBJECT_REF',
    });
  }
}

function normalizeDocumentAssets(assets) {
  return (Array.isArray(assets) ? assets : []).map(asset => {
    const contentHash = asset?.contentHash || null;
    if (!contentHash) {
      throw new SyncProtocolError(
        `Asset ${asset?.path || 'unknown'} is missing contentHash.`,
        { code: 'ASSET_HASH_REQUIRED' },
      );
    }
    return {
      path: String(asset.path || ''),
      contentHash: String(contentHash),
      mimeType: String(asset.mimeType || asset?.blob?.type || 'application/octet-stream'),
      size: Number(asset.size ?? asset?.blob?.size ?? 0) || 0,
    };
  });
}

function stripBankStorageFields(bank) {
  const output = { ...bank };
  for (const key of [
    'sourceType',
    'sourceMetadata',
    'importedAt',
    'storedAt',
    'contentFingerprint',
    'revision',
  ]) {
    delete output[key];
  }
  return output;
}

function stripQuestionStorageFields(question) {
  const output = { ...question };
  for (const key of ['key', 'bankId', 'questionId', 'questionFingerprint']) {
    delete output[key];
  }
  return output;
}

function safeFileToken(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export { findExistingObject };

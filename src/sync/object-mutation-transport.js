import {
  openDatabase,
  requestToPromise,
  transactionDone,
} from '../storage/db.js';
import {
  CLOUD_OBJECT_TYPE,
  SyncProtocolError,
} from './cloud-contract.js';
import {
  attachUploadedAssetRefs,
  buildStudioDraftDocument,
  buildUserBankDocument,
  downloadAssetObject,
  downloadJsonObject,
  ensureCloudAsset,
  ensureJsonDocumentObject,
} from './cloud-object-transport.js';
import { withSyncLock } from './sync-lock.js';

const OBJECT_ENTITY_TYPES = new Set(['studio-draft', 'user-bank']);

export async function materializePendingObjectMutations(provider, {
  profileId,
  now = new Date(),
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) {
    throw new SyncProtocolError('profileId is required to materialize cloud objects.', {
      code: 'PROFILE_REQUIRED',
    });
  }

  return withSyncLock(async () => {
    const db = await openDatabase();
    const stateTx = db.transaction(['syncMeta', 'syncOutbox'], 'readonly');
    const meta = await requestToPromise(stateTx.objectStore('syncMeta').get('global'));
    assertProfileCompatible(meta, profile);

    const rows = await requestToPromise(stateTx.objectStore('syncOutbox').getAll());
    const candidates = (rows || [])
      .filter(row =>
        OBJECT_ENTITY_TYPES.has(String(row?.entityType || '')) &&
        row?.operation === 'upsert' &&
        !row?.objectRef &&
        row?.hasPayload === true &&
        row?.payload
      )
      .sort((left, right) =>
        String(left.createdAt || '').localeCompare(String(right.createdAt || '')) ||
        String(left.mutationId || '').localeCompare(String(right.mutationId || ''))
      );

    const results = [];
    for (const row of candidates) {
      const materialized = row.entityType === 'studio-draft'
        ? await materializeStudioDraft(provider, row, profile)
        : await materializeUserBank(provider, row, profile);

      const tx = db.transaction(['syncMeta', 'syncOutbox', 'cloudObjects'], 'readwrite');
      const done = transactionDone(tx);
      try {
        const freshMeta = await requestToPromise(tx.objectStore('syncMeta').get('global'));
        assertProfileCompatible(freshMeta, profile);

        const outboxStore = tx.objectStore('syncOutbox');
        const fresh = await requestToPromise(outboxStore.get(row.mutationId));
        if (
          fresh &&
          !fresh.objectRef &&
          fresh.targetRevisionId === row.targetRevisionId &&
          fresh.hasPayload === true
        ) {
          outboxStore.put({
            ...fresh,
            objectRef: materialized.documentRef,
            materializedAt: now.toISOString(),
          });

          const objectStore = tx.objectStore('cloudObjects');
          for (const ref of [...materialized.assetRefs, materialized.documentRef]) {
            objectStore.put({
              objectKey: `${ref.objectType}:${ref.objectId}`,
              objectType: ref.objectType,
              logicalId: ref.objectId,
              contentHash: ref.contentHash,
              driveFileId: ref.driveFileId,
              size: ref.size ?? null,
              mimeType: ref.mimeType || null,
              verifiedAt: now.toISOString(),
            });
          }

          results.push({
            mutationId: row.mutationId,
            entityType: row.entityType,
            objectRef: materialized.documentRef,
            assetCount: materialized.assetRefs.length,
          });
        }
        await done;
      } catch (error) {
        try { tx.abort(); } catch {}
        await done.catch(() => {});
        throw error;
      }
    }

    return results;
  });
}

export async function resolveCommitObjectValues(provider, commit) {
  const resolved = new Map();

  for (const mutation of commit?.mutations || []) {
    if (!mutation?.objectRef) continue;
    const type = String(mutation.type || '');

    if (!OBJECT_ENTITY_TYPES.has(type)) {
      throw new SyncProtocolError(
        `Object-backed mutation is not supported for ${type} yet.`,
        {
          code: 'REMOTE_OBJECT_UNSUPPORTED',
          details: { entityType: type, mutationId: mutation.mutationId },
        },
      );
    }
    if (!provider) {
      throw new SyncProtocolError(
        'A cloud provider is required to resolve object-backed mutations.',
        { code: 'REMOTE_OBJECT_PROVIDER_REQUIRED' },
      );
    }

    const expectedType = type === 'studio-draft'
      ? CLOUD_OBJECT_TYPE.DRAFT
      : CLOUD_OBJECT_TYPE.USER_BANK;
    if (mutation.objectRef.objectType !== expectedType) {
      throw new SyncProtocolError('Cloud object type does not match mutation entity type.', {
        code: 'INVALID_OBJECT_REF',
        details: {
          entityType: type,
          expectedObjectType: expectedType,
          actualObjectType: mutation.objectRef.objectType,
        },
      });
    }

    const document = await downloadJsonObject(provider, mutation.objectRef, {
      expectedProfileId: commit.profileId,
    });
    assertDocumentRevision(document, mutation);

    const value = type === 'studio-draft'
      ? await hydrateStudioDraftDocument(provider, document, commit.profileId, mutation.key)
      : await hydrateUserBankDocument(provider, document, commit.profileId, mutation.key);

    resolved.set(String(mutation.mutationId), value);
  }

  return resolved;
}

async function materializeStudioDraft(provider, row, profileId) {
  const draft = row.payload;
  if (String(draft?.id || '') !== String(row.entityKey || '')) {
    throw new SyncProtocolError('Studio draft payload identity does not match its Outbox key.', {
      code: 'OUTBOX_PAYLOAD_ID_MISMATCH',
      details: { mutationId: row.mutationId },
    });
  }

  const assetRefs = await ensurePayloadAssets(provider, draft.assets, profileId);
  const document = attachUploadedAssetRefs(
    buildStudioDraftDocument(draft),
    new Map(assetRefs.map(ref => [ref.contentHash, ref])),
  );
  const revisionId = draft?.revision?.revisionId || row.targetRevisionId;
  if (!revisionId) {
    throw new SyncProtocolError('Studio draft mutation is missing revision metadata.', {
      code: 'OUTBOX_PAYLOAD_REVISION_MISSING',
    });
  }

  const documentRef = await ensureJsonDocumentObject(provider, {
    profileId,
    objectType: CLOUD_OBJECT_TYPE.DRAFT,
    logicalId: row.entityKey,
    revisionId,
    document,
  });

  return { assetRefs, documentRef };
}

async function materializeUserBank(provider, row, profileId) {
  const payload = row.payload || {};
  const bank = payload.bank;
  if (String(bank?.id || '') !== String(row.entityKey || '')) {
    throw new SyncProtocolError('User-bank payload identity does not match its Outbox key.', {
      code: 'OUTBOX_PAYLOAD_ID_MISMATCH',
      details: { mutationId: row.mutationId },
    });
  }

  const assetRefs = await ensurePayloadAssets(provider, payload.assets, profileId);
  const document = attachUploadedAssetRefs(
    buildUserBankDocument({
      bank,
      questions: payload.questions || [],
      assets: payload.assets || [],
      sourceDraftId: payload.sourceDraftId || null,
    }),
    new Map(assetRefs.map(ref => [ref.contentHash, ref])),
  );
  const revisionId = payload?.revision?.revisionId || bank?.revision?.revisionId || row.targetRevisionId;
  if (!revisionId) {
    throw new SyncProtocolError('User-bank mutation is missing revision metadata.', {
      code: 'OUTBOX_PAYLOAD_REVISION_MISSING',
    });
  }

  const documentRef = await ensureJsonDocumentObject(provider, {
    profileId,
    objectType: CLOUD_OBJECT_TYPE.USER_BANK,
    logicalId: row.entityKey,
    revisionId,
    document,
  });

  return { assetRefs, documentRef };
}

async function ensurePayloadAssets(provider, assets, profileId) {
  const refsByHash = new Map();

  for (const asset of Array.isArray(assets) ? assets : []) {
    const hash = String(asset?.contentHash || '');
    if (!hash) {
      throw new SyncProtocolError('Object-backed payload asset is missing contentHash.', {
        code: 'ASSET_HASH_REQUIRED',
        details: { path: asset?.path || null },
      });
    }
    if (refsByHash.has(hash)) continue;
    if (!(asset?.blob instanceof Blob)) {
      throw new SyncProtocolError('Object-backed payload asset is missing its local Blob.', {
        code: 'LOCAL_ASSET_BLOB_MISSING',
        details: { path: asset?.path || null, contentHash: hash },
      });
    }

    const ref = await ensureCloudAsset(provider, {
      profileId,
      blob: asset.blob,
      contentHash: hash,
      mimeType: asset.mimeType || asset.blob.type || 'application/octet-stream',
      name: asset.path || null,
    });
    refsByHash.set(hash, ref);
  }

  return [...refsByHash.values()];
}

async function hydrateStudioDraftDocument(provider, document, profileId, entityKey) {
  if (String(document?.draftId || '') !== String(entityKey || '')) {
    throw new SyncProtocolError('Studio draft document identity mismatch.', {
      code: 'REMOTE_OBJECT_ID_MISMATCH',
    });
  }

  return {
    id: String(document.draftId),
    bankId: document.bankId ? String(document.bankId) : null,
    manifest: document.manifest || {},
    questions: Array.isArray(document.questions) ? document.questions : [],
    assets: await hydrateDocumentAssets(provider, document.assets, profileId),
    sourceBankVersion: document.sourceBankVersion || null,
    sourceBankFingerprint: document.sourceBankFingerprint || null,
    contentFingerprint: document.contentFingerprint || null,
    conflictOfDraftId: document.conflictOfDraftId || null,
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
    revision: document.revision || null,
  };
}

async function hydrateUserBankDocument(provider, document, profileId, entityKey) {
  if (String(document?.bankId || '') !== String(entityKey || '')) {
    throw new SyncProtocolError('User-bank document identity mismatch.', {
      code: 'REMOTE_OBJECT_ID_MISMATCH',
    });
  }

  const publishedAt = document.publishedAt || new Date().toISOString();
  return {
    revision: document.revision || null,
    bank: {
      ...(document.manifest || {}),
      id: String(document.bankId),
      sourceType: 'user',
      sourceMetadata: null,
      questionCount: Array.isArray(document.questions) ? document.questions.length : 0,
      contentFingerprint: document.contentFingerprint || null,
      importedAt: publishedAt,
      storedAt: publishedAt,
      revision: document.revision || null,
    },
    questions: Array.isArray(document.questions) ? document.questions : [],
    assets: await hydrateDocumentAssets(provider, document.assets, profileId),
    sourceDraftId: document.sourceDraftId || null,
  };
}

async function hydrateDocumentAssets(provider, assets, profileId) {
  const output = [];
  for (const asset of Array.isArray(assets) ? assets : []) {
    if (!asset?.objectRef) {
      throw new SyncProtocolError('Cloud document asset is missing objectRef.', {
        code: 'CLOUD_ASSET_REF_MISSING',
        details: { path: asset?.path || null },
      });
    }
    if (asset.objectRef.contentHash !== asset.contentHash) {
      throw new SyncProtocolError('Cloud document asset hash disagrees with objectRef.', {
        code: 'CLOUD_OBJECT_HASH_MISMATCH',
        details: { path: asset?.path || null },
      });
    }

    const blob = await downloadAssetObject(provider, asset.objectRef, {
      expectedProfileId: profileId,
    });
    output.push({
      path: String(asset.path || ''),
      contentHash: String(asset.contentHash || ''),
      mimeType: String(asset.mimeType || blob.type || 'application/octet-stream'),
      size: Number(asset.size ?? blob.size ?? 0) || 0,
      blob,
      hashStatus: 'ready',
    });
  }
  return output;
}

function assertDocumentRevision(document, mutation) {
  const expected = String(mutation?.revision?.revisionId || '');
  const actual = String(document?.revision?.revisionId || document?.revisionId || '');
  if (!expected || !actual || expected !== actual) {
    throw new SyncProtocolError('Cloud document revision does not match its commit mutation.', {
      code: 'REMOTE_OBJECT_REVISION_MISMATCH',
      details: { expectedRevisionId: expected || null, actualRevisionId: actual || null },
    });
  }
}

function assertProfileCompatible(meta, profileId) {
  if (meta?.linkedProfileId && String(meta.linkedProfileId) !== String(profileId)) {
    throw new SyncProtocolError('This device is linked to a different cloud profile.', {
      code: 'PROFILE_MISMATCH',
      details: {
        linkedProfileId: meta.linkedProfileId,
        requestedProfileId: profileId,
      },
    });
  }
}

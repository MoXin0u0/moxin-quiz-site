import {
  getAllRecords,
  getRecord,
} from '../db.js';
import { runReadwriteTransaction } from '../transactions/transaction-utils.js';
import {
  attachMutationPayloadInTransaction,
  createRevisionMutationInTransaction,
  getLatestTombstoneRevisionInTransaction,
} from '../transactions/sync-mutation.js';
import { createUuid } from '../../utils/ids.js';
import {
  computeAssetContentHash,
  computeDraftFingerprint,
} from '../../content/fingerprints.js';

export const STUDIO_DRAFT_STATUS = Object.freeze({
  DRAFT: 'draft',
  READY: 'ready',
});

export function createStudioDraft(input = {}, now = new Date()) {
  const source = input && typeof input === 'object' ? input : {};
  const id = String(source.id || createDraftId());
  const timestamp = now.toISOString();

  return normalizeStudioDraft({
    ...source,
    id,
    createdAt: source.createdAt || timestamp,
    updatedAt: timestamp,
  });
}

export function normalizeStudioDraft(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const status = Object.values(STUDIO_DRAFT_STATUS).includes(source.status)
    ? source.status
    : STUDIO_DRAFT_STATUS.DRAFT;

  return {
    id: String(source.id || createDraftId()),
    bankId: source.bankId ? String(source.bankId) : null,
    status,
    manifest: cloneJsonLike(source.manifest),
    questions: Array.isArray(source.questions)
      ? source.questions.map(question => cloneJsonLike(question))
      : [],
    assets: Array.isArray(source.assets)
      ? source.assets.map(asset => normalizeDraftAsset(asset))
      : [],
    sourceBankVersion: source.sourceBankVersion ? String(source.sourceBankVersion) : null,
    sourceBankFingerprint: source.sourceBankFingerprint ? String(source.sourceBankFingerprint) : null,
    contentFingerprint: source.contentFingerprint ? String(source.contentFingerprint) : null,
    conflictOfDraftId: source.conflictOfDraftId ? String(source.conflictOfDraftId) : null,
    createdAt: normalizeDateString(source.createdAt),
    updatedAt: normalizeDateString(source.updatedAt),
    revision: source.revision || null,
  };
}

export async function saveStudioDraft(input) {
  const now = new Date();
  const id = String(input?.id || createDraftId());
  const existing = input?.id ? await getRecord('studioDrafts', id) : null;

  let draft = normalizeStudioDraft({
    ...existing,
    ...input,
    id,
    createdAt: existing?.createdAt || input?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  });

  draft = {
    ...draft,
    assets: await hydrateDraftAssetHashes(draft.assets),
  };
  draft.contentFingerprint = await computeDraftFingerprint(draft);

  return runReadwriteTransaction([
    'studioDrafts',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
    'syncTombstones',
  ], async ({ store, request, tx }) => {
    const fresh = await request(store('studioDrafts').get(id));
    const tombstoneRevision = fresh
      ? null
      : await getLatestTombstoneRevisionInTransaction(tx, {
          entityType: 'studio-draft',
          entityKey: id,
        });

    const { revision, mutation } = await createRevisionMutationInTransaction(tx, {
      entityType: 'studio-draft',
      entityKey: id,
      previousRevision: fresh?.revision || tombstoneRevision || null,
      operation: 'upsert',
      coalesceKey: `studio-draft:${id}`,
      now,
    });

    const record = {
      ...draft,
      createdAt: fresh?.createdAt || draft.createdAt,
      updatedAt: now.toISOString(),
      revision,
    };
    store('studioDrafts').put(record);
    attachMutationPayloadInTransaction(tx, mutation, record);
    return record;
  });
}

export function getStudioDraft(id) {
  return getRecord('studioDrafts', String(id));
}

export async function listStudioDrafts() {
  const drafts = await getAllRecords('studioDrafts');
  return (drafts || []).sort(
    (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
  );
}

export async function deleteStudioDraft(id) {
  const key = String(id);
  const now = new Date();

  return runReadwriteTransaction([
    'studioDrafts',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
    'syncTombstones',
  ], async ({ store, request, tx }) => {
    const existing = await request(store('studioDrafts').get(key));
    if (!existing) return false;

    const { revision, mutation } = await createRevisionMutationInTransaction(tx, {
      entityType: 'studio-draft',
      entityKey: key,
      previousRevision: existing.revision || null,
      operation: 'delete',
      coalesceKey: `studio-draft:${key}`,
      now,
    });

    const tombstone = {
      tombstoneId: createUuid('tombstone'),
      entityType: 'studio-draft',
      entityKey: key,
      deletedAt: now.toISOString(),
      revision,
    };

    store('studioDrafts').delete(key);
    store('syncTombstones').put(tombstone);
    attachMutationPayloadInTransaction(tx, mutation, tombstone);
    return true;
  });
}

export function createDraftFromBankPackage(pkg, { id = null } = {}) {
  if (!pkg?.manifest || !Array.isArray(pkg.questions)) {
    throw new Error('題庫資料不完整，無法建立工作室草稿。');
  }

  return createStudioDraft({
    id,
    bankId: pkg.manifest.id || null,
    manifest: stripStoredManifestFields(pkg.manifest),
    questions: pkg.questions,
    assets: pkg.assets || [],
    sourceBankVersion: pkg.manifest.version || null,
    sourceBankFingerprint: pkg.manifest.contentFingerprint || null,
  });
}

async function hydrateDraftAssetHashes(assets) {
  const output = [];
  for (const asset of Array.isArray(assets) ? assets : []) {
    const normalized = normalizeDraftAsset(asset);
    output.push({
      ...normalized,
      contentHash: normalized.contentHash || await computeAssetContentHash(normalized),
    });
  }
  return output;
}

function normalizeDraftAsset(asset = {}) {
  const blob = typeof Blob !== 'undefined' && asset.blob instanceof Blob
    ? asset.blob
    : null;

  return {
    path: String(asset.path || ''),
    mimeType: String(asset.mimeType || blob?.type || 'application/octet-stream'),
    size: Number(asset.size ?? blob?.size ?? 0) || 0,
    blob,
    contentHash: asset.contentHash ? String(asset.contentHash) : null,
    hashStatus: asset.hashStatus || (asset.contentHash ? 'ready' : 'pending'),
  };
}

function stripStoredManifestFields(manifest) {
  const copy = cloneJsonLike(manifest);
  for (const field of ['sourceType', 'sourceMetadata', 'importedAt', 'storedAt']) {
    delete copy[field];
  }
  return copy;
}

function cloneJsonLike(value) {
  if (!value || typeof value !== 'object') return {};
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeDateString(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function createDraftId() {
  if (globalThis.crypto?.randomUUID) return `draft-${crypto.randomUUID()}`;
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

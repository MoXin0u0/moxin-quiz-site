import {
  deleteRecord,
  getAllRecords,
  getRecord,
  putRecord,
} from '../db.js';

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
    createdAt: normalizeDateString(source.createdAt),
    updatedAt: normalizeDateString(source.updatedAt),
  };
}

export async function saveStudioDraft(input) {
  const existing = input?.id ? await getRecord('studioDrafts', String(input.id)) : null;
  const now = new Date().toISOString();
  const draft = normalizeStudioDraft({
    ...existing,
    ...input,
    id: input?.id || existing?.id || createDraftId(),
    createdAt: existing?.createdAt || input?.createdAt || now,
    updatedAt: now,
  });

  await putRecord('studioDrafts', draft);
  return draft;
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

export function deleteStudioDraft(id) {
  return deleteRecord('studioDrafts', String(id));
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
  });
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

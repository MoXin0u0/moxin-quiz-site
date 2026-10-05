import { sha256Blob, sha256Canonical } from '../sync/hash.js';

const QUESTION_STORAGE_FIELDS = new Set([
  'key',
  'bankId',
  'questionId',
  'questionUid',
  'questionFingerprint',
  'revision',
]);

const BANK_INTERNAL_FIELDS = new Set([
  'sourceType',
  'sourceMetadata',
  'importedAt',
  'storedAt',
  'contentFingerprint',
  'revision',
]);

function stripFields(value, fields) {
  const output = {};
  for (const [key, item] of Object.entries(value || {})) {
    if (fields.has(key)) continue;
    output[key] = item;
  }
  return output;
}

function normalizeStringList(values, { sort = false } = {}) {
  const items = [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean))];
  return sort ? items.sort() : items;
}

export function canonicalQuestionPayload(question = {}) {
  const payload = stripFields(question, QUESTION_STORAGE_FIELDS);
  payload.tags = normalizeStringList(payload.tags, { sort: true });

  if (payload.type === 'multiple-choice' && Array.isArray(payload.answer)) {
    payload.answer = [...payload.answer].map(String).sort();
  }

  return payload;
}

export function canonicalDraftQuestionPayload(question = {}) {
  return {
    ...canonicalQuestionPayload(question),
    questionUid: String(question.questionUid || ''),
  };
}

export async function computeQuestionFingerprint(question) {
  return sha256Canonical(canonicalQuestionPayload(question));
}

export async function computeAssetContentHash(asset) {
  if (asset?.contentHash) return String(asset.contentHash);
  if (!asset?.blob) return null;
  return sha256Blob(asset.blob);
}

export function canonicalBankManifest(bank = {}) {
  const manifest = stripFields(bank, BANK_INTERNAL_FIELDS);
  for (const field of ['createdAt', 'updatedAt', 'questionCount']) {
    delete manifest[field];
  }
  return manifest;
}

export async function computeBankFingerprint({
  bank,
  questions = [],
  assets = [],
}) {
  const canonicalQuestions = [...questions]
    .map(canonicalQuestionPayload)
    .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));

  const canonicalAssets = [...assets]
    .map(asset => ({
      path: String(asset.path || ''),
      contentHash: asset.contentHash || null,
      mimeType: String(asset.mimeType || ''),
      size: Number(asset.size || 0),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return sha256Canonical({
    manifest: canonicalBankManifest(bank),
    questions: canonicalQuestions,
    assets: canonicalAssets,
  });
}

export async function computeDraftFingerprint(draft = {}) {
  const questions = (Array.isArray(draft.questions) ? draft.questions : [])
    .map(canonicalDraftQuestionPayload);

  const assets = (Array.isArray(draft.assets) ? draft.assets : [])
    .map(asset => ({
      path: String(asset.path || ''),
      contentHash: asset.contentHash || null,
      mimeType: String(asset.mimeType || ''),
      size: Number(asset.size || 0),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return sha256Canonical({
    draftId: String(draft.id || ''),
    bankId: draft.bankId ? String(draft.bankId) : null,
    manifest: draft.manifest || {},
    questions,
    assets,
    sourceBankVersion: draft.sourceBankVersion || null,
    sourceBankFingerprint: draft.sourceBankFingerprint || null,
  });
}

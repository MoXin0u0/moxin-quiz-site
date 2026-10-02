import { validatePackage } from '../question-bank/validator.js';
import { createDraftFromBankPackage } from '../storage/repositories/studio.js';
import {
  makeUniqueBankId,
  sanitizeBankId,
  syncManifestQuestionCount,
} from './editor-model.js';
import { normalizeQuestionDraft } from './question-draft.js';

export const STUDIO_PACKAGE_OPEN_MODE = Object.freeze({
  DIRECT: 'direct',
  RENAMED_COPY: 'renamed-copy',
});

export function inspectStudioPackagePlan(pkg, {
  existingBankIds = [],
} = {}) {
  const assetPaths = resolveAssetPaths(pkg);
  const report = validatePackage({
    manifest: pkg?.manifest,
    questions: pkg?.questions,
    assetPaths,
  });

  const originalBankId = String(pkg?.manifest?.id || '');
  const existing = new Set((existingBankIds || []).map(value => String(value)));
  const hasCollision = Boolean(originalBankId && existing.has(originalBankId));

  let targetBankId = '';
  if (report.valid && originalBankId) {
    targetBankId = hasCollision
      ? makeUniqueBankId(
          `${sanitizeBankId(originalBankId) || 'question-bank'}-copy`,
          existing,
        )
      : originalBankId;
  }

  return {
    valid: report.valid,
    report,
    mode: hasCollision
      ? STUDIO_PACKAGE_OPEN_MODE.RENAMED_COPY
      : STUDIO_PACKAGE_OPEN_MODE.DIRECT,
    hasCollision,
    originalBankId,
    targetBankId,
    sourceKind: String(pkg?.source?.kind || 'unknown'),
    sourceName: String(pkg?.source?.name || ''),
    questionCount: Array.isArray(pkg?.questions) ? pkg.questions.length : 0,
    assetCount: Array.isArray(pkg?.assets) ? pkg.assets.length : 0,
    warningCount: report.summary?.warnings || 0,
    errorCount: report.summary?.errors || 0,
  };
}

export function createStudioDraftFromInspectedPackage(pkg, {
  existingBankIds = [],
  draftId = null,
  now = new Date(),
} = {}) {
  const plan = inspectStudioPackagePlan(pkg, { existingBankIds });

  if (!plan.valid) {
    throw new Error(
      `題庫驗證未通過，仍有 ${plan.errorCount} 個錯誤，不能開啟為工作室草稿。`,
    );
  }

  const questions = pkg.questions.map(question => normalizeQuestionDraft(question));
  const manifest = buildStudioManifest(pkg.manifest, plan, now);
  const assets = cloneDraftAssets(pkg.assets || []);

  const prepared = {
    manifest: syncManifestQuestionCount(manifest, questions),
    questions,
    assets,
  };

  let draft = createDraftFromBankPackage(prepared, { id: draftId });

  // External ZIP / JSON is never considered linked to an installed local bank.
  // Even when the ID is unchanged, saving from Studio creates/claims a user bank
  // instead of silently overwriting an existing source.
  draft = {
    ...draft,
    bankId: null,
    sourceBankVersion: String(pkg.manifest.version || '') || null,
  };

  return {
    draft,
    plan,
  };
}

function buildStudioManifest(manifest, plan, now) {
  const source = cloneJson(manifest);
  const timestamp = normalizeNow(now);
  const metadata = {
    ...(source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata)
      ? cloneJson(source.metadata)
      : {}),
    studioImport: {
      sourceKind: plan.sourceKind,
      sourceName: plan.sourceName,
      originalBankId: plan.originalBankId,
      openMode: plan.mode,
    },
  };

  const next = {
    ...source,
    id: plan.targetBankId,
    metadata,
  };

  if (plan.hasCollision) {
    next.name = `${source.name || source.title || source.id || '題庫'} 副本`;
    next.version = '1.0.0';
    next.createdAt = timestamp;
    next.updatedAt = timestamp;
    next.metadata = {
      ...metadata,
      copiedFrom: plan.originalBankId,
    };
  }

  for (const field of ['sourceType', 'sourceMetadata', 'importedAt', 'storedAt']) {
    delete next[field];
  }

  return next;
}

function resolveAssetPaths(pkg) {
  if (Array.isArray(pkg?.assetPaths)) {
    return [...pkg.assetPaths];
  }

  return Array.isArray(pkg?.assets)
    ? pkg.assets
        .map(asset => String(asset?.path || ''))
        .filter(Boolean)
    : [];
}

function cloneDraftAssets(assets) {
  return (assets || []).map(asset => {
    const blob = typeof Blob !== 'undefined' && asset?.blob instanceof Blob
      ? asset.blob
      : null;

    return {
      path: String(asset?.path || ''),
      mimeType: String(asset?.mimeType || blob?.type || 'application/octet-stream'),
      size: Number(asset?.size ?? blob?.size ?? 0) || 0,
      blob,
    };
  });
}

function normalizeNow(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function cloneJson(value) {
  if (!value || typeof value !== 'object') return {};
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

import { APP_CONFIG } from '../app/config.js';
import { SAFE_IMAGE_EXTENSIONS } from '../data/schema/question-bank.js';
import { mimeTypeForPath } from '../utils/mime.js';
import { extensionOf, normalizePackagePath } from '../utils/path.js';

const IMAGE_FIELDS = new Set(['images', 'explanationImages']);
const SAFE_EXTENSIONS = new Set(SAFE_IMAGE_EXTENSIONS);

export function addQuestionImages({
  draft,
  questionId,
  field,
  files,
}) {
  const question = requireQuestion(draft, questionId);
  assertImageField(field);

  const prepared = prepareFiles(files);
  if (!prepared.length) return [];

  const additions = [];
  const existingPaths = new Set((draft.assets || []).map(asset => asset.path));

  for (const item of prepared) {
    const path = makeUniqueImagePath({
      questionId,
      field,
      filename: item.name,
      extension: item.extension,
      existingPaths,
    });
    existingPaths.add(path);
    additions.push(assetFromPrepared(path, item));
  }

  assertCapacity(draft, additions);

  draft.assets = [...(draft.assets || []), ...additions];
  question[field] = [
    ...(Array.isArray(question[field]) ? question[field] : []),
    ...additions.map(asset => asset.path),
  ];

  return additions.map(asset => asset.path);
}

export function replaceQuestionImage({
  draft,
  questionId,
  field,
  path,
  file,
}) {
  const question = requireQuestion(draft, questionId);
  assertImageField(field);

  const current = Array.isArray(question[field]) ? question[field] : [];
  const index = current.indexOf(path);
  if (index < 0) throw new Error('找不到要更換的圖片引用。');

  const [prepared] = prepareFiles([file]);
  if (!prepared) throw new Error('尚未選擇新的圖片。');

  const existingPaths = new Set((draft.assets || []).map(asset => asset.path));
  const replacementPath = makeUniqueImagePath({
    questionId,
    field,
    filename: prepared.name,
    extension: prepared.extension,
    existingPaths,
  });
  const replacementAsset = assetFromPrepared(replacementPath, prepared);

  const referencedElsewhere = countAssetReferences(draft.questions, path) > 1;
  const currentAsset = getAssetByPath(draft, path);
  const reclaimedSize = referencedElsewhere ? 0 : Number(currentAsset?.size || 0);
  const reclaimedCount = referencedElsewhere || !currentAsset ? 0 : 1;

  assertCapacity(draft, [replacementAsset], {
    reclaimedSize,
    reclaimedCount,
  });

  draft.assets = [...(draft.assets || []), replacementAsset];
  question[field] = current.map((value, currentIndex) =>
    currentIndex === index ? replacementPath : value
  );
  pruneUnusedAssets(draft);

  return replacementPath;
}

export function removeQuestionImage({
  draft,
  questionId,
  field,
  path,
}) {
  const question = requireQuestion(draft, questionId);
  assertImageField(field);

  question[field] = (question[field] || []).filter(value => value !== path);
  return pruneUnusedAssets(draft);
}

export function duplicateQuestionAssets({
  draft,
  sourceQuestion,
  targetQuestion,
}) {
  const pendingAssets = [];
  const nextFields = {
    images: [],
    explanationImages: [],
  };
  const existingPaths = new Set((draft.assets || []).map(asset => asset.path));

  for (const field of IMAGE_FIELDS) {
    for (const sourcePath of sourceQuestion?.[field] || []) {
      const sourceAsset = getAssetByPath(draft, sourcePath);
      if (!sourceAsset?.blob) {
        // Keep an unresolved reference visible to the validator rather than
        // silently pretending a missing asset was copied.
        nextFields[field].push(sourcePath);
        continue;
      }

      const extension = extensionOf(sourcePath);
      const filename = sourcePath.split('/').pop() || `image.${extension}`;
      const path = makeUniqueImagePath({
        questionId: targetQuestion.id,
        field,
        filename,
        extension,
        existingPaths,
      });
      existingPaths.add(path);

      pendingAssets.push({
        path,
        mimeType: sourceAsset.mimeType || sourceAsset.blob.type || mimeTypeForPath(path),
        size: Number(sourceAsset.size ?? sourceAsset.blob.size ?? 0) || 0,
        blob: sourceAsset.blob,
      });
      nextFields[field].push(path);
    }
  }

  assertCapacity(draft, pendingAssets);
  draft.assets = [...(draft.assets || []), ...pendingAssets];
  targetQuestion.images = nextFields.images;
  targetQuestion.explanationImages = nextFields.explanationImages;

  return pendingAssets.map(asset => asset.path);
}

export function pruneUnusedAssets(draft) {
  const referenced = collectReferencedAssetPaths(draft?.questions || []);
  const before = draft?.assets || [];
  const kept = before.filter(asset => referenced.has(asset.path));
  const removed = before.filter(asset => !referenced.has(asset.path));

  draft.assets = kept;
  return removed;
}

export function findUnusedAssets(draft) {
  const referenced = collectReferencedAssetPaths(draft?.questions || []);
  return (draft?.assets || []).filter(asset => !referenced.has(asset.path));
}

export function collectReferencedAssetPaths(questions) {
  const paths = new Set();
  for (const question of questions || []) {
    for (const field of IMAGE_FIELDS) {
      for (const rawPath of question?.[field] || []) {
        if (typeof rawPath !== 'string' || !rawPath.trim()) continue;
        try {
          paths.add(normalizePackagePath(rawPath));
        } catch {
          paths.add(rawPath);
        }
      }
    }
  }
  return paths;
}

export function countAssetReferences(questions, path) {
  let count = 0;
  for (const question of questions || []) {
    for (const field of IMAGE_FIELDS) {
      count += (question?.[field] || []).filter(value => value === path).length;
    }
  }
  return count;
}

export function getAssetByPath(draft, path) {
  return (draft?.assets || []).find(asset => asset.path === path) || null;
}

export function getAssetUsageSummary(draft) {
  const assets = draft?.assets || [];
  const unused = findUnusedAssets(draft);
  return {
    assetCount: assets.length,
    unusedCount: unused.length,
    totalBytes: assets.reduce((sum, asset) => sum + Number(asset.size || 0), 0),
  };
}

export function makeUniqueImagePath({
  questionId,
  field,
  filename,
  extension,
  existingPaths = new Set(),
}) {
  assertImageField(field);

  const ext = String(extension || '').toLowerCase();
  if (!SAFE_EXTENSIONS.has(ext)) {
    throw new Error(`不支援的圖片類型：${ext || 'unknown'}`);
  }

  const used = existingPaths instanceof Set
    ? existingPaths
    : new Set(existingPaths || []);
  const role = field === 'images' ? 'question' : 'explanation';
  const base = sanitizeFilenameBase(filename, ext);
  const folder = `assets/images/${sanitizeSegment(questionId || 'question')}/${role}`;

  let suffix = 1;
  let path = `${folder}/${base}.${ext}`;
  while (used.has(path)) {
    suffix += 1;
    path = `${folder}/${base}-${suffix}.${ext}`;
  }

  return normalizePackagePath(path);
}

function prepareFiles(files) {
  const result = [];
  for (const file of Array.from(files || [])) {
    if (!file || typeof file !== 'object') continue;

    const extension = extensionForFile(file);
    if (!SAFE_EXTENSIONS.has(extension)) {
      throw new Error(
        `不支援的圖片類型：${file.name || file.type || 'unknown'}。` +
        '請使用 PNG、JPG、JPEG、WebP、GIF 或 SVG。',
      );
    }

    const size = Number(file.size || 0);
    if (size > APP_CONFIG.packageLimits.maxSingleFileBytes) {
      throw new Error(
        `${file.name || '圖片'} 超過單檔 ${formatMb(APP_CONFIG.packageLimits.maxSingleFileBytes)} MB 上限。`,
      );
    }

    result.push({
      file,
      name: String(file.name || `image.${extension}`),
      extension,
      mimeType: String(file.type || mimeTypeForPath(`image.${extension}`)),
      size,
    });
  }
  return result;
}

function extensionForFile(file) {
  const byName = extensionOf(file.name || '');
  if (SAFE_EXTENSIONS.has(byName)) return byName;

  const byMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return byMime[file.type] || '';
}

function assetFromPrepared(path, prepared) {
  return {
    path,
    mimeType: prepared.mimeType || mimeTypeForPath(path),
    size: prepared.size,
    blob: prepared.file,
  };
}

function assertCapacity(
  draft,
  additions,
  {
    reclaimedSize = 0,
    reclaimedCount = 0,
  } = {},
) {
  const assets = draft?.assets || [];
  const currentBytes = assets.reduce(
    (sum, asset) => sum + Number(asset.size || 0),
    0,
  );
  const addedBytes = additions.reduce(
    (sum, asset) => sum + Number(asset.size || 0),
    0,
  );

  const projectedCount = assets.length - reclaimedCount + additions.length;
  const projectedBytes = currentBytes - reclaimedSize + addedBytes;

  if (projectedCount + 2 > APP_CONFIG.packageLimits.maxFiles) {
    throw new Error(
      `題庫檔案數將超過 ${APP_CONFIG.packageLimits.maxFiles} 個上限。`,
    );
  }

  if (projectedBytes > APP_CONFIG.packageLimits.maxUncompressedBytes) {
    throw new Error(
      `題庫圖片總大小將超過約 ${formatMb(APP_CONFIG.packageLimits.maxUncompressedBytes)} MB 上限。`,
    );
  }
}

function requireQuestion(draft, questionId) {
  const question = draft?.questions?.find(item => item.id === questionId);
  if (!question) throw new Error(`找不到題目：${questionId || 'unknown'}`);
  return question;
}

function assertImageField(field) {
  if (!IMAGE_FIELDS.has(field)) {
    throw new Error(`不支援的圖片欄位：${field || 'unknown'}`);
  }
}

function sanitizeFilenameBase(filename, extension) {
  const name = String(filename || 'image').split('/').pop() || 'image';
  const extPattern = new RegExp(`\\.${escapeRegex(extension)}$`, 'i');
  const withoutExt = name.replace(extPattern, '');

  return sanitizeSegment(withoutExt)
    .slice(0, 64) || 'image';
}

function sanitizeSegment(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '') || 'image';
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatMb(bytes) {
  return Math.round(Number(bytes || 0) / 1024 / 1024);
}

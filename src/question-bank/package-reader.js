import { SAFE_IMAGE_EXTENSIONS } from '../data/schema/question-bank.js';
import { migrateLegacyBank } from '../data/migration/legacy-v1-to-v2.js';
import { extensionOf, normalizePackagePath, stripCommonRoot } from '../utils/path.js';
import { mimeTypeForPath } from '../utils/mime.js';
import { validatePackage } from './validator.js';
import { readZip } from './zip-reader.js';

const TEXT = new TextDecoder('utf-8');
const SAFE_IMAGES = new Set(SAFE_IMAGE_EXTENSIONS);

export async function readQuestionBankZip(file) {
  const rawEntries = await readZip(file);
  const entries = remapCommonRoot(rawEntries);
  return buildPackageFromEntries(entries, { source: file.name || 'question-bank.zip', kind: 'zip' });
}

export async function readQuestionBankFolder(fileList) {
  const rawEntries = new Map();
  for (const file of Array.from(fileList || [])) {
    const rawPath = file.webkitRelativePath || file.name;
    const path = normalizePackagePath(rawPath);
    rawEntries.set(path, new Uint8Array(await file.arrayBuffer()));
  }
  const entries = remapCommonRoot(rawEntries);
  return buildPackageFromEntries(entries, { source: 'folder', kind: 'folder' });
}

export async function readQuestionBankJson(file) {
  const data = JSON.parse(await file.text());
  if (data?.bankId && Array.isArray(data.questions)) {
    const migrated = migrateLegacyBank(data);
    const report = validatePackage({
      manifest: migrated.manifest,
      questions: migrated.questions,
      assetPaths: migrated.assetPaths,
    });
    return {
      ...migrated,
      report,
      source: { name: file.name, kind: 'legacy-json' },
    };
  }

  if (data?.manifest && Array.isArray(data.questions)) {
    const assetPaths = [];
    const report = validatePackage({ manifest: data.manifest, questions: data.questions, assetPaths });
    return {
      manifest: data.manifest,
      questions: data.questions,
      assetPaths,
      assets: [],
      report,
      source: { name: file.name, kind: 'v2-json' },
    };
  }

  throw new Error('無法辨識 JSON 題庫格式；需要 Legacy 題庫或 { manifest, questions }。');
}

function remapCommonRoot(rawEntries) {
  const paths = [...rawEntries.keys()].filter(path => !isJunkPath(path));
  const mapping = stripCommonRoot(paths);
  const result = new Map();
  for (const original of paths) {
    const mapped = mapping.get(normalizePackagePath(original));
    if (!mapped) continue;
    if (result.has(mapped)) throw new Error(`題庫內含重複路徑：${mapped}`);
    result.set(mapped, rawEntries.get(original));
  }
  return result;
}

function buildPackageFromEntries(entries, source) {
  if (!entries.has('manifest.json')) throw new Error('題庫缺少 manifest.json。');
  if (!entries.has('questions.json')) throw new Error('題庫缺少 questions.json。');

  const manifest = parseJson(entries.get('manifest.json'), 'manifest.json');
  const questions = parseJson(entries.get('questions.json'), 'questions.json');
  const assets = [];
  const assetPaths = [];
  const ignored = [];

  for (const [path, bytes] of entries) {
    if (path === 'manifest.json' || path === 'questions.json') continue;
    if (!path.startsWith('assets/')) {
      ignored.push(path);
      continue;
    }
    const ext = extensionOf(path);
    if (!SAFE_IMAGES.has(ext)) throw new Error(`assets/ 內含不支援的檔案類型：${path}`);
    assetPaths.push(path);
    assets.push({
      path,
      mimeType: mimeTypeForPath(path),
      size: bytes.byteLength,
      blob: new Blob([bytes], { type: mimeTypeForPath(path) }),
    });
  }

  const report = validatePackage({ manifest, questions, assetPaths });
  if (ignored.length) {
    report.issues.push({
      severity: 'warning',
      location: 'package',
      message: `已忽略 ${ignored.length} 個非題庫核心檔案：${ignored.slice(0, 5).join(', ')}${ignored.length > 5 ? '…' : ''}`,
    });
    report.summary.warnings += 1;
  }

  return {
    manifest,
    questions,
    assetPaths,
    assets,
    report,
    source,
  };
}

function parseJson(bytes, name) {
  try {
    return JSON.parse(TEXT.decode(bytes));
  } catch (error) {
    throw new Error(`${name} 不是合法 JSON：${error.message}`);
  }
}

function isJunkPath(path) {
  const normalized = String(path).replace(/\\/g, '/');
  return normalized.startsWith('__MACOSX/') || normalized.endsWith('/.DS_Store') || normalized === '.DS_Store';
}

import { migrateLegacyBank } from '../data/migration/legacy-v1-to-v2.js';
import { validatePackage } from './validator.js';

const DEFAULT_CATALOG_URL = './author-banks.json';

export async function loadAuthorCatalog({
  fetchImpl = fetch,
  catalogUrl = DEFAULT_CATALOG_URL,
} = {}) {
  const response = await fetchImpl(catalogUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`作者題庫清單讀取失敗：HTTP ${response.status}`);

  const entries = await response.json();
  if (!Array.isArray(entries)) throw new Error('author-banks.json 根節點必須是陣列。');

  return entries.map(normalizeCatalogEntry);
}

export async function inspectAuthorBank(entry, { fetchImpl = fetch } = {}) {
  const catalogEntry = normalizeCatalogEntry(entry);
  const source = catalogEntry.source;
  if (!source?.url) throw new Error(`作者題庫 ${catalogEntry.id} 缺少 source.url。`);

  const response = await fetchImpl(source.url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`作者題庫 ${catalogEntry.name} 下載失敗：HTTP ${response.status}`);
  }

  let pkg;
  if (source.kind === 'legacy-json') {
    const data = await response.json();
    pkg = migrateLegacyBank(data);
  } else if (source.kind === 'v2-json') {
    const data = await response.json();
    if (!data?.manifest || !Array.isArray(data.questions)) {
      throw new Error('作者題庫 v2-json 必須包含 manifest 與 questions。');
    }
    pkg = {
      manifest: data.manifest,
      questions: data.questions,
      assets: [],
      assetPaths: [],
    };
  } else {
    throw new Error(`不支援的作者題庫來源格式：${source.kind || 'unknown'}`);
  }

  const manifest = {
    ...pkg.manifest,
    id: catalogEntry.id,
    name: catalogEntry.name || pkg.manifest.name,
    description: catalogEntry.description || pkg.manifest.description || '',
    version: catalogEntry.version || pkg.manifest.version,
    author: catalogEntry.author || pkg.manifest.author || '',
    language: catalogEntry.language || pkg.manifest.language || 'zh-TW',
    questionCount: pkg.questions.length,
    metadata: {
      ...(pkg.manifest.metadata || {}),
      category: catalogEntry.category || pkg.manifest.metadata?.category || '',
      sourceType: 'author',
      catalogId: catalogEntry.id,
    },
  };

  const assetPaths = Array.isArray(pkg.assetPaths) ? pkg.assetPaths : [];
  const report = validatePackage({
    manifest,
    questions: pkg.questions,
    assetPaths,
  });

  return {
    ...pkg,
    manifest,
    assetPaths,
    report,
    source: {
      kind: 'author-catalog',
      name: catalogEntry.name,
      catalogEntry,
    },
  };
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  const length = Math.max(a.length, b.length, 3);

  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
}

function normalizeCatalogEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error('作者題庫清單項目必須是物件。');
  }
  if (!entry.id || !entry.name || !entry.version) {
    throw new Error('作者題庫清單項目至少需要 id、name、version。');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(entry.id)) {
    throw new Error(`作者題庫 ID 不合法：${entry.id}`);
  }

  return {
    id: String(entry.id),
    name: String(entry.name),
    description: String(entry.description || ''),
    version: String(entry.version),
    author: String(entry.author || ''),
    category: String(entry.category || ''),
    language: String(entry.language || 'zh-TW'),
    questionCount: Number(entry.questionCount) || 0,
    source: {
      kind: String(entry.source?.kind || ''),
      url: String(entry.source?.url || ''),
    },
  };
}

function parseVersion(value) {
  return String(value || '0')
    .split(/[+-]/, 1)[0]
    .split('.')
    .map(part => Number.parseInt(part, 10))
    .map(part => Number.isFinite(part) ? part : 0);
}

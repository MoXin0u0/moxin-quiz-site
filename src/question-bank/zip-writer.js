import { normalizePackagePath } from '../utils/path.js';

const UTF8 = new TextEncoder();
const MANIFEST_FIELDS = [
  'schemaVersion',
  'id',
  'name',
  'description',
  'version',
  'author',
  'language',
  'questionCount',
  'createdAt',
  'updatedAt',
  'metadata',
  'source',
  'license',
];

export async function createQuestionBankZip(pkg) {
  if (!pkg?.manifest || !Array.isArray(pkg.questions)) {
    throw new Error('題庫資料不完整，無法匯出。');
  }

  const manifest = cleanExportManifest(pkg.manifest, pkg.questions.length);
  const entries = [
    textEntry('manifest.json', JSON.stringify(manifest, null, 2) + '\n'),
    textEntry('questions.json', JSON.stringify(pkg.questions, null, 2) + '\n'),
  ];

  for (const asset of pkg.assets || []) {
    const assetPath = normalizePackagePath(asset.path);
    if (!assetPath.startsWith('assets/')) {
      throw new Error(`題庫圖片必須位於 assets/：${assetPath}`);
    }
    if (!asset.blob) {
      throw new Error(`題庫圖片缺少 Blob：${assetPath}`);
    }
    const bytes = new Uint8Array(await asset.blob.arrayBuffer());
    entries.push({ path: assetPath, bytes });
  }

  return buildStoredZip(entries);
}

export async function downloadQuestionBankZip(pkg) {
  const blob = await createQuestionBankZip(pkg);
  const id = safeFilename(pkg.manifest?.id || 'question-bank');
  const version = safeFilename(pkg.manifest?.version || '1.0.0');
  const filename = `${id}-${version}.zip`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);

  return filename;
}

export function cleanExportManifest(manifest, questionCount) {
  const result = {};
  for (const field of MANIFEST_FIELDS) {
    if (manifest[field] !== undefined) result[field] = manifest[field];
  }
  result.questionCount = questionCount;
  return result;
}

function textEntry(path, text) {
  return { path, bytes: UTF8.encode(text) };
}

function buildStoredZip(entries) {
  if (!entries.length) throw new Error('ZIP 至少需要一個檔案。');
  if (entries.length > 0xffff) throw new Error('ZIP 檔案數超過傳統格式上限。');

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  const { time, date } = dosDateTime(new Date());

  for (const entry of entries) {
    const path = normalizePackagePath(entry.path);
    const name = UTF8.encode(path);
    const data = entry.bytes instanceof Uint8Array
      ? entry.bytes
      : new Uint8Array(entry.bytes);
    const crc = crc32(data);

    if (data.byteLength > 0xffffffff) {
      throw new Error(`單一檔案過大，無法使用傳統 ZIP：${path}`);
    }

    const local = new Uint8Array(30);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.byteLength, true);
    lv.setUint32(22, data.byteLength, true);
    lv.setUint16(26, name.byteLength, true);
    lv.setUint16(28, 0, true);

    localParts.push(local, name, data);

    const central = new Uint8Array(46);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.byteLength, true);
    cv.setUint32(24, data.byteLength, true);
    cv.setUint16(28, name.byteLength, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);

    centralParts.push(central, name);
    offset += local.byteLength + name.byteLength + data.byteLength;
    if (offset > 0xffffffff) throw new Error('ZIP 總大小超過傳統格式上限。');
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd], {
    type: 'application/zip',
  });
}

function dosDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

let crcTable;

function crc32(bytes) {
  if (!crcTable) crcTable = buildCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
}

function safeFilename(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'question-bank';
}

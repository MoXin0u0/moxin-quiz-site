import { APP_CONFIG } from '../app/config.js';
import { normalizePackagePath } from '../utils/path.js';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const UTF8 = new TextDecoder('utf-8');

export async function readZip(input, limits = APP_CONFIG.packageLimits) {
  const blob = input instanceof Blob ? input : new Blob([input]);
  if (blob.size > limits.maxZipBytes) {
    throw new Error(`ZIP 檔案過大：${formatBytes(blob.size)}，上限 ${formatBytes(limits.maxZipBytes)}。`);
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const diskNo = view.getUint16(eocdOffset + 4, true);
  const centralDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);

  if (diskNo !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new Error('不支援跨磁碟 ZIP。');
  }
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('目前不支援 Zip64 題庫。');
  }
  if (entryCount > limits.maxFiles) {
    throw new Error(`ZIP 內檔案數過多：${entryCount}，上限 ${limits.maxFiles}。`);
  }
  if (centralOffset + centralSize > bytes.length) throw new Error('ZIP central directory 超出檔案範圍。');

  const entries = [];
  let offset = centralOffset;
  let totalUncompressed = 0;

  for (let i = 0; i < entryCount; i += 1) {
    ensureSignature(view, offset, SIG_CENTRAL, 'central directory');
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) throw new Error('ZIP 檔名資料損壞。');

    const decodedName = UTF8.decode(bytes.subarray(nameStart, nameEnd));
    const isDirectory = decodedName.replace(/\\/g, '/').endsWith('/');
    const path = isDirectory ? null : normalizePackagePath(decodedName);

    if (flags & 0x0001) throw new Error(`不支援加密 ZIP：${decodedName}`);
    if (![0, 8].includes(method)) throw new Error(`不支援 ZIP 壓縮方式 ${method}：${decodedName}`);
    if (!isDirectory && uncompressedSize > limits.maxSingleFileBytes) {
      throw new Error(`ZIP 單檔過大：${decodedName} (${formatBytes(uncompressedSize)})`);
    }
    if (!isDirectory && compressedSize > 0 && uncompressedSize / compressedSize > limits.maxCompressionRatio) {
      throw new Error(`ZIP 壓縮比異常：${decodedName}`);
    }

    totalUncompressed += isDirectory ? 0 : uncompressedSize;
    if (totalUncompressed > limits.maxUncompressedBytes) {
      throw new Error(`ZIP 解壓後總大小超過 ${formatBytes(limits.maxUncompressedBytes)}。`);
    }

    if (!isDirectory) entries.push({ path, flags, method, crc, compressedSize, uncompressedSize, localOffset });
    offset = nameEnd + extraLength + commentLength;
  }

  const output = new Map();
  for (const entry of entries) {
    if (output.has(entry.path)) throw new Error(`ZIP 內含重複路徑：${entry.path}`);
    const data = await extractEntry(bytes, view, entry);
    output.set(entry.path, data);
  }
  return output;
}

async function extractEntry(bytes, view, entry) {
  const offset = entry.localOffset;
  ensureSignature(view, offset, SIG_LOCAL, 'local file header');
  const localNameLength = view.getUint16(offset + 26, true);
  const localExtraLength = view.getUint16(offset + 28, true);
  const start = offset + 30 + localNameLength + localExtraLength;
  const end = start + entry.compressedSize;
  if (start < 0 || end > bytes.length) throw new Error(`ZIP 資料範圍損壞：${entry.path}`);

  const compressed = bytes.slice(start, end);
  let data;
  if (entry.method === 0) {
    data = compressed;
  } else {
    data = await inflateRaw(compressed);
  }

  if (data.length !== entry.uncompressedSize) {
    throw new Error(`ZIP 解壓大小不符：${entry.path}`);
  }
  if (crc32(data) !== entry.crc) {
    throw new Error(`ZIP CRC 驗證失敗：${entry.path}`);
  }
  return data;
}

async function inflateRaw(compressed) {
  if (!globalThis.DecompressionStream) {
    throw new Error('此瀏覽器不支援 DecompressionStream，暫時無法解壓縮 DEFLATE ZIP。');
  }
  let stream;
  try {
    stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  } catch (error) {
    throw new Error(`瀏覽器無法建立 ZIP 解壓縮串流：${error.message}`);
  }
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === SIG_EOCD) return offset;
  }
  throw new Error('找不到 ZIP End of Central Directory。');
}

function ensureSignature(view, offset, expected, label) {
  if (offset < 0 || offset + 4 > view.byteLength || view.getUint32(offset, true) !== expected) {
    throw new Error(`ZIP ${label} 損壞或格式不支援。`);
  }
}

let crcTable;
function crc32(bytes) {
  if (!crcTable) crcTable = buildCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

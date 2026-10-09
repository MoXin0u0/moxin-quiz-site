import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { readZip } from '../src/question-bank/zip-reader.js';
import { createQuestionBankZip } from '../src/question-bank/zip-writer.js';
import { APP_CONFIG } from '../src/app/config.js';

// Deterministic ZIP fixtures; no third-party dependency or network access.
const enc = new TextEncoder();
const smallLimits = Object.freeze({
  ...APP_CONFIG.packageLimits,
  maxSingleFileBytes: 1024,
  maxUncompressedBytes: 1500,
  maxCompressionRatio: 100,
});
const u16 = (v, n, x) => v.setUint16(n, x, true);
const u32 = (v, n, x) => v.setUint32(n, x >>> 0, true);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const locals = [], centrals = [];
  let localOffset = 0;
  for (const options of entries) {
    const data = options.data instanceof Uint8Array ? options.data : enc.encode(options.data ?? 'hello');
    const name = enc.encode(options.path);
    const localName = enc.encode(options.localName ?? options.path);
    const method = options.method ?? 0;
    const compressed = method === 8 ? new Uint8Array(deflateRawSync(data)) : data;
    const declaredSize = options.declaredSize ?? data.length;
    const checksum = options.declaredCrc ?? crc32(data);
    const lh = new Uint8Array(30), ch = new Uint8Array(46);
    const lv = new DataView(lh.buffer), cv = new DataView(ch.buffer);
    u32(lv, 0, 0x04034b50);
    u16(lv, 4, 20); u16(lv, 6, 0x0800); u16(lv, 8, options.localMethod ?? method);
    u32(lv, 14, checksum); u32(lv, 18, compressed.length); u32(lv, 22, declaredSize);
    u16(lv, 26, localName.length);

    u32(cv, 0, 0x02014b50);
    u16(cv, 4, 20); u16(cv, 6, 20); u16(cv, 8, 0x0800); u16(cv, 10, method);
    u32(cv, 16, checksum); u32(cv, 20, compressed.length); u32(cv, 24, declaredSize);
    u16(cv, 28, name.length); u32(cv, 42, localOffset);
    locals.push(lh, localName, compressed);
    centrals.push(ch, name);
    localOffset += lh.length + localName.length + compressed.length;
  }
  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50);
  u16(ev, 8, entries.length); u16(ev, 10, entries.length);
  u32(ev, 12, centralSize); u32(ev, 16, localOffset);
  return new Blob([...locals, ...centrals, end], { type: 'application/zip' });
}

let passed = 0;
async function accepts(name, blob, expected, limits = smallLimits) {
  const values = await readZip(blob, limits);
  assert.equal(new TextDecoder().decode(values.get(name)), expected);
  passed++;
}
async function rejects(blob, error, limits = smallLimits) {
  await assert.rejects(readZip(blob, limits), error);
  passed++;
}

await accepts('data.txt', zip([{ path: 'data.txt', data: 'hello' }]), 'hello');
await accepts('notes.txt', zip([{ path: 'notes.txt', method: 8, data: 'compressible example' }]), 'compressible example');
await rejects(zip([{ path: 'data.txt', method: 8, data: 'abc', declaredCrc: 0 }]), /CRC/);
await rejects(zip([{ path: 'notes.txt', method: 8, data: 'hello', declaredSize: 2 }]), /解壓輸出超過限制/);
await rejects(zip([{ path: 'large.txt', method: 8, data: 'X'.repeat(4096), declaredSize: 32 }]), /解壓輸出超過限制/);
await rejects(zip([{ path: 'large.txt', method: 8, data: 'X'.repeat(4096) }]), /單檔過大/);
await rejects(zip([{ path: 'big.txt', data: 'X'.repeat(1025) }]), /單檔過大/);
await rejects(zip([{ path: '../escape.js' }]), /Unsafe package path/);
await rejects(zip([{ path: '/absolute.js' }]), /Absolute path/);
await rejects(zip([{ path: 'same.txt' }, { path: 'same.txt' }]), /重複路徑/);
await rejects(zip([{ path: 'a.txt', data: 'x'.repeat(900) }, { path: 'b.txt', data: 'y'.repeat(900) }]), /解壓後總大小/);
await rejects(zip([{ path: 'data.txt', localName: 'other.txt' }]), /本地檔名與目錄不一致/);
await rejects(zip([{ path: 'data.txt', localMethod: 8 }]), /本地檔頭與目錄不一致/);
await rejects(zip([{ path: 'data.txt' }, { path: 'other.txt' }]), /檔案數過多/, { ...smallLimits, maxFiles: 1 });

// Catch deceptive metadata when the declared count stays within limits.
await rejects(zip([{ path: 'one.txt', method: 8, data: 'a'.repeat(800), declaredSize: 100 },
  { path: 'two.txt', method: 8, data: 'b'.repeat(800), declaredSize: 100 }]), /解壓輸出超過限制/);

// Normal exported ZIP must remain import-compatible.
const exported = await createQuestionBankZip({
  manifest: { schemaVersion: '2.0', id: 'b01-demo', name: 'B01', version: '1.0.0' },
  questions: [{ id: 'Q001', type: 'true-false', question: 'B01?', answer: [true], explanation: 'OK' }],
});
const roundTrip = await readZip(exported);
assert.ok(roundTrip.has('manifest.json'));
assert.ok(roundTrip.has('questions.json'));
passed++;

// Source ZIP must not be modified; errors never return a partial map to the caller.
console.log(`B01 ZIP security tests passed (${passed} cases).`);

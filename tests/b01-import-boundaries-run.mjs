import assert from 'node:assert/strict';
import { APP_CONFIG } from '../src/app/config.js';
import { readQuestionBankFolder, readQuestionBankJson } from '../src/question-bank/package-reader.js';

const limits = APP_CONFIG.packageLimits;
let passed = 0;

async function rejects(operation, pattern) {
  await assert.rejects(operation, pattern);
  passed++;
}

const noRead = (name, size) => ({
  name,
  size,
  async arrayBuffer() { throw new Error('must reject before reading'); },
  async text() { throw new Error('must reject before reading'); },
});

await rejects(() => readQuestionBankJson(noRead('too-large.json', limits.maxSingleFileBytes + 1)), /JSON 題庫檔案過大/);
await rejects(() => readQuestionBankJson(noRead('unknown-size.json', undefined)), /大小不合法/);
await rejects(() => readQuestionBankFolder([noRead('too-large.bin', limits.maxSingleFileBytes + 1)]), /單檔過大/);
await rejects(() => readQuestionBankFolder(Array.from(
  { length: limits.maxFiles + 1 },
  (_, i) => noRead(`f${i}.txt`, 0),
)), /檔案數過多/);
await rejects(() => readQuestionBankFolder([
  noRead('same.txt', 1), noRead('same.txt', 1),
]), /重複路徑/);
await rejects(() => readQuestionBankFolder([
  noRead('../escape.txt', 1),
]), /Unsafe package path/);
await rejects(() => readQuestionBankFolder(Array.from(
  { length: Math.ceil(limits.maxUncompressedBytes / limits.maxSingleFileBytes) + 1 },
  (_, i) => noRead(`f${i}.txt`, limits.maxSingleFileBytes),
)), /總大小超過/);

const manifest = new Blob([JSON.stringify({
  schemaVersion: '2.0', id: 'b01-folder', name: 'B01 Folder', version: '1.0.0',
  questionCount: 0,
})]);
const questions = new Blob(['[]']);
Object.defineProperty(manifest, 'name', { value: 'bank/manifest.json' });
Object.defineProperty(questions, 'name', { value: 'bank/questions.json' });
const folder = await readQuestionBankFolder([manifest, questions]);
assert.equal(folder.manifest.id, 'b01-folder');
assert.deepEqual(folder.questions, []);
passed++;

const plainJson = new Blob([JSON.stringify({
  manifest: { schemaVersion: '2.0', id: 'b01-json', name: 'B01 JSON', version: '1.0.0', questionCount: 0 },
  questions: [],
})]);
Object.defineProperty(plainJson, 'name', { value: 'bank.json' });
const parsed = await readQuestionBankJson(plainJson);
assert.equal(parsed.manifest.id, 'b01-json');
passed++;

await rejects(() => readQuestionBankFolder([{ name: 'bad.txt', size: 7,
  async arrayBuffer() { return new ArrayBuffer(1); },
}]), /讀取大小不符/);

console.log(`B01 folder/JSON input boundary tests passed (${passed} cases).`);

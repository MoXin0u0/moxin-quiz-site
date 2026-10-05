import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createQuestionBankZip, cleanExportManifest } from '../src/question-bank/zip-writer.js';
import { readZip } from '../src/question-bank/zip-reader.js';
import { QUESTION_BANK_AI_PROMPT } from '../src/ui/tools.js';

const manifest = {
  schemaVersion: '2.0',
  id: 'v33_test',
  name: 'v3.3 test',
  version: '1.0.0',
  author: 'test',
  questionCount: 99,
  sourceType: 'user',
  sourceMetadata: { ignored: true },
  importedAt: '2026-10-01T00:00:00Z',
};

const questions = [{
  id: 'Q001',
  type: 'single-choice',
  question: '測試題',
  options: [
    { id: 'A', text: '甲' },
    { id: 'B', text: '乙' },
  ],
  answer: ['A'],
  explanation: '測試',
  images: ['assets/images/Q001.txt.png'],
  explanationImages: [],
  chapter: '測試',
  tags: [],
  difficulty: 1,
}];

const assetBytes = new TextEncoder().encode('asset');
const zip = await createQuestionBankZip({
  manifest,
  questions,
  assets: [{
    path: 'assets/images/Q001.txt.png',
    blob: new Blob([assetBytes], { type: 'image/png' }),
  }],
});

assert.equal(zip.type, 'application/zip');

const entries = await readZip(zip);
assert.equal(entries.has('manifest.json'), true);
assert.equal(entries.has('questions.json'), true);
assert.equal(entries.has('assets/images/Q001.txt.png'), true);

const exportedManifest = JSON.parse(new TextDecoder().decode(entries.get('manifest.json')));
const exportedQuestions = JSON.parse(new TextDecoder().decode(entries.get('questions.json')));

assert.equal(exportedManifest.id, 'v33_test');
assert.equal(exportedManifest.questionCount, 1);
assert.equal('sourceType' in exportedManifest, false);
assert.equal('sourceMetadata' in exportedManifest, false);
assert.equal('importedAt' in exportedManifest, false);
assert.equal(exportedQuestions.length, 1);

const cleaned = cleanExportManifest(manifest, 1);
assert.equal(cleaned.questionCount, 1);
assert.equal(cleaned.sourceType, undefined);

assert.match(QUESTION_BANK_AI_PROMPT, /Schema 2\.0/);
assert.match(QUESTION_BANK_AI_PROMPT, /manifest\.json/);
assert.match(QUESTION_BANK_AI_PROMPT, /questions\.json/);
assert.match(QUESTION_BANK_AI_PROMPT, /不要自行猜題/);

const index = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const redirect = fs.readFileSync('legacy-v2.html', 'utf8');

assert.equal(index, v3);
assert.match(index, /<span class="version-badge">v[0-9][^<]*<\/span>/);
assert.match(index, /data-nav-tools/);
assert.match(index, /id="toolsView"/);

// Cache version must remain versioned, but later releases are allowed to advance it.
assert.match(sw, /const CACHE_VERSION = 'moxin-quiz-v(?:3|5)-[^']+';/);
assert.match(sw, /src\/question-bank\/zip-writer\.js/);
assert.match(sw, /src\/ui\/tools\.js/);
assert.match(sw, /styles\/v3-v33\.css/);

assert.equal(fs.existsSync('script.js'), false);
assert.equal(fs.existsSync('style.css'), false);
assert.equal(fs.existsSync('question-banks.json'), false);
assert.equal(fs.existsSync('questions'), false);
assert.equal(fs.existsSync('assets/images'), false);

for (const file of [
  'legacy-v2/index.html',
  'legacy-v2/script.js',
  'legacy-v2/style.css',
  'legacy-v2/question-banks.json',
  'legacy-v2/questions/ERP_Planner_202509_V06_improved_explanations.json',
  'legacy-v2/questions/Motorcycle_License_1150218.json',
  'legacy-v2/questions/sample.json',
  'legacy-v2/README.md',
]) {
  assert.equal(fs.existsSync(file), true, `Missing legacy archive file: ${file}`);
}

assert.match(redirect, /\.\/legacy-v2\//);

console.log('MoXin Quiz v3.3 tools/export/legacy cleanup tests passed.');

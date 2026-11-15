import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePackage } from '../src/question-bank/validator.js';
import { checkAnswer } from '../src/quiz/scoring.js';
import { loadAuthorCatalog, inspectAuthorBank } from '../src/question-bank/author-catalog.js';

const path = 'author-banks/MoXin_QuickStart_Demo.json';
const bank = JSON.parse(readFileSync(path, 'utf8'));
const catalog = JSON.parse(readFileSync('author-banks.json', 'utf8'));
const sw = readFileSync('service-worker.js', 'utf8');
const id = 'MoXin_QuickStart_Demo';

assert.equal(catalog[0].id, id, 'new visitors should see the demo first');
assert.equal(catalog.length, 2, 'keep the ERP catalog entry unchanged');
assert.equal(catalog[1].id, 'ERP_Planner_202509_V06');
assert.equal(catalog[0].source.kind, 'v2-json', 'reuse the existing author-bank loader');
assert.equal(catalog[0].source.url, './' + path);
assert.equal(bank.manifest.id, id);
assert.equal(bank.manifest.questionCount, 4);
assert.equal(bank.questions.length, 4);
assert.equal(new Set(bank.questions.map(q => q.type)).size, 4);
assert.deepEqual(bank.questions.map(q => q.type),
  ['single-choice', 'multiple-choice', 'true-false', 'fill-in']);
assert.ok(bank.manifest.description.includes('非證照考題'));
const report = validatePackage({ ...bank, assetPaths: [] });
assert.equal(report.valid, true, JSON.stringify(report.issues));
assert.equal(report.summary.errors, 0);
assert.ok(bank.questions.every(q => q.explanation.trim().length >= 20),
  'every demo question requires an actual explanation');

const [single, multiple, boolean, blank] = bank.questions;
assert.equal(checkAnswer(single, 'B'), true);
assert.equal(checkAnswer(single, 'A'), false);
assert.equal(checkAnswer(multiple, ['C', 'A']), true);
assert.equal(checkAnswer(multiple, ['A']), false);
assert.equal(checkAnswer(boolean, true), true);
assert.equal(checkAnswer(boolean, false), false);
assert.equal(checkAnswer(blank, '12'), true);
assert.equal(checkAnswer(blank, '13'), false);
assert.match(sw, /moxin-quiz-v5-5\.0\.0-prod-15/);
assert.ok(sw.includes("'./" + path + "'"),
  'demo JSON should be small enough to include in offline App Shell');

const fetchImpl = async url => ({
  ok: true,
  json: async () => {
    if (url === './author-banks.json') return catalog;
    if (url === './' + path) return bank;
    throw new Error('unexpected demo fetch: ' + url);
  },
});
const entries = await loadAuthorCatalog({ fetchImpl });
assert.equal(entries[0].id, id);
const inspected = await inspectAuthorBank(entries[0], { fetchImpl });
assert.equal(inspected.report.valid, true);
assert.equal(inspected.manifest.questionCount, 4);
assert.equal(inspected.source.kind, 'author-catalog');
console.log('B06-03 PASS: 4 original demo types, correct scoring, author catalog, offline asset and existing loader.');

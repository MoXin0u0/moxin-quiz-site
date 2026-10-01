import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inspectAuthorBank } from '../src/question-bank/author-catalog.js';
import { validatePackage } from '../src/question-bank/validator.js';

const catalog = JSON.parse(fs.readFileSync('author-banks.json', 'utf8'));
const entry = catalog.find(item => item.id === 'ERP_Planner_202509_V06');

assert.ok(entry);
assert.equal(entry.version, '1.2.0');
assert.equal(entry.source.kind, 'v2-package');

const manifestPath = 'author-banks/ERP_Planner_202509_V06/manifest.json';
const questionsPath = 'author-banks/ERP_Planner_202509_V06/questions.json';

assert.equal(fs.existsSync(manifestPath), true);
assert.equal(fs.existsSync(questionsPath), true);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

assert.equal(manifest.schemaVersion, '2.0');
assert.equal(manifest.id, 'ERP_Planner_202509_V06');
assert.equal(manifest.version, '1.2.0');
assert.equal(manifest.questionCount, 443);
assert.equal(questions.length, 443);

const report = validatePackage({ manifest, questions, assetPaths: [] });
assert.equal(report.valid, true, JSON.stringify(report.issues, null, 2));

const responses = new Map([
  [entry.source.manifestUrl, manifest],
  [entry.source.questionsUrl, questions],
]);
const fetchImpl = async url => ({
  ok: responses.has(url),
  status: responses.has(url) ? 200 : 404,
  async json() { return responses.get(url); },
});

const inspected = await inspectAuthorBank(entry, { fetchImpl });
assert.equal(inspected.report.valid, true);
assert.equal(inspected.questions.length, 443);
assert.equal(inspected.manifest.version, '1.2.0');

const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.match(sw, /const CACHE_VERSION = 'moxin-quiz-v3-[^']+';/);

// Author bank payload must NOT be preloaded in APP_SHELL.
const shell = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] || '';
assert.doesNotMatch(
  shell,
  /author-banks\/ERP_Planner_202509_V06\/questions\.json/,
);

console.log('MoXin Quiz v3.2 native ERP author bank tests passed.');

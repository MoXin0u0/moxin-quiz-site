import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  compareVersions,
  inspectAuthorBank,
  loadAuthorCatalog,
} from '../src/question-bank/author-catalog.js';

const catalog = JSON.parse(fs.readFileSync('author-banks.json', 'utf8'));
assert.equal(catalog.length, 1);
assert.equal(catalog[0].id, 'ERP_Planner_202509_V06');
assert.equal(catalog[0].questionCount, 443);
assert.ok(
  ['legacy-json', 'v2-package'].includes(catalog[0].source.kind),
  `unexpected author source kind: ${catalog[0].source.kind}`,
);

assert.equal(compareVersions('1.2.0', '1.1.9'), 1);
assert.equal(compareVersions('1.1.0', '1.1'), 0);
assert.equal(compareVersions('1.0.0', '2.0.0'), -1);

const fakeCatalogFetch = async () => ({
  ok: true,
  status: 200,
  async json() { return catalog; },
});
const loaded = await loadAuthorCatalog({ fetchImpl: fakeCatalogFetch });
assert.equal(loaded[0].author, '墨忻');

let fakeBankFetch;

if (catalog[0].source.kind === 'legacy-json') {
  const legacy = {
    bankId: 'ERP_Planner_202509_V06',
    title: 'Legacy ERP',
    description: 'test',
    version: '1.1',
    createdDate: '2026-06-07',
    category: 'ERP規劃師',
    questions: [{
      id: 'Q001',
      type: 'single_choice',
      question: '測試題',
      options: { A: '甲', B: '乙' },
      answer: 'A',
      explanation: '測試詳解',
      tags: ['ERP'],
      difficulty: 'easy',
      chapter: '第一章',
    }],
  };

  fakeBankFetch = async url => ({
    ok: true,
    status: 200,
    async json() {
      if (String(url).includes('ERP_Planner')) return legacy;
      throw new Error(`unexpected url ${url}`);
    },
  });
} else {
  const manifestPath = 'author-banks/ERP_Planner_202509_V06/manifest.json';
  const questionsPath = 'author-banks/ERP_Planner_202509_V06/questions.json';

  assert.equal(fs.existsSync(manifestPath), true, 'native ERP manifest must exist');
  assert.equal(fs.existsSync(questionsPath), true, 'native ERP questions must exist');

  const nativeManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const nativeQuestions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

  fakeBankFetch = async url => {
    const value = String(url);
    if (value.endsWith('/manifest.json')) {
      return {
        ok: true,
        status: 200,
        async json() { return nativeManifest; },
      };
    }
    if (value.endsWith('/questions.json')) {
      return {
        ok: true,
        status: 200,
        async json() { return nativeQuestions; },
      };
    }
    return {
      ok: false,
      status: 404,
      async json() { return null; },
    };
  };
}

const inspected = await inspectAuthorBank(catalog[0], { fetchImpl: fakeBankFetch });
assert.equal(inspected.manifest.schemaVersion, '2.0');
assert.equal(inspected.manifest.id, 'ERP_Planner_202509_V06');
assert.equal(inspected.manifest.author, '墨忻');
assert.equal(inspected.manifest.metadata.sourceType, 'author');
assert.equal(inspected.questions[0].type, 'single-choice');
assert.ok(Array.isArray(inspected.questions[0].answer));
assert.equal(inspected.report.valid, true);

const importer = fs.readFileSync('src/question-bank/importer.js', 'utf8');
assert.match(importer, /sourceType:\s*'user'/);
assert.match(importer, /sourceType:\s*'author'/);

const banksRepo = fs.readFileSync('src/storage/repositories/banks.js', 'utf8');
assert.match(banksRepo, /sourceType:\s*pkg\.sourceType === 'author' \? 'author' : 'user'/);

const html = fs.readFileSync('app.html', 'utf8');
assert.match(html, /data-library-source-tab="author"/);
assert.match(html, /data-library-source-tab="user"/);
assert.match(html, /id="authorBankList"/);
assert.match(html, /id="bankList"/);

const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.match(sw, /\.\/author-banks\.json/);
assert.match(sw, /\.\/styles\/v3-v31\.css/);
assert.match(sw, /\.\/src\/question-bank\/author-catalog\.js/);

console.log('MoXin Quiz v3.1 author/user library tests passed.');

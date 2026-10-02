import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('src/ui/studio-r1.js', 'utf8');
const batchUi = fs.readFileSync('src/ui/studio-batch-import.js', 'utf8');
const batchCss = fs.readFileSync('styles/v4-studio-batch.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(studio, /openStudioBatchImportDialog/);
assert.match(studio, /data-studio-new-batch/);
assert.match(studio, /data-studio-batch-import/);
assert.match(studio, /replaceStarter/);
assert.match(studio, /isPristineStarterQuestion/);
assert.match(studio, /state\.draft\.questions = additions/);
assert.match(studio, /state\.draft\.questions\.push\(\.\.\.additions\)/);

assert.match(batchUi, /from '\.\.\/studio\/batch-parser\.js'/);
assert.match(batchUi, /parseBatchQuestionText/);
assert.match(batchUi, /selectBatchQuestions/);
assert.match(batchUi, /BATCH_PARSE_STATUS/);
assert.match(batchUi, /data-studio-batch-source/);
assert.match(batchUi, /data-studio-batch-parse/);
assert.match(batchUi, /data-studio-batch-add/);
assert.match(batchUi, /data-batch-candidate-index/);
assert.match(batchUi, /可直接加入/);
assert.match(batchUi, /需確認/);
assert.match(batchUi, /未解析/);
assert.match(batchUi, /我已確認，仍加入草稿/);
assert.match(batchUi, /includeReview/);

assert.match(batchCss, /v4\.0 P2B\.1 — Studio Batch Import/);
assert.match(batchCss, /\.studio-r1-batch-dialog/);
assert.match(batchCss, /\.studio-r1-batch-item\.is-ready/);
assert.match(batchCss, /\.studio-r1-batch-item\.is-review/);
assert.match(batchCss, /\.studio-r1-batch-item\.is-unparsed/);
assert.match(batchCss, /@media \(max-width: 720px\)/);

assert.match(sw, /\.\/styles\/v4-studio-batch\.css/);
assert.match(sw, /\.\/src\/ui\/studio-batch-import\.js/);

for (const legacyReadme of [
  'README-P2B.txt',
  'README-R2K3.1.txt',
  'README-R2K4.txt',
  'README-R2K5.txt',
  'README-R2K5.1.md',
  'README-R2K5.2.md',
  'README-R2K5.2.1.md',
  'README-R2K5.3.md',
  'README-R2K5.4.md',
]) {
  assert.equal(
    fs.existsSync(legacyReadme),
    false,
    `${legacyReadme} should be consolidated into docs/V4_0_CHANGELOG.md`,
  );
}

assert.equal(fs.existsSync('docs/V4_0_CHANGELOG.md'), true);

console.log('MoXin Quiz v4.0 P2B.1 Studio batch UI + repository hygiene tests passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createEditableCopyPackage,
  createEmptyStudioPackage,
  createQuestion,
  duplicateQuestion,
  makeUniqueBankId,
  moveQuestion,
  parseFillAnswers,
  parseTags,
  removeQuestion,
} from '../src/studio/editor-model.js';
import {
  convertQuestionType,
  validateQuestionDraft,
} from '../src/studio/question-draft.js';

const pkg = createEmptyStudioPackage({
  now: new Date('2026-10-01T12:00:00.000Z'),
  existingBankIds: [],
});

assert.equal(pkg.manifest.schemaVersion, '2.0');
assert.equal(pkg.questions.length, 1);
assert.equal(pkg.questions[0].id, 'Q001');
assert.equal(pkg.questions[0].type, 'single-choice');
assert.deepEqual(pkg.questions[0].answer, []);

const q2 = createQuestion('multiple-choice', pkg.questions);
assert.equal(q2.id, 'Q002');
assert.equal(q2.type, 'multiple-choice');
assert.deepEqual(q2.answer, []);

const fill = convertQuestionType(q2, 'fill-in');
assert.equal(fill.type, 'fill-in');
assert.deepEqual(fill.options, []);
assert.deepEqual(fill.answer, []);
assert.equal(fill.caseSensitive, false);

const tf = convertQuestionType(fill, 'true-false');
assert.deepEqual(tf.answer, []);

const duplicated = duplicateQuestion(pkg.questions[0], [pkg.questions[0], q2]);
assert.equal(duplicated.id, 'Q003');

const moved = moveQuestion([pkg.questions[0], q2], q2.id, -1);
assert.equal(moved[0].id, q2.id);

assert.equal(removeQuestion([pkg.questions[0]], 'Q001').length, 1);
assert.deepEqual(parseTags('ERP, ERP，第三章\n重要'), ['ERP', '第三章', '重要']);
assert.deepEqual(parseFillAnswers('ERP\n\nEnterprise Resource Planning\nERP'), [
  'ERP',
  'Enterprise Resource Planning',
]);
assert.equal(makeUniqueBankId('bank', ['bank', 'bank-2']), 'bank-3');

const authorCopy = createEditableCopyPackage({
  manifest: {
    schemaVersion: '2.0',
    id: 'author_bank',
    name: '作者題庫',
    version: '9.0.0',
  },
  questions: [{
    ...pkg.questions[0],
    question: '已完成題目',
    options: [
      { id: 'A', text: '甲' },
      { id: 'B', text: '乙' },
    ],
    answer: ['A'],
  }],
  assets: [],
}, ['author_bank', 'author_bank-copy']);

assert.equal(authorCopy.manifest.id, 'author_bank-copy-2');
assert.equal(authorCopy.manifest.version, '1.0.0');
assert.match(authorCopy.manifest.name, /副本/);
assert.equal(validateQuestionDraft(authorCopy.questions[0]).valid, true);

const studioShim = fs.readFileSync('src/ui/studio.js', 'utf8');
const studio = fs.readFileSync('src/ui/studio-r1.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const designCss = fs.readFileSync('styles/v4-design.css', 'utf8');
const studioCss = fs.readFileSync('styles/v4-studio-r1.css', 'utf8');

assert.match(studioShim, /studio-r1/);
assert.match(studio, /convertQuestionType/);
assert.match(studio, /planQuestionTypeChange/);
assert.match(studio, /data-studio-save-library/);
assert.match(studio, /data-studio-export-json/);
assert.match(studio, /data-studio-copy-bank/);
assert.match(studio, /data-studio-clear-suspect-answers/);
assert.match(sw, /styles\/v4-design\.css/);
assert.match(sw, /styles\/v4-studio-r1\.css/);
assert.match(sw, /src\/studio\/question-draft\.js/);
assert.match(sw, /src\/ui\/studio-r1\.js/);
assert.match(designCss, /--surface-2:/);
assert.match(designCss, /--text-muted:/);
assert.match(studioCss, /\.studio-r1-layout/);

console.log('MoXin Quiz v4.0 R1 studio/design tests passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createEditableCopyPackage,
  createEmptyStudioPackage,
  createQuestion,
  duplicateQuestion,
  makeUniqueBankId,
  moveQuestion,
  normalizeQuestionForType,
  parseFillAnswers,
  parseTags,
  removeQuestion,
} from '../src/studio/editor-model.js';

const pkg = createEmptyStudioPackage({
  now: new Date('2026-10-01T12:00:00.000Z'),
  existingBankIds: [],
});
assert.equal(pkg.manifest.schemaVersion, '2.0');
assert.equal(pkg.questions.length, 1);
assert.equal(pkg.questions[0].id, 'Q001');
assert.equal(pkg.questions[0].type, 'single-choice');

const q2 = createQuestion('multiple-choice', pkg.questions);
assert.equal(q2.id, 'Q002');
assert.equal(q2.type, 'multiple-choice');
assert.ok(q2.answer.length >= 1);

const fill = normalizeQuestionForType(q2, 'fill-in');
assert.equal(fill.type, 'fill-in');
assert.deepEqual(fill.options, []);
assert.deepEqual(fill.answer, ['']);
assert.equal(fill.caseSensitive, false);

// Switching between incompatible answer models must never reinterpret an
// option ID such as "A" as a legitimate fill-in answer.
const choiceWithAnswerA = {
  ...pkg.questions[0],
  type: 'single-choice',
  answer: ['A'],
};
const fillFromChoice = normalizeQuestionForType(choiceWithAnswerA, 'fill-in');
assert.deepEqual(fillFromChoice.answer, ['']);

const filledQuestion = {
  ...fill,
  type: 'fill-in',
  answer: ['ERP'],
};
const choiceFromFill = normalizeQuestionForType(filledQuestion, 'single-choice');
assert.deepEqual(choiceFromFill.answer, ['A']);

const tf = normalizeQuestionForType(fill, 'true-false');
assert.deepEqual(tf.answer, [true]);

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
  questions: [pkg.questions[0]],
  assets: [],
}, ['author_bank', 'author_bank-copy']);
assert.equal(authorCopy.manifest.id, 'author_bank-copy-2');
assert.equal(authorCopy.manifest.version, '1.0.0');
assert.match(authorCopy.manifest.name, /副本/);

const tools = fs.readFileSync('src/ui/tools.js', 'utf8');
const studio = fs.readFileSync('src/ui/studio.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const css = fs.readFileSync('styles/v4-studio.css', 'utf8');

assert.match(tools, /mountStudioWorkspace/);
assert.match(tools, /題庫工作室/);
assert.match(studio, /saveBankPackage/);
assert.match(studio, /validatePackage/);
assert.match(studio, /downloadQuestionBankZip/);
assert.match(studio, /data-studio-save-library/);
assert.match(studio, /data-studio-export-json/);
assert.match(studio, /data-studio-copy-bank/);
assert.match(sw, /styles\/v4-studio\.css/);
assert.match(sw, /src\/studio\/editor-model\.js/);
assert.match(sw, /src\/ui\/studio\.js/);
assert.match(css, /\.studio-editor-grid/);

console.log('MoXin Quiz v4.0 P1 studio core tests passed.');

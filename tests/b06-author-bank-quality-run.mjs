import assert from 'node:assert/strict';
import fs from 'node:fs';

// B06-01: fail on broken structure, report content-quality risks WITHOUT
// pretending that answer keys, explanations or third-party rights are vetted.
const catalog = JSON.parse(fs.readFileSync('author-banks.json', 'utf8'));
const root = 'author-banks/ERP_Planner_202509_V06/';
const manifest = JSON.parse(fs.readFileSync(root + 'manifest.json', 'utf8'));
const questions = JSON.parse(fs.readFileSync(root + 'questions.json', 'utf8'));

const record = catalog.find(x => x.id === manifest.id);
assert.ok(record, 'ERP author bank must be registered in catalog');
assert.equal(questions.length, 443, 'review baseline changed: reassess the authored 443-question bank');
assert.equal(manifest.questionCount, questions.length, 'manifest question count drift');
assert.equal(record.questionCount, questions.length, 'catalog question count drift');
assert.ok(Array.isArray(questions), 'question file is expected to be an array');

const ids = new Set();
const chapterCounts = new Map();
const questionGroups = new Map();
let genericDistractorExplanations = 0;
let genericCorrectExplanations = 0;
let dedicatedSourceCount = 0;

for (const item of questions) {
  assert.ok(item && typeof item === 'object');
  assert.ok(typeof item.id === 'string' && item.id.trim(), 'missing question ID');
  assert.equal(ids.has(item.id), false, 'duplicate question ID ' + item.id);
  ids.add(item.id);
  assert.equal(item.type, 'single-choice', 'unexpected quiz type ' + item.id);
  assert.ok(typeof item.question === 'string' && item.question.trim(),
    'question text missing ' + item.id);
  assert.ok(Array.isArray(item.options) && item.options.length >= 2,
    'answer choices missing ' + item.id);
  const choiceIds = item.options.map(x => x.id);
  assert.equal(new Set(choiceIds).size, choiceIds.length,
    'duplicate option identifiers ' + item.id);
  assert.ok(item.options.every(x => typeof x.text === 'string' && x.text.trim()),
    'blank answer option in ' + item.id);
  assert.ok(Array.isArray(item.answer) && item.answer.length === 1,
    'single-choice requires one keyed answer in ' + item.id);
  assert.ok(choiceIds.includes(item.answer[0]), 'answer key not in options ' + item.id);
  assert.ok(typeof item.explanation === 'string' && item.explanation.trim(),
    'missing explanation in ' + item.id);
  assert.ok(typeof item.chapter === 'string' && item.chapter.trim(),
    'chapter label missing ' + item.id);
  assert.ok(Array.isArray(item.tags), 'tag array missing ' + item.id);
  chapterCounts.set(item.chapter, (chapterCounts.get(item.chapter) || 0) + 1);

  const stem = item.question.trim().replace(/\s+/g, ' ');
  const group = questionGroups.get(stem) || [];
  group.push(item);
  questionGroups.set(stem, group);

  if (item.explanation.includes('與題目概念有關或文字相近')) {
    genericDistractorExplanations += 1;
  }
  if (item.explanation.includes('最符合題目所問')) {
    genericCorrectExplanations += 1;
  }
  if (item.source || item.references || item.citation || item.explanationSources) {
    dedicatedSourceCount += 1;
  }
}

const duplicateGroups = [...questionGroups.values()].filter(group => group.length > 1);
const duplicates = duplicateGroups.map(group => {
  const answerTexts = group.map(x => x.options.find(o => o.id === x.answer[0])?.text || '');
  const optionLists = group.map(x => x.options.map(o => o.text).join('|'));
  return {
    ids: group.map(x => x.id),
    answerTextConflict: new Set(answerTexts).size > 1,
    differentOptionSets: new Set(optionLists).size > 1,
    chapters: [...new Set(group.map(x => x.chapter))],
  };
});
const extraDuplicateCount = duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0);
const report = {
  bankId: manifest.id,
  structural: {
    count: questions.length, uniqueIds: ids.size, singleChoice: questions.length,
    keyedAnswerStructurePass: true, explanationsNonEmpty: true,
    catalogAndManifestCountsMatch: true,
  },
  humanReview: {
    duplicateStemGroups: duplicates,
    extraDuplicateStems: extraDuplicateCount,
    genericDistractorExplanations,
    genericCorrectExplanations,
    dedicatedSourceFields: dedicatedSourceCount,
    chapterCounts: Object.fromEntries(chapterCounts),
    legacyImportSource: manifest.metadata?.legacySource || null,
    answerAccuracyVerified: false,
    republicationRightsVerified: false,
  },
};

assert.equal(Object.values(report.humanReview.chapterCounts).reduce((a, b) => a + b, 0),
  questions.length, 'chapter distribution missing questions');
console.log('B06-01 STRUCTURAL PASS:', questions.length,
  'questions; unique IDs, keyed answer choices and nonempty explanations.');
console.log('B06-01 CONTENT REVIEW REQUIRED:', extraDuplicateCount, 'extra repeated stems;',
  genericDistractorExplanations, 'generic distractor explanations;',
  genericCorrectExplanations, 'generic correct-answer explanations;',
  dedicatedSourceCount, 'dedicated source fields.');
console.log('B06-01 DETAIL:', JSON.stringify(report));
console.log('B06-01 LIMITATION: structural pass is NOT an independent key, subject-matter, source-rights or expert review.');

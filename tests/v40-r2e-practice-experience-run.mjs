import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = fs.readFileSync('src/ui/bank-detail.js', 'utf8');
const practice = fs.readFileSync('src/ui/practice.js', 'utf8');
const exam = fs.readFileSync('src/ui/exam.js', 'utf8');
const css = fs.readFileSync('styles/v4-learning.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

// Bank detail still exposes the same functional hooks.
for (const hook of [
  'data-back-library',
  'data-export-bank',
  'data-resume-practice',
  'data-learning-filter',
  'data-filter-keyword',
  'data-filter-type',
  'data-filter-difficulty',
  'data-filter-chapter',
  'data-filter-count',
  'data-start-practice',
  'data-question-results',
]) {
  assert.match(bank, new RegExp(hook));
}
assert.match(bank, /bank-study-hero/);
assert.match(bank, /bank-study-planner/);
assert.match(bank, /bank-study-question-preview/);

// Practice hooks remain stable while the page becomes focus-mode UI.
for (const hook of [
  'data-exit-practice',
  'data-question-images',
  'data-answer-form',
  'data-submit-answer',
  'data-toggle-favorite',
  'data-toggle-unfamiliar',
  'data-note-input',
  'data-save-note',
  'data-feedback-area',
  'data-next-question',
  'data-restart-practice',
  'data-finish-to-bank',
  'data-finish-to-library',
]) {
  assert.match(practice, new RegExp(hook));
}
assert.match(practice, /practice-focus-shell/);
assert.match(practice, /practice-focus-option/);
assert.match(practice, /practice-note-details/);
assert.match(practice, /practice-focus-feedback/);

// Exam hooks remain stable.
for (const hook of [
  'data-exam-timer',
  'data-exam-go',
  'data-submit-exam',
  'data-exam-question-images',
  'data-exam-answer-form',
  'data-exam-prev',
  'data-exam-next',
  'data-exam-again',
  'data-exam-result-center',
  'data-exam-result-library',
]) {
  assert.match(exam, new RegExp(hook));
}
assert.match(exam, /exam-focus-shell/);
assert.match(exam, /exam-focus-navigator/);
assert.match(exam, /exam-result-score-ring/);
assert.match(exam, /exam-focus-analysis/);

// CSS contains the new focus-mode layouts and mobile rules.
assert.match(css, /v4\.0 R2E — Practice Experience Redesign/);
assert.match(css, /\.bank-study-hero/);
assert.match(css, /\.practice-focus-topbar/);
assert.match(css, /\.practice-focus-question/);
assert.match(css, /\.exam-focus-layout/);
assert.match(css, /\.exam-focus-navigator/);
assert.match(css, /\.exam-result-score-ring/);
assert.match(css, /@media \(max-width: 700px\)/);
assert.match(css, /@media \(max-width: 460px\)/);

assert.match(sw, /moxin-quiz-v3-4\.0\.0-r2e-1/);

console.log('MoXin Quiz v4.0 R2E practice experience tests passed.');

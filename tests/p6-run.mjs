import assert from 'node:assert/strict';
import {
  countAnswered,
  createExamSession,
  getExamAnswer,
  getRemainingSeconds,
  gradeExam,
  normalizeResumedExam,
  setExamAnswer,
} from '../src/quiz/exam-engine.js';

const questions = [
  { id: 'Q1', type: 'single-choice', question: 'A', options: [{ id: 'A', text: 'a' }, { id: 'B', text: 'b' }], answer: ['A'] },
  { id: 'Q2', type: 'true-false', question: 'B', answer: [true] },
  { id: 'Q3', type: 'fill-in', question: 'C', answer: ['hello'], caseSensitive: false },
];

const now = new Date('2026-10-01T00:00:00.000Z');
const exam = createExamSession({
  bankId: 'demo',
  bankName: 'Demo',
  questions,
  questionCount: 3,
  durationMinutes: 30,
  random: () => 0.999,
  now,
});

assert.equal(exam.sessionType, 'exam');
assert.equal(exam.questionIds.length, 3);
assert.equal(getRemainingSeconds(exam, now), 1800);

setExamAnswer(exam, 'Q1', 'A');
setExamAnswer(exam, 'Q2', false);
assert.equal(countAnswered(exam), 2);
assert.equal(getExamAnswer(exam, 'Q1'), 'A');

const map = new Map(questions.map(question => [question.id, question]));
const result = gradeExam(exam, map);
assert.equal(result.total, 3);
assert.equal(result.correctCount, 1);
assert.equal(result.wrongCount, 1);
assert.equal(result.unansweredCount, 1);
assert.equal(result.score, 33);

const resumed = normalizeResumedExam({
  ...exam,
  questionIds: ['Q1', 'Q2', 'REMOVED'],
  answers: { Q1: 'A', Q2: false, REMOVED: 'x' },
  currentIndex: 99,
}, ['Q1', 'Q2'], now);

assert.deepEqual(
  resumed.questionIds,
  ['Q1', 'Q2', 'REMOVED'],
  'V5 must not silently shrink a frozen exam when snapshot data is missing',
);
assert.deepEqual(resumed.answers, { Q1: 'A', Q2: false, REMOVED: 'x' });
assert.equal(resumed.currentIndex, 2);
assert.deepEqual(resumed.integrityError?.missingQuestionIds, ['REMOVED']);
assert.equal(resumed.expired, false);

const expired = normalizeResumedExam({
  ...exam,
  deadlineAt: '2026-09-30T23:59:00.000Z',
}, ['Q1', 'Q2', 'Q3'], now);
assert.equal(expired.expired, true);

console.log('MoXin Quiz v3 P6 unit tests passed.');

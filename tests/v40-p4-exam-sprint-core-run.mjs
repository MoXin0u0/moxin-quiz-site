import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  SPRINT_PRIORITY,
  SPRINT_PRIORITY_ORDER,
  buildExamSprintPlan,
  classifySprintQuestion,
  diffDateKeys,
  normalizeExamDateKey,
  recommendedSprintDailyTarget,
} from '../src/learning/exam-sprint.js';

const NOW = new Date('2026-10-03T10:00:00.000Z');
const TZ = 'Asia/Taipei';

function q(id, bankId = 'erp') {
  return { bankId, questionId: id, question: `Question ${id}`, chapter: 'Core', difficulty: 2 };
}
function p(id, overrides = {}, bankId = 'erp') {
  return {
    bankId, questionId: id, attempts: 1, correctCount: 1, wrongCount: 0,
    lastResult: 'correct', lastAnsweredAt: '2026-10-02T10:00:00.000Z', ...overrides,
  };
}
function r(id, overrides = {}, bankId = 'erp') {
  return { bankId, questionId: id, level: 3, dueAt: '2026-10-10T00:00:00.000Z', ...overrides };
}
function u(id, overrides = {}, bankId = 'erp') {
  return {
    bankId, questionId: id, status: 'unfamiliar',
    markedAt: '2026-10-02T00:00:00.000Z', ...overrides,
  };
}

assert.deepEqual(SPRINT_PRIORITY_ORDER, [
  'wrong', 'unfamiliar', 'due', 'low-mastery', 'unanswered', 'other',
]);

assert.equal(classifySprintQuestion(q('Q1'), {
  progress: p('Q1', { lastResult: 'wrong' }),
  unfamiliar: u('Q1'),
  review: r('Q1', { level: 1, dueAt: '2026-10-01T00:00:00.000Z' }),
  now: NOW,
}), SPRINT_PRIORITY.WRONG);

assert.equal(classifySprintQuestion(q('Q2'), {
  progress: p('Q2'),
  unfamiliar: u('Q2'),
  review: r('Q2', { level: 1, dueAt: '2026-10-01T00:00:00.000Z' }),
  now: NOW,
}), SPRINT_PRIORITY.UNFAMILIAR);

assert.equal(classifySprintQuestion(q('Q3'), {
  progress: p('Q3'),
  review: r('Q3', { level: 1, dueAt: '2026-10-01T00:00:00.000Z' }),
  now: NOW,
}), SPRINT_PRIORITY.DUE);

assert.equal(classifySprintQuestion(q('Q4'), {
  progress: p('Q4'),
  review: r('Q4', { level: 2 }),
  now: NOW,
}), SPRINT_PRIORITY.LOW_MASTERY);

assert.equal(classifySprintQuestion(q('Q5'), {
  progress: p('Q5'),
  review: null,
  now: NOW,
}), SPRINT_PRIORITY.LOW_MASTERY);

assert.equal(classifySprintQuestion(q('Q6'), { now: NOW }), SPRINT_PRIORITY.UNANSWERED);

assert.equal(classifySprintQuestion(q('Q7'), {
  progress: p('Q7'),
  review: r('Q7', { level: 5 }),
  now: NOW,
}), SPRINT_PRIORITY.OTHER);

assert.equal(normalizeExamDateKey('2026-11-15T00:00:00.000Z'), '2026-11-15');
assert.equal(diffDateKeys('2026-10-03', '2026-10-10'), 7);
assert.equal(diffDateKeys('2026-10-03', '2026-10-03'), 0);
assert.equal(diffDateKeys('2026-10-03', '2026-10-02'), -1);

assert.equal(recommendedSprintDailyTarget({
  questionCount: 443,
  remainingStudyDays: 10,
}), 45);

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-13T00:00:00.000Z', dailyPracticeTarget: 30,
  }, {
    questions: Array.from({ length: 100 }, (_, index) => q(`Q${index + 1}`)),
  }, { now: NOW, timeZone: TZ });

  assert.equal(plan.daysUntilExam, 10);
  assert.equal(plan.remainingStudyDays, 10);
  assert.equal(plan.recommendedDailyTarget, 10);
  assert.equal(plan.dailyTarget, 30);
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-13', dailyPracticeTarget: 0,
  }, {
    questions: Array.from({ length: 95 }, (_, index) => q(`Q${index + 1}`)),
  }, { now: NOW, timeZone: TZ });

  assert.equal(plan.recommendedDailyTarget, 10);
  assert.equal(plan.dailyTarget, 10);
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-13', dailyPracticeTarget: 30,
  }, {
    questions: Array.from({ length: 100 }, (_, index) => q(`Q${index + 1}`)),
  }, { now: NOW, timeZone: TZ, todayPracticeCount: 12 });

  assert.equal(plan.remainingToday, 18);
  assert.equal(plan.selectionTarget, 18);
  assert.equal(plan.selected.length, 18);
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-13', dailyPracticeTarget: 5,
  }, { questions: [q('Q1'), q('Q2')] },
  { now: NOW, timeZone: TZ, todayPracticeCount: 5 });

  assert.equal(plan.status, 'today-complete');
  assert.equal(plan.selected.length, 0);
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-02', dailyPracticeTarget: 10,
  }, { questions: [q('Q1')] }, { now: NOW, timeZone: TZ });

  assert.equal(plan.active, false);
  assert.equal(plan.status, 'exam-passed');
  assert.equal(plan.remainingStudyDays, 0);
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: false,
    examDate: '2026-11-15', dailyPracticeTarget: 30,
  }, { questions: [q('Q1')] }, { now: NOW, timeZone: TZ });

  assert.equal(plan.active, false);
  assert.equal(plan.status, 'disabled');
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true, dailyPracticeTarget: 30,
  }, { questions: [q('Q1')] }, { now: NOW, timeZone: TZ });

  assert.equal(plan.status, 'missing-exam-date');
}

{
  const questions = ['W', 'U', 'D', 'L', 'N', 'O'].map(id => q(id));
  const progressRecords = [
    p('W', { lastResult: 'wrong', wrongCount: 3 }),
    p('U'), p('D'), p('L'), p('O'),
  ];
  const unfamiliarRecords = [u('U')];
  const reviewRecords = [
    r('D', { level: 3, dueAt: '2026-10-01T00:00:00.000Z' }),
    r('L', { level: 1 }),
    r('O', { level: 5 }),
  ];

  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-10', dailyPracticeTarget: 10,
  }, { questions, progressRecords, unfamiliarRecords, reviewRecords },
  { now: NOW, timeZone: TZ });

  assert.deepEqual(
    plan.ranked.map(item => item.priority),
    ['wrong', 'unfamiliar', 'due', 'low-mastery', 'unanswered', 'other'],
  );
  assert.equal(new Set(plan.ranked.map(item => item.questionId)).size, 6);
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-10', dailyPracticeTarget: 10,
  }, {
    questions: [q('Q1'), q('Q2')],
    progressRecords: [
      p('Q1', { lastResult: 'wrong', wrongCount: 1 }),
      p('Q2', { lastResult: 'wrong', wrongCount: 5 }),
    ],
  }, { now: NOW, timeZone: TZ });

  assert.deepEqual(plan.ranked.map(item => item.questionId), ['Q2', 'Q1']);
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-10', dailyPracticeTarget: 10,
  }, {
    questions: [q('Q1'), q('Q2')],
    progressRecords: [p('Q1'), p('Q2')],
    reviewRecords: [
      r('Q1', { dueAt: '2026-10-03T01:00:00.000Z' }),
      r('Q2', { dueAt: '2026-10-01T01:00:00.000Z' }),
    ],
  }, { now: NOW, timeZone: TZ });

  assert.deepEqual(plan.ranked.map(item => item.questionId), ['Q2', 'Q1']);
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-10', dailyPracticeTarget: 10,
  }, {
    questions: [q('Q1', 'erp'), q('Q2', 'sample')],
  }, { now: NOW, timeZone: TZ });

  assert.deepEqual(plan.ranked.map(item => item.bankId), ['erp']);
}

{
  const plan = buildExamSprintPlan({
    id: 'global', bankId: null, sprintEnabled: true,
    examDate: '2026-10-10', dailyPracticeTarget: 10,
  }, {
    questions: [q('Q1', 'erp'), q('Q1', 'sample')],
  }, { now: NOW, timeZone: TZ });

  assert.equal(plan.ranked.length, 2);
  assert.equal(
    new Set(plan.ranked.map(item => `${item.bankId}:${item.questionId}`)).size,
    2,
  );
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-08', dailyPracticeTarget: 10,
  }, {
    questions: Array.from({ length: 100 }, (_, index) => q(`Q${index + 1}`)),
  }, { now: NOW, timeZone: TZ });

  assert.equal(plan.remainingStudyDays, 5);
  assert.equal(plan.projectedCoverage, 50);
  assert.equal(plan.coverageGap, 50);
  assert.equal(plan.recommendedDailyTarget, 20);
}

{
  const plan = buildExamSprintPlan({
    id: 'bank:erp', bankId: 'erp', sprintEnabled: true,
    examDate: '2026-10-10', dailyPracticeTarget: 10,
  }, { questions: [q('Q1'), q('Q1'), q('Q2')] },
  { now: NOW, timeZone: TZ });

  assert.equal(plan.candidateCount, 2);
}

{
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(sw, /\.\/src\/learning\/exam-sprint\.js/);
  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);
}

console.log('MoXin Quiz v4.0 P4 exam sprint core: 26 regression cases passed.');

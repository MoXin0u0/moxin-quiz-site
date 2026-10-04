import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  LEARNING_HUB_TAB,
  normalizeLearningHubTab,
  renderLearningHubTabs,
} from '../src/ui/learning-hub.js';

import {
  createExamSprintSaveInput,
  renderExamSprintPanel,
} from '../src/ui/exam-sprint.js';

import {
  EXAM_SPRINT_GOAL_ID,
  buildExamSprintPlan,
  resolveSprintBankIds,
} from '../src/learning/exam-sprint.js';

import { normalizeLearningGoal } from '../src/storage/repositories/goals.js';
import { renderReviewCenter } from '../src/ui/review-center.js';

assert.equal(normalizeLearningHubTab('goals'), LEARNING_HUB_TAB.GOALS);
assert.equal(normalizeLearningHubTab('unknown'), LEARNING_HUB_TAB.OVERVIEW);

const tabs = renderLearningHubTabs('sprint');
assert.match(tabs, /總覽/);
assert.match(tabs, /複習/);
assert.match(tabs, /學習目標/);
assert.match(tabs, /考前衝刺/);
assert.match(tabs, /data-learning-hub-tab="sprint"/);
assert.match(tabs, /learning-hub-tab is-active/);

const normalized = normalizeLearningGoal({
  id: EXAM_SPRINT_GOAL_ID,
  sprintBankIds: ['erp', 'erp', 'sample', ''],
  sprintDailyTarget: 25.6,
  sprintEnabled: true,
});
assert.deepEqual(normalized.sprintBankIds, ['erp', 'sample']);
assert.equal(normalized.sprintDailyTarget, 26);

const save = createExamSprintSaveInput({
  bankIds: ['erp', 'sample', 'erp'],
  examLabel: ' ERP 期末 ',
  examDate: '2026-11-15',
  sprintEnabled: true,
  sprintDailyTarget: '30',
});
assert.equal(save.id, EXAM_SPRINT_GOAL_ID);
assert.equal(save.bankId, null);
assert.deepEqual(save.sprintBankIds, ['erp', 'sample']);
assert.equal(save.sprintDailyTarget, 30);
assert.equal(save.examLabel, 'ERP 期末');

assert.deepEqual(resolveSprintBankIds({ id: EXAM_SPRINT_GOAL_ID, sprintBankIds: [] }), []);
assert.deepEqual(resolveSprintBankIds({ id: EXAM_SPRINT_GOAL_ID, sprintBankIds: ['erp', 'sample'] }), ['erp', 'sample']);
assert.deepEqual(resolveSprintBankIds({ id: 'bank:erp', bankId: 'erp' }), ['erp']);
assert.equal(resolveSprintBankIds({ id: 'global', bankId: null }), null);

{
  const plan = buildExamSprintPlan({
    id: EXAM_SPRINT_GOAL_ID,
    sprintEnabled: true,
    examDate: '2026-11-15',
    sprintBankIds: [],
    sprintDailyTarget: 20,
  }, {
    questions: [
      { bankId: 'erp', questionId: 'Q1' },
      { bankId: 'sample', questionId: 'Q1' },
    ],
  }, {
    now: new Date('2026-10-03T12:00:00.000Z'),
    timeZone: 'Asia/Taipei',
  });

  assert.equal(plan.status, 'missing-bank-selection');
  assert.equal(plan.candidateCount, 0);
}

{
  const plan = buildExamSprintPlan({
    id: EXAM_SPRINT_GOAL_ID,
    sprintEnabled: true,
    examDate: '2026-11-15',
    sprintBankIds: ['erp'],
    sprintDailyTarget: 20,
  }, {
    questions: [
      { bankId: 'erp', questionId: 'Q1' },
      { bankId: 'sample', questionId: 'Q1' },
    ],
  }, {
    now: new Date('2026-10-03T12:00:00.000Z'),
    timeZone: 'Asia/Taipei',
  });

  assert.equal(plan.candidateCount, 1);
  assert.deepEqual(plan.ranked.map(item => item.bankId), ['erp']);
  assert.equal(plan.dailyTarget, 20);
}

const sprintHtml = renderExamSprintPanel({
  banks: [
    { id: 'erp', name: 'ERP 題庫' },
    { id: 'sample', name: '範例題庫' },
  ],
  goal: {
    id: EXAM_SPRINT_GOAL_ID,
    sprintBankIds: ['erp'],
    sprintDailyTarget: 20,
    sprintEnabled: true,
    examDate: '2026-11-15',
  },
  plan: {
    status: 'ready',
    examDateKey: '2026-11-15',
    daysUntilExam: 43,
    remainingToday: 20,
    dailyTarget: 20,
    candidateCount: 30,
    projectedCoverage: 30,
    coverageGap: 0,
    selectionTarget: 2,
    priorityCounts: {},
    selected: [{ bankId: 'erp', questionId: 'Q1' }],
  },
});
assert.match(sprintHtml, /這場考試包含哪些題庫/);
assert.match(sprintHtml, /data-exam-sprint-bank/);
assert.match(sprintHtml, /ERP 題庫/);
assert.match(sprintHtml, /範例題庫/);
assert.match(sprintHtml, /1 個題庫/);
assert.doesNotMatch(sprintHtml, /全部題庫模式/);

const container = { innerHTML: '' };
renderReviewCenter(container, [], {
  activeTab: 'overview',
  goalModel: {
    banks: [],
    selectedScope: 'global',
    goal: { enabled: false },
    progress: {
      streak: 2,
      today: {
        completionPercent: 0,
        practiceGoal: { count: 2, active: false },
        reviewGoal: { count: 0, active: false },
      },
    },
  },
  sprintModel: {
    banks: [],
    goal: { sprintEnabled: false, sprintBankIds: [] },
    plan: {},
  },
});
assert.match(container.innerHTML, /今日學習/);
assert.match(container.innerHTML, /data-learning-hub-tab="overview"/);
assert.match(container.innerHTML, /今天先做什麼/);
assert.match(container.innerHTML, /今日總覽/);
assert.doesNotMatch(container.innerHTML, /data-learning-goal-form/);
assert.doesNotMatch(container.innerHTML, /data-exam-sprint-form/);

const main = fs.readFileSync('src/app/main.js', 'utf8');
const goalUi = fs.readFileSync('src/ui/learning-goals.js', 'utf8');
const goals = fs.readFileSync('src/storage/repositories/goals.js', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const index = fs.readFileSync('app.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const audit = fs.readFileSync('docs/V4_0_UX_DENSITY_AUDIT.md', 'utf8');

assert.match(main, /learningHubTab: 'overview'/);
assert.match(main, /EXAM_SPRINT_GOAL_ID/);
assert.match(main, /data-learning-hub-tab/);
assert.match(main, /data-exam-sprint-bank/);
assert.match(main, /sprintBankIds/);
assert.match(main, /collectSprintData\(sprintGoal\.sprintBankIds\)/);

assert.match(goalUi, /全部題庫（整體目標）/);
assert.match(goalUi, /optgroup label="單一題庫"/);
assert.match(goals, /sprintBankIds/);
assert.match(goals, /sprintDailyTarget/);

assert.match(v3, />今日學習<\/button>/);
assert.equal(index, v3);
assert.match(v3, /styles\/v4-learning-hub\.css/);
assert.match(sw, /\.\/styles\/v4-learning-hub\.css/);
assert.match(sw, /\.\/src\/ui\/learning-hub\.js/);
assert.match(audit, /學習統計/);
assert.match(audit, /題庫工作室/);
assert.match(audit, /設定/);

console.log('MoXin Quiz v4.0 P4.2 learning hub IA / scoped sprint tests passed.');

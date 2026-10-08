import assert from 'node:assert/strict';
import fs from 'node:fs';

import { renderLearningHubOverview } from '../src/ui/learning-hub.js';
import { renderReviewCenter } from '../src/ui/review-center.js';
import { renderExamSprintPanel } from '../src/ui/exam-sprint.js';

const overview = renderLearningHubOverview({
  groups: [],
  summaryModel: {
    progress: {
      streak: 5,
      today: {
        practiceGoal: { count: 12 },
        reviewGoal: { count: 4 },
        exam: 2,
      },
    },
  },
  goalModel: {
    banks: [{ id: 'erp', name: 'ERP 題庫' }],
    selectedScope: 'erp',
    goal: {
      enabled: true,
      dailyPracticeTarget: 5,
      dailyReviewTarget: 2,
    },
    progress: {
      today: {
        completionPercent: 43,
        practiceGoal: { count: 2, target: 5, active: true },
        reviewGoal: { count: 1, target: 2, active: true },
      },
    },
  },
  sprintModel: {
    goal: { sprintEnabled: false, sprintBankIds: [] },
    plan: {},
  },
});

assert.match(overview, /全站今日/);
assert.match(overview, /刷題 <strong>12<\/strong>/);
assert.match(overview, /複習 <strong>4<\/strong>/);
assert.match(overview, /模擬考 <strong>2<\/strong>/);
assert.match(overview, /連續 <strong>5 天<\/strong>/);
assert.match(overview, /43%/);
assert.match(overview, /目標範圍：ERP 題庫/);

const container = { innerHTML: '' };
renderReviewCenter(container, [], {
  activeTab: 'overview',
  summaryModel: {
    progress: {
      streak: 7,
      today: { practiceGoal: { count: 9 } },
    },
  },
  goalModel: {
    banks: [{ id: 'erp', name: 'ERP 題庫' }],
    selectedScope: 'erp',
    goal: { enabled: false },
    progress: {
      streak: 1,
      today: {
        practiceGoal: { count: 1 },
        reviewGoal: { count: 0 },
      },
    },
  },
  sprintModel: {
    goal: { sprintEnabled: false, sprintBankIds: [] },
    plan: {},
  },
});

assert.match(container.innerHTML, /全站刷題/);
assert.match(container.innerHTML, /<strong>9<\/strong>/);
assert.match(container.innerHTML, /全站連續/);
assert.match(container.innerHTML, /<strong>7<\/strong>/);

const manyBanks = Array.from({ length: 8 }, (_, index) => ({
  id: `bank-${index + 1}`,
  name: `題庫 ${index + 1}`,
}));

const sprintHtml = renderExamSprintPanel({
  banks: manyBanks,
  goal: { sprintBankIds: ['bank-1'], sprintEnabled: false },
  plan: {
    status: 'disabled',
    priorityCounts: {},
    selected: [],
  },
});

assert.match(sprintHtml, /data-exam-sprint-bank-search/);
assert.match(sprintHtml, /搜尋題庫名稱或 ID/);
assert.match(sprintHtml, /data-exam-sprint-bank-option/);
assert.match(sprintHtml, /data-sprint-bank-search-text/);

const main = fs.readFileSync('src/app/main.js', 'utf8');
const hubCss = fs.readFileSync('styles/v4-learning-hub.css', 'utf8');
const sprintCss = fs.readFileSync('styles/v4-exam-sprint.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(main, /learningHubModel: null/);
assert.match(main, /function renderLearningHubFromCache\(\)/);
assert.match(main, /summaryModel/);
assert.match(main, /data-exam-sprint-bank-search/);

const tabHandler = main.match(
  /const tab = event\.target\.closest\('\[data-learning-hub-tab\]'\);[\s\S]{0,320}/
)?.[0] || '';
assert.match(tabHandler, /if \(!renderLearningHubFromCache\(\)\) \{/);
assert.match(tabHandler, /await openReviewCenter\(\);/);
assert.ok(
  tabHandler.indexOf('renderLearningHubFromCache()') <
  tabHandler.indexOf('await openReviewCenter()'),
  'Hub tabs must try cached render before the fallback refresh',
);

assert.match(hubCss, /\.learning-hub-global-strip/);
assert.match(hubCss, /#reviewView \.learning-review-hero/);
assert.match(sprintCss, /\.exam-sprint-bank-search/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v(?:3-4\.\d+\.\d+|5)-[^']+'/);

console.log('MoXin Quiz v4.0 P4.2.1 Learning Hub refinement tests passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  GLOBAL_SCOPE,
  createLearningGoalSaveInput,
  learningGoalIdForScope,
  renderLearningGoalPanel,
} from '../src/ui/learning-goals.js';

assert.equal(learningGoalIdForScope('global'), 'global');
assert.equal(learningGoalIdForScope('bank-a'), 'bank:bank-a');

assert.deepEqual(
  createLearningGoalSaveInput({
    scope: 'bank-a',
    enabled: true,
    dailyPracticeTarget: '25.6',
    dailyReviewTarget: '-1',
  }),
  {
    id: 'bank:bank-a',
    bankId: 'bank-a',
    enabled: true,
    dailyPracticeTarget: 26,
    dailyReviewTarget: 0,
  },
);

const html = renderLearningGoalPanel({
  banks: [
    { id: 'bank-a', name: 'Bank A' },
    { id: 'bank-b', name: 'Bank B' },
  ],
  selectedScope: GLOBAL_SCOPE,
  configured: true,
  goal: {
    id: 'global',
    bankId: null,
    enabled: true,
    dailyPracticeTarget: 20,
    dailyReviewTarget: 10,
  },
  progress: {
    streak: 4,
    recentAchievedDays: 3,
    today: {
      completionPercent: 75,
      achieved: false,
      practiceGoal: {
        count: 20,
        target: 20,
        active: true,
        complete: true,
        percent: 100,
        remaining: 0,
      },
      reviewGoal: {
        count: 5,
        target: 10,
        active: true,
        complete: false,
        percent: 50,
        remaining: 5,
      },
    },
    history: [
      { dateKey: '2026-09-26', active: false, achieved: false, answered: 0, completionPercent: 0 },
      { dateKey: '2026-09-27', active: true, achieved: true, answered: 10, completionPercent: 100 },
      { dateKey: '2026-09-28', active: true, achieved: false, answered: 8, completionPercent: 40 },
      { dateKey: '2026-09-29', active: true, achieved: true, answered: 12, completionPercent: 100 },
      { dateKey: '2026-09-30', active: false, achieved: false, answered: 0, completionPercent: 0 },
      { dateKey: '2026-10-01', active: true, achieved: true, answered: 9, completionPercent: 100 },
      { dateKey: '2026-10-02', active: true, achieved: false, answered: 25, completionPercent: 75 },
    ],
  },
});

assert.match(html, /P3 · 學習目標/);
assert.match(html, /今日整體進度/);
assert.match(html, /75%/);
assert.match(html, /連續學習/);
assert.match(html, /4 天/);
assert.match(html, /3 \/ 7/);
assert.match(html, /每日刷題/);
assert.match(html, /20 \/ 20/);
assert.match(html, /每日複習/);
assert.match(html, /5 \/ 10/);
assert.match(html, /還差 5 題/);
assert.match(html, /data-learning-goal-form/);
assert.match(html, /data-learning-goal-scope/);
assert.match(html, /Bank A/);
assert.match(html, /Bank B/);

const reviewSource = fs.readFileSync('src/ui/review-center.js', 'utf8');
const mainSource = fs.readFileSync('src/app/main.js', 'utf8');
const css = fs.readFileSync('styles/v4-learning-goals.css', 'utf8');
const htmlSource = fs.readFileSync('v3.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(reviewSource, /renderLearningGoalPanel/);
assert.match(reviewSource, /goalModel/);

assert.match(mainSource, /listLearningGoals/);
assert.match(mainSource, /saveLearningGoal/);
assert.match(mainSource, /listAllAttempts/);
assert.match(mainSource, /buildLearningGoalProgress/);
assert.match(mainSource, /learningGoalScope/);
assert.match(mainSource, /data-learning-goal-form/);
assert.match(mainSource, /data-learning-goal-scope/);
assert.match(mainSource, /createLearningGoalSaveInput/);

assert.match(css, /\.learning-goal-panel/);
assert.match(css, /\.learning-goal-dashboard/);
assert.match(css, /\.learning-goal-week/);
assert.match(css, /\.learning-goal-form/);
assert.match(css, /@media \(max-width: 520px\)/);

assert.match(htmlSource, /styles\/v4-learning-goals\.css/);
assert.match(sw, /\.\/styles\/v4-learning-goals\.css/);
assert.match(sw, /\.\/src\/ui\/learning-goals\.js/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v(?:3-4\.\d+\.\d+|5)-[^']+'/);

console.log('MoXin Quiz v4.0 P3.1 learning goal UI tests passed.');

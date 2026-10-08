import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildLearningGoalProgress } from '../src/learning/goal-progress.js';
import { buildLearningAnalytics } from '../src/learning/analytics.js';
import {
  buildBackupStatus,
  buildHomeDashboard,
} from '../src/learning/home-dashboard.js';
import { renderHomeDashboard } from '../src/ui/home-dashboard.js';
import { renderLearningHubOverview } from '../src/ui/learning-hub.js';
import { renderLearningStats } from '../src/ui/stats.js';

const NOW = new Date('2026-10-03T12:00:00.000Z');
const TZ = 'Asia/Taipei';

const banks = [
  { id: 'erp', name: 'ERP 題庫' },
  { id: 'math', name: '數學題庫' },
];

const globalGoal = {
  id: 'global',
  bankId: null,
  enabled: true,
  dailyPracticeTarget: 2,
  dailyReviewTarget: 1,
  updatedAt: '2026-10-03T01:00:00.000Z',
};

const bankGoal = {
  id: 'bank:erp',
  bankId: 'erp',
  enabled: true,
  dailyPracticeTarget: 1,
  dailyReviewTarget: 0,
  updatedAt: '2026-10-03T02:00:00.000Z',
};

const attempts = [
  {
    bankId: 'erp',
    questionId: 'Q1',
    timestamp: '2026-10-03T01:00:00.000Z',
    correct: true,
    mode: 'filtered',
  },
  {
    bankId: 'erp',
    questionId: 'Q2',
    timestamp: '2026-10-03T02:00:00.000Z',
    correct: false,
    mode: 'wrong',
  },
  {
    bankId: 'math',
    questionId: 'M1',
    timestamp: '2026-10-02T01:00:00.000Z',
    correct: true,
    mode: 'filtered',
  },
];

const questions = [
  { bankId: 'erp', questionId: 'Q1', id: 'Q1', type: 'single-choice', chapter: '第一章' },
  { bankId: 'erp', questionId: 'Q2', id: 'Q2', type: 'single-choice', chapter: '第一章' },
  { bankId: 'math', questionId: 'M1', id: 'M1', type: 'fill-in', chapter: '基礎' },
];

// 1. Home goal progress must be the same P3 engine result.
{
  const expected = buildLearningGoalProgress(globalGoal, attempts, {
    now: NOW,
    timeZone: TZ,
    historyDays: 7,
  });

  const home = buildHomeDashboard({
    banks,
    goals: [bankGoal, globalGoal],
    attempts,
    summaries: [],
    now: NOW,
    timeZone: TZ,
  });

  assert.equal(home.goal.scopeLabel, '全部題庫');
  assert.equal(home.goal.percent, expected.today.completionPercent);
  assert.equal(home.goal.practice.count, expected.today.practiceGoal.count);
  assert.equal(home.goal.review.count, expected.today.reviewGoal.count);
}

// 2. Home streak is always Global and not the currently selected P3 bank scope.
{
  const home = buildHomeDashboard({
    banks,
    goals: [bankGoal],
    attempts,
    summaries: [],
    now: NOW,
    timeZone: TZ,
  });

  const global = buildLearningGoalProgress({
    id: 'audit-global',
    bankId: null,
    enabled: false,
  }, attempts, {
    now: NOW,
    timeZone: TZ,
    historyDays: 7,
  });

  assert.equal(home.streak.days, global.streak);
  assert.equal(home.streak.todayAnswered, global.today.answered);
}

// 3. Home review totals keep the same semantics as Learning Hub summary groups.
{
  const summaries = [
    { bank: banks[0], due: 3, wrong: 5 },
    { bank: banks[1], due: 1, wrong: 2 },
  ];

  const home = buildHomeDashboard({
    banks,
    goals: [],
    attempts,
    summaries,
    now: NOW,
    timeZone: TZ,
  });

  assert.equal(home.review.dueTotal, 4);
  assert.equal(home.review.wrongTotal, 7);
  assert.equal(home.review.wrongBankId, 'erp');
}

// 4. P5 analytics intentionally counts attempts, while P3/Home daily activity dedupes by question.
{
  const retryAttempts = [
    ...attempts,
    {
      bankId: 'erp',
      questionId: 'Q1',
      timestamp: '2026-10-03T03:00:00.000Z',
      correct: false,
      mode: 'filtered',
    },
  ];

  const analytics = buildLearningAnalytics({
    attempts: retryAttempts,
    questions,
  }, {
    now: NOW,
    timeZone: TZ,
  });

  const global = buildLearningGoalProgress({
    id: 'audit-global',
    bankId: null,
    enabled: false,
  }, retryAttempts, {
    now: NOW,
    timeZone: TZ,
    historyDays: 7,
  });

  assert.equal(analytics.overall.attempts, 4);
  assert.equal(global.today.answered, 2);
}

// 5. Learning Hub overview keeps Global summary separate from bank-goal scope.
{
  const html = renderLearningHubOverview({
    groups: [],
    summaryModel: {
      progress: {
        streak: 2,
        today: {
          practiceGoal: { count: 9 },
          reviewGoal: { count: 4 },
          exam: 1,
        },
      },
    },
    goalModel: {
      banks,
      selectedScope: 'erp',
      goal: bankGoal,
      progress: {
        today: {
          completionPercent: 100,
          practiceGoal: { count: 1, target: 1, active: true },
          reviewGoal: { count: 0, target: 0, active: false },
        },
      },
    },
    sprintModel: {
      goal: { sprintEnabled: false, sprintBankIds: [] },
      plan: {},
    },
  });

  assert.match(html, /全站今日/);
  assert.match(html, /刷題 <strong>9<\/strong>/);
  assert.match(html, /目標範圍：ERP 題庫/);
}

// 6. Stats can render empty data without creating a long-page failure state.
{
  const emptyAnalytics = buildLearningAnalytics({}, {
    now: NOW,
    timeZone: TZ,
  });

  const container = { innerHTML: '' };
  renderLearningStats(container, {
    activeTab: 'overview',
    scope: 'global',
    windowDays: 7,
    overall: {
      attempts: 0,
      accuracy: 0,
      answeredQuestions: 0,
      due: 0,
    },
    globalAnalytics: emptyAnalytics,
    analytics: emptyAnalytics,
    banks: [],
  });

  assert.match(container.innerHTML, /data-stats-tab="overview"/);
  assert.match(container.innerHTML, /最近 7 日/);
  assert.match(container.innerHTML, /資料不足/);
}

// 7. Home empty state remains actionable and does not fabricate progress.
{
  const home = buildHomeDashboard({
    banks: [],
    goals: [],
    attempts: [],
    summaries: [],
    now: NOW,
    timeZone: TZ,
  });

  const container = { innerHTML: '' };
  renderHomeDashboard(container, home);

  assert.match(container.innerHTML, /今日目標/);
  assert.match(container.innerHTML, /尚未設定/);
  assert.match(container.innerHTML, /目前沒有未完成練習/);
  assert.match(container.innerHTML, /尚未完整備份/);
}

// 8. Dynamic bank names in action-card notes must be escaped.
{
  const unsafeBank = {
    id: 'unsafe',
    name: '<img src=x onerror=alert(1)>',
  };

  const home = buildHomeDashboard({
    banks: [unsafeBank],
    goals: [],
    attempts: [],
    summaries: [
      { bank: unsafeBank, due: 0, wrong: 3 },
    ],
    now: NOW,
    timeZone: TZ,
  });

  const container = { innerHTML: '' };
  renderHomeDashboard(container, home);

  assert.doesNotMatch(container.innerHTML, /<img src=x/);
  assert.match(container.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
}

// 9. Backup stale boundary is explicit: 6 days fresh, 7 days stale.
{
  const now = new Date('2026-10-08T00:00:00.000Z');
  assert.equal(
    buildBackupStatus('2026-10-02T00:00:00.000Z', { now }).stale,
    false,
  );
  assert.equal(
    buildBackupStatus('2026-10-01T00:00:00.000Z', { now }).stale,
    true,
  );
}

// 10. Runtime integration contracts across Home / Stats / Learning Hub.
{
  const main = fs.readFileSync('src/app/main.js', 'utf8');
  assert.match(main, /refreshHomeDashboard/);
  assert.match(main, /renderLearningHubFromCache/);
  assert.match(main, /renderStatsFromCache/);
  assert.match(main, /data-home-resume-bank/);
  assert.match(main, /data-home-wrong-bank/);
  assert.match(main, /data-home-sprint/);
  assert.match(main, /data-stats-tab/);
  assert.match(main, /data-learning-hub-tab/);
}

// 11. Backup timestamp is written only from the full-backup export path.
{
  const p7 = fs.readFileSync('src/app/p7.js', 'utf8');
  const meta = fs.readFileSync('src/storage/backup-meta.js', 'utf8');

  assert.match(p7, /markFullBackupCompleted\(snapshot\.exportedAt \|\| new Date\(\)\)/);
  assert.match(meta, /moxin\.v4\.backup\.meta/);
  assert.match(meta, /lastFullBackupAt/);
}

// 12. Responsive contracts exist for all three P5-facing workspaces.
{
  const homeCss = fs.readFileSync('styles/v4-home.css', 'utf8');
  const statsCss = fs.readFileSync('styles/v4-stats.css', 'utf8');
  const hubCss = fs.readFileSync('styles/v4-learning-hub.css', 'utf8');

  assert.match(homeCss, /@media \(max-width: 980px\)/);
  assert.match(homeCss, /@media \(max-width: 620px\)/);
  assert.match(statsCss, /@media \(max-width: 980px\)/);
  assert.match(statsCss, /@media \(max-width: 820px\)/);
  assert.match(statsCss, /@media \(max-width: 620px\)/);
  assert.match(hubCss, /@media \(max-width: 620px\)/);
}

// 13. P5 styles rely on theme tokens instead of new fixed hex colors.
{
  const homeCss = fs.readFileSync('styles/v4-home.css', 'utf8');
  const statsCss = fs.readFileSync('styles/v4-stats.css', 'utf8');

  assert.doesNotMatch(homeCss, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(statsCss, /#[0-9a-fA-F]{3,8}\b/);
  assert.match(homeCss, /var\(--learn-/);
  assert.match(statsCss, /var\(--learn-/);
}

// 14. Offline App Shell contains every P5 runtime asset.
{
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  for (const asset of [
    './styles/v4-stats.css',
    './styles/v4-home.css',
    './src/learning/analytics.js',
    './src/learning/home-dashboard.js',
    './src/storage/backup-meta.js',
    './src/ui/stats.js',
    './src/ui/home-dashboard.js',
  ]) {
    assert.ok(sw.includes(`'${asset}'`), `APP_SHELL missing ${asset}`);
  }
  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v(?:3-4\.\d+\.\d+|5)-[^']+'/);
}

// 15. Release entries stay byte-for-byte identical.
{
  const index = fs.readFileSync('app.html', 'utf8');
  const v3 = fs.readFileSync('v3.html', 'utf8');
  assert.equal(index, v3);
}

// 16. Final audit is chained into npm test.
{
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts.test, /v40-p5-final-audit-run\.mjs/);
}

console.log('MoXin Quiz v4.0 P5 final audit: 16 cross-page regression cases passed.');

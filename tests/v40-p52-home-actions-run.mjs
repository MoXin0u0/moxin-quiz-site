import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildBackupStatus,
  buildHomeDashboard,
  calendarDaysUntil,
  pickPrimaryHomeGoal,
} from '../src/learning/home-dashboard.js';
import { renderHomeDashboard } from '../src/ui/home-dashboard.js';

const banks = [
  { id: 'erp', name: 'ERP 題庫' },
  { id: 'math', name: '數學題庫' },
];

const attempts = [
  { bankId: 'erp', questionId: 'Q1', timestamp: '2026-10-03T01:00:00.000Z', mode: 'filtered' },
  { bankId: 'erp', questionId: 'Q2', timestamp: '2026-10-03T02:00:00.000Z', mode: 'wrong' },
  { bankId: 'math', questionId: 'M1', timestamp: '2026-10-02T01:00:00.000Z', mode: 'filtered' },
];

const goals = [
  {
    id: 'bank:erp',
    bankId: 'erp',
    enabled: true,
    dailyPracticeTarget: 10,
    dailyReviewTarget: 2,
    updatedAt: '2026-10-02T00:00:00.000Z',
  },
  {
    id: 'global',
    bankId: null,
    enabled: true,
    dailyPracticeTarget: 20,
    dailyReviewTarget: 5,
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'exam-sprint',
    bankId: null,
    sprintEnabled: true,
    examLabel: '期中考',
    examDate: '2026-10-10',
    sprintBankIds: ['erp', 'math'],
  },
];

assert.equal(
  pickPrimaryHomeGoal(goals, new Set(['erp', 'math'])).id,
  'global',
);

assert.equal(
  calendarDaysUntil('2026-10-10', {
    now: new Date('2026-10-03T04:00:00.000Z'),
    timeZone: 'Asia/Taipei',
  }),
  7,
);

assert.equal(
  buildBackupStatus(null, {
    now: new Date('2026-10-03T12:00:00.000Z'),
  }).status,
  'never',
);

assert.equal(
  buildBackupStatus('2026-10-02T12:00:00.000Z', {
    now: new Date('2026-10-03T12:00:00.000Z'),
  }).status,
  'fresh',
);

assert.equal(
  buildBackupStatus('2026-09-20T12:00:00.000Z', {
    now: new Date('2026-10-03T12:00:00.000Z'),
  }).status,
  'stale',
);

const model = buildHomeDashboard({
  banks,
  goals,
  attempts,
  summaries: [
    { bank: banks[0], due: 3, wrong: 5 },
    { bank: banks[1], due: 1, wrong: 2 },
  ],
  resumeSession: {
    bankId: 'erp',
    sourceQuestionIds: ['Q1', 'Q2', 'Q3', 'Q4'],
    completedIds: ['Q1'],
    updatedAt: '2026-10-03T05:00:00.000Z',
  },
  lastBackupAt: '2026-09-20T12:00:00.000Z',
  now: new Date('2026-10-03T12:00:00.000Z'),
  timeZone: 'Asia/Taipei',
});

assert.equal(model.goal.configured, true);
assert.equal(model.goal.scopeLabel, '全部題庫');
assert.equal(model.streak.days, 2);
assert.equal(model.resume.bankId, 'erp');
assert.equal(model.resume.remaining, 3);
assert.equal(model.review.dueTotal, 4);
assert.equal(model.review.wrongTotal, 7);
assert.equal(model.review.wrongBankId, 'erp');
assert.equal(model.sprint.configured, true);
assert.equal(model.sprint.bankCount, 2);
assert.equal(model.backup.stale, true);

const container = { innerHTML: '' };
renderHomeDashboard(container, model);
assert.match(container.innerHTML, /今日概況/);
assert.match(container.innerHTML, /今日目標/);
assert.match(container.innerHTML, /連續學習/);
assert.match(container.innerHTML, /繼續上次練習/);
assert.match(container.innerHTML, /data-home-resume-bank="erp"/);
assert.match(container.innerHTML, /data-home-review/);
assert.match(container.innerHTML, /data-home-wrong-bank="erp"/);
assert.match(container.innerHTML, /data-home-sprint/);
assert.match(container.innerHTML, /data-nav-settings/);
assert.match(container.innerHTML, /超過 7 天/);

const main = fs.readFileSync('src/app/main.js', 'utf8');
const p7 = fs.readFileSync('src/app/p7.js', 'utf8');
const sessions = fs.readFileSync('src/storage/repositories/sessions.js', 'utf8');
const index = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(main, /refreshHomeDashboard/);
assert.match(main, /getLatestUnfinishedPracticeSession/);
assert.match(main, /data-home-resume-bank/);
assert.match(main, /data-home-wrong-bank/);
assert.match(main, /data-home-sprint/);
assert.match(p7, /markFullBackupCompleted/);
assert.match(sessions, /getLatestUnfinishedPracticeSession/);
assert.equal(index, v3);
assert.match(index, /id="homeDashboardArea"/);
assert.match(index, /styles\/v4-home\.css/);
assert.match(sw, /\.\/styles\/v4-home\.css/);
assert.match(sw, /\.\/src\/learning\/home-dashboard\.js/);
assert.match(sw, /\.\/src\/ui\/home-dashboard\.js/);
assert.match(sw, /\.\/src\/storage\/backup-meta\.js/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);

console.log('MoXin Quiz v4.0 P5.2 home actions tests passed.');

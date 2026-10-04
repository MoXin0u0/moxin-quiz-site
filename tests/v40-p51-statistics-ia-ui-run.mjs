import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  STATS_TAB,
  normalizeStatsTab,
  renderLearningStats,
  renderStatsTabs,
} from '../src/ui/stats.js';

assert.equal(normalizeStatsTab('trends'), STATS_TAB.TRENDS);
assert.equal(normalizeStatsTab('unknown'), STATS_TAB.OVERVIEW);

const tabs = renderStatsTabs('weakness');
assert.match(tabs, /data-stats-tab="overview"/);
assert.match(tabs, /data-stats-tab="trends"/);
assert.match(tabs, /data-stats-tab="weakness"/);
assert.match(tabs, /data-stats-tab="banks"/);
assert.match(tabs, /stats-tab is-active/);

const mockAnalytics = {
  overall: {
    attempts: 20,
    correct: 14,
    wrong: 6,
    accuracy: 70,
    uniqueQuestions: 12,
  },
  recent7: {
    attempts: 9,
    accuracy: 67,
    activeDays: 4,
    uniqueQuestionTouches: 8,
  },
  recent30: {
    attempts: 20,
    accuracy: 70,
    activeDays: 9,
    uniqueQuestionTouches: 17,
  },
  history7: Array.from({ length: 7 }, (_, index) => ({
    dateKey: `2026-10-0${index + 1}`,
    attempts: index + 1,
    accuracy: 50 + index,
  })),
  history30: Array.from({ length: 30 }, (_, index) => ({
    dateKey: `2026-09-${String(index + 1).padStart(2, '0')}`,
    attempts: index % 4,
    accuracy: 60,
  })),
  typeAccuracy: [
    { key: 'single-choice', attempts: 10, wrong: 3, accuracy: 70 },
    { key: 'fill-in', attempts: 4, wrong: 2, accuracy: 50 },
  ],
  chapterAccuracy: [
    { key: '第一章', attempts: 8, wrong: 4, accuracy: 50 },
    { key: '第二章', attempts: 7, wrong: 1, accuracy: 86 },
  ],
  weakChapters: [
    { key: '第一章', attempts: 8, wrong: 4, accuracy: 50, provisional: false },
  ],
  dataQuality: {
    attemptsWithoutValidTimestamp: 0,
    attemptsWithoutQuestionMetadata: 0,
  },
};

const banks = [
  {
    bank: { id: 'erp', name: 'ERP 題庫' },
    questionCount: 20,
    attempts: 14,
    accuracy: 71,
    wrong: 3,
    due: 2,
    mastery: { new: 5, learning: 7, familiar: 5, mastered: 3 },
  },
];

const base = {
  overall: {
    attempts: 20,
    accuracy: 70,
    answeredQuestions: 12,
    due: 2,
  },
  globalAnalytics: mockAnalytics,
  analytics: mockAnalytics,
  banks,
  scope: 'global',
  windowDays: 7,
};

{
  const container = { innerHTML: '' };
  renderLearningStats(container, { ...base, activeTab: 'overview' });
  assert.match(container.innerHTML, /學習統計/);
  assert.match(container.innerHTML, /總覽/);
  assert.match(container.innerHTML, /最近 7 日/);
  assert.match(container.innerHTML, /stats-mini-trend/);
  assert.doesNotMatch(container.innerHTML, /data-stats-scope/);
}

{
  const container = { innerHTML: '' };
  renderLearningStats(container, { ...base, activeTab: 'trends' });
  assert.match(container.innerHTML, /data-stats-scope/);
  assert.match(container.innerHTML, /data-stats-window="7"/);
  assert.match(container.innerHTML, /data-stats-window="30"/);
  assert.match(container.innerHTML, /stats-bar-chart/);
  assert.match(container.innerHTML, /7 日正確率/);
}

{
  const container = { innerHTML: '' };
  renderLearningStats(container, { ...base, activeTab: 'weakness' });
  assert.match(container.innerHTML, /弱點章節/);
  assert.match(container.innerHTML, /題型表現/);
  assert.match(container.innerHTML, /單選題/);
  assert.match(container.innerHTML, /第一章/);
  assert.doesNotMatch(container.innerHTML, /learning-mastery-bar/);
}

{
  const container = { innerHTML: '' };
  renderLearningStats(container, { ...base, activeTab: 'banks' });
  assert.match(container.innerHTML, /逐題庫查看掌握狀態/);
  assert.match(container.innerHTML, /ERP 題庫/);
  assert.match(container.innerHTML, /learning-mastery-bar/);
  assert.match(container.innerHTML, /learning-bank-accuracy/);
  assert.match(container.innerHTML, /<strong>71%<\/strong>/);
}

const main = fs.readFileSync('src/app/main.js', 'utf8');
const index = fs.readFileSync('app.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const css = fs.readFileSync('styles/v4-stats.css', 'utf8');

assert.match(main, /buildLearningAnalytics/);
assert.match(main, /statsTab: 'overview'/);
assert.match(main, /statsScope: 'global'/);
assert.match(main, /statsWindowDays: 7/);
assert.match(main, /statsModel: null/);
assert.match(main, /function renderStatsFromCache\(\)/);
assert.match(main, /data-stats-tab/);
assert.match(main, /data-stats-window/);
assert.match(main, /data-stats-scope/);

const tabHandler = main.match(
  /const statsTab = event\.target\.closest\('\[data-stats-tab\]'\);[\s\S]{0,260}/
)?.[0] || '';
assert.match(tabHandler, /renderStatsFromCache/);
assert.doesNotMatch(tabHandler, /openStats/);

assert.equal(index, v3);
assert.match(index, /styles\/v4-stats\.css/);
assert.match(sw, /\.\/styles\/v4-stats\.css/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);
assert.match(css, /\.stats-tabs/);
assert.match(css, /\.stats-bar-chart/);
assert.match(css, /@media \(max-width: 620px\)/);

console.log('MoXin Quiz v4.0 P5.1 statistics IA/UI tests passed.');

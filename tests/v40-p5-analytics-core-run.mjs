import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ANALYTICS_REMOVED_QUESTION_CHAPTER,
  ANALYTICS_UNCATEGORIZED_CHAPTER,
  ANALYTICS_UNKNOWN_TYPE,
  buildDailySeries,
  buildLearningAnalytics,
  buildWeakChapterList,
  shiftDateKey,
} from '../src/learning/analytics.js';

const NOW = new Date('2026-10-03T12:00:00.000Z');
const TZ = 'Asia/Taipei';

function q(bankId, id, type, chapter) {
  return { bankId, questionId: id, id, type, chapter };
}
function a(bankId, id, timestamp, correct, mode = 'filtered') {
  return { bankId, questionId: id, timestamp, correct, mode };
}

const questions = [
  q('erp', 'Q1', 'single-choice', '第一章'),
  q('erp', 'Q2', 'multiple-choice', '第一章'),
  q('erp', 'Q3', 'true-false', '第二章'),
  q('erp', 'Q4', 'fill-in', ''),
  q('sample', 'Q1', 'single-choice', 'Sample'),
];

const attempts = [
  a('erp', 'Q1', '2026-10-03T01:00:00.000Z', true),
  a('erp', 'Q1', '2026-10-03T02:00:00.000Z', false),
  a('erp', 'Q2', '2026-10-02T02:00:00.000Z', false),
  a('erp', 'Q2', '2026-10-01T02:00:00.000Z', false),
  a('erp', 'Q3', '2026-09-30T02:00:00.000Z', true, 'exam'),
  a('erp', 'Q4', '2026-09-29T02:00:00.000Z', true),
  a('sample', 'Q1', '2026-10-03T03:00:00.000Z', true),
  a('erp', 'REMOVED', '2026-10-03T04:00:00.000Z', false),
  a('erp', 'Q1', 'not-a-date', true),
];

assert.equal(shiftDateKey('2026-10-03', -6), '2026-09-27');
assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');

{
  const series = buildDailySeries(attempts, {
    days: 7,
    todayKey: '2026-10-03',
    timeZone: TZ,
  });
  assert.equal(series.length, 7);
  assert.equal(series[0].dateKey, '2026-09-27');
  assert.equal(series[6].dateKey, '2026-10-03');
  assert.equal(series[6].attempts, 4);
  assert.equal(series[6].correct, 2);
  assert.equal(series[6].accuracy, 50);
}

{
  const analytics = buildLearningAnalytics({ attempts, questions }, { now: NOW, timeZone: TZ });
  assert.equal(analytics.overall.uniqueQuestions, 6);
  assert.equal(analytics.overall.attempts, 9);
  assert.equal(analytics.dataQuality.attemptsWithoutValidTimestamp, 1);
  assert.equal(analytics.history7.length, 7);
  assert.equal(analytics.history30.length, 30);
  assert.equal(analytics.recent7.attempts, 8);
  assert.equal(analytics.recent30.attempts, 8);
}

{
  const analytics = buildLearningAnalytics({ attempts, questions }, {
    bankId: 'erp',
    now: NOW,
    timeZone: TZ,
  });
  assert.equal(analytics.overall.attempts, 8);
  assert.equal(analytics.scope.bankId, 'erp');

  const byType = new Map(analytics.typeAccuracy.map(item => [item.key, item]));
  assert.equal(byType.get('single-choice').attempts, 3);
  assert.equal(byType.get('single-choice').accuracy, 67);
  assert.equal(byType.get('multiple-choice').accuracy, 0);
  assert.equal(byType.get('true-false').accuracy, 100);
  assert.equal(byType.get('fill-in').accuracy, 100);
  assert.equal(byType.get(ANALYTICS_UNKNOWN_TYPE).attempts, 1);

  const byChapter = new Map(analytics.chapterAccuracy.map(item => [item.key, item]));
  assert.equal(byChapter.get(ANALYTICS_UNCATEGORIZED_CHAPTER).attempts, 1);
  assert.equal(byChapter.get(ANALYTICS_REMOVED_QUESTION_CHAPTER).attempts, 1);
  assert.equal(analytics.dataQuality.attemptsWithoutQuestionMetadata, 1);
}

{
  const weak = buildWeakChapterList([
    { key: 'A', attempts: 10, correct: 4, wrong: 6, accuracy: 40 },
    { key: 'B', attempts: 8, correct: 2, wrong: 6, accuracy: 25 },
    { key: 'C', attempts: 1, correct: 0, wrong: 1, accuracy: 0 },
  ], { minAttempts: 3, limit: 5 });
  assert.deepEqual(weak.map(item => item.key), ['B', 'A']);
  assert.equal(weak[0].provisional, false);
}

{
  const weak = buildWeakChapterList([
    { key: 'A', attempts: 1, correct: 0, wrong: 1, accuracy: 0 },
    { key: 'B', attempts: 2, correct: 1, wrong: 1, accuracy: 50 },
  ], { minAttempts: 3 });
  assert.deepEqual(weak.map(item => item.key), ['A', 'B']);
  assert.ok(weak.every(item => item.provisional));
}

{
  const weak = buildWeakChapterList([
    { key: ANALYTICS_REMOVED_QUESTION_CHAPTER, attempts: 10, wrong: 10, accuracy: 0 },
    { key: '第一章', attempts: 4, wrong: 2, accuracy: 50 },
  ]);
  assert.deepEqual(weak.map(item => item.key), ['第一章']);
}

{
  const analytics = buildLearningAnalytics({
    questions: [q('erp', 'Q1', 'single-choice', 'A')],
    attempts: [a('erp', 'Q1', '2026-10-02T16:30:00.000Z', true)],
  }, {
    bankId: 'erp',
    now: new Date('2026-10-02T17:00:00.000Z'),
    timeZone: TZ,
  });
  assert.equal(analytics.todayKey, '2026-10-03');
  assert.equal(analytics.history7.at(-1).dateKey, '2026-10-03');
  assert.equal(analytics.history7.at(-1).attempts, 1);
}

{
  const analytics = buildLearningAnalytics({ attempts, questions }, {
    bankId: 'erp',
    now: NOW,
    timeZone: TZ,
  });
  const sep30 = analytics.history30.find(day => day.dateKey === '2026-09-30');
  assert.equal(sep30.attempts, 1);
  assert.equal(sep30.correct, 1);
}

{
  const analytics = buildLearningAnalytics({}, { now: NOW, timeZone: TZ });
  assert.equal(analytics.overall.attempts, 0);
  assert.equal(analytics.recent7.accuracy, 0);
  assert.equal(analytics.history7.length, 7);
  assert.deepEqual(analytics.typeAccuracy, []);
  assert.deepEqual(analytics.chapterAccuracy, []);
  assert.deepEqual(analytics.weakChapters, []);
}

{
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(sw, /\.\/src\/learning\/analytics\.js/);
  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);
}

console.log('MoXin Quiz v4.0 P5 analytics core: 16 regression cases passed.');

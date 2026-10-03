const CORE_CODE = "import { localDateKey } from './goal-progress.js';\n\nexport const ANALYTICS_WINDOW_DAYS = Object.freeze({\n  WEEK: 7,\n  MONTH: 30,\n});\n\nexport const ANALYTICS_UNKNOWN_TYPE = 'unknown';\nexport const ANALYTICS_UNCATEGORIZED_CHAPTER = '未分類';\nexport const ANALYTICS_REMOVED_QUESTION_CHAPTER = '已移除題目';\n\nconst TYPE_ORDER = Object.freeze([\n  'single-choice',\n  'multiple-choice',\n  'true-false',\n  'fill-in',\n  ANALYTICS_UNKNOWN_TYPE,\n]);\n\nexport function buildLearningAnalytics(data = {}, {\n  bankId = null,\n  now = new Date(),\n  timeZone = null,\n  weakMinAttempts = 3,\n  weakLimit = 5,\n} = {}) {\n  const questions = normalizeQuestions(data?.questions);\n  const questionMap = new Map(\n    questions.map(question => [\n      questionKey(question.bankId, question.questionId),\n      question,\n    ]),\n  );\n\n  const attempts = normalizeAttempts(data?.attempts)\n    .filter(attempt => !bankId || attempt.bankId === String(bankId));\n\n  const todayKey = localDateKey(now, { timeZone });\n  const history30 = buildDailySeries(attempts, {\n    days: ANALYTICS_WINDOW_DAYS.MONTH,\n    todayKey,\n    timeZone,\n  });\n  const history7 = history30.slice(-ANALYTICS_WINDOW_DAYS.WEEK);\n\n  const typeAccuracy = buildDimensionAccuracy(attempts, attempt => {\n    const question = questionMap.get(questionKey(attempt.bankId, attempt.questionId));\n    return normalizeType(question?.type);\n  }, TYPE_ORDER);\n\n  const chapterAccuracy = buildDimensionAccuracy(attempts, attempt => {\n    const question = questionMap.get(questionKey(attempt.bankId, attempt.questionId));\n    if (!question) return ANALYTICS_REMOVED_QUESTION_CHAPTER;\n    return normalizeChapter(question.chapter);\n  });\n\n  const weakChapters = buildWeakChapterList(chapterAccuracy, {\n    minAttempts: weakMinAttempts,\n    limit: weakLimit,\n  });\n\n  const validDateAttempts = attempts.filter(attempt =>\n    Boolean(toDateKey(attempt.timestamp, { timeZone })),\n  );\n\n  return {\n    scope: {\n      bankId: bankId ? String(bankId) : null,\n    },\n    todayKey,\n    overall: summarizeAttempts(attempts),\n    recent7: summarizeSeries(history7),\n    recent30: summarizeSeries(history30),\n    history7,\n    history30,\n    typeAccuracy,\n    chapterAccuracy,\n    weakChapters,\n    dataQuality: {\n      attemptsWithoutValidTimestamp: attempts.length - validDateAttempts.length,\n      attemptsWithoutQuestionMetadata: attempts.filter(attempt =>\n        !questionMap.has(questionKey(attempt.bankId, attempt.questionId)),\n      ).length,\n    },\n  };\n}\n\nexport function buildDailySeries(attempts = [], {\n  days = 7,\n  todayKey,\n  now = new Date(),\n  timeZone = null,\n} = {}) {\n  const windowDays = clampPositiveInteger(days, 1, 366);\n  const resolvedTodayKey = todayKey || localDateKey(now, { timeZone });\n  const startKey = shiftDateKey(resolvedTodayKey, -(windowDays - 1));\n  const buckets = new Map();\n\n  for (let index = 0; index < windowDays; index += 1) {\n    const dateKey = shiftDateKey(startKey, index);\n    buckets.set(dateKey, {\n      dateKey,\n      attempts: 0,\n      correct: 0,\n      wrong: 0,\n      accuracy: 0,\n      uniqueQuestions: 0,\n      active: false,\n      _questionKeys: new Set(),\n    });\n  }\n\n  for (const attempt of normalizeAttempts(attempts)) {\n    const dateKey = toDateKey(attempt.timestamp, { timeZone });\n    const bucket = dateKey ? buckets.get(dateKey) : null;\n    if (!bucket) continue;\n\n    bucket.attempts += 1;\n    if (attempt.correct) bucket.correct += 1;\n    else bucket.wrong += 1;\n    bucket._questionKeys.add(questionKey(attempt.bankId, attempt.questionId));\n  }\n\n  return [...buckets.values()].map(bucket => ({\n    dateKey: bucket.dateKey,\n    attempts: bucket.attempts,\n    correct: bucket.correct,\n    wrong: bucket.wrong,\n    accuracy: percent(bucket.correct, bucket.attempts),\n    uniqueQuestions: bucket._questionKeys.size,\n    active: bucket.attempts > 0,\n  }));\n}\n\nexport function buildDimensionAccuracy(attempts = [], keySelector, order = null) {\n  const buckets = new Map();\n\n  for (const attempt of normalizeAttempts(attempts)) {\n    const rawKey = keySelector?.(attempt);\n    const key = String(rawKey || ANALYTICS_UNKNOWN_TYPE).trim() || ANALYTICS_UNKNOWN_TYPE;\n\n    if (!buckets.has(key)) {\n      buckets.set(key, {\n        key,\n        attempts: 0,\n        correct: 0,\n        wrong: 0,\n        accuracy: 0,\n        uniqueQuestions: 0,\n        _questionKeys: new Set(),\n      });\n    }\n\n    const bucket = buckets.get(key);\n    bucket.attempts += 1;\n    if (attempt.correct) bucket.correct += 1;\n    else bucket.wrong += 1;\n    bucket._questionKeys.add(questionKey(attempt.bankId, attempt.questionId));\n  }\n\n  const results = [...buckets.values()].map(bucket => ({\n    key: bucket.key,\n    attempts: bucket.attempts,\n    correct: bucket.correct,\n    wrong: bucket.wrong,\n    accuracy: percent(bucket.correct, bucket.attempts),\n    uniqueQuestions: bucket._questionKeys.size,\n  }));\n\n  if (Array.isArray(order)) {\n    const rank = new Map(order.map((key, index) => [key, index]));\n    return results.sort((a, b) => {\n      const aRank = rank.has(a.key) ? rank.get(a.key) : order.length;\n      const bRank = rank.has(b.key) ? rank.get(b.key) : order.length;\n      return aRank - bRank || a.key.localeCompare(b.key);\n    });\n  }\n\n  return results.sort((a, b) =>\n    b.attempts - a.attempts ||\n    a.key.localeCompare(b.key),\n  );\n}\n\nexport function buildWeakChapterList(chapterAccuracy = [], {\n  minAttempts = 3,\n  limit = 5,\n} = {}) {\n  const normalizedMin = clampPositiveInteger(minAttempts, 1, 10000);\n  const normalizedLimit = clampPositiveInteger(limit, 1, 100);\n\n  const actionable = (Array.isArray(chapterAccuracy) ? chapterAccuracy : [])\n    .filter(item =>\n      item &&\n      item.key !== ANALYTICS_REMOVED_QUESTION_CHAPTER &&\n      Number(item.attempts || 0) > 0,\n    );\n\n  const eligible = actionable.filter(item =>\n    Number(item.attempts || 0) >= normalizedMin,\n  );\n\n  const source = eligible.length ? eligible : actionable;\n\n  return [...source]\n    .sort((a, b) =>\n      Number(a.accuracy || 0) - Number(b.accuracy || 0) ||\n      Number(b.wrong || 0) - Number(a.wrong || 0) ||\n      Number(b.attempts || 0) - Number(a.attempts || 0) ||\n      String(a.key).localeCompare(String(b.key)),\n    )\n    .slice(0, normalizedLimit)\n    .map(item => ({\n      ...item,\n      provisional: Number(item.attempts || 0) < normalizedMin,\n    }));\n}\n\nexport function summarizeAttempts(attempts = []) {\n  const normalized = normalizeAttempts(attempts);\n  const correct = normalized.filter(attempt => attempt.correct).length;\n  const unique = new Set(\n    normalized.map(attempt => questionKey(attempt.bankId, attempt.questionId)),\n  );\n\n  return {\n    attempts: normalized.length,\n    correct,\n    wrong: normalized.length - correct,\n    accuracy: percent(correct, normalized.length),\n    uniqueQuestions: unique.size,\n  };\n}\n\nexport function summarizeSeries(series = []) {\n  const items = Array.isArray(series) ? series : [];\n  const attempts = items.reduce((sum, day) => sum + Number(day.attempts || 0), 0);\n  const correct = items.reduce((sum, day) => sum + Number(day.correct || 0), 0);\n  const wrong = items.reduce((sum, day) => sum + Number(day.wrong || 0), 0);\n\n  return {\n    attempts,\n    correct,\n    wrong,\n    accuracy: percent(correct, attempts),\n    activeDays: items.filter(day => day.active).length,\n    uniqueQuestionTouches: items.reduce(\n      (sum, day) => sum + Number(day.uniqueQuestions || 0),\n      0,\n    ),\n  };\n}\n\nexport function shiftDateKey(dateKey, offsetDays) {\n  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(dateKey || ''));\n  if (!match) return null;\n\n  const date = new Date(Date.UTC(\n    Number(match[1]),\n    Number(match[2]) - 1,\n    Number(match[3]),\n  ));\n\n  if (Number.isNaN(date.getTime())) return null;\n\n  date.setUTCDate(date.getUTCDate() + Number(offsetDays || 0));\n\n  return [\n    String(date.getUTCFullYear()).padStart(4, '0'),\n    String(date.getUTCMonth() + 1).padStart(2, '0'),\n    String(date.getUTCDate()).padStart(2, '0'),\n  ].join('-');\n}\n\nfunction normalizeQuestions(questions = []) {\n  return (Array.isArray(questions) ? questions : [])\n    .map(question => ({\n      ...question,\n      bankId: String(question?.bankId || ''),\n      questionId: String(question?.questionId || question?.id || ''),\n    }))\n    .filter(question => question.bankId && question.questionId);\n}\n\nfunction normalizeAttempts(attempts = []) {\n  return (Array.isArray(attempts) ? attempts : [])\n    .map(attempt => ({\n      ...attempt,\n      bankId: String(attempt?.bankId || ''),\n      questionId: String(attempt?.questionId || ''),\n      correct: attempt?.correct === true,\n    }))\n    .filter(attempt => attempt.bankId && attempt.questionId);\n}\n\nfunction normalizeType(type) {\n  const key = String(type || '').trim();\n  return TYPE_ORDER.includes(key) ? key : ANALYTICS_UNKNOWN_TYPE;\n}\n\nfunction normalizeChapter(chapter) {\n  const value = String(chapter || '').trim();\n  return value || ANALYTICS_UNCATEGORIZED_CHAPTER;\n}\n\nfunction toDateKey(timestamp, { timeZone = null } = {}) {\n  if (!timestamp) return null;\n  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);\n  if (Number.isNaN(date.getTime())) return null;\n  return localDateKey(date, { timeZone });\n}\n\nfunction questionKey(bankId, questionId) {\n  return `${String(bankId)}\\u0000${String(questionId)}`;\n}\n\nfunction percent(correct, total) {\n  const denominator = Number(total) || 0;\n  if (denominator <= 0) return 0;\n  return Math.max(\n    0,\n    Math.min(100, Math.round((Number(correct || 0) / denominator) * 100)),\n  );\n}\n\nfunction clampPositiveInteger(value, min, max) {\n  const number = Number(value);\n  if (!Number.isFinite(number)) return min;\n  return Math.max(min, Math.min(max, Math.round(number)));\n}\n";
const TEST_CODE = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nimport {\n  ANALYTICS_REMOVED_QUESTION_CHAPTER,\n  ANALYTICS_UNCATEGORIZED_CHAPTER,\n  ANALYTICS_UNKNOWN_TYPE,\n  buildDailySeries,\n  buildLearningAnalytics,\n  buildWeakChapterList,\n  shiftDateKey,\n} from '../src/learning/analytics.js';\n\nconst NOW = new Date('2026-10-03T12:00:00.000Z');\nconst TZ = 'Asia/Taipei';\n\nfunction q(bankId, id, type, chapter) {\n  return { bankId, questionId: id, id, type, chapter };\n}\nfunction a(bankId, id, timestamp, correct, mode = 'filtered') {\n  return { bankId, questionId: id, timestamp, correct, mode };\n}\n\nconst questions = [\n  q('erp', 'Q1', 'single-choice', '第一章'),\n  q('erp', 'Q2', 'multiple-choice', '第一章'),\n  q('erp', 'Q3', 'true-false', '第二章'),\n  q('erp', 'Q4', 'fill-in', ''),\n  q('sample', 'Q1', 'single-choice', 'Sample'),\n];\n\nconst attempts = [\n  a('erp', 'Q1', '2026-10-03T01:00:00.000Z', true),\n  a('erp', 'Q1', '2026-10-03T02:00:00.000Z', false),\n  a('erp', 'Q2', '2026-10-02T02:00:00.000Z', false),\n  a('erp', 'Q2', '2026-10-01T02:00:00.000Z', false),\n  a('erp', 'Q3', '2026-09-30T02:00:00.000Z', true, 'exam'),\n  a('erp', 'Q4', '2026-09-29T02:00:00.000Z', true),\n  a('sample', 'Q1', '2026-10-03T03:00:00.000Z', true),\n  a('erp', 'REMOVED', '2026-10-03T04:00:00.000Z', false),\n  a('erp', 'Q1', 'not-a-date', true),\n];\n\nassert.equal(shiftDateKey('2026-10-03', -6), '2026-09-27');\nassert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');\n\n{\n  const series = buildDailySeries(attempts, {\n    days: 7,\n    todayKey: '2026-10-03',\n    timeZone: TZ,\n  });\n  assert.equal(series.length, 7);\n  assert.equal(series[0].dateKey, '2026-09-27');\n  assert.equal(series[6].dateKey, '2026-10-03');\n  assert.equal(series[6].attempts, 4);\n  assert.equal(series[6].correct, 2);\n  assert.equal(series[6].accuracy, 50);\n}\n\n{\n  const analytics = buildLearningAnalytics({ attempts, questions }, { now: NOW, timeZone: TZ });\n  assert.equal(analytics.overall.uniqueQuestions, 6);\n  assert.equal(analytics.overall.attempts, 9);\n  assert.equal(analytics.dataQuality.attemptsWithoutValidTimestamp, 1);\n  assert.equal(analytics.history7.length, 7);\n  assert.equal(analytics.history30.length, 30);\n  assert.equal(analytics.recent7.attempts, 8);\n  assert.equal(analytics.recent30.attempts, 8);\n}\n\n{\n  const analytics = buildLearningAnalytics({ attempts, questions }, {\n    bankId: 'erp',\n    now: NOW,\n    timeZone: TZ,\n  });\n  assert.equal(analytics.overall.attempts, 8);\n  assert.equal(analytics.scope.bankId, 'erp');\n\n  const byType = new Map(analytics.typeAccuracy.map(item => [item.key, item]));\n  assert.equal(byType.get('single-choice').attempts, 3);\n  assert.equal(byType.get('single-choice').accuracy, 67);\n  assert.equal(byType.get('multiple-choice').accuracy, 0);\n  assert.equal(byType.get('true-false').accuracy, 100);\n  assert.equal(byType.get('fill-in').accuracy, 100);\n  assert.equal(byType.get(ANALYTICS_UNKNOWN_TYPE).attempts, 1);\n\n  const byChapter = new Map(analytics.chapterAccuracy.map(item => [item.key, item]));\n  assert.equal(byChapter.get(ANALYTICS_UNCATEGORIZED_CHAPTER).attempts, 1);\n  assert.equal(byChapter.get(ANALYTICS_REMOVED_QUESTION_CHAPTER).attempts, 1);\n  assert.equal(analytics.dataQuality.attemptsWithoutQuestionMetadata, 1);\n}\n\n{\n  const weak = buildWeakChapterList([\n    { key: 'A', attempts: 10, correct: 4, wrong: 6, accuracy: 40 },\n    { key: 'B', attempts: 8, correct: 2, wrong: 6, accuracy: 25 },\n    { key: 'C', attempts: 1, correct: 0, wrong: 1, accuracy: 0 },\n  ], { minAttempts: 3, limit: 5 });\n  assert.deepEqual(weak.map(item => item.key), ['B', 'A']);\n  assert.equal(weak[0].provisional, false);\n}\n\n{\n  const weak = buildWeakChapterList([\n    { key: 'A', attempts: 1, correct: 0, wrong: 1, accuracy: 0 },\n    { key: 'B', attempts: 2, correct: 1, wrong: 1, accuracy: 50 },\n  ], { minAttempts: 3 });\n  assert.deepEqual(weak.map(item => item.key), ['A', 'B']);\n  assert.ok(weak.every(item => item.provisional));\n}\n\n{\n  const weak = buildWeakChapterList([\n    { key: ANALYTICS_REMOVED_QUESTION_CHAPTER, attempts: 10, wrong: 10, accuracy: 0 },\n    { key: '第一章', attempts: 4, wrong: 2, accuracy: 50 },\n  ]);\n  assert.deepEqual(weak.map(item => item.key), ['第一章']);\n}\n\n{\n  const analytics = buildLearningAnalytics({\n    questions: [q('erp', 'Q1', 'single-choice', 'A')],\n    attempts: [a('erp', 'Q1', '2026-10-02T16:30:00.000Z', true)],\n  }, {\n    bankId: 'erp',\n    now: new Date('2026-10-02T17:00:00.000Z'),\n    timeZone: TZ,\n  });\n  assert.equal(analytics.todayKey, '2026-10-03');\n  assert.equal(analytics.history7.at(-1).dateKey, '2026-10-03');\n  assert.equal(analytics.history7.at(-1).attempts, 1);\n}\n\n{\n  const analytics = buildLearningAnalytics({ attempts, questions }, {\n    bankId: 'erp',\n    now: NOW,\n    timeZone: TZ,\n  });\n  const sep30 = analytics.history30.find(day => day.dateKey === '2026-09-30');\n  assert.equal(sep30.attempts, 1);\n  assert.equal(sep30.correct, 1);\n}\n\n{\n  const analytics = buildLearningAnalytics({}, { now: NOW, timeZone: TZ });\n  assert.equal(analytics.overall.attempts, 0);\n  assert.equal(analytics.recent7.accuracy, 0);\n  assert.equal(analytics.history7.length, 7);\n  assert.deepEqual(analytics.typeAccuracy, []);\n  assert.deepEqual(analytics.chapterAccuracy, []);\n  assert.deepEqual(analytics.weakChapters, []);\n}\n\n{\n  const sw = fs.readFileSync('service-worker.js', 'utf8');\n  assert.match(sw, /\\.\\/src\\/learning\\/analytics\\.js/);\n  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-\\d+'/);\n}\n\nconsole.log('MoXin Quiz v4.0 P5 analytics core: 16 regression cases passed.');\n";
const DOC_CODE = "# 墨忻刷題網 v4.0 — P5 Analytics Core\n\n## Roadmap 對位\n\nP5「統計與首頁」先拆成 Core 與 UI，避免再次把大量功能直接堆進既有頁面。\n\n本階段 P5 Core 完成：\n\n- 7 日作答趨勢\n- 30 日作答趨勢\n- 7 / 30 日正確率\n- 題型正確率\n- 章節正確率\n- 弱點章節排序\n\nP5.1 再建立「學習統計」第二層：\n\n```text\n總覽 / 趨勢 / 弱點分析 / 題庫分析\n```\n\n首頁快捷入口、繼續上次練習與備份提醒另放 P5.2，避免一次改動過大。\n\n## 統計口徑\n\n### 作答趨勢\n\n趨勢統計的是 `attempts` 記錄，不做同題去重。\n\n因此：\n\n```text\n同一天 Q001 作答 3 次\n→ 作答趨勢 +3\n```\n\n這和 P3 每日目標的 unique-question 語義不同。\n\n### 正確率\n\n```text\ncorrect attempts / all attempts\n```\n\n一般練習、複習、考前衝刺與模擬考都屬於「實際作答」，因此 P5 的一般作答統計全部納入。\n\nP3 仍維持原規則：exam 不會灌入每日刷題 / 複習目標。\n\n## 日期\n\nP5 沿用 P3 的 `localDateKey()`。\n\n也就是：\n\n- Production：瀏覽器本機日期\n- Regression：可注入 IANA timezone\n\n因此 P3 與 P5 的「今天」不會使用不同日界線。\n\n## 題型統計\n\nAttempts 本身沒有保存題型，因此 P5 使用：\n\n```text\nbankId + questionId\n```\n\n回查目前本機 questions metadata。\n\n支援：\n\n- single-choice\n- multiple-choice\n- true-false\n- fill-in\n- unknown\n\n如果歷史 attempt 指向已不存在的題目，不會把該紀錄整筆丟掉；它會進 unknown。\n\n## 章節統計\n\n有 chapter：使用 chapter。\n\n題目存在但 chapter 為空：`未分類`。\n\n歷史 attempt 對應題目已刪除：`已移除題目`。\n\n「已移除題目」保留在統計資料品質中，但不會被當成可行動的弱點章節。\n\n## 弱點章節\n\n預設至少 3 次作答才進正式弱點排名。\n\n排序：\n\n1. 正確率低\n2. 錯誤次數高\n3. 作答次數高\n4. 章節名稱\n\n如果所有章節都不足 3 次作答，仍提供 provisional 排名，UI 必須標示「樣本較少」，避免把 1 題答錯誤解成確定弱點。\n\n## Global / Bank Scope\n\nCore 支援：\n\n```text\nbankId = null → 全站\nbankId = ERP  → 指定題庫\n```\n\nP5.1 題庫分析可以直接共用，不需要重寫統計公式。\n\n## Data Quality\n\n回傳：\n\n```text\nattemptsWithoutValidTimestamp\nattemptsWithoutQuestionMetadata\n```\n\n避免舊資料或刪題造成統計 silently drop。\n\n## 下一階段\n\nP5.1 — Statistics IA & UI\n\n```text\n總覽\n趨勢\n弱點分析\n題庫分析\n```\n\nP5.2 — Home Actions\n\n- 今日目標達成率\n- 連續學習\n- 繼續上次練習\n- 今日複習\n- 快速錯題\n- 考前衝刺\n- 最近備份與提醒\n";

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
}
function replaceOne(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error('Missing patch anchor: ' + label);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error('Patch anchor is not unique: ' + label);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

write('src/learning/analytics.js', CORE_CODE);
write('tests/v40-p5-analytics-core-run.mjs', TEST_CODE);
write('docs/V4_0_P5_ANALYTICS_CORE.md', DOC_CODE);

{
  const path = 'service-worker.js';
  let sw = read(path);

  if (!sw.includes("'./src/learning/analytics.js'")) {
    sw = replaceOne(
      sw,
      "  './src/learning/exam-sprint.js',",
      "  './src/learning/exam-sprint.js',\n  './src/learning/analytics.js',",
      'P5 analytics APP_SHELL',
    );
  }

  sw = replaceOne(
    sw,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-14';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-15';",
    'P5 analytics cache revision',
  );

  write(path, sw);
}

{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const anchor =
    'node tests/v40-p421-learning-hub-refinement-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const replacement =
    'node tests/v40-p421-learning-hub-refinement-run.mjs && node tests/v40-p5-analytics-core-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';

  if (!pkg.scripts.test.includes('v40-p5-analytics-core-run.mjs')) {
    if (!pkg.scripts.test.includes(anchor)) {
      throw new Error('package.json P5 analytics insertion anchor not found');
    }
    pkg.scripts.test = pkg.scripts.test.replace(anchor, replacement);
  }

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);

  if (!changelog.includes('## P5 — Analytics Core')) {
    const anchor = '## P4.2.1 — Learning Hub Refinement';
    const section =
      '## P5 — Analytics Core\n' +
      '- 正式進入 v4.0 統計與首頁主線，先完成統計 Core，再接分層 UI。\n' +
      '- 新增 7 / 30 日作答趨勢與正確率。\n' +
      '- 新增題型正確率、章節正確率與弱點章節排序。\n' +
      '- 趨勢採 attempt 次數；與 P3 unique-question 每日目標語義明確分離。\n' +
      '- 題型 / 章節由 bankId + questionId 回查目前題目 metadata；刪題歷史不 silent drop。\n' +
      '- 弱點章節預設至少 3 次作答；樣本不足時回傳 provisional 結果。\n' +
      '- Global / Bank scope 共用同一套 Core；日期沿用 P3 localDateKey。\n' +
      '- 新增 16 組 regression；analytics engine 加入 APP_SHELL。\n' +
      '- APP cache 更新至 r2k.5-15。\n\n';

    if (!changelog.includes(anchor)) {
      throw new Error('P4.2.1 changelog anchor missing');
    }
    changelog = changelog.replace(anchor, section + anchor);
  }

  write(path, changelog);
}

{
  const core = read('src/learning/analytics.js');
  const sw = read('service-worker.js');
  const pkg = JSON.parse(read('package.json'));

  for (const marker of [
    'buildLearningAnalytics',
    'history7',
    'history30',
    'typeAccuracy',
    'chapterAccuracy',
    'weakChapters',
    'attemptsWithoutQuestionMetadata',
  ]) {
    if (!core.includes(marker)) {
      throw new Error('P5 analytics self-check failed: ' + marker);
    }
  }

  if (!sw.includes("'./src/learning/analytics.js'")) {
    throw new Error('P5 analytics missing from APP_SHELL');
  }
  if (!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-15'")) {
    throw new Error('P5 analytics cache revision missing');
  }
  if (!pkg.scripts.test.includes('v40-p5-analytics-core-run.mjs')) {
    throw new Error('P5 analytics regression missing from package.json');
  }
  if (read('index.html') !== read('v3.html')) {
    throw new Error('P5 analytics release entries diverged');
  }
}

console.log('P5 Analytics Core patch applied successfully.');

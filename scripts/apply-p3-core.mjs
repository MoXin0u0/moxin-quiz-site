import fs from 'node:fs';

const ENGINE = "export const LEARNING_ATTEMPT_KIND = Object.freeze({\n  PRACTICE: 'practice',\n  REVIEW: 'review',\n  EXAM: 'exam',\n});\n\nconst REVIEW_MODES = new Set([\n  'review',\n  'due',\n  'wrong',\n  'unfamiliar',\n  'favorite',\n  'scheduled-review',\n]);\n\nexport function classifyLearningAttempt(attempt = {}) {\n  const mode = String(attempt?.mode || '').trim().toLowerCase();\n\n  if (mode === 'exam' || mode.startsWith('exam:')) {\n    return LEARNING_ATTEMPT_KIND.EXAM;\n  }\n\n  if (REVIEW_MODES.has(mode) || mode.startsWith('review:')) {\n    return LEARNING_ATTEMPT_KIND.REVIEW;\n  }\n\n  return LEARNING_ATTEMPT_KIND.PRACTICE;\n}\n\nexport function localDateKey(value = new Date(), { timeZone = null } = {}) {\n  const date = value instanceof Date ? value : new Date(value);\n  if (Number.isNaN(date.getTime())) return null;\n\n  if (timeZone) {\n    try {\n      const parts = new Intl.DateTimeFormat('en-US', {\n        timeZone,\n        year: 'numeric',\n        month: '2-digit',\n        day: '2-digit',\n      }).formatToParts(date);\n\n      const map = Object.fromEntries(\n        parts\n          .filter(part => part.type !== 'literal')\n          .map(part => [part.type, part.value]),\n      );\n\n      if (map.year && map.month && map.day) {\n        return `${map.year}-${map.month}-${map.day}`;\n      }\n    } catch {\n      // Fall through to runtime-local date when an invalid/unsupported zone is supplied.\n    }\n  }\n\n  return [\n    String(date.getFullYear()).padStart(4, '0'),\n    String(date.getMonth() + 1).padStart(2, '0'),\n    String(date.getDate()).padStart(2, '0'),\n  ].join('-');\n}\n\nexport function shiftDateKey(dateKey, deltaDays) {\n  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(dateKey || ''));\n  if (!match) return null;\n\n  const date = new Date(Date.UTC(\n    Number(match[1]),\n    Number(match[2]) - 1,\n    Number(match[3]) + Number(deltaDays || 0),\n  ));\n\n  if (Number.isNaN(date.getTime())) return null;\n\n  return [\n    String(date.getUTCFullYear()).padStart(4, '0'),\n    String(date.getUTCMonth() + 1).padStart(2, '0'),\n    String(date.getUTCDate()).padStart(2, '0'),\n  ].join('-');\n}\n\nexport function buildDailyLearningActivity(attempts = [], {\n  now = new Date(),\n  days = 7,\n  timeZone = null,\n  bankId = null,\n} = {}) {\n  const normalizedDays = Math.max(1, Math.min(3660, Math.round(Number(days) || 7)));\n  const todayKey = localDateKey(now, { timeZone });\n  if (!todayKey) return [];\n\n  const keys = [];\n  for (let offset = normalizedDays - 1; offset >= 0; offset -= 1) {\n    keys.push(shiftDateKey(todayKey, -offset));\n  }\n\n  const requested = new Set(keys);\n  const buckets = new Map(keys.map(key => [key, createBucket(key)]));\n  const scopedBankId = bankId ? String(bankId) : null;\n\n  for (const attempt of Array.isArray(attempts) ? attempts : []) {\n    if (!attempt || !attempt.timestamp) continue;\n    if (scopedBankId && String(attempt.bankId || '') !== scopedBankId) continue;\n\n    const dateKey = localDateKey(attempt.timestamp, { timeZone });\n    if (!dateKey || !requested.has(dateKey)) continue;\n\n    const bucket = buckets.get(dateKey);\n    const kind = classifyLearningAttempt(attempt);\n    const questionKey = learningAttemptQuestionKey(attempt);\n\n    bucket.attempts += 1;\n    bucket.active = true;\n    bucket.all.add(questionKey);\n\n    if (kind === LEARNING_ATTEMPT_KIND.EXAM) {\n      bucket.exam.add(questionKey);\n    } else if (kind === LEARNING_ATTEMPT_KIND.REVIEW) {\n      bucket.review.add(questionKey);\n    } else {\n      bucket.practice.add(questionKey);\n    }\n  }\n\n  return keys.map(key => finalizeBucket(buckets.get(key)));\n}\n\nexport function calculateLearningStreak(attempts = [], {\n  now = new Date(),\n  timeZone = null,\n  bankId = null,\n} = {}) {\n  const todayKey = localDateKey(now, { timeZone });\n  if (!todayKey) return 0;\n\n  const scopedBankId = bankId ? String(bankId) : null;\n  const activeDays = new Set();\n\n  for (const attempt of Array.isArray(attempts) ? attempts : []) {\n    if (!attempt?.timestamp) continue;\n    if (scopedBankId && String(attempt.bankId || '') !== scopedBankId) continue;\n\n    const key = localDateKey(attempt.timestamp, { timeZone });\n    if (key && key <= todayKey) activeDays.add(key);\n  }\n\n  let cursor = todayKey;\n\n  // A streak is still alive during a not-yet-finished current day.\n  if (!activeDays.has(cursor)) {\n    const yesterday = shiftDateKey(cursor, -1);\n    if (!yesterday || !activeDays.has(yesterday)) return 0;\n    cursor = yesterday;\n  }\n\n  let streak = 0;\n  while (cursor && activeDays.has(cursor)) {\n    streak += 1;\n    cursor = shiftDateKey(cursor, -1);\n  }\n\n  return streak;\n}\n\nexport function buildLearningGoalProgress(goal = {}, attempts = [], {\n  now = new Date(),\n  timeZone = null,\n  historyDays = 7,\n} = {}) {\n  const scopedBankId = goal?.bankId ? String(goal.bankId) : null;\n  const daily = buildDailyLearningActivity(attempts, {\n    now,\n    days: historyDays,\n    timeZone,\n    bankId: scopedBankId,\n  });\n\n  const practiceTarget = clampTarget(goal?.dailyPracticeTarget);\n  const reviewTarget = clampTarget(goal?.dailyReviewTarget);\n  const enabled = goal?.enabled === true;\n  const targetTotal = practiceTarget + reviewTarget;\n\n  const history = daily.map(day => {\n    const practice = buildMetric(day.practice, practiceTarget);\n    const review = buildMetric(day.review, reviewTarget);\n    const achieved = enabled && targetTotal > 0 &&\n      (!practice.active || practice.complete) &&\n      (!review.active || review.complete);\n\n    return {\n      ...day,\n      practiceGoal: practice,\n      reviewGoal: review,\n      achieved,\n      completionPercent: combinedPercent(practice, review),\n    };\n  });\n\n  const today = history[history.length - 1] || {\n    dateKey: localDateKey(now, { timeZone }),\n    practice: 0,\n    review: 0,\n    exam: 0,\n    answered: 0,\n    attempts: 0,\n    active: false,\n    practiceGoal: buildMetric(0, practiceTarget),\n    reviewGoal: buildMetric(0, reviewTarget),\n    achieved: false,\n    completionPercent: 0,\n  };\n\n  return {\n    goalId: String(goal?.id || 'global'),\n    bankId: scopedBankId,\n    enabled,\n    activeTargetCount: Number(practiceTarget > 0) + Number(reviewTarget > 0),\n    today,\n    history,\n    streak: calculateLearningStreak(attempts, {\n      now,\n      timeZone,\n      bankId: scopedBankId,\n    }),\n    recentAchievedDays: history.filter(day => day.achieved).length,\n  };\n}\n\nexport function countRecentActiveDays(attempts = [], {\n  now = new Date(),\n  days = 7,\n  timeZone = null,\n  bankId = null,\n} = {}) {\n  return buildDailyLearningActivity(attempts, {\n    now,\n    days,\n    timeZone,\n    bankId,\n  }).filter(day => day.active).length;\n}\n\nfunction createBucket(dateKey) {\n  return {\n    dateKey,\n    practice: new Set(),\n    review: new Set(),\n    exam: new Set(),\n    all: new Set(),\n    attempts: 0,\n    active: false,\n  };\n}\n\nfunction finalizeBucket(bucket) {\n  return {\n    dateKey: bucket.dateKey,\n    practice: bucket.practice.size,\n    review: bucket.review.size,\n    exam: bucket.exam.size,\n    answered: bucket.all.size,\n    attempts: bucket.attempts,\n    active: bucket.active,\n  };\n}\n\nfunction learningAttemptQuestionKey(attempt) {\n  const bank = String(attempt?.bankId || '');\n  const question = String(attempt?.questionId || '');\n\n  if (bank || question) return `${bank}\\u0000${question}`;\n\n  const id = attempt?.id;\n  return id === undefined || id === null\n    ? `anonymous:${String(attempt?.timestamp || '')}:${String(attempt?.mode || '')}`\n    : `attempt:${String(id)}`;\n}\n\nfunction clampTarget(value) {\n  const number = Number(value);\n  if (!Number.isFinite(number)) return 0;\n  return Math.max(0, Math.min(10000, Math.round(number)));\n}\n\nfunction buildMetric(count, target) {\n  const normalizedCount = Math.max(0, Math.round(Number(count) || 0));\n  const active = target > 0;\n  const complete = active ? normalizedCount >= target : true;\n  const percent = active\n    ? Math.min(100, Math.round((normalizedCount / target) * 100))\n    : 0;\n\n  return {\n    count: normalizedCount,\n    target,\n    active,\n    complete,\n    percent,\n    remaining: active ? Math.max(0, target - normalizedCount) : 0,\n  };\n}\n\nfunction combinedPercent(practice, review) {\n  const target = (practice.active ? practice.target : 0) +\n    (review.active ? review.target : 0);\n  if (!target) return 0;\n\n  const completed =\n    (practice.active ? Math.min(practice.count, practice.target) : 0) +\n    (review.active ? Math.min(review.count, review.target) : 0);\n\n  return Math.min(100, Math.round((completed / target) * 100));\n}\n";
const TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nimport {\n  LEARNING_ATTEMPT_KIND,\n  buildDailyLearningActivity,\n  buildLearningGoalProgress,\n  calculateLearningStreak,\n  classifyLearningAttempt,\n  countRecentActiveDays,\n  localDateKey,\n  shiftDateKey,\n} from '../src/learning/goal-progress.js';\n\nconst TZ = 'Asia/Taipei';\n\nfunction attempt(timestamp, {\n  bankId = 'bank-a',\n  questionId = 'Q001',\n  mode = 'filtered',\n  id = null,\n} = {}) {\n  return {\n    id,\n    bankId,\n    questionId,\n    timestamp,\n    mode,\n  };\n}\n\n// 1. Attempt mode classification.\nassert.equal(classifyLearningAttempt({ mode: 'filtered' }), LEARNING_ATTEMPT_KIND.PRACTICE);\nassert.equal(classifyLearningAttempt({ mode: 'due' }), LEARNING_ATTEMPT_KIND.REVIEW);\nassert.equal(classifyLearningAttempt({ mode: 'wrong' }), LEARNING_ATTEMPT_KIND.REVIEW);\nassert.equal(classifyLearningAttempt({ mode: 'unfamiliar' }), LEARNING_ATTEMPT_KIND.REVIEW);\nassert.equal(classifyLearningAttempt({ mode: 'favorite' }), LEARNING_ATTEMPT_KIND.REVIEW);\nassert.equal(classifyLearningAttempt({ mode: 'review:custom' }), LEARNING_ATTEMPT_KIND.REVIEW);\nassert.equal(classifyLearningAttempt({ mode: 'exam' }), LEARNING_ATTEMPT_KIND.EXAM);\n\n// 2. Unknown / legacy modes count as normal practice.\nassert.equal(classifyLearningAttempt({ mode: '' }), LEARNING_ATTEMPT_KIND.PRACTICE);\nassert.equal(classifyLearningAttempt({}), LEARNING_ATTEMPT_KIND.PRACTICE);\n\n// 3. Local date is based on the user's timezone, not UTC calendar date.\nassert.equal(\n  localDateKey('2026-10-01T16:30:00.000Z', { timeZone: TZ }),\n  '2026-10-02',\n);\n\n// 4. Date key shifting is calendar-safe.\nassert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');\nassert.equal(shiftDateKey('2024-03-01', -1), '2024-02-29');\n\n// 5. Wrong retry of the same normal-practice question counts as one daily practice question.\n{\n  const rows = [\n    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001', mode: 'filtered' }),\n    attempt('2026-10-02T01:01:00.000Z', { questionId: 'Q001', mode: 'filtered' }),\n    attempt('2026-10-02T01:02:00.000Z', { questionId: 'Q002', mode: 'filtered' }),\n  ];\n  const day = buildDailyLearningActivity(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    days: 1,\n    timeZone: TZ,\n  })[0];\n\n  assert.equal(day.practice, 2);\n  assert.equal(day.attempts, 3);\n  assert.equal(day.answered, 2);\n}\n\n// 6. Review modes count toward review, not daily practice.\n{\n  const rows = [\n    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001', mode: 'due' }),\n    attempt('2026-10-02T01:01:00.000Z', { questionId: 'Q002', mode: 'wrong' }),\n    attempt('2026-10-02T01:02:00.000Z', { questionId: 'Q003', mode: 'favorite' }),\n  ];\n  const day = buildDailyLearningActivity(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    days: 1,\n    timeZone: TZ,\n  })[0];\n\n  assert.equal(day.practice, 0);\n  assert.equal(day.review, 3);\n}\n\n// 7. Exam questions do not inflate practice/review targets, but still mark the day active.\n{\n  const rows = [\n    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001', mode: 'exam' }),\n    attempt('2026-10-02T01:01:00.000Z', { questionId: 'Q002', mode: 'exam' }),\n  ];\n  const day = buildDailyLearningActivity(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    days: 1,\n    timeZone: TZ,\n  })[0];\n\n  assert.equal(day.practice, 0);\n  assert.equal(day.review, 0);\n  assert.equal(day.exam, 2);\n  assert.equal(day.active, true);\n}\n\n// 8. The same question can legitimately count once in practice and once in review.\n{\n  const rows = [\n    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001', mode: 'filtered' }),\n    attempt('2026-10-02T02:00:00.000Z', { questionId: 'Q001', mode: 'due' }),\n  ];\n  const day = buildDailyLearningActivity(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    days: 1,\n    timeZone: TZ,\n  })[0];\n\n  assert.equal(day.practice, 1);\n  assert.equal(day.review, 1);\n  assert.equal(day.answered, 1);\n}\n\n// 9. Bank-scoped activity excludes other banks even when question IDs match.\n{\n  const rows = [\n    attempt('2026-10-02T01:00:00.000Z', { bankId: 'bank-a', questionId: 'Q001' }),\n    attempt('2026-10-02T01:00:00.000Z', { bankId: 'bank-b', questionId: 'Q001' }),\n  ];\n  const day = buildDailyLearningActivity(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    days: 1,\n    timeZone: TZ,\n    bankId: 'bank-a',\n  })[0];\n\n  assert.equal(day.practice, 1);\n  assert.equal(day.answered, 1);\n}\n\n// 10. Global scope distinguishes identical question IDs from different banks.\n{\n  const rows = [\n    attempt('2026-10-02T01:00:00.000Z', { bankId: 'bank-a', questionId: 'Q001' }),\n    attempt('2026-10-02T01:00:00.000Z', { bankId: 'bank-b', questionId: 'Q001' }),\n  ];\n  const day = buildDailyLearningActivity(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    days: 1,\n    timeZone: TZ,\n  })[0];\n\n  assert.equal(day.practice, 2);\n}\n\n// 11. Goal progress reports independent practice/review completion.\n{\n  const rows = [\n    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001' }),\n    attempt('2026-10-02T01:05:00.000Z', { questionId: 'Q002' }),\n    attempt('2026-10-02T01:10:00.000Z', { questionId: 'Q003', mode: 'due' }),\n  ];\n  const progress = buildLearningGoalProgress({\n    id: 'global',\n    enabled: true,\n    dailyPracticeTarget: 2,\n    dailyReviewTarget: 2,\n  }, rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    timeZone: TZ,\n  });\n\n  assert.equal(progress.today.practiceGoal.count, 2);\n  assert.equal(progress.today.practiceGoal.complete, true);\n  assert.equal(progress.today.reviewGoal.count, 1);\n  assert.equal(progress.today.reviewGoal.complete, false);\n  assert.equal(progress.today.completionPercent, 75);\n  assert.equal(progress.today.achieved, false);\n}\n\n// 12. Goal achievement requires every configured target; zero targets are ignored.\n{\n  const rows = [\n    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001' }),\n    attempt('2026-10-02T01:05:00.000Z', { questionId: 'Q002' }),\n  ];\n  const progress = buildLearningGoalProgress({\n    enabled: true,\n    dailyPracticeTarget: 2,\n    dailyReviewTarget: 0,\n  }, rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    timeZone: TZ,\n  });\n\n  assert.equal(progress.activeTargetCount, 1);\n  assert.equal(progress.today.reviewGoal.active, false);\n  assert.equal(progress.today.achieved, true);\n  assert.equal(progress.today.completionPercent, 100);\n}\n\n// 13. An enabled goal with no configured targets is not considered achieved.\n{\n  const progress = buildLearningGoalProgress({\n    enabled: true,\n    dailyPracticeTarget: 0,\n    dailyReviewTarget: 0,\n  }, [], {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    timeZone: TZ,\n  });\n\n  assert.equal(progress.activeTargetCount, 0);\n  assert.equal(progress.today.achieved, false);\n  assert.equal(progress.today.completionPercent, 0);\n}\n\n// 14. Disabled goals still expose counts but never mark a day achieved.\n{\n  const rows = [\n    attempt('2026-10-02T01:00:00.000Z', { questionId: 'Q001' }),\n  ];\n  const progress = buildLearningGoalProgress({\n    enabled: false,\n    dailyPracticeTarget: 1,\n    dailyReviewTarget: 0,\n  }, rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    timeZone: TZ,\n  });\n\n  assert.equal(progress.today.practiceGoal.count, 1);\n  assert.equal(progress.today.achieved, false);\n}\n\n// 15. History is chronological and applies the current target to all seven days.\n{\n  const rows = [\n    attempt('2026-09-27T02:00:00.000Z', { questionId: 'Q001' }),\n    attempt('2026-10-02T02:00:00.000Z', { questionId: 'Q002' }),\n  ];\n  const progress = buildLearningGoalProgress({\n    enabled: true,\n    dailyPracticeTarget: 1,\n    dailyReviewTarget: 0,\n  }, rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    timeZone: TZ,\n    historyDays: 7,\n  });\n\n  assert.equal(progress.history.length, 7);\n  assert.equal(progress.history[0].dateKey, '2026-09-26');\n  assert.equal(progress.history[6].dateKey, '2026-10-02');\n  assert.equal(progress.history.find(day => day.dateKey === '2026-09-27').achieved, true);\n  assert.equal(progress.history.find(day => day.dateKey === '2026-10-02').achieved, true);\n  assert.equal(progress.recentAchievedDays, 2);\n}\n\n// 16. Current streak includes today when today has learning activity.\n{\n  const rows = [\n    attempt('2026-09-30T03:00:00.000Z'),\n    attempt('2026-10-01T03:00:00.000Z'),\n    attempt('2026-10-02T03:00:00.000Z'),\n  ];\n  assert.equal(calculateLearningStreak(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    timeZone: TZ,\n  }), 3);\n}\n\n// 17. Streak remains alive during an unfinished today when yesterday was active.\n{\n  const rows = [\n    attempt('2026-09-30T03:00:00.000Z'),\n    attempt('2026-10-01T03:00:00.000Z'),\n  ];\n  assert.equal(calculateLearningStreak(rows, {\n    now: new Date('2026-10-02T04:00:00.000Z'),\n    timeZone: TZ,\n  }), 2);\n}\n\n// 18. A fully missed day breaks the streak.\n{\n  const rows = [\n    attempt('2026-09-29T03:00:00.000Z'),\n    attempt('2026-09-30T03:00:00.000Z'),\n  ];\n  assert.equal(calculateLearningStreak(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    timeZone: TZ,\n  }), 0);\n}\n\n// 19. Exam-only activity keeps a learning streak alive.\n{\n  const rows = [\n    attempt('2026-10-01T03:00:00.000Z', { mode: 'exam' }),\n    attempt('2026-10-02T03:00:00.000Z', { mode: 'exam' }),\n  ];\n  assert.equal(calculateLearningStreak(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    timeZone: TZ,\n  }), 2);\n}\n\n// 20. Streak can be scoped to one bank.\n{\n  const rows = [\n    attempt('2026-10-01T03:00:00.000Z', { bankId: 'bank-a' }),\n    attempt('2026-10-02T03:00:00.000Z', { bankId: 'bank-b' }),\n  ];\n  assert.equal(calculateLearningStreak(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    timeZone: TZ,\n    bankId: 'bank-a',\n  }), 1);\n}\n\n// 21. Malformed timestamps are ignored.\n{\n  const rows = [\n    attempt('not-a-date'),\n    attempt('2026-10-02T03:00:00.000Z', { questionId: 'Q002' }),\n  ];\n  const day = buildDailyLearningActivity(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    days: 1,\n    timeZone: TZ,\n  })[0];\n\n  assert.equal(day.practice, 1);\n  assert.equal(day.attempts, 1);\n}\n\n// 22. Recent active days counts practice, review and exam days.\n{\n  const rows = [\n    attempt('2026-09-30T03:00:00.000Z', { mode: 'filtered' }),\n    attempt('2026-10-01T03:00:00.000Z', { mode: 'due' }),\n    attempt('2026-10-02T03:00:00.000Z', { mode: 'exam' }),\n  ];\n  assert.equal(countRecentActiveDays(rows, {\n    now: new Date('2026-10-02T12:00:00.000Z'),\n    days: 7,\n    timeZone: TZ,\n  }), 3);\n}\n\n// 23. Attempts repository exposes all attempts for future P3 UI aggregation.\n{\n  const source = fs.readFileSync('src/storage/repositories/attempts.js', 'utf8');\n  assert.match(source, /getAllRecords/);\n  assert.match(source, /export function listAllAttempts\\(\\)/);\n}\n\n// 24. P3 core is available offline.\n{\n  const sw = fs.readFileSync('service-worker.js', 'utf8');\n  assert.match(sw, /\\.\\/src\\/learning\\/goal-progress\\.js/);\n  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-\\d+'/);\n}\n\nconsole.log('MoXin Quiz v4.0 P3 learning goal progress core: 24 regression cases passed.');\n";
const DOC = "# 墨忻刷題網 v4.0 — P3 Learning Goal Progress Core\n\n## 目的\n\nP3 Core 將既有 `learningGoals` 設定與 `attempts` 作答紀錄接起來，提供：\n\n- 今日一般刷題數\n- 今日複習數\n- 每日目標進度\n- 最近 7 日達成狀況\n- 連續學習天數\n- 全域 / 指定題庫 scope\n\n本階段只建立資料與計算核心；UI 留給 P3.1。\n\n## 計數規則\n\n### 每日刷題\n\n一般 practice attempt 計入：\n\n```text\nfiltered\n未標示 mode 的舊紀錄\n其他非 review / exam mode\n```\n\n同一題在同一天因答錯而重做多次，只計為 1 題，避免 retry 人為灌高每日目標。\n\n### 每日複習\n\n以下 mode 計入：\n\n```text\nreview\ndue\nwrong\nunfamiliar\nfavorite\nscheduled-review\nreview:*\n```\n\n同一題同一天在 review 中重做多次，只計為 1 題。\n\n### 模擬考\n\n```text\nexam\nexam:*\n```\n\n不計入「每日刷題」或「每日複習」，但算作當天有學習，因此會維持連續學習天數。\n\n### 同題跨類型\n\n同一題如果今天先做一般練習、後來又進入複習，它可以：\n\n```text\npractice +1\nreview +1\n```\n\n但 `answered` 的 unique question count 仍只算 1 題。\n\n## 日期與時區\n\n正式執行時使用瀏覽器本機日期：\n\n```text\nDate.getFullYear()\nDate.getMonth()\nDate.getDate()\n```\n\n因此台灣凌晨不會因 UTC 日界線被算到前一天。\n\n核心另外支援注入 IANA timezone（例如 `Asia/Taipei`）供 regression 做跨 UTC 邊界驗證。\n\n## 連續學習天數\n\n有任一：\n\n- 一般練習\n- 複習\n- 模擬考\n\n就視為當天有學習。\n\n若今天尚未作答，但昨天有學習，streak 不會在「今天尚未結束」時立刻歸零；會以昨天作為目前 streak 尾端。\n\n若昨天也沒有活動，streak 為 0。\n\n## 目標完成規則\n\n`dailyPracticeTarget > 0` 才啟用一般練習目標。\n\n`dailyReviewTarget > 0` 才啟用複習目標。\n\n當天只有所有已設定的 target 都完成，才算：\n\n```text\nachieved = true\n```\n\n若兩個 target 都是 0，即使 goal.enabled = true，也不算達成日。\n\n## 最近 7 日\n\n目前資料庫只保存「目前 learning goal」，沒有每天的歷史 goal snapshot。\n\n因此最近 7 日的達成狀況採：\n\n> 用目前設定的 target 回看最近 7 天。\n\n這是 P3 的正式語義；未來若增加 goal history store，才可改成「依當時目標」重建歷史。\n\n## Scope\n\n若 goal 有：\n\n```text\nbankId\n```\n\n只計算該題庫 attempts。\n\n若 `bankId = null`，則計算所有題庫。\n\n## Repository\n\nP3 Core 追加：\n\n```js\nlistAllAttempts()\n```\n\n到 attempts repository，供 P3.1 UI 一次取得完整作答紀錄後進行本機 aggregation。\n\n目前是個人 Local-first 網站，此方式足以維持簡單可靠；若未來作答紀錄量非常大，再考慮建立 daily aggregate store。\n\n## 下一階段\n\nP3.1 — Learning Goal UI：\n\n```text\n設定每日刷題 / 複習目標\n→ 顯示今日進度\n→ 顯示 streak\n→ 顯示最近 7 日達成狀況\n→ 支援全域 / 指定題庫目標\n```\n";

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOne(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Patch anchor is not unique: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

// 1. New P3 pure calculation engine + regression + documentation.
write('src/learning/goal-progress.js', ENGINE);
write('tests/v40-p3-learning-goals-core-run.mjs', TEST);
write('docs/V4_0_P3_LEARNING_GOALS_CORE.md', DOC);

// 2. Attempts repository: expose complete local attempt history for P3 aggregation.
{
  const path = 'src/storage/repositories/attempts.js';
  let source = read(path);

  source = replaceOne(
    source,
    "import { openDatabase, requestToPromise, transactionDone } from '../db.js';",
    "import { getAllRecords, openDatabase, requestToPromise, transactionDone } from '../db.js';",
    'attempts getAllRecords import',
  );

  if (!source.includes('export function listAllAttempts()')) {
    source += `

export function listAllAttempts() {
  return getAllRecords('attempts');
}
`;
  }

  write(path, source);
}

// 3. Regression chain.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const anchor =
    'node tests/v40-p2c1-package-studio-ui-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const replacement =
    'node tests/v40-p2c1-package-studio-ui-run.mjs && node tests/v40-p3-learning-goals-core-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';

  if (!pkg.scripts.test.includes('v40-p3-learning-goals-core-run.mjs')) {
    if (!pkg.scripts.test.includes(anchor)) {
      throw new Error('package.json P3 insertion anchor not found');
    }
    pkg.scripts.test = pkg.scripts.test.replace(anchor, replacement);
  }

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

// 4. PWA offline shell + cache revision.
{
  const path = 'service-worker.js';
  let sw = read(path);

  if (!sw.includes("'./src/learning/goal-progress.js'")) {
    sw = replaceOne(
      sw,
      "  './src/quiz/shuffle.js',",
      "  './src/quiz/shuffle.js',\n\n  './src/learning/goal-progress.js',",
      'P3 learning engine APP_SHELL',
    );
  }

  sw = replaceOne(
    sw,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-7';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-8';",
    'P3 APP cache revision',
  );

  write(path, sw);
}

// 5. Consolidated changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);

  if (!changelog.includes('## P3 — Learning Goal Progress Core')) {
    const anchor = '## P2C.1 — Import → Studio UI Integration';
    const section =
`## P3 — Learning Goal Progress Core
- 將 learningGoals 與 attempts 正式接成每日目標進度引擎。
- 一般練習 / 複習 / 模擬考採明確分類；exam 不灌入每日刷題或複習目標。
- 同題同日 retry 去重，避免答錯重做造成目標數字失真。
- 使用瀏覽器本機日界線，並加入 Asia/Taipei 跨 UTC regression。
- 新增最近 7 日達成狀況、全域 / 題庫 scope 與連續學習 streak。
- 最近 7 日以「目前 target」回看，規格明確記錄，不假裝有歷史 goal snapshot。
- attempts repository 新增 listAllAttempts()，P3 engine 加入 APP_SHELL。
- 新增 24 組 regression。

`;

    if (!changelog.includes(anchor)) {
      throw new Error('P3 changelog anchor missing');
    }
    changelog = changelog.replace(anchor, section + anchor);
  }

  write(path, changelog);
}

// 6. Self-check.
{
  const engine = read('src/learning/goal-progress.js');
  const attempts = read('src/storage/repositories/attempts.js');
  const pkg = JSON.parse(read('package.json'));
  const sw = read('service-worker.js');

  const required = [
    'buildDailyLearningActivity',
    'calculateLearningStreak',
    'buildLearningGoalProgress',
    'localDateKey',
  ];

  for (const marker of required) {
    if (!engine.includes(marker)) {
      throw new Error(`P3 core missing API: ${marker}`);
    }
  }

  if (!attempts.includes('export function listAllAttempts()')) {
    throw new Error('listAllAttempts() missing from attempts repository');
  }

  if (!pkg.scripts.test.includes('v40-p3-learning-goals-core-run.mjs')) {
    throw new Error('P3 regression missing from package.json');
  }

  if (!sw.includes("'./src/learning/goal-progress.js'")) {
    throw new Error('P3 goal-progress engine missing from APP_SHELL');
  }

  if (!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-8'")) {
    throw new Error('P3 APP cache revision was not bumped');
  }
}

console.log('P3 learning goal progress core patch applied successfully.');

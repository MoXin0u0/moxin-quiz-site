const AUDIT_TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nimport { buildLearningGoalProgress } from '../src/learning/goal-progress.js';\nimport { buildLearningAnalytics } from '../src/learning/analytics.js';\nimport {\n  buildBackupStatus,\n  buildHomeDashboard,\n} from '../src/learning/home-dashboard.js';\nimport { renderHomeDashboard } from '../src/ui/home-dashboard.js';\nimport { renderLearningHubOverview } from '../src/ui/learning-hub.js';\nimport { renderLearningStats } from '../src/ui/stats.js';\n\nconst NOW = new Date('2026-10-03T12:00:00.000Z');\nconst TZ = 'Asia/Taipei';\n\nconst banks = [\n  { id: 'erp', name: 'ERP 題庫' },\n  { id: 'math', name: '數學題庫' },\n];\n\nconst globalGoal = {\n  id: 'global',\n  bankId: null,\n  enabled: true,\n  dailyPracticeTarget: 2,\n  dailyReviewTarget: 1,\n  updatedAt: '2026-10-03T01:00:00.000Z',\n};\n\nconst bankGoal = {\n  id: 'bank:erp',\n  bankId: 'erp',\n  enabled: true,\n  dailyPracticeTarget: 1,\n  dailyReviewTarget: 0,\n  updatedAt: '2026-10-03T02:00:00.000Z',\n};\n\nconst attempts = [\n  {\n    bankId: 'erp',\n    questionId: 'Q1',\n    timestamp: '2026-10-03T01:00:00.000Z',\n    correct: true,\n    mode: 'filtered',\n  },\n  {\n    bankId: 'erp',\n    questionId: 'Q2',\n    timestamp: '2026-10-03T02:00:00.000Z',\n    correct: false,\n    mode: 'wrong',\n  },\n  {\n    bankId: 'math',\n    questionId: 'M1',\n    timestamp: '2026-10-02T01:00:00.000Z',\n    correct: true,\n    mode: 'filtered',\n  },\n];\n\nconst questions = [\n  { bankId: 'erp', questionId: 'Q1', id: 'Q1', type: 'single-choice', chapter: '第一章' },\n  { bankId: 'erp', questionId: 'Q2', id: 'Q2', type: 'single-choice', chapter: '第一章' },\n  { bankId: 'math', questionId: 'M1', id: 'M1', type: 'fill-in', chapter: '基礎' },\n];\n\n// 1. Home goal progress must be the same P3 engine result.\n{\n  const expected = buildLearningGoalProgress(globalGoal, attempts, {\n    now: NOW,\n    timeZone: TZ,\n    historyDays: 7,\n  });\n\n  const home = buildHomeDashboard({\n    banks,\n    goals: [bankGoal, globalGoal],\n    attempts,\n    summaries: [],\n    now: NOW,\n    timeZone: TZ,\n  });\n\n  assert.equal(home.goal.scopeLabel, '全部題庫');\n  assert.equal(home.goal.percent, expected.today.completionPercent);\n  assert.equal(home.goal.practice.count, expected.today.practiceGoal.count);\n  assert.equal(home.goal.review.count, expected.today.reviewGoal.count);\n}\n\n// 2. Home streak is always Global and not the currently selected P3 bank scope.\n{\n  const home = buildHomeDashboard({\n    banks,\n    goals: [bankGoal],\n    attempts,\n    summaries: [],\n    now: NOW,\n    timeZone: TZ,\n  });\n\n  const global = buildLearningGoalProgress({\n    id: 'audit-global',\n    bankId: null,\n    enabled: false,\n  }, attempts, {\n    now: NOW,\n    timeZone: TZ,\n    historyDays: 7,\n  });\n\n  assert.equal(home.streak.days, global.streak);\n  assert.equal(home.streak.todayAnswered, global.today.answered);\n}\n\n// 3. Home review totals keep the same semantics as Learning Hub summary groups.\n{\n  const summaries = [\n    { bank: banks[0], due: 3, wrong: 5 },\n    { bank: banks[1], due: 1, wrong: 2 },\n  ];\n\n  const home = buildHomeDashboard({\n    banks,\n    goals: [],\n    attempts,\n    summaries,\n    now: NOW,\n    timeZone: TZ,\n  });\n\n  assert.equal(home.review.dueTotal, 4);\n  assert.equal(home.review.wrongTotal, 7);\n  assert.equal(home.review.wrongBankId, 'erp');\n}\n\n// 4. P5 analytics intentionally counts attempts, while P3/Home daily activity dedupes by question.\n{\n  const retryAttempts = [\n    ...attempts,\n    {\n      bankId: 'erp',\n      questionId: 'Q1',\n      timestamp: '2026-10-03T03:00:00.000Z',\n      correct: false,\n      mode: 'filtered',\n    },\n  ];\n\n  const analytics = buildLearningAnalytics({\n    attempts: retryAttempts,\n    questions,\n  }, {\n    now: NOW,\n    timeZone: TZ,\n  });\n\n  const global = buildLearningGoalProgress({\n    id: 'audit-global',\n    bankId: null,\n    enabled: false,\n  }, retryAttempts, {\n    now: NOW,\n    timeZone: TZ,\n    historyDays: 7,\n  });\n\n  assert.equal(analytics.overall.attempts, 4);\n  assert.equal(global.today.answered, 2);\n}\n\n// 5. Learning Hub overview keeps Global summary separate from bank-goal scope.\n{\n  const html = renderLearningHubOverview({\n    groups: [],\n    summaryModel: {\n      progress: {\n        streak: 2,\n        today: {\n          practiceGoal: { count: 9 },\n          reviewGoal: { count: 4 },\n          exam: 1,\n        },\n      },\n    },\n    goalModel: {\n      banks,\n      selectedScope: 'erp',\n      goal: bankGoal,\n      progress: {\n        today: {\n          completionPercent: 100,\n          practiceGoal: { count: 1, target: 1, active: true },\n          reviewGoal: { count: 0, target: 0, active: false },\n        },\n      },\n    },\n    sprintModel: {\n      goal: { sprintEnabled: false, sprintBankIds: [] },\n      plan: {},\n    },\n  });\n\n  assert.match(html, /全站今日/);\n  assert.match(html, /刷題 <strong>9<\\/strong>/);\n  assert.match(html, /目標範圍：ERP 題庫/);\n}\n\n// 6. Stats can render empty data without creating a long-page failure state.\n{\n  const emptyAnalytics = buildLearningAnalytics({}, {\n    now: NOW,\n    timeZone: TZ,\n  });\n\n  const container = { innerHTML: '' };\n  renderLearningStats(container, {\n    activeTab: 'overview',\n    scope: 'global',\n    windowDays: 7,\n    overall: {\n      attempts: 0,\n      accuracy: 0,\n      answeredQuestions: 0,\n      due: 0,\n    },\n    globalAnalytics: emptyAnalytics,\n    analytics: emptyAnalytics,\n    banks: [],\n  });\n\n  assert.match(container.innerHTML, /data-stats-tab=\"overview\"/);\n  assert.match(container.innerHTML, /最近 7 日/);\n  assert.match(container.innerHTML, /資料不足/);\n}\n\n// 7. Home empty state remains actionable and does not fabricate progress.\n{\n  const home = buildHomeDashboard({\n    banks: [],\n    goals: [],\n    attempts: [],\n    summaries: [],\n    now: NOW,\n    timeZone: TZ,\n  });\n\n  const container = { innerHTML: '' };\n  renderHomeDashboard(container, home);\n\n  assert.match(container.innerHTML, /今日目標/);\n  assert.match(container.innerHTML, /尚未設定/);\n  assert.match(container.innerHTML, /目前沒有未完成練習/);\n  assert.match(container.innerHTML, /尚未完整備份/);\n}\n\n// 8. Dynamic bank names in action-card notes must be escaped.\n{\n  const unsafeBank = {\n    id: 'unsafe',\n    name: '<img src=x onerror=alert(1)>',\n  };\n\n  const home = buildHomeDashboard({\n    banks: [unsafeBank],\n    goals: [],\n    attempts: [],\n    summaries: [\n      { bank: unsafeBank, due: 0, wrong: 3 },\n    ],\n    now: NOW,\n    timeZone: TZ,\n  });\n\n  const container = { innerHTML: '' };\n  renderHomeDashboard(container, home);\n\n  assert.doesNotMatch(container.innerHTML, /<img src=x/);\n  assert.match(container.innerHTML, /&lt;img src=x onerror=alert\\(1\\)&gt;/);\n}\n\n// 9. Backup stale boundary is explicit: 6 days fresh, 7 days stale.\n{\n  const now = new Date('2026-10-08T00:00:00.000Z');\n  assert.equal(\n    buildBackupStatus('2026-10-02T00:00:00.000Z', { now }).stale,\n    false,\n  );\n  assert.equal(\n    buildBackupStatus('2026-10-01T00:00:00.000Z', { now }).stale,\n    true,\n  );\n}\n\n// 10. Runtime integration contracts across Home / Stats / Learning Hub.\n{\n  const main = fs.readFileSync('src/app/main.js', 'utf8');\n  assert.match(main, /refreshHomeDashboard/);\n  assert.match(main, /renderLearningHubFromCache/);\n  assert.match(main, /renderStatsFromCache/);\n  assert.match(main, /data-home-resume-bank/);\n  assert.match(main, /data-home-wrong-bank/);\n  assert.match(main, /data-home-sprint/);\n  assert.match(main, /data-stats-tab/);\n  assert.match(main, /data-learning-hub-tab/);\n}\n\n// 11. Backup timestamp is written only from the full-backup export path.\n{\n  const p7 = fs.readFileSync('src/app/p7.js', 'utf8');\n  const meta = fs.readFileSync('src/storage/backup-meta.js', 'utf8');\n\n  assert.match(p7, /markFullBackupCompleted\\(snapshot\\.exportedAt \\|\\| new Date\\(\\)\\)/);\n  assert.match(meta, /moxin\\.v4\\.backup\\.meta/);\n  assert.match(meta, /lastFullBackupAt/);\n}\n\n// 12. Responsive contracts exist for all three P5-facing workspaces.\n{\n  const homeCss = fs.readFileSync('styles/v4-home.css', 'utf8');\n  const statsCss = fs.readFileSync('styles/v4-stats.css', 'utf8');\n  const hubCss = fs.readFileSync('styles/v4-learning-hub.css', 'utf8');\n\n  assert.match(homeCss, /@media \\(max-width: 980px\\)/);\n  assert.match(homeCss, /@media \\(max-width: 620px\\)/);\n  assert.match(statsCss, /@media \\(max-width: 980px\\)/);\n  assert.match(statsCss, /@media \\(max-width: 820px\\)/);\n  assert.match(statsCss, /@media \\(max-width: 620px\\)/);\n  assert.match(hubCss, /@media \\(max-width: 620px\\)/);\n}\n\n// 13. P5 styles rely on theme tokens instead of new fixed hex colors.\n{\n  const homeCss = fs.readFileSync('styles/v4-home.css', 'utf8');\n  const statsCss = fs.readFileSync('styles/v4-stats.css', 'utf8');\n\n  assert.doesNotMatch(homeCss, /#[0-9a-fA-F]{3,8}\\b/);\n  assert.doesNotMatch(statsCss, /#[0-9a-fA-F]{3,8}\\b/);\n  assert.match(homeCss, /var\\(--learn-/);\n  assert.match(statsCss, /var\\(--learn-/);\n}\n\n// 14. Offline App Shell contains every P5 runtime asset.\n{\n  const sw = fs.readFileSync('service-worker.js', 'utf8');\n  for (const asset of [\n    './styles/v4-stats.css',\n    './styles/v4-home.css',\n    './src/learning/analytics.js',\n    './src/learning/home-dashboard.js',\n    './src/storage/backup-meta.js',\n    './src/ui/stats.js',\n    './src/ui/home-dashboard.js',\n  ]) {\n    assert.ok(sw.includes(`'${asset}'`), `APP_SHELL missing ${asset}`);\n  }\n  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-\\d+'/);\n}\n\n// 15. Release entries stay byte-for-byte identical.\n{\n  const index = fs.readFileSync('index.html', 'utf8');\n  const v3 = fs.readFileSync('v3.html', 'utf8');\n  assert.equal(index, v3);\n}\n\n// 16. Final audit is chained into npm test.\n{\n  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\n  assert.match(pkg.scripts.test, /v40-p5-final-audit-run\\.mjs/);\n}\n\nconsole.log('MoXin Quiz v4.0 P5 final audit: 16 cross-page regression cases passed.');\n";
const DOC = "# 墨忻刷題網 v4.0 — P5 Final Audit\n\n## Audit 範圍\n\nP5 Final Audit 不再增加新的功能頁，而是把下列三個互相關聯的區域一起驗證：\n\n```text\n我的題庫首頁\n今日學習\n學習統計\n```\n\n涵蓋：\n\n- 資料口徑一致性\n- Empty State\n- Global / Bank scope\n- Session resume\n- 今日複習 / 快速錯題\n- 考前衝刺入口\n- 完整備份提醒\n- Desktop / Tablet / Mobile\n- Theme token / Dark Mode 相容性\n- Offline App Shell\n- Release cutover invariant\n\n## 統計口徑確認\n\n### 今日目標\n\n首頁直接使用 P3 `buildLearningGoalProgress()`。\n\n因此首頁與 Learning Hub 的目標百分比不是另外計算一套公式。\n\n### 連續學習\n\n首頁 streak 固定使用 Global attempts。\n\n不受 Learning Hub 目前選定的 P3 bank scope 影響。\n\n### 今日複習 / 快速錯題\n\n首頁 summary 與 Learning Hub 採相同語義：\n\n- due：目前到期且題目仍存在\n- wrong：目前 `lastResult === wrong` 且題目仍存在\n\n快速錯題只決定「先進哪個題庫」，不建立新的 review engine。\n\n### P3 與 P5 的數字差異\n\n保留既有設計：\n\n```text\nP3 / Home 每日學習\n→ 同題同日 unique-question\n\nP5 Statistics\n→ 實際 attempt 次數\n```\n\nRetry 因此可以讓 P5 趨勢 +1，但不會讓 P3 今日目標重複灌水。\n\n## Scope\n\n- Home Hero / streak：Global\n- Home 今日目標：明確顯示所採用 goal scope\n- Learning Hub Hero / summary：Global\n- Learning Hub P3 card：目前 P3 scope\n- Statistics Hero：Global\n- Statistics Trends / Weakness：可切 Global / Bank\n\n## Empty State\n\n驗證：\n\n- 沒有題庫\n- 沒有 attempts\n- 沒有 learning goal\n- 沒有 unfinished session\n- 沒有 backup metadata\n\n各頁仍必須能正常 render，且不得虛構進度。\n\n## Security Hardening\n\nFinal Audit 發現 Home Action generic note 原先允許 caller 傳入已組合 HTML 字串。\n\n現在改為：\n\n```text\n所有 action note\n→ renderAction() 統一 escapeHtml()\n```\n\n並移除 sprint note 的預先 escape，避免 double escaping。\n\n因此匯入題庫名稱即使包含 HTML-like 文字，也只會當文字顯示。\n\n## RWD / Theme\n\nFinal Audit 靜態 gate：\n\n- Home：980 / 620 breakpoint\n- Statistics：980 / 820 / 620 breakpoint\n- Learning Hub：620 mobile compaction\n- P5 新 CSS 不新增固定 hex 色碼\n- 使用既有 `--learn-*` theme tokens\n\n## Offline / Release\n\nP5 runtime assets 必須全部存在 APP_SHELL。\n\n`index.html` 與 `v3.html` 必須 byte-for-byte 相同。\n\n## Stable Criteria\n\n當：\n\n```text\nP5 Analytics Core\nP5.1 Statistics IA/UI\nP5.2 Home Actions\nP5 Final Audit\n```\n\n全部通過 `npm run ci`，且已完成實機畫面驗收後：\n\n```text\nP5 — 統計與首頁 = Stable\n```\n\n後續除 bugfix / regression 外進入 Maintenance Only。\n";
const PATCHES = [{"path": "src/ui/home-dashboard.js", "search": "    note = `${escapeHtml(sprint.label || '考前衝刺')} · ${Number(sprint.bankCount || 0)} 個題庫`;", "replacement": "    note = `${sprint.label || '考前衝刺'} · ${Number(sprint.bankCount || 0)} 個題庫`;", "label": "home sprint note raw data before centralized escaping"}, {"path": "src/ui/home-dashboard.js", "search": "      <p>${note}</p>", "replacement": "      <p>${escapeHtml(note)}</p>", "label": "home action note centralized escaping"}];

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

write('tests/v40-p5-final-audit-run.mjs', AUDIT_TEST);
write('docs/V4_0_P5_FINAL_AUDIT.md', DOC);

for (const item of PATCHES) {
  const source = read(item.path);
  write(item.path, replaceOne(source, item.search, item.replacement, item.label));
}

// Mark P5 stable in the long-term roadmap. This only commits if the full CI passes.
{
  const path = 'docs/V4_0_PLAN.md';
  let plan = read(path);
  const anchor = '## P5 — 統計與首頁\n';

  if (!plan.includes('**狀態：Stable（P5 Final Audit）**')) {
    if (!plan.includes(anchor)) {
      throw new Error('P5 roadmap heading missing');
    }
    plan = plan.replace(
      anchor,
      anchor + '\n**狀態：Stable（P5 Final Audit）**\n',
    );
  }

  write(path, plan);
}

// Add audit regression after P5.2.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const anchor =
    'node tests/v40-p52-home-actions-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const replacement =
    'node tests/v40-p52-home-actions-run.mjs && node tests/v40-p5-final-audit-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';

  if (!pkg.scripts.test.includes('v40-p5-final-audit-run.mjs')) {
    if (!pkg.scripts.test.includes(anchor)) {
      throw new Error('package.json P5 Final Audit insertion anchor not found');
    }
    pkg.scripts.test = pkg.scripts.test.replace(anchor, replacement);
  }

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

// Runtime JS changed, so bump App Shell cache.
{
  const path = 'service-worker.js';
  let sw = read(path);
  sw = replaceOne(
    sw,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-17';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-18';",
    'P5 Final Audit cache revision',
  );
  write(path, sw);
}

// Changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);

  if (!changelog.includes('## P5 Final Audit — Stable')) {
    const anchor = '## P5.2 — Home Actions';
    const section =
      '## P5 Final Audit — Stable\n' +
      '- 首頁 / 今日學習 / 學習統計完成跨頁資料口徑與 Empty State 回歸。\n' +
      '- 驗證 Home 今日目標直接共用 P3 engine；Home / Learning Hub Global 摘要不受 bank scope 汙染。\n' +
      '- 驗證 P3 unique-question 與 P5 attempt-count 的刻意差異，避免未來誤合併統計口徑。\n' +
      '- 驗證首頁 due / wrong、resume session、sprint、backup 與既有流程一致。\n' +
      '- Home Action 動態 note 改為統一 HTML escape，補強匯入題庫名稱的輸出安全。\n' +
      '- 加入 Desktop / Tablet / Mobile、theme token、offline APP_SHELL、release equality final gates。\n' +
      '- 新增 16 組 P5 cross-page audit regression。\n' +
      '- P5「統計與首頁」正式標記 Stable / Maintenance Only。\n' +
      '- APP cache 更新至 r2k.5-18。\n\n';

    if (!changelog.includes(anchor)) {
      throw new Error('P5.2 changelog anchor missing');
    }
    changelog = changelog.replace(anchor, section + anchor);
  }

  write(path, changelog);
}

// Strong self-check.
{
  const homeUi = read('src/ui/home-dashboard.js');
  const sw = read('service-worker.js');
  const pkg = JSON.parse(read('package.json'));
  const plan = read('docs/V4_0_PLAN.md');

  if (!homeUi.includes('<p>${escapeHtml(note)}</p>')) {
    throw new Error('P5 Final Audit home note escaping missing');
  }
  if (homeUi.includes("escapeHtml(sprint.label || '考前衝刺')")) {
    throw new Error('P5 Final Audit sprint note still pre-escapes before centralized escaping');
  }
  if (!pkg.scripts.test.includes('v40-p5-final-audit-run.mjs')) {
    throw new Error('P5 Final Audit regression missing from package.json');
  }
  if (!plan.includes('**狀態：Stable（P5 Final Audit）**')) {
    throw new Error('P5 Stable roadmap marker missing');
  }
  if (!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-18'")) {
    throw new Error('P5 Final Audit cache revision missing');
  }
  if (read('index.html') !== read('v3.html')) {
    throw new Error('P5 Final Audit release entries diverged');
  }
}

console.log('P5 Final Audit patch applied successfully.');

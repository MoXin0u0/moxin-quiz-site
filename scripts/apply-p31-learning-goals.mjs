import fs from 'node:fs';

const UI_CODE = "export const GLOBAL_SCOPE = 'global';\n\nexport function learningGoalIdForScope(scope) {\n  const normalized = String(scope || GLOBAL_SCOPE).trim();\n  return normalized === GLOBAL_SCOPE ? GLOBAL_SCOPE : `bank:${normalized}`;\n}\n\nexport function createLearningGoalSaveInput({\n  scope = GLOBAL_SCOPE,\n  enabled = false,\n  dailyPracticeTarget = 0,\n  dailyReviewTarget = 0,\n} = {}) {\n  const normalizedScope = String(scope || GLOBAL_SCOPE).trim() || GLOBAL_SCOPE;\n  const bankId = normalizedScope === GLOBAL_SCOPE ? null : normalizedScope;\n\n  return {\n    id: learningGoalIdForScope(normalizedScope),\n    bankId,\n    enabled: enabled === true,\n    dailyPracticeTarget: clampTarget(dailyPracticeTarget),\n    dailyReviewTarget: clampTarget(dailyReviewTarget),\n  };\n}\n\nexport function renderLearningGoalPanel(model = {}) {\n  const banks = Array.isArray(model.banks) ? model.banks : [];\n  const selectedScope = String(model.selectedScope || GLOBAL_SCOPE);\n  const goal = model.goal || {};\n  const progress = model.progress || {};\n  const today = progress.today || {};\n  const practice = today.practiceGoal || emptyMetric(goal.dailyPracticeTarget);\n  const review = today.reviewGoal || emptyMetric(goal.dailyReviewTarget);\n  const history = Array.isArray(progress.history) ? progress.history : [];\n  const configured = model.configured === true;\n\n  return `\n    <section class=\"learning-goal-panel\" aria-labelledby=\"learningGoalTitle\">\n      <div class=\"learning-goal-head\">\n        <div>\n          <span class=\"learning-kicker\">P3 · 學習目標</span>\n          <h2 id=\"learningGoalTitle\">把今天的學習量變成可追蹤的節奏</h2>\n          <p>一般練習與複習分開計算；模擬考不灌入每日題數，但仍會維持連續學習天數。</p>\n        </div>\n\n        <label class=\"learning-goal-scope\">\n          <span>目標範圍</span>\n          <select data-learning-goal-scope>\n            <option value=\"${GLOBAL_SCOPE}\" ${selectedScope === GLOBAL_SCOPE ? 'selected' : ''}>全部題庫</option>\n            ${banks.map(bank => `\n              <option\n                value=\"${escapeAttr(bank.id)}\"\n                ${selectedScope === String(bank.id) ? 'selected' : ''}\n              >${escapeHtml(bank.name || bank.title || bank.id)}</option>\n            `).join('')}\n          </select>\n        </label>\n      </div>\n\n      <div class=\"learning-goal-dashboard\">\n        <article class=\"learning-goal-summary-card primary\">\n          <span>今日整體進度</span>\n          <strong>${clampPercent(today.completionPercent)}%</strong>\n          <small>${today.achieved ? '今日目標已完成' : goal.enabled ? '依目前目標持續累積' : '目前未啟用目標'}</small>\n          <div class=\"learning-goal-progress-track\" aria-hidden=\"true\">\n            <i style=\"width:${clampPercent(today.completionPercent)}%\"></i>\n          </div>\n        </article>\n\n        <article class=\"learning-goal-summary-card\">\n          <span>連續學習</span>\n          <strong>${Number(progress.streak || 0)} 天</strong>\n          <small>練習、複習或模擬考任一有作答</small>\n        </article>\n\n        <article class=\"learning-goal-summary-card\">\n          <span>近 7 日達成</span>\n          <strong>${Number(progress.recentAchievedDays || 0)} / ${history.length || 7}</strong>\n          <small>以目前設定的目標回看</small>\n        </article>\n      </div>\n\n      <div class=\"learning-goal-target-grid\">\n        ${targetCard('每日刷題', '一般練習', practice, 'practice')}\n        ${targetCard('每日複習', '到期、錯題、不熟與收藏複習', review, 'review')}\n      </div>\n\n      <div class=\"learning-goal-history\">\n        <div class=\"learning-goal-history-head\">\n          <div>\n            <strong>最近 7 日</strong>\n            <span>綠色代表依目前目標達成；有作答但未完成會顯示進度。</span>\n          </div>\n        </div>\n        <div class=\"learning-goal-week\" role=\"list\" aria-label=\"最近七日學習目標\">\n          ${history.map(day => historyCell(day)).join('')}\n        </div>\n      </div>\n\n      <form class=\"learning-goal-form\" data-learning-goal-form>\n        <input type=\"hidden\" data-learning-goal-form-scope value=\"${escapeAttr(selectedScope)}\" />\n\n        <label class=\"learning-goal-enabled\">\n          <input\n            type=\"checkbox\"\n            data-learning-goal-enabled\n            ${goal.enabled ? 'checked' : ''}\n          />\n          <span>\n            <strong>啟用這組每日目標</strong>\n            <small>${configured ? '設定已保存在這個瀏覽器。' : '尚未建立設定，儲存後開始追蹤。'}</small>\n          </span>\n        </label>\n\n        <label>\n          <span>每日一般刷題</span>\n          <input\n            type=\"number\"\n            inputmode=\"numeric\"\n            min=\"0\"\n            max=\"10000\"\n            step=\"1\"\n            value=\"${escapeAttr(goal.dailyPracticeTarget || 0)}\"\n            data-learning-goal-practice\n          />\n          <small>設為 0 代表不啟用這一項。</small>\n        </label>\n\n        <label>\n          <span>每日複習</span>\n          <input\n            type=\"number\"\n            inputmode=\"numeric\"\n            min=\"0\"\n            max=\"10000\"\n            step=\"1\"\n            value=\"${escapeAttr(goal.dailyReviewTarget || 0)}\"\n            data-learning-goal-review\n          />\n          <small>同一天同一題重做不會重複灌高題數。</small>\n        </label>\n\n        <button class=\"button primary\" type=\"submit\">儲存學習目標</button>\n      </form>\n    </section>\n  `;\n}\n\nfunction targetCard(title, subtitle, metric, kind) {\n  const active = metric?.active === true;\n  const count = Number(metric?.count || 0);\n  const target = Number(metric?.target || 0);\n  const percent = clampPercent(metric?.percent);\n\n  return `\n    <article class=\"learning-goal-target ${escapeAttr(kind)} ${metric?.complete && active ? 'is-complete' : ''}\">\n      <div class=\"learning-goal-target-head\">\n        <div>\n          <span>${escapeHtml(subtitle)}</span>\n          <strong>${escapeHtml(title)}</strong>\n        </div>\n        <b>${active ? `${count} / ${target}` : `${count}`}</b>\n      </div>\n\n      <div class=\"learning-goal-progress-track\" aria-label=\"${escapeAttr(title)} ${percent}%\">\n        <i style=\"width:${active ? percent : 0}%\"></i>\n      </div>\n\n      <small>\n        ${active\n          ? metric.complete\n            ? '今天已完成'\n            : `還差 ${Number(metric.remaining || 0)} 題`\n          : '目前沒有設定每日目標'}\n      </small>\n    </article>\n  `;\n}\n\nfunction historyCell(day) {\n  const percent = clampPercent(day?.completionPercent);\n  const state = day?.achieved\n    ? 'is-achieved'\n    : day?.active\n      ? 'is-active'\n      : 'is-empty';\n\n  return `\n    <div class=\"learning-goal-day ${state}\" role=\"listitem\" title=\"${escapeAttr(day.dateKey || '')}\">\n      <span>${formatShortDate(day.dateKey)}</span>\n      <strong>${day?.achieved ? '✓' : day?.active ? `${percent}%` : '—'}</strong>\n      <small>${Number(day?.answered || 0)} 題</small>\n    </div>\n  `;\n}\n\nfunction formatShortDate(dateKey) {\n  const parts = String(dateKey || '').split('-');\n  if (parts.length !== 3) return '—';\n  return `${Number(parts[1])}/${Number(parts[2])}`;\n}\n\nfunction clampTarget(value) {\n  const number = Number(value);\n  if (!Number.isFinite(number)) return 0;\n  return Math.max(0, Math.min(10000, Math.round(number)));\n}\n\nfunction clampPercent(value) {\n  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));\n}\n\nfunction emptyMetric(target = 0) {\n  const normalized = clampTarget(target);\n  return {\n    count: 0,\n    target: normalized,\n    active: normalized > 0,\n    complete: normalized <= 0,\n    percent: 0,\n    remaining: normalized,\n  };\n}\n\nfunction escapeHtml(value) {\n  return String(value ?? '')\n    .replaceAll('&', '&amp;')\n    .replaceAll('<', '&lt;')\n    .replaceAll('>', '&gt;')\n    .replaceAll('\"', '&quot;')\n    .replaceAll(\"'\", '&#039;');\n}\n\nfunction escapeAttr(value) {\n  return escapeHtml(value).replaceAll('`', '&#096;');\n}\n";
const CSS_CODE = "/* v4.0 P3.1 — Learning Goal UI */\n\n.learning-goal-panel {\n  display: grid;\n  gap: 1rem;\n  margin: 1rem 0;\n  padding: clamp(1rem, 2.4vw, 1.35rem);\n  border: 1px solid var(--learn-line);\n  border-radius: 22px;\n  background:\n    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--learn-primary) 10%, transparent), transparent 22rem),\n    var(--learn-surface);\n  box-shadow: var(--learn-shadow-soft);\n  backdrop-filter: blur(16px);\n}\n\n.learning-goal-head {\n  display: flex;\n  align-items: end;\n  justify-content: space-between;\n  gap: 1rem;\n}\n\n.learning-goal-head h2 {\n  margin: .18rem 0 .28rem;\n  color: var(--learn-text);\n  font-size: clamp(1.25rem, 2.6vw, 1.7rem);\n  letter-spacing: -.03em;\n}\n\n.learning-goal-head p {\n  max-width: 66ch;\n  margin: 0;\n  color: var(--learn-muted);\n  line-height: 1.6;\n}\n\n.learning-goal-scope {\n  display: grid;\n  flex: 0 0 min(300px, 36%);\n  gap: .35rem;\n}\n\n.learning-goal-scope > span,\n.learning-goal-form > label > span:first-child {\n  color: var(--learn-muted);\n  font-size: .76rem;\n  font-weight: 800;\n}\n\n.learning-goal-scope select,\n.learning-goal-form input[type=\"number\"] {\n  width: 100%;\n  min-height: 42px;\n  border: 1px solid var(--learn-line);\n  border-radius: 12px;\n  padding: .6rem .72rem;\n  background: var(--learn-surface-strong);\n  color: var(--learn-text);\n  font: inherit;\n}\n\n.learning-goal-dashboard {\n  display: grid;\n  grid-template-columns: 1.25fr repeat(2, minmax(0, 1fr));\n  gap: .7rem;\n}\n\n.learning-goal-summary-card {\n  display: grid;\n  align-content: start;\n  gap: .25rem;\n  min-height: 128px;\n  padding: .9rem;\n  border: 1px solid var(--learn-line);\n  border-radius: 16px;\n  background: var(--learn-surface-soft);\n}\n\n.learning-goal-summary-card.primary {\n  background:\n    linear-gradient(\n      135deg,\n      color-mix(in srgb, var(--learn-primary) 12%, var(--learn-surface)),\n      color-mix(in srgb, var(--learn-primary-2) 7%, var(--learn-surface))\n    );\n}\n\n.learning-goal-summary-card > span {\n  color: var(--learn-muted);\n  font-size: .76rem;\n  font-weight: 800;\n}\n\n.learning-goal-summary-card > strong {\n  color: var(--learn-text);\n  font-size: clamp(1.4rem, 3vw, 2rem);\n}\n\n.learning-goal-summary-card > small {\n  color: var(--learn-muted);\n  line-height: 1.4;\n}\n\n.learning-goal-target-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: .7rem;\n}\n\n.learning-goal-target {\n  display: grid;\n  gap: .65rem;\n  padding: .9rem;\n  border: 1px solid var(--learn-line);\n  border-radius: 16px;\n  background: var(--learn-surface-soft);\n}\n\n.learning-goal-target.is-complete {\n  border-color: color-mix(in srgb, var(--learn-teal) 48%, var(--learn-line));\n}\n\n.learning-goal-target-head {\n  display: flex;\n  justify-content: space-between;\n  gap: .75rem;\n  align-items: end;\n}\n\n.learning-goal-target-head > div {\n  display: grid;\n  gap: .12rem;\n}\n\n.learning-goal-target-head span {\n  color: var(--learn-muted);\n  font-size: .72rem;\n}\n\n.learning-goal-target-head strong,\n.learning-goal-target-head b {\n  color: var(--learn-text);\n}\n\n.learning-goal-target > small {\n  color: var(--learn-muted);\n}\n\n.learning-goal-progress-track {\n  height: 8px;\n  overflow: hidden;\n  border-radius: 999px;\n  background: color-mix(in srgb, var(--learn-line) 72%, transparent);\n}\n\n.learning-goal-progress-track > i {\n  display: block;\n  width: 0;\n  height: 100%;\n  border-radius: inherit;\n  background: linear-gradient(90deg, var(--learn-primary), var(--learn-primary-2));\n}\n\n.learning-goal-target.review .learning-goal-progress-track > i {\n  background: linear-gradient(90deg, var(--learn-cyan), var(--learn-teal));\n}\n\n.learning-goal-history {\n  display: grid;\n  gap: .6rem;\n  padding: .85rem;\n  border: 1px solid var(--learn-line);\n  border-radius: 16px;\n  background: color-mix(in srgb, var(--learn-surface-soft) 78%, transparent);\n}\n\n.learning-goal-history-head {\n  display: flex;\n  justify-content: space-between;\n  gap: .8rem;\n}\n\n.learning-goal-history-head > div {\n  display: grid;\n  gap: .12rem;\n}\n\n.learning-goal-history-head strong {\n  color: var(--learn-text);\n}\n\n.learning-goal-history-head span {\n  color: var(--learn-muted);\n  font-size: .75rem;\n}\n\n.learning-goal-week {\n  display: grid;\n  grid-template-columns: repeat(7, minmax(0, 1fr));\n  gap: .45rem;\n}\n\n.learning-goal-day {\n  display: grid;\n  place-items: center;\n  gap: .18rem;\n  min-height: 78px;\n  padding: .5rem .3rem;\n  border: 1px solid var(--learn-line);\n  border-radius: 12px;\n  background: var(--learn-surface-strong);\n  text-align: center;\n}\n\n.learning-goal-day > span,\n.learning-goal-day > small {\n  color: var(--learn-muted);\n  font-size: .68rem;\n}\n\n.learning-goal-day > strong {\n  color: var(--learn-text);\n  font-size: .9rem;\n}\n\n.learning-goal-day.is-achieved {\n  border-color: color-mix(in srgb, var(--learn-teal) 50%, var(--learn-line));\n  background: color-mix(in srgb, var(--learn-teal) 10%, var(--learn-surface));\n}\n\n.learning-goal-day.is-achieved > strong {\n  color: var(--learn-teal);\n}\n\n.learning-goal-day.is-active:not(.is-achieved) {\n  border-color: color-mix(in srgb, var(--learn-primary) 38%, var(--learn-line));\n}\n\n.learning-goal-form {\n  display: grid;\n  grid-template-columns: 1.25fr repeat(2, minmax(150px, .7fr)) auto;\n  gap: .65rem;\n  align-items: end;\n  padding-top: .95rem;\n  border-top: 1px solid var(--learn-line);\n}\n\n.learning-goal-form > label {\n  display: grid;\n  gap: .32rem;\n}\n\n.learning-goal-form > label > small {\n  color: var(--learn-muted);\n  font-size: .68rem;\n  line-height: 1.35;\n}\n\n.learning-goal-enabled {\n  display: flex !important;\n  align-items: center;\n  gap: .65rem;\n  min-height: 68px;\n  padding: .65rem .7rem;\n  border: 1px solid var(--learn-line);\n  border-radius: 14px;\n  background: var(--learn-surface-soft);\n}\n\n.learning-goal-enabled > span {\n  display: grid;\n  gap: .12rem;\n}\n\n.learning-goal-enabled strong {\n  color: var(--learn-text);\n}\n\n.learning-goal-enabled small {\n  color: var(--learn-muted);\n}\n\n.learning-goal-enabled input {\n  width: 1.1rem;\n  height: 1.1rem;\n  accent-color: var(--learn-primary);\n}\n\n.learning-goal-form > .button {\n  min-height: 46px;\n  white-space: nowrap;\n}\n\n@media (max-width: 980px) {\n  .learning-goal-form {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .learning-goal-enabled {\n    grid-column: 1 / -1;\n  }\n\n  .learning-goal-form > .button {\n    width: 100%;\n  }\n}\n\n@media (max-width: 760px) {\n  .learning-goal-head {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .learning-goal-scope {\n    flex-basis: auto;\n    width: 100%;\n  }\n\n  .learning-goal-dashboard,\n  .learning-goal-target-grid {\n    grid-template-columns: 1fr;\n  }\n\n  .learning-goal-week {\n    grid-template-columns: repeat(4, minmax(0, 1fr));\n  }\n}\n\n@media (max-width: 520px) {\n  .learning-goal-form {\n    grid-template-columns: 1fr;\n  }\n\n  .learning-goal-enabled {\n    grid-column: auto;\n  }\n\n  .learning-goal-week {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n}\n";
const TEST_CODE = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nimport {\n  GLOBAL_SCOPE,\n  createLearningGoalSaveInput,\n  learningGoalIdForScope,\n  renderLearningGoalPanel,\n} from '../src/ui/learning-goals.js';\n\nassert.equal(learningGoalIdForScope('global'), 'global');\nassert.equal(learningGoalIdForScope('bank-a'), 'bank:bank-a');\n\nassert.deepEqual(\n  createLearningGoalSaveInput({\n    scope: 'bank-a',\n    enabled: true,\n    dailyPracticeTarget: '25.6',\n    dailyReviewTarget: '-1',\n  }),\n  {\n    id: 'bank:bank-a',\n    bankId: 'bank-a',\n    enabled: true,\n    dailyPracticeTarget: 26,\n    dailyReviewTarget: 0,\n  },\n);\n\nconst html = renderLearningGoalPanel({\n  banks: [\n    { id: 'bank-a', name: 'Bank A' },\n    { id: 'bank-b', name: 'Bank B' },\n  ],\n  selectedScope: GLOBAL_SCOPE,\n  configured: true,\n  goal: {\n    id: 'global',\n    bankId: null,\n    enabled: true,\n    dailyPracticeTarget: 20,\n    dailyReviewTarget: 10,\n  },\n  progress: {\n    streak: 4,\n    recentAchievedDays: 3,\n    today: {\n      completionPercent: 75,\n      achieved: false,\n      practiceGoal: {\n        count: 20,\n        target: 20,\n        active: true,\n        complete: true,\n        percent: 100,\n        remaining: 0,\n      },\n      reviewGoal: {\n        count: 5,\n        target: 10,\n        active: true,\n        complete: false,\n        percent: 50,\n        remaining: 5,\n      },\n    },\n    history: [\n      { dateKey: '2026-09-26', active: false, achieved: false, answered: 0, completionPercent: 0 },\n      { dateKey: '2026-09-27', active: true, achieved: true, answered: 10, completionPercent: 100 },\n      { dateKey: '2026-09-28', active: true, achieved: false, answered: 8, completionPercent: 40 },\n      { dateKey: '2026-09-29', active: true, achieved: true, answered: 12, completionPercent: 100 },\n      { dateKey: '2026-09-30', active: false, achieved: false, answered: 0, completionPercent: 0 },\n      { dateKey: '2026-10-01', active: true, achieved: true, answered: 9, completionPercent: 100 },\n      { dateKey: '2026-10-02', active: true, achieved: false, answered: 25, completionPercent: 75 },\n    ],\n  },\n});\n\nassert.match(html, /P3 · 學習目標/);\nassert.match(html, /今日整體進度/);\nassert.match(html, /75%/);\nassert.match(html, /連續學習/);\nassert.match(html, /4 天/);\nassert.match(html, /3 \\/ 7/);\nassert.match(html, /每日刷題/);\nassert.match(html, /20 \\/ 20/);\nassert.match(html, /每日複習/);\nassert.match(html, /5 \\/ 10/);\nassert.match(html, /還差 5 題/);\nassert.match(html, /data-learning-goal-form/);\nassert.match(html, /data-learning-goal-scope/);\nassert.match(html, /Bank A/);\nassert.match(html, /Bank B/);\n\nconst reviewSource = fs.readFileSync('src/ui/review-center.js', 'utf8');\nconst mainSource = fs.readFileSync('src/app/main.js', 'utf8');\nconst css = fs.readFileSync('styles/v4-learning-goals.css', 'utf8');\nconst htmlSource = fs.readFileSync('v3.html', 'utf8');\nconst sw = fs.readFileSync('service-worker.js', 'utf8');\n\nassert.match(reviewSource, /renderLearningGoalPanel/);\nassert.match(reviewSource, /goalModel/);\n\nassert.match(mainSource, /listLearningGoals/);\nassert.match(mainSource, /saveLearningGoal/);\nassert.match(mainSource, /listAllAttempts/);\nassert.match(mainSource, /buildLearningGoalProgress/);\nassert.match(mainSource, /learningGoalScope/);\nassert.match(mainSource, /data-learning-goal-form/);\nassert.match(mainSource, /data-learning-goal-scope/);\nassert.match(mainSource, /createLearningGoalSaveInput/);\n\nassert.match(css, /\\.learning-goal-panel/);\nassert.match(css, /\\.learning-goal-dashboard/);\nassert.match(css, /\\.learning-goal-week/);\nassert.match(css, /\\.learning-goal-form/);\nassert.match(css, /@media \\(max-width: 520px\\)/);\n\nassert.match(htmlSource, /styles\\/v4-learning-goals\\.css/);\nassert.match(sw, /\\.\\/styles\\/v4-learning-goals\\.css/);\nassert.match(sw, /\\.\\/src\\/ui\\/learning-goals\\.js/);\nassert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-\\d+'/);\n\nconsole.log('MoXin Quiz v4.0 P3.1 learning goal UI tests passed.');\n";
const DOC_CODE = "# 墨忻刷題網 v4.0 — P3.1 Learning Goal UI\n\n## 位置\n\nP3.1 放在「今日複習」頁面。\n\n原因是這個頁面本來就是每日學習節奏與複習路線的入口；學習目標放在 Hero 與題庫複習路線之間，可以同時顯示：\n\n- 今日一般刷題進度\n- 今日複習進度\n- 連續學習天數\n- 最近 7 日達成狀況\n- 全部題庫 / 指定題庫目標\n\n不額外增加主導覽項目。\n\n## Scope\n\n下拉選單支援：\n\n```text\n全部題庫\n指定本機題庫\n```\n\nGlobal goal 使用：\n\n```text\nid = global\nbankId = null\n```\n\n題庫目標使用：\n\n```text\nid = bank:<bankId>\nbankId = <bankId>\n```\n\n這讓 `learningGoals` store 可以同時保存全域與多個題庫目標。\n\n## UI 行為\n\n### 今日整體進度\n\nP3 Core 已提供的 `completionPercent` 直接呈現，不在 UI 重新發明計算規則。\n\n### 每日刷題 / 每日複習\n\n顯示：\n\n```text\n已完成 / 目標\n剩餘題數\n完成狀態\n```\n\n若 target = 0：\n\n```text\n目前沒有設定每日目標\n```\n\n### 最近 7 日\n\n每一天顯示：\n\n- 日期\n- 達成 ✓\n- 未達成百分比\n- 當天 unique answered 題數\n\n資料語義仍維持 P3 Core：\n\n> 使用「目前目標」回看最近七日，而不是假裝保存了歷史目標快照。\n\n### Streak\n\nUI 不自行計算 streak，只顯示 P3 Core 結果。\n\n## 儲存\n\n表單只保存：\n\n- enabled\n- dailyPracticeTarget\n- dailyReviewTarget\n- scope / bankId\n\n所有數值仍由 repository `normalizeLearningGoal()` 做第二層正規化。\n\n## RWD\n\n- Desktop：三張摘要卡、兩張 target 卡。\n- Tablet：表單 2 欄。\n- Mobile：摘要、target、表單全部單欄。\n- 最近 7 日會依螢幕寬度從 7 欄降為 4 欄、2 欄。\n\n## 下一步\n\nP3.1 實機驗收重點：\n\n1. Global target 儲存後重新進頁仍存在。\n2. 切換到某個題庫可建立獨立 target。\n3. 作答一般練習後 practice count 增加。\n4. due / wrong / unfamiliar / favorite 複習後 review count 增加。\n5. exam 不增加上述兩項，但 streak 可維持。\n6. 同題 retry 不重複灌高題數。\n7. Light / Dark、Academy / Epic、Desktop / Mobile 都保持可讀。\n";

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

write('src/ui/learning-goals.js', UI_CODE);
write('styles/v4-learning-goals.css', CSS_CODE);
write('tests/v40-p31-learning-goals-ui-run.mjs', TEST_CODE);
write('docs/V4_0_P3_1_LEARNING_GOAL_UI.md', DOC_CODE);

// 1. review-center: embed goal panel between hero and review routes.
{
  const path = 'src/ui/review-center.js';
  let source = read(path);

  if (!source.includes("from './learning-goals.js'")) {
    source =
      "import { renderLearningGoalPanel } from './learning-goals.js';\n\n" +
      source;
  }

  source = replaceOne(
    source,
    'export function renderReviewCenter(container, groups) {',
    'export function renderReviewCenter(container, groups, options = {}) {',
    'review-center options',
  );

  source = replaceOne(
    source,
`    </section>

    <section class="learning-section-head">`,
`    </section>

    \${renderLearningGoalPanel(options.goalModel || {})}

    <section class="learning-section-head">`,
    'review goal panel insertion',
  );

  write(path, source);
}

// 2. main.js imports: goals repository, attempts aggregate, core engine and UI helpers.
{
  const path = 'src/app/main.js';
  let source = read(path);

  source = replaceOne(
    source,
`import {
  addAttempt,
  getAttemptsByBank,
} from '../storage/repositories/attempts.js';`,
`import {
  addAttempt,
  getAttemptsByBank,
  listAllAttempts,
} from '../storage/repositories/attempts.js';`,
    'main attempts import',
  );

  const reviewImport =
    "import { renderReviewCenter } from '../ui/review-center.js';";

  source = replaceOne(
    source,
    reviewImport,
`import { renderReviewCenter } from '../ui/review-center.js';
import {
  GLOBAL_SCOPE,
  createLearningGoalSaveInput,
  learningGoalIdForScope,
} from '../ui/learning-goals.js';
import {
  GLOBAL_GOAL_ID,
  listLearningGoals,
  normalizeLearningGoal,
  saveLearningGoal,
} from '../storage/repositories/goals.js';
import { buildLearningGoalProgress } from '../learning/goal-progress.js';`,
    'main P3.1 imports',
  );

  source = replaceOne(
    source,
`  reviewGroups: [],
  exam: null,`,
`  reviewGroups: [],
  learningGoalScope: GLOBAL_SCOPE,
  exam: null,`,
    'main learningGoalScope state',
  );

  // Add scope-change and submit handlers before review click handler.
  source = replaceOne(
    source,
`  elements.reviewArea.addEventListener('click', async event => {
    const button = event.target.closest('[data-review-bank][data-review-mode]');`,
`  elements.reviewArea.addEventListener('change', async event => {
    const scope = event.target.closest('[data-learning-goal-scope]');
    if (!scope) return;
    state.learningGoalScope = scope.value || GLOBAL_SCOPE;
    await openReviewCenter();
  });

  elements.reviewArea.addEventListener('submit', async event => {
    const form = event.target.closest('[data-learning-goal-form]');
    if (!form) return;
    event.preventDefault();

    const scope =
      form.querySelector('[data-learning-goal-form-scope]')?.value ||
      state.learningGoalScope ||
      GLOBAL_SCOPE;

    const payload = createLearningGoalSaveInput({
      scope,
      enabled: form.querySelector('[data-learning-goal-enabled]')?.checked === true,
      dailyPracticeTarget: form.querySelector('[data-learning-goal-practice]')?.value,
      dailyReviewTarget: form.querySelector('[data-learning-goal-review]')?.value,
    });

    await saveLearningGoal(payload);
    state.learningGoalScope = scope;
    showToast(elements.toastRegion, '學習目標已儲存。', 'success');
    await openReviewCenter();
  });

  elements.reviewArea.addEventListener('click', async event => {
    const button = event.target.closest('[data-review-bank][data-review-mode]');`,
    'main goal event handlers',
  );

  // Replace openReviewCenter with goal-aware version.
  const start = source.indexOf('async function openReviewCenter() {');
  const end = source.indexOf('\nasync function startDedicatedReview', start);
  if (start < 0 || end < 0) throw new Error('openReviewCenter block not found');

  const replacement = `async function openReviewCenter() {
  await refreshBanks();

  const [goals, attempts, groups] = await Promise.all([
    listLearningGoals(),
    listAllAttempts(),
    Promise.all(state.banks.map(async bank => {
      const [questions, progress, favorites, unfamiliar, due] = await Promise.all([
        getQuestionsByBank(bank.id),
        listQuestionProgress(bank.id),
        listFavorites(bank.id),
        listUnfamiliar(bank.id),
        listDueReviews(bank.id),
      ]);

      const validIds = new Set(questions.map(question => question.id));
      const wrongIds = new Set(
        progress
          .filter(item => item?.lastResult === 'wrong' && validIds.has(item.questionId))
          .map(item => item.questionId)
      );

      return {
        bank,
        questionCount: questions.length,
        counts: {
          due: due.filter(item => validIds.has(item.questionId)).length,
          wrong: wrongIds.size,
          favorite: favorites.filter(item => validIds.has(item.questionId)).length,
          unfamiliar: unfamiliar.filter(item => validIds.has(item.questionId)).length,
        },
      };
    })),
  ]);

  const validScopes = new Set([GLOBAL_SCOPE, ...state.banks.map(bank => String(bank.id))]);
  if (!validScopes.has(state.learningGoalScope)) {
    state.learningGoalScope = GLOBAL_SCOPE;
  }

  const selectedScope = state.learningGoalScope;
  const goalId = learningGoalIdForScope(selectedScope);
  const existingGoal = goals.find(goal => goal.id === goalId) || null;
  const bankId = selectedScope === GLOBAL_SCOPE ? null : selectedScope;
  const goal = existingGoal || normalizeLearningGoal({
    id: selectedScope === GLOBAL_SCOPE ? GLOBAL_GOAL_ID : goalId,
    bankId,
    enabled: false,
    dailyPracticeTarget: 0,
    dailyReviewTarget: 0,
  });

  const progress = buildLearningGoalProgress(goal, attempts, {
    historyDays: 7,
  });

  state.reviewGroups = groups;
  renderReviewCenter(elements.reviewArea, groups, {
    goalModel: {
      banks: state.banks,
      selectedScope,
      configured: Boolean(existingGoal),
      goal,
      progress,
    },
  });
  showView('review');
}
`;

  source = source.slice(0, start) + replacement + source.slice(end);
  write(path, source);
}

// 3. Release entry stylesheets.
// index.html and v3.html are intentionally locked to identical content by
// tests/release-cutover-run.mjs, so every release-entry HTML change must be
// applied to both files in the same installer step.
{
  for (const path of ['v3.html', 'index.html']) {
    let html = read(path);

    if (!html.includes('styles/v4-learning-goals.css')) {
      html = replaceOne(
        html,
        '  <link rel="stylesheet" href="styles/v4-learning-styles.css" />',
        '  <link rel="stylesheet" href="styles/v4-learning-styles.css" />\n  <link rel="stylesheet" href="styles/v4-learning-goals.css" />',
        `${path} P3.1 stylesheet`,
      );
    }

    write(path, html);
  }

  if (read('index.html') !== read('v3.html')) {
    throw new Error('P3.1 release entry mismatch: index.html and v3.html must stay identical');
  }
}

// 4. Service Worker.
{
  const path = 'service-worker.js';
  let sw = read(path);

  if (!sw.includes("'./styles/v4-learning-goals.css'")) {
    sw = replaceOne(
      sw,
      "  './styles/v4-learning-styles.css',",
      "  './styles/v4-learning-styles.css',\n  './styles/v4-learning-goals.css',",
      'P3.1 CSS APP_SHELL',
    );
  }

  if (!sw.includes("'./src/ui/learning-goals.js'")) {
    sw = replaceOne(
      sw,
      "  './src/ui/library.js',",
      "  './src/ui/library.js',\n  './src/ui/learning-goals.js',",
      'P3.1 UI APP_SHELL',
    );
  }

  sw = replaceOne(
    sw,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-8';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-9';",
    'P3.1 cache revision',
  );

  write(path, sw);
}

// 5. Regression chain.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const anchor =
    'node tests/v40-p3-learning-goals-core-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const replacement =
    'node tests/v40-p3-learning-goals-core-run.mjs && node tests/v40-p31-learning-goals-ui-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';

  if (!pkg.scripts.test.includes('v40-p31-learning-goals-ui-run.mjs')) {
    if (!pkg.scripts.test.includes(anchor)) {
      throw new Error('package.json P3.1 insertion anchor not found');
    }
    pkg.scripts.test = pkg.scripts.test.replace(anchor, replacement);
  }

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

// 6. Changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);

  if (!changelog.includes('## P3.1 — Learning Goal UI')) {
    const anchor = '## P3 — Learning Goal Progress Core';
    const section =
`## P3.1 — Learning Goal UI
- 「今日複習」頁新增學習目標 Dashboard，不增加主導覽負擔。
- 可設定全部題庫或指定題庫的每日一般刷題 / 每日複習目標。
- 顯示今日整體進度、practice / review 個別進度、連續學習天數與最近 7 日達成狀況。
- Scope 採 global / bank:<bankId>，可同時保存多組目標。
- UI 只呈現 P3 Core 結果，不重複實作統計邏輯。
- 新增 Desktop / Tablet / Mobile RWD，並加入 P3.1 regression。
- APP cache 更新至 r2k.5-9。

`;

    if (!changelog.includes(anchor)) throw new Error('P3 changelog anchor missing');
    changelog = changelog.replace(anchor, section + anchor);
  }

  write(path, changelog);
}

// 7. Self-check.
{
  const main = read('src/app/main.js');
  const review = read('src/ui/review-center.js');
  const html = read('v3.html');
  const indexHtml = read('index.html');
  const sw = read('service-worker.js');
  const pkg = JSON.parse(read('package.json'));

  if (indexHtml !== html) {
    throw new Error('P3.1 self-check failed: index.html and v3.html are not identical');
  }

  for (const [source, marker, label] of [
    [main, 'learningGoalScope: GLOBAL_SCOPE', 'goal scope state'],
    [main, 'buildLearningGoalProgress', 'goal progress usage'],
    [main, 'saveLearningGoal', 'goal save'],
    [main, "data-learning-goal-form", 'goal form handler'],
    [review, 'renderLearningGoalPanel', 'review goal panel'],
    [html, 'styles/v4-learning-goals.css', 'v3 goal css link'],
    [indexHtml, 'styles/v4-learning-goals.css', 'index goal css link'],
    [sw, "'./src/ui/learning-goals.js'", 'goal ui app shell'],
  ]) {
    if (!source.includes(marker)) throw new Error(`P3.1 self-check failed: ${label}`);
  }

  if (!pkg.scripts.test.includes('v40-p31-learning-goals-ui-run.mjs')) {
    throw new Error('P3.1 regression missing from package.json');
  }

  if (!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-9'")) {
    throw new Error('P3.1 cache revision missing');
  }
}

console.log('P3.1 learning goal UI patch applied successfully.');

const STATS_JS = "const MASTERY_LABELS = {\n  new: '尚未建立',\n  learning: '學習中',\n  familiar: '熟悉',\n  mastered: '已掌握',\n};\n\nconst TYPE_LABELS = {\n  'single-choice': '單選題',\n  'multiple-choice': '複選題',\n  'true-false': '是非題',\n  'fill-in': '填空題',\n  unknown: '未知題型',\n};\n\nexport const STATS_TAB = Object.freeze({\n  OVERVIEW: 'overview',\n  TRENDS: 'trends',\n  WEAKNESS: 'weakness',\n  BANKS: 'banks',\n});\n\nconst VALID_TABS = new Set(Object.values(STATS_TAB));\n\nexport function normalizeStatsTab(value) {\n  const tab = String(value || '').trim();\n  return VALID_TABS.has(tab) ? tab : STATS_TAB.OVERVIEW;\n}\n\nexport function renderLearningStats(container, data = {}) {\n  const overall = data.overall || {};\n  const globalAnalytics = data.globalAnalytics || {};\n  const analytics = data.analytics || globalAnalytics;\n  const banks = Array.isArray(data.banks) ? data.banks : [];\n  const activeTab = normalizeStatsTab(data.activeTab);\n  const scope = String(data.scope || 'global');\n  const windowDays = Number(data.windowDays) === 30 ? 30 : 7;\n  const accuracy = clampPercent(overall.accuracy);\n\n  container.innerHTML = `\n    <section class=\"learning-hero learning-stats-hero learning-hero-whole\" data-learning-scene=\"stats\">\n      <div class=\"learning-hero-art learning-hero-art-stats\" data-scene-art=\"stats\" aria-hidden=\"true\"></div>\n      <div class=\"learning-hero-content learning-stats-hero-content\">\n        <span class=\"learning-kicker\">學習統計</span>\n        <h2>先看全局，再深入趨勢與弱點</h2>\n        <p>統計資料只來自這個瀏覽器的 IndexedDB；分頁後不再把所有分析堆在同一張長頁面。</p>\n\n        <div class=\"learning-focus-strip stats learning-hero-stat-strip\">\n          ${metricCard('總作答', overall.attempts || 0, '▤')}\n          ${metricCard('已作答題', overall.answeredQuestions || 0, '✓')}\n          ${metricCard('今日到期', overall.due || 0, '↻')}\n        </div>\n      </div>\n\n      <div class=\"learning-hero-data-visual\" aria-label=\"整體正確率 ${accuracy}%\">\n        <div class=\"learning-accuracy-ring\" style=\"--accuracy:${accuracy * 3.6}deg\">\n          <div>\n            <strong>${accuracy}%</strong>\n            <span>整體正確率</span>\n          </div>\n        </div>\n        <p>${accuracyMessage(accuracy)}</p>\n      </div>\n    </section>\n\n    ${renderStatsTabs(activeTab)}\n\n    <div class=\"stats-workspace\" data-stats-workspace=\"${activeTab}\">\n      ${renderActiveTab(activeTab, {\n        overall,\n        globalAnalytics,\n        analytics,\n        banks,\n        scope,\n        windowDays,\n      })}\n    </div>\n  `;\n}\n\nexport function renderStatsTabs(activeTab) {\n  const active = normalizeStatsTab(activeTab);\n  const items = [\n    [STATS_TAB.OVERVIEW, '總覽', '最重要的學習指標'],\n    [STATS_TAB.TRENDS, '趨勢', '7 / 30 日變化'],\n    [STATS_TAB.WEAKNESS, '弱點分析', '題型與章節'],\n    [STATS_TAB.BANKS, '題庫分析', '逐題庫掌握狀態'],\n  ];\n\n  return `\n    <nav class=\"stats-tabs\" aria-label=\"學習統計功能\">\n      ${items.map(([key, label, note]) => `\n        <button\n          class=\"stats-tab ${active === key ? 'is-active' : ''}\"\n          type=\"button\"\n          data-stats-tab=\"${key}\"\n          aria-current=\"${active === key ? 'page' : 'false'}\"\n        >\n          <strong>${escapeHtml(label)}</strong>\n          <span>${escapeHtml(note)}</span>\n        </button>\n      `).join('')}\n    </nav>\n  `;\n}\n\nfunction renderActiveTab(activeTab, model) {\n  if (activeTab === STATS_TAB.TRENDS) return renderTrends(model);\n  if (activeTab === STATS_TAB.WEAKNESS) return renderWeakness(model);\n  if (activeTab === STATS_TAB.BANKS) return renderBankAnalysis(model);\n  return renderOverview(model);\n}\n\nfunction renderOverview({ overall, globalAnalytics, banks }) {\n  const recent7 = globalAnalytics.recent7 || {};\n  const recent30 = globalAnalytics.recent30 || {};\n  const weak = globalAnalytics.weakChapters?.[0] || null;\n  const strongestBank = [...banks]\n    .filter(item => Number(item.attempts || 0) > 0)\n    .sort((a, b) =>\n      Number(b.accuracy || 0) - Number(a.accuracy || 0) ||\n      Number(b.attempts || 0) - Number(a.attempts || 0)\n    )[0] || null;\n\n  return `\n    <section class=\"stats-overview-grid\">\n      ${overviewCard(\n        '最近 7 日',\n        `${Number(recent7.attempts || 0)} 次`,\n        `${clampPercent(recent7.accuracy)}% 正確率 · ${Number(recent7.activeDays || 0)} 個學習日`,\n        'week',\n      )}\n      ${overviewCard(\n        '最近 30 日',\n        `${Number(recent30.attempts || 0)} 次`,\n        `${clampPercent(recent30.accuracy)}% 正確率 · ${Number(recent30.activeDays || 0)} 個學習日`,\n        'month',\n      )}\n      ${overviewCard(\n        '優先弱點',\n        weak ? weak.key : '資料不足',\n        weak\n          ? `${clampPercent(weak.accuracy)}% · ${Number(weak.attempts || 0)} 次作答${weak.provisional ? ' · 樣本較少' : ''}`\n          : '完成更多題目後會開始辨識弱點',\n        'weak',\n      )}\n      ${overviewCard(\n        '目前題庫表現',\n        strongestBank ? `${clampPercent(strongestBank.accuracy)}%` : '—',\n        strongestBank\n          ? `${escapeHtml(strongestBank.bank.name || strongestBank.bank.title || strongestBank.bank.id)} · ${Number(strongestBank.attempts || 0)} 次`\n          : '尚無題庫作答資料',\n        'bank',\n      )}\n    </section>\n\n    <section class=\"stats-overview-detail-grid\">\n      <article class=\"stats-panel\">\n        <div class=\"stats-panel-head\">\n          <div>\n            <span class=\"learning-kicker\">最近 7 日</span>\n            <h3>每日作答量</h3>\n          </div>\n          <button type=\"button\" class=\"stats-inline-action\" data-stats-tab=\"trends\">查看完整趨勢</button>\n        </div>\n        ${renderMiniTrend(globalAnalytics.history7 || [])}\n      </article>\n\n      <article class=\"stats-panel\">\n        <div class=\"stats-panel-head\">\n          <div>\n            <span class=\"learning-kicker\">資料概況</span>\n            <h3>目前累積</h3>\n          </div>\n        </div>\n        <div class=\"stats-summary-list\">\n          ${summaryRow('總作答', overall.attempts || 0)}\n          ${summaryRow('正確作答', globalAnalytics.overall?.correct || 0)}\n          ${summaryRow('錯誤作答', globalAnalytics.overall?.wrong || 0)}\n          ${summaryRow('跨題庫已碰觸題目', globalAnalytics.overall?.uniqueQuestions || 0)}\n        </div>\n      </article>\n    </section>\n  `;\n}\n\nfunction renderTrends({ analytics, banks, scope, windowDays }) {\n  const series = windowDays === 30 ? analytics.history30 || [] : analytics.history7 || [];\n  const summary = windowDays === 30 ? analytics.recent30 || {} : analytics.recent7 || [];\n\n  return `\n    ${renderAnalysisToolbar({ banks, scope, windowDays, showWindow: true })}\n\n    <section class=\"stats-trend-summary\">\n      ${smallSummaryCard(`${windowDays} 日作答`, summary.attempts || 0)}\n      ${smallSummaryCard(`${windowDays} 日正確率`, `${clampPercent(summary.accuracy)}%`)}\n      ${smallSummaryCard('有學習天數', `${Number(summary.activeDays || 0)} / ${windowDays}`)}\n      ${smallSummaryCard('題目觸及次數', summary.uniqueQuestionTouches || 0)}\n    </section>\n\n    <section class=\"stats-chart-grid\">\n      <article class=\"stats-panel\">\n        <div class=\"stats-panel-head\">\n          <div>\n            <span class=\"learning-kicker\">作答趨勢</span>\n            <h3>每天做了多少題</h3>\n          </div>\n        </div>\n        ${renderBarChart(series, 'attempts', '作答')}\n      </article>\n\n      <article class=\"stats-panel\">\n        <div class=\"stats-panel-head\">\n          <div>\n            <span class=\"learning-kicker\">正確率趨勢</span>\n            <h3>每天的答題穩定度</h3>\n          </div>\n        </div>\n        ${renderBarChart(series, 'accuracy', '正確率', { percent: true })}\n      </article>\n    </section>\n  `;\n}\n\nfunction renderWeakness({ analytics, banks, scope, windowDays }) {\n  const weak = Array.isArray(analytics.weakChapters) ? analytics.weakChapters : [];\n  const types = Array.isArray(analytics.typeAccuracy) ? analytics.typeAccuracy : [];\n  const chapters = (Array.isArray(analytics.chapterAccuracy) ? analytics.chapterAccuracy : [])\n    .filter(item => item.key !== '已移除題目');\n\n  return `\n    ${renderAnalysisToolbar({ banks, scope, windowDays, showWindow: false })}\n\n    <section class=\"stats-weak-grid\">\n      <article class=\"stats-panel\">\n        <div class=\"stats-panel-head\">\n          <div>\n            <span class=\"learning-kicker\">優先處理</span>\n            <h3>弱點章節</h3>\n            <p>預設至少 3 次作答才視為正式弱點；不足時會標示樣本較少。</p>\n          </div>\n        </div>\n\n        <div class=\"stats-weak-list\">\n          ${weak.length ? weak.map((item, index) => `\n            <div class=\"stats-weak-row\">\n              <span class=\"stats-rank\">${String(index + 1).padStart(2, '0')}</span>\n              <div>\n                <strong>${escapeHtml(item.key)}</strong>\n                <small>${Number(item.attempts || 0)} 次作答 · ${Number(item.wrong || 0)} 次錯誤${item.provisional ? ' · 樣本較少' : ''}</small>\n              </div>\n              <b>${clampPercent(item.accuracy)}%</b>\n            </div>\n          `).join('') : emptyInline('目前還沒有足夠資料辨識弱點。')}\n        </div>\n      </article>\n\n      <article class=\"stats-panel\">\n        <div class=\"stats-panel-head\">\n          <div>\n            <span class=\"learning-kicker\">題型表現</span>\n            <h3>哪一種題型比較不穩定</h3>\n          </div>\n        </div>\n\n        <div class=\"stats-dimension-list\">\n          ${types.length ? types.map(item =>\n            dimensionRow(TYPE_LABELS[item.key] || item.key, item)\n          ).join('') : emptyInline('目前沒有題型作答資料。')}\n        </div>\n      </article>\n    </section>\n\n    <section class=\"stats-panel\">\n      <div class=\"stats-panel-head\">\n        <div>\n          <span class=\"learning-kicker\">章節表現</span>\n          <h3>所有章節正確率</h3>\n        </div>\n      </div>\n      <div class=\"stats-chapter-grid\">\n        ${chapters.length ? chapters.map(item => dimensionRow(item.key, item)).join('') : emptyInline('目前沒有章節統計資料。')}\n      </div>\n      ${renderDataQuality(analytics.dataQuality)}\n    </section>\n  `;\n}\n\nfunction renderBankAnalysis({ banks }) {\n  return `\n    <section class=\"learning-section-head compact\">\n      <div>\n        <span class=\"learning-kicker\">題庫分析</span>\n        <h2>逐題庫查看掌握狀態</h2>\n        <p>這一頁只處理題庫比較，不再混入趨勢與弱點圖表。</p>\n      </div>\n    </section>\n\n    <div class=\"stats-bank-list learning-stats-list\">\n      ${banks.length ? banks.map(renderBankStats).join('') : `\n        <div class=\"learning-empty\">\n          <div class=\"learning-empty-icon\" aria-hidden=\"true\">▥</div>\n          <strong>還沒有統計資料</strong>\n          <p>完成一些題目後，這裡會開始顯示你的學習進度與熟練度。</p>\n        </div>\n      `}\n    </div>\n  `;\n}\n\nfunction renderAnalysisToolbar({ banks, scope, windowDays, showWindow }) {\n  return `\n    <section class=\"stats-toolbar\">\n      <label>\n        <span>分析範圍</span>\n        <select data-stats-scope>\n          <option value=\"global\" ${scope === 'global' ? 'selected' : ''}>全部題庫</option>\n          ${banks.map(item => `\n            <option value=\"${escapeAttr(item.bank.id)}\" ${scope === String(item.bank.id) ? 'selected' : ''}>\n              ${escapeHtml(item.bank.name || item.bank.title || item.bank.id)}\n            </option>\n          `).join('')}\n        </select>\n      </label>\n\n      ${showWindow ? `\n        <div class=\"stats-window-switch\" role=\"group\" aria-label=\"趨勢期間\">\n          <button type=\"button\" data-stats-window=\"7\" class=\"${windowDays === 7 ? 'is-active' : ''}\">7 日</button>\n          <button type=\"button\" data-stats-window=\"30\" class=\"${windowDays === 30 ? 'is-active' : ''}\">30 日</button>\n        </div>\n      ` : ''}\n    </section>\n  `;\n}\n\nfunction renderBankStats(item) {\n  const m = item.mastery || {};\n  const total = Math.max(\n    1,\n    Number(m.new || 0) +\n      Number(m.learning || 0) +\n      Number(m.familiar || 0) +\n      Number(m.mastered || 0),\n  );\n\n  return `\n    <article class=\"stats-bank-card learning-stats-card\">\n      <header class=\"learning-bank-header\">\n        <div class=\"learning-bank-symbol stats\" aria-hidden=\"true\">▥</div>\n        <div>\n          <span class=\"learning-bank-id\">${escapeHtml(item.bank.id)}</span>\n          <h3>${escapeHtml(item.bank.name || item.bank.title || item.bank.id)}</h3>\n          <p>${item.questionCount} 題</p>\n        </div>\n\n        <div class=\"learning-bank-accuracy\">\n          <strong>${clampPercent(item.accuracy)}%</strong>\n          <span>正確率</span>\n        </div>\n      </header>\n\n      <div class=\"learning-stat-row\">\n        ${smallStat('作答次數', item.attempts)}\n        ${smallStat('目前錯題', item.wrong)}\n        ${smallStat('今日到期', item.due)}\n      </div>\n\n      <div class=\"mastery-block learning-mastery-block\">\n        <div class=\"learning-mastery-heading\">\n          <div>\n            <span>熟練度分布</span>\n            <strong>${Number(m.mastered || 0)} 題已掌握</strong>\n          </div>\n        </div>\n\n        <div class=\"learning-mastery-bar\" aria-label=\"熟練度分布\">\n          ${masterySegment('new', m.new, total)}\n          ${masterySegment('learning', m.learning, total)}\n          ${masterySegment('familiar', m.familiar, total)}\n          ${masterySegment('mastered', m.mastered, total)}\n        </div>\n\n        <div class=\"mastery-row learning-mastery-legend\">\n          ${masteryCell('new', m.new)}\n          ${masteryCell('learning', m.learning)}\n          ${masteryCell('familiar', m.familiar)}\n          ${masteryCell('mastered', m.mastered)}\n        </div>\n      </div>\n    </article>\n  `;\n}\n\nfunction renderBarChart(series, key, label, { percent = false } = {}) {\n  const values = (Array.isArray(series) ? series : []).map(item => Number(item?.[key] || 0));\n  const maxValue = percent ? 100 : Math.max(1, ...values);\n\n  if (!series?.length) return emptyInline('目前沒有可顯示的趨勢資料。');\n\n  return `\n    <div class=\"stats-bar-chart ${series.length > 10 ? 'is-dense' : ''}\" aria-label=\"${escapeAttr(label)}趨勢\">\n      ${series.map(item => {\n        const value = Number(item?.[key] || 0);\n        const height = percent\n          ? clampPercent(value)\n          : Math.max(0, Math.min(100, Math.round(value / maxValue * 100)));\n        return `\n          <div class=\"stats-bar-column\" title=\"${escapeAttr(`${item.dateKey} · ${label} ${percent ? `${value}%` : value}`)}\">\n            <div class=\"stats-bar-track\">\n              <i style=\"height:${height}%\"></i>\n            </div>\n            <strong>${percent ? `${clampPercent(value)}%` : value}</strong>\n            <span>${formatShortDate(item.dateKey)}</span>\n          </div>\n        `;\n      }).join('')}\n    </div>\n  `;\n}\n\nfunction renderMiniTrend(series) {\n  const items = Array.isArray(series) ? series : [];\n  const max = Math.max(1, ...items.map(item => Number(item.attempts || 0)));\n\n  return `\n    <div class=\"stats-mini-trend\">\n      ${items.map(item => `\n        <div title=\"${escapeAttr(`${item.dateKey} · ${Number(item.attempts || 0)} 次`)}\">\n          <i style=\"height:${Math.max(6, Math.round(Number(item.attempts || 0) / max * 100))}%\"></i>\n          <span>${formatShortDate(item.dateKey)}</span>\n        </div>\n      `).join('')}\n    </div>\n  `;\n}\n\nfunction dimensionRow(label, item) {\n  const accuracy = clampPercent(item.accuracy);\n  return `\n    <div class=\"stats-dimension-row\">\n      <div class=\"stats-dimension-copy\">\n        <strong>${escapeHtml(label)}</strong>\n        <small>${Number(item.attempts || 0)} 次 · ${Number(item.wrong || 0)} 錯</small>\n      </div>\n      <div class=\"stats-dimension-meter\" aria-label=\"${escapeAttr(label)}正確率 ${accuracy}%\">\n        <i style=\"width:${accuracy}%\"></i>\n      </div>\n      <b>${accuracy}%</b>\n    </div>\n  `;\n}\n\nfunction renderDataQuality(dataQuality = {}) {\n  const missingTime = Number(dataQuality.attemptsWithoutValidTimestamp || 0);\n  const missingQuestion = Number(dataQuality.attemptsWithoutQuestionMetadata || 0);\n  if (!missingTime && !missingQuestion) return '';\n\n  return `\n    <aside class=\"stats-data-quality\">\n      <strong>資料完整性提醒</strong>\n      <span>${missingTime ? `${missingTime} 筆作答缺少有效時間。` : ''}</span>\n      <span>${missingQuestion ? `${missingQuestion} 筆歷史作答已找不到目前題目 metadata。` : ''}</span>\n    </aside>\n  `;\n}\n\nfunction overviewCard(label, value, note, kind) {\n  return `\n    <article class=\"stats-overview-card ${escapeAttr(kind)}\">\n      <span>${escapeHtml(label)}</span>\n      <strong>${escapeHtml(String(value))}</strong>\n      <small>${note}</small>\n    </article>\n  `;\n}\n\nfunction smallSummaryCard(label, value) {\n  return `\n    <article>\n      <span>${escapeHtml(label)}</span>\n      <strong>${escapeHtml(String(value))}</strong>\n    </article>\n  `;\n}\n\nfunction summaryRow(label, value) {\n  return `\n    <div>\n      <span>${escapeHtml(label)}</span>\n      <strong>${escapeHtml(String(value))}</strong>\n    </div>\n  `;\n}\n\nfunction metricCard(label, value, icon) {\n  return `\n    <div class=\"learning-focus-item\">\n      <span class=\"learning-metric-icon\" aria-hidden=\"true\">${escapeHtml(icon)}</span>\n      <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>\n    </div>\n  `;\n}\n\nfunction smallStat(label, value) {\n  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;\n}\n\nfunction masterySegment(key, value, total) {\n  const percent = Math.max(0, (Number(value) || 0) / total * 100);\n  return `<span class=\"${key}\" style=\"width:${percent}%\"></span>`;\n}\n\nfunction masteryCell(key, value) {\n  return `\n    <div class=\"mastery-cell ${key}\">\n      <span>${escapeHtml(MASTERY_LABELS[key])}</span>\n      <strong>${value || 0}</strong>\n    </div>\n  `;\n}\n\nfunction emptyInline(message) {\n  return `<div class=\"stats-empty-inline\">${escapeHtml(message)}</div>`;\n}\n\nfunction accuracyMessage(accuracy) {\n  if (accuracy >= 80) return '目前整體表現穩定，可以進一步觀察零散弱點與長期趨勢。';\n  if (accuracy >= 60) return '已建立一定基礎，接下來可從弱點章節與錯題集中加強。';\n  return '先從錯題與低正確率章節開始，逐步建立穩定的答題記憶。';\n}\n\nfunction formatShortDate(dateKey) {\n  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(dateKey || ''));\n  return match ? `${Number(match[2])}/${Number(match[3])}` : String(dateKey || '');\n}\n\nfunction clampPercent(value) {\n  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));\n}\n\nfunction escapeHtml(value) {\n  return String(value ?? '')\n    .replaceAll('&', '&amp;')\n    .replaceAll('<', '&lt;')\n    .replaceAll('>', '&gt;')\n    .replaceAll('\"', '&quot;')\n    .replaceAll(\"'\", '&#039;');\n}\n\nfunction escapeAttr(value) {\n  return escapeHtml(value).replaceAll('`', '&#096;');\n}\n";
const STATS_CSS = "/* v4.0 P5.1 — Statistics IA & UI */\n\n.stats-tabs {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: .55rem;\n  margin: 1rem 0;\n  padding: .55rem;\n  border: 1px solid var(--learn-line);\n  border-radius: 18px;\n  background: color-mix(in srgb, var(--learn-surface) 92%, transparent);\n  box-shadow: var(--learn-shadow-soft);\n}\n\n.stats-tab {\n  display: grid;\n  gap: .18rem;\n  min-width: 0;\n  min-height: 64px;\n  padding: .68rem .78rem;\n  border: 1px solid transparent;\n  border-radius: 13px;\n  background: transparent;\n  color: var(--learn-muted);\n  text-align: left;\n  cursor: pointer;\n}\n\n.stats-tab strong {\n  color: var(--learn-text);\n  font-size: .9rem;\n}\n\n.stats-tab span {\n  overflow: hidden;\n  font-size: .69rem;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.stats-tab:hover {\n  background: var(--learn-surface-soft);\n}\n\n.stats-tab.is-active {\n  border-color: color-mix(in srgb, var(--learn-primary) 36%, var(--learn-line));\n  background: color-mix(in srgb, var(--learn-primary) 10%, var(--learn-surface));\n}\n\n.stats-tab.is-active strong {\n  color: var(--learn-primary);\n}\n\n.stats-workspace {\n  min-width: 0;\n}\n\n.stats-overview-grid {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: .65rem;\n}\n\n.stats-overview-card,\n.stats-panel,\n.stats-trend-summary > article {\n  border: 1px solid var(--learn-line);\n  background: var(--learn-surface-strong);\n  box-shadow: var(--learn-shadow-soft);\n}\n\n.stats-overview-card {\n  display: grid;\n  gap: .48rem;\n  min-height: 145px;\n  padding: .9rem;\n  border-radius: 16px;\n}\n\n.stats-overview-card > span,\n.stats-trend-summary span {\n  color: var(--learn-muted);\n  font-size: .72rem;\n  font-weight: 800;\n}\n\n.stats-overview-card > strong {\n  color: var(--learn-text);\n  font-size: clamp(1.3rem, 2.6vw, 1.8rem);\n}\n\n.stats-overview-card > small {\n  color: var(--learn-muted);\n  line-height: 1.45;\n}\n\n.stats-overview-detail-grid,\n.stats-chart-grid,\n.stats-weak-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: .75rem;\n  margin-top: .75rem;\n}\n\n.stats-panel {\n  min-width: 0;\n  padding: 1rem;\n  border-radius: 18px;\n}\n\n.stats-panel-head {\n  display: flex;\n  align-items: start;\n  justify-content: space-between;\n  gap: .8rem;\n  margin-bottom: .8rem;\n}\n\n.stats-panel-head h3 {\n  margin: .14rem 0 0;\n  color: var(--learn-text);\n}\n\n.stats-panel-head p {\n  margin: .3rem 0 0;\n  color: var(--learn-muted);\n  font-size: .76rem;\n  line-height: 1.5;\n}\n\n.stats-inline-action {\n  border: 0;\n  background: transparent;\n  color: var(--learn-primary);\n  font: inherit;\n  font-size: .74rem;\n  font-weight: 800;\n  cursor: pointer;\n}\n\n.stats-summary-list {\n  display: grid;\n  gap: .45rem;\n}\n\n.stats-summary-list > div {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 1rem;\n  padding: .6rem .7rem;\n  border-radius: 11px;\n  background: var(--learn-surface-soft);\n}\n\n.stats-summary-list span {\n  color: var(--learn-muted);\n  font-size: .76rem;\n}\n\n.stats-summary-list strong {\n  color: var(--learn-text);\n}\n\n.stats-mini-trend {\n  display: grid;\n  grid-template-columns: repeat(7, minmax(0, 1fr));\n  gap: .35rem;\n  align-items: end;\n  min-height: 150px;\n}\n\n.stats-mini-trend > div {\n  display: grid;\n  grid-template-rows: 110px auto;\n  gap: .25rem;\n  align-items: end;\n  text-align: center;\n}\n\n.stats-mini-trend i {\n  display: block;\n  width: min(28px, 70%);\n  min-height: 4px;\n  margin: auto auto 0;\n  border-radius: 7px 7px 3px 3px;\n  background: linear-gradient(to top, var(--learn-primary), var(--learn-cyan));\n}\n\n.stats-mini-trend span {\n  color: var(--learn-muted);\n  font-size: .62rem;\n}\n\n.stats-toolbar {\n  display: flex;\n  align-items: end;\n  justify-content: space-between;\n  gap: .8rem;\n  margin-bottom: .75rem;\n  padding: .75rem;\n  border: 1px solid var(--learn-line);\n  border-radius: 15px;\n  background: var(--learn-surface);\n}\n\n.stats-toolbar label {\n  display: grid;\n  gap: .3rem;\n  min-width: min(100%, 310px);\n}\n\n.stats-toolbar label > span {\n  color: var(--learn-muted);\n  font-size: .74rem;\n  font-weight: 800;\n}\n\n.stats-toolbar select {\n  min-height: 42px;\n  border: 1px solid var(--learn-line);\n  border-radius: 11px;\n  padding: .55rem .7rem;\n  background: var(--learn-surface-strong);\n  color: var(--learn-text);\n  font: inherit;\n}\n\n.stats-window-switch {\n  display: inline-flex;\n  gap: .3rem;\n  padding: .28rem;\n  border: 1px solid var(--learn-line);\n  border-radius: 12px;\n  background: var(--learn-surface-soft);\n}\n\n.stats-window-switch button {\n  min-height: 34px;\n  border: 0;\n  border-radius: 9px;\n  padding: .38rem .75rem;\n  background: transparent;\n  color: var(--learn-muted);\n  font: inherit;\n  font-size: .76rem;\n  font-weight: 800;\n  cursor: pointer;\n}\n\n.stats-window-switch button.is-active {\n  background: var(--learn-surface-strong);\n  color: var(--learn-primary);\n  box-shadow: var(--learn-shadow-soft);\n}\n\n.stats-trend-summary {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: .55rem;\n}\n\n.stats-trend-summary > article {\n  display: grid;\n  gap: .25rem;\n  padding: .72rem .8rem;\n  border-radius: 13px;\n}\n\n.stats-trend-summary strong {\n  color: var(--learn-text);\n  font-size: 1.15rem;\n}\n\n.stats-bar-chart {\n  display: grid;\n  grid-template-columns: repeat(7, minmax(34px, 1fr));\n  gap: .38rem;\n  align-items: end;\n  overflow-x: auto;\n  overscroll-behavior-inline: contain;\n  scrollbar-gutter: stable;\n  min-height: 250px;\n  padding: .25rem .15rem .35rem;\n}\n\n.stats-bar-chart.is-dense {\n  grid-template-columns: repeat(30, minmax(28px, 1fr));\n}\n\n.stats-bar-column {\n  display: grid;\n  grid-template-rows: 175px auto auto;\n  gap: .2rem;\n  min-width: 0;\n  text-align: center;\n}\n\n.stats-bar-track {\n  display: flex;\n  align-items: end;\n  justify-content: center;\n  overflow: hidden;\n  border-radius: 8px;\n  background: color-mix(in srgb, var(--learn-primary) 7%, var(--learn-surface-soft));\n}\n\n.stats-bar-track i {\n  width: min(24px, 68%);\n  min-height: 2px;\n  border-radius: 7px 7px 2px 2px;\n  background: linear-gradient(to top, var(--learn-primary), var(--learn-cyan));\n}\n\n.stats-bar-column strong {\n  color: var(--learn-text);\n  font-size: .67rem;\n}\n\n.stats-bar-column span {\n  color: var(--learn-muted);\n  font-size: .58rem;\n}\n\n.stats-weak-list,\n.stats-dimension-list,\n.stats-chapter-grid {\n  display: grid;\n  gap: .48rem;\n}\n\n.stats-chapter-grid {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n\n.stats-weak-row {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) auto;\n  gap: .65rem;\n  align-items: center;\n  padding: .68rem;\n  border: 1px solid var(--learn-line);\n  border-radius: 12px;\n  background: var(--learn-surface-soft);\n}\n\n.stats-rank {\n  display: grid;\n  place-items: center;\n  width: 2rem;\n  height: 2rem;\n  border-radius: 9px;\n  background: color-mix(in srgb, var(--learn-danger) 10%, var(--learn-surface));\n  color: var(--learn-danger);\n  font-size: .67rem;\n  font-weight: 900;\n}\n\n.stats-weak-row > div {\n  display: grid;\n  gap: .12rem;\n}\n\n.stats-weak-row strong,\n.stats-dimension-row strong {\n  color: var(--learn-text);\n}\n\n.stats-weak-row small,\n.stats-dimension-row small {\n  color: var(--learn-muted);\n  font-size: .68rem;\n}\n\n.stats-weak-row > b {\n  color: var(--learn-danger);\n}\n\n.stats-dimension-row {\n  display: grid;\n  grid-template-columns: minmax(110px, .8fr) minmax(100px, 1.4fr) auto;\n  gap: .6rem;\n  align-items: center;\n  padding: .62rem .68rem;\n  border: 1px solid var(--learn-line);\n  border-radius: 11px;\n  background: var(--learn-surface-soft);\n}\n\n.stats-dimension-copy {\n  display: grid;\n  gap: .12rem;\n  min-width: 0;\n}\n\n.stats-dimension-copy strong,\n.stats-dimension-copy small {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.stats-dimension-meter {\n  height: 8px;\n  overflow: hidden;\n  border-radius: 999px;\n  background: color-mix(in srgb, var(--learn-line) 65%, transparent);\n}\n\n.stats-dimension-meter i {\n  display: block;\n  height: 100%;\n  border-radius: inherit;\n  background: linear-gradient(90deg, var(--learn-primary), var(--learn-teal));\n}\n\n.stats-dimension-row > b {\n  min-width: 3rem;\n  color: var(--learn-text);\n  text-align: right;\n  font-size: .78rem;\n}\n\n.stats-data-quality {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .45rem .8rem;\n  margin-top: .7rem;\n  padding: .65rem .72rem;\n  border: 1px dashed color-mix(in srgb, var(--learn-gold) 52%, var(--learn-line));\n  border-radius: 11px;\n  background: color-mix(in srgb, var(--learn-gold) 8%, var(--learn-surface));\n  color: var(--learn-muted);\n  font-size: .7rem;\n}\n\n.stats-data-quality strong {\n  color: var(--learn-gold);\n}\n\n.stats-empty-inline {\n  padding: 1rem;\n  border: 1px dashed var(--learn-line-strong);\n  border-radius: 11px;\n  color: var(--learn-muted);\n  text-align: center;\n}\n\n@media (max-width: 980px) {\n  .stats-overview-grid,\n  .stats-trend-summary {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .stats-chapter-grid {\n    grid-template-columns: 1fr;\n  }\n}\n\n@media (max-width: 820px) {\n  .stats-tabs {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .stats-overview-detail-grid,\n  .stats-chart-grid,\n  .stats-weak-grid {\n    grid-template-columns: 1fr;\n  }\n}\n\n@media (max-width: 620px) {\n  #statsView .learning-stats-hero {\n    padding: .9rem;\n  }\n\n  #statsView .learning-stats-hero h2 {\n    font-size: clamp(1.45rem, 7vw, 1.9rem);\n  }\n\n  .stats-tabs {\n    grid-template-columns: 1fr;\n    margin-top: .65rem;\n  }\n\n  .stats-tab {\n    min-height: 0;\n  }\n\n  .stats-overview-grid,\n  .stats-trend-summary {\n    grid-template-columns: 1fr 1fr;\n  }\n\n  .stats-toolbar {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .stats-toolbar label,\n  .stats-window-switch {\n    width: 100%;\n  }\n\n  .stats-window-switch button {\n    flex: 1;\n  }\n\n  .stats-dimension-row {\n    grid-template-columns: minmax(0, 1fr) auto;\n  }\n\n  .stats-dimension-meter {\n    grid-column: 1 / -1;\n    grid-row: 2;\n  }\n}\n\n@media (max-width: 420px) {\n  .stats-overview-grid,\n  .stats-trend-summary {\n    grid-template-columns: 1fr;\n  }\n}\n";
const TEST_JS = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nimport {\n  STATS_TAB,\n  normalizeStatsTab,\n  renderLearningStats,\n  renderStatsTabs,\n} from '../src/ui/stats.js';\n\nassert.equal(normalizeStatsTab('trends'), STATS_TAB.TRENDS);\nassert.equal(normalizeStatsTab('unknown'), STATS_TAB.OVERVIEW);\n\nconst tabs = renderStatsTabs('weakness');\nassert.match(tabs, /data-stats-tab=\"overview\"/);\nassert.match(tabs, /data-stats-tab=\"trends\"/);\nassert.match(tabs, /data-stats-tab=\"weakness\"/);\nassert.match(tabs, /data-stats-tab=\"banks\"/);\nassert.match(tabs, /stats-tab is-active/);\n\nconst mockAnalytics = {\n  overall: {\n    attempts: 20,\n    correct: 14,\n    wrong: 6,\n    accuracy: 70,\n    uniqueQuestions: 12,\n  },\n  recent7: {\n    attempts: 9,\n    accuracy: 67,\n    activeDays: 4,\n    uniqueQuestionTouches: 8,\n  },\n  recent30: {\n    attempts: 20,\n    accuracy: 70,\n    activeDays: 9,\n    uniqueQuestionTouches: 17,\n  },\n  history7: Array.from({ length: 7 }, (_, index) => ({\n    dateKey: `2026-10-0${index + 1}`,\n    attempts: index + 1,\n    accuracy: 50 + index,\n  })),\n  history30: Array.from({ length: 30 }, (_, index) => ({\n    dateKey: `2026-09-${String(index + 1).padStart(2, '0')}`,\n    attempts: index % 4,\n    accuracy: 60,\n  })),\n  typeAccuracy: [\n    { key: 'single-choice', attempts: 10, wrong: 3, accuracy: 70 },\n    { key: 'fill-in', attempts: 4, wrong: 2, accuracy: 50 },\n  ],\n  chapterAccuracy: [\n    { key: '第一章', attempts: 8, wrong: 4, accuracy: 50 },\n    { key: '第二章', attempts: 7, wrong: 1, accuracy: 86 },\n  ],\n  weakChapters: [\n    { key: '第一章', attempts: 8, wrong: 4, accuracy: 50, provisional: false },\n  ],\n  dataQuality: {\n    attemptsWithoutValidTimestamp: 0,\n    attemptsWithoutQuestionMetadata: 0,\n  },\n};\n\nconst banks = [\n  {\n    bank: { id: 'erp', name: 'ERP 題庫' },\n    questionCount: 20,\n    attempts: 14,\n    accuracy: 71,\n    wrong: 3,\n    due: 2,\n    mastery: { new: 5, learning: 7, familiar: 5, mastered: 3 },\n  },\n];\n\nconst base = {\n  overall: {\n    attempts: 20,\n    accuracy: 70,\n    answeredQuestions: 12,\n    due: 2,\n  },\n  globalAnalytics: mockAnalytics,\n  analytics: mockAnalytics,\n  banks,\n  scope: 'global',\n  windowDays: 7,\n};\n\n{\n  const container = { innerHTML: '' };\n  renderLearningStats(container, { ...base, activeTab: 'overview' });\n  assert.match(container.innerHTML, /學習統計/);\n  assert.match(container.innerHTML, /總覽/);\n  assert.match(container.innerHTML, /最近 7 日/);\n  assert.match(container.innerHTML, /stats-mini-trend/);\n  assert.doesNotMatch(container.innerHTML, /data-stats-scope/);\n}\n\n{\n  const container = { innerHTML: '' };\n  renderLearningStats(container, { ...base, activeTab: 'trends' });\n  assert.match(container.innerHTML, /data-stats-scope/);\n  assert.match(container.innerHTML, /data-stats-window=\"7\"/);\n  assert.match(container.innerHTML, /data-stats-window=\"30\"/);\n  assert.match(container.innerHTML, /stats-bar-chart/);\n  assert.match(container.innerHTML, /7 日正確率/);\n}\n\n{\n  const container = { innerHTML: '' };\n  renderLearningStats(container, { ...base, activeTab: 'weakness' });\n  assert.match(container.innerHTML, /弱點章節/);\n  assert.match(container.innerHTML, /題型表現/);\n  assert.match(container.innerHTML, /單選題/);\n  assert.match(container.innerHTML, /第一章/);\n  assert.doesNotMatch(container.innerHTML, /learning-mastery-bar/);\n}\n\n{\n  const container = { innerHTML: '' };\n  renderLearningStats(container, { ...base, activeTab: 'banks' });\n  assert.match(container.innerHTML, /逐題庫查看掌握狀態/);\n  assert.match(container.innerHTML, /ERP 題庫/);\n  assert.match(container.innerHTML, /learning-mastery-bar/);\n  assert.match(container.innerHTML, /item\\.accuracy/);\n}\n\nconst main = fs.readFileSync('src/app/main.js', 'utf8');\nconst index = fs.readFileSync('index.html', 'utf8');\nconst v3 = fs.readFileSync('v3.html', 'utf8');\nconst sw = fs.readFileSync('service-worker.js', 'utf8');\nconst css = fs.readFileSync('styles/v4-stats.css', 'utf8');\n\nassert.match(main, /buildLearningAnalytics/);\nassert.match(main, /statsTab: 'overview'/);\nassert.match(main, /statsScope: 'global'/);\nassert.match(main, /statsWindowDays: 7/);\nassert.match(main, /statsModel: null/);\nassert.match(main, /function renderStatsFromCache\\(\\)/);\nassert.match(main, /data-stats-tab/);\nassert.match(main, /data-stats-window/);\nassert.match(main, /data-stats-scope/);\n\nconst tabHandler = main.match(\n  /const statsTab = event\\.target\\.closest\\('\\[data-stats-tab\\]'\\);[\\s\\S]{0,260}/\n)?.[0] || '';\nassert.match(tabHandler, /renderStatsFromCache/);\nassert.doesNotMatch(tabHandler, /openStats/);\n\nassert.equal(index, v3);\nassert.match(index, /styles\\/v4-stats\\.css/);\nassert.match(sw, /\\.\\/styles\\/v4-stats\\.css/);\nassert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-\\d+'/);\nassert.match(css, /\\.stats-tabs/);\nassert.match(css, /\\.stats-bar-chart/);\nassert.match(css, /@media \\(max-width: 620px\\)/);\n\nconsole.log('MoXin Quiz v4.0 P5.1 statistics IA/UI tests passed.');\n";
const DOC = "# 墨忻刷題網 v4.0 — P5.1 Statistics IA & UI\n\n## 目的\n\nP5 不採「所有圖表一路往下堆」的長頁架構。\n\n學習統計正式拆成：\n\n```text\n總覽\n趨勢\n弱點分析\n題庫分析\n```\n\n## 總覽\n\n只保留高層決策資訊：\n\n- 最近 7 日作答 / 正確率 / 學習日\n- 最近 30 日作答 / 正確率 / 學習日\n- 優先弱點章節\n- 題庫表現摘要\n- 7 日迷你作答圖\n\nHero 的總作答 / 整體正確率維持 Global，避免 scope 語意混亂。\n\n## 趨勢\n\n提供：\n\n- Global 或指定題庫\n- 7 / 30 日切換\n- 每日作答量\n- 每日正確率\n- 活躍學習日\n- 題目觸及次數\n\n30 日圖表使用水平捲動，不壓縮到無法辨識。\n\n## 弱點分析\n\n提供：\n\n- Global / 指定題庫\n- 弱點章節排序\n- 樣本不足標記\n- 題型正確率\n- 全章節正確率\n- 刪題 / 異常 timestamp 的資料品質提示\n\n## 題庫分析\n\n保留既有每題庫卡片：\n\n- 題數\n- 作答次數\n- 正確率\n- 目前錯題\n- 今日到期\n- 熟練度分布\n\n它現在有自己的頁籤，不再跟趨勢與弱點垂直堆疊。\n\n## 效能\n\n第一次進入「學習統計」：\n\n```text\nIndexedDB → build statsModel\n```\n\n之後切：\n\n```text\n總覽 / 趨勢 / 弱點分析 / 題庫分析\n```\n\n或切：\n\n```text\n7 / 30 日\nGlobal / 題庫\n```\n\n都只使用 cached model 與 P5 Analytics Core 重新計算，不重新讀 IndexedDB。\n\n## RWD\n\n- Desktop：4 個次層 Tab、雙欄分析\n- Tablet：2 × 2 Tab、主要分析改單欄\n- Mobile：Tab 單欄、Hero 壓縮、30 日圖表可橫向捲動\n\n## 下一階段\n\nP5.2 — Home Actions\n\n- 今日目標達成率\n- 連續學習天數\n- 繼續上次練習\n- 今日複習\n- 快速錯題\n- 考前衝刺入口\n- 最近完整備份時間 / 過久未備份提醒\n";

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

write('src/ui/stats.js', STATS_JS);
write('styles/v4-stats.css', STATS_CSS);
write('tests/v40-p51-statistics-ia-ui-run.mjs', TEST_JS);
write('docs/V4_0_P5_1_STATISTICS_IA_UI.md', DOC);

// main.js: integrate P5 analytics + cached Statistics workspace.
{
  const path = 'src/app/main.js';
  let s = read(path);

  s = replaceOne(
    s,
    "import { buildLearningGoalProgress } from '../learning/goal-progress.js';",
    "import { buildLearningGoalProgress } from '../learning/goal-progress.js';\nimport { buildLearningAnalytics } from '../learning/analytics.js';",
    'P5.1 analytics import',
  );

  s = replaceOne(
    s,
`  sprintPlan: null,
  exam: null,`,
`  sprintPlan: null,
  statsTab: 'overview',
  statsScope: 'global',
  statsWindowDays: 7,
  statsModel: null,
  exam: null,`,
    'P5.1 state',
  );

  s = replaceOne(
    s,
`  elements.examCenterArea.addEventListener('click', async event => {`,
`  elements.statsArea.addEventListener('click', event => {
    const statsTab = event.target.closest('[data-stats-tab]');
    if (statsTab) {
      state.statsTab = statsTab.dataset.statsTab || 'overview';
      renderStatsFromCache();
      return;
    }

    const windowButton = event.target.closest('[data-stats-window]');
    if (windowButton) {
      state.statsWindowDays = Number(windowButton.dataset.statsWindow) === 30 ? 30 : 7;
      renderStatsFromCache();
    }
  });

  elements.statsArea.addEventListener('change', event => {
    const scope = event.target.closest('[data-stats-scope]');
    if (!scope) return;
    state.statsScope = scope.value || 'global';
    renderStatsFromCache();
  });

  elements.examCenterArea.addEventListener('click', async event => {`,
    'P5.1 stats event handlers',
  );

  const start = s.indexOf('async function openStats() {');
  const end = s.indexOf('\nasync function openExamCenter()', start);
  if (start < 0 || end < 0) {
    throw new Error('P5.1 openStats boundaries missing');
  }

  const newBlock = `async function openStats() {
  await refreshBanks();

  const attempts = await listAllAttempts();

  const bankChunks = await Promise.all(state.banks.map(async bank => {
    const [questions, progress, due, schedules] = await Promise.all([
      getQuestionsByBank(bank.id),
      listQuestionProgress(bank.id),
      listDueReviews(bank.id),
      listReviewSchedules(bank.id),
    ]);

    return {
      bank,
      questions,
      progress,
      due,
      schedules,
    };
  }));

  const questions = bankChunks.flatMap(chunk =>
    chunk.questions.map(question => ({
      ...question,
      bankId: chunk.bank.id,
      questionId: question.id || question.questionId,
    }))
  );

  const attemptsByBank = new Map();
  for (const attempt of attempts) {
    const bankId = String(attempt.bankId || '');
    if (!attemptsByBank.has(bankId)) attemptsByBank.set(bankId, []);
    attemptsByBank.get(bankId).push(attempt);
  }

  const bankStats = bankChunks.map(chunk => {
    const bankAttempts = attemptsByBank.get(String(chunk.bank.id)) || [];
    const correct = bankAttempts.filter(item => item.correct).length;
    const accuracy = bankAttempts.length
      ? Math.round((correct / bankAttempts.length) * 100)
      : 0;
    const answered = new Set(bankAttempts.map(item => item.questionId)).size;
    const wrong = chunk.progress.filter(item => item.lastResult === 'wrong').length;

    return {
      bank: chunk.bank,
      questionCount: chunk.questions.length,
      attempts: bankAttempts.length,
      correct,
      accuracy,
      answered,
      wrong,
      due: chunk.due.length,
      mastery: summarizeMastery(
        chunk.questions.map(question => question.id),
        chunk.schedules,
      ),
    };
  });

  const totalAttempts = bankStats.reduce((sum, item) => sum + item.attempts, 0);
  const totalCorrect = bankStats.reduce((sum, item) => sum + item.correct, 0);

  state.statsModel = {
    attempts,
    questions,
    banks: bankStats,
    overall: {
      attempts: totalAttempts,
      accuracy: totalAttempts
        ? Math.round((totalCorrect / totalAttempts) * 100)
        : 0,
      answeredQuestions: bankStats.reduce((sum, item) => sum + item.answered, 0),
      due: bankStats.reduce((sum, item) => sum + item.due, 0),
    },
    globalAnalytics: buildLearningAnalytics({
      attempts,
      questions,
    }),
  };

  const validScopes = new Set(['global', ...state.banks.map(bank => String(bank.id))]);
  if (!validScopes.has(state.statsScope)) state.statsScope = 'global';

  renderStatsFromCache();
  showView('stats');
}

function renderStatsFromCache() {
  if (!state.statsModel) return false;

  const scope = state.statsScope || 'global';
  const analytics = scope === 'global'
    ? state.statsModel.globalAnalytics
    : buildLearningAnalytics({
        attempts: state.statsModel.attempts,
        questions: state.statsModel.questions,
      }, {
        bankId: scope,
      });

  renderLearningStats(elements.statsArea, {
    activeTab: state.statsTab,
    scope,
    windowDays: state.statsWindowDays,
    overall: state.statsModel.overall,
    globalAnalytics: state.statsModel.globalAnalytics,
    analytics,
    banks: state.statsModel.banks,
  });

  return true;
}

`;

  s = s.slice(0, start) + newBlock + s.slice(end);
  write(path, s);
}

// HTML stylesheet entry; preserve release invariant.
for (const path of ['v3.html', 'index.html']) {
  let html = read(path);
  if (!html.includes('styles/v4-stats.css')) {
    html = replaceOne(
      html,
      '  <link rel="stylesheet" href="styles/v4-learning-hub.css" />',
      '  <link rel="stylesheet" href="styles/v4-learning-hub.css" />\n  <link rel="stylesheet" href="styles/v4-stats.css" />',
      path + ' P5.1 stylesheet',
    );
  }
  write(path, html);
}

if (read('index.html') !== read('v3.html')) {
  throw new Error('P5.1 release entry mismatch: index.html and v3.html must stay identical');
}

// APP_SHELL + cache revision.
{
  const path = 'service-worker.js';
  let sw = read(path);

  if (!sw.includes("'./styles/v4-stats.css'")) {
    sw = replaceOne(
      sw,
      "  './styles/v4-learning-hub.css',",
      "  './styles/v4-learning-hub.css',\n  './styles/v4-stats.css',",
      'P5.1 stats CSS APP_SHELL',
    );
  }

  sw = replaceOne(
    sw,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-15';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-16';",
    'P5.1 cache revision',
  );

  write(path, sw);
}

// Regression chain.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const anchor =
    'node tests/v40-p5-analytics-core-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const replacement =
    'node tests/v40-p5-analytics-core-run.mjs && node tests/v40-p51-statistics-ia-ui-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';

  if (!pkg.scripts.test.includes('v40-p51-statistics-ia-ui-run.mjs')) {
    if (!pkg.scripts.test.includes(anchor)) {
      throw new Error('package.json P5.1 insertion anchor not found');
    }
    pkg.scripts.test = pkg.scripts.test.replace(anchor, replacement);
  }

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

// Changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);

  if (!changelog.includes('## P5.1 — Statistics IA & UI')) {
    const anchor = '## P5 — Analytics Core';
    const section =
      '## P5.1 — Statistics IA & UI\n' +
      '- 學習統計正式拆成「總覽 / 趨勢 / 弱點分析 / 題庫分析」第二層，不再使用超長單頁。\n' +
      '- Hero 維持 Global 總作答與整體正確率；scope 只影響深入分析，避免語意混淆。\n' +
      '- 趨勢頁支援 Global / Bank scope 與 7 / 30 日切換，顯示每日作答量與正確率。\n' +
      '- 弱點頁顯示弱點章節、樣本不足標記、題型正確率、章節正確率與資料品質提醒。\n' +
      '- 題庫分析保留既有熟練度卡片，但移到獨立頁籤。\n' +
      '- 新增 statsModel cache；切 Tab、期間或 scope 不重新查 IndexedDB。\n' +
      '- 新增 P5.1 Desktop / Tablet / Mobile RWD 與 regression。\n' +
      '- APP cache 更新至 r2k.5-16。\n\n';

    if (!changelog.includes(anchor)) {
      throw new Error('P5 Analytics Core changelog anchor missing');
    }
    changelog = changelog.replace(anchor, section + anchor);
  }

  write(path, changelog);
}

// Self-check.
{
  const main = read('src/app/main.js');
  const stats = read('src/ui/stats.js');
  const css = read('styles/v4-stats.css');
  const sw = read('service-worker.js');
  const pkg = JSON.parse(read('package.json'));

  for (const [source, marker, label] of [
    [main, 'buildLearningAnalytics', 'P5 analytics integration'],
    [main, "statsTab: 'overview'", 'Stats tab state'],
    [main, "statsScope: 'global'", 'Stats scope state'],
    [main, 'statsModel: null', 'Stats cached model'],
    [main, 'function renderStatsFromCache()', 'Stats cached renderer'],
    [stats, 'data-stats-tab', 'Stats IA tabs'],
    [stats, 'data-stats-window', '7/30 trend control'],
    [stats, 'data-stats-scope', 'Stats scope control'],
    [stats, 'learning-mastery-bar', 'Bank mastery compatibility'],
    [css, '.stats-bar-chart', 'Stats chart styles'],
  ]) {
    if (!source.includes(marker)) {
      throw new Error('P5.1 self-check failed: ' + label);
    }
  }

  if (!sw.includes("'./styles/v4-stats.css'")) {
    throw new Error('P5.1 stats CSS missing from APP_SHELL');
  }

  if (!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-16'")) {
    throw new Error('P5.1 cache revision missing');
  }

  if (!pkg.scripts.test.includes('v40-p51-statistics-ia-ui-run.mjs')) {
    throw new Error('P5.1 regression missing from package.json');
  }

  if (read('index.html') !== read('v3.html')) {
    throw new Error('P5.1 release entries diverged');
  }
}

console.log('P5.1 Statistics IA & UI applied successfully.');

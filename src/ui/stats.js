const MASTERY_LABELS = {
  new: '尚未建立',
  learning: '學習中',
  familiar: '熟悉',
  mastered: '已掌握',
};

const TYPE_LABELS = {
  'single-choice': '單選題',
  'multiple-choice': '複選題',
  'true-false': '是非題',
  'fill-in': '填空題',
  unknown: '未知題型',
};

export const STATS_TAB = Object.freeze({
  OVERVIEW: 'overview',
  TRENDS: 'trends',
  WEAKNESS: 'weakness',
  BANKS: 'banks',
});

const VALID_TABS = new Set(Object.values(STATS_TAB));

export function normalizeStatsTab(value) {
  const tab = String(value || '').trim();
  return VALID_TABS.has(tab) ? tab : STATS_TAB.OVERVIEW;
}

export function renderLearningStats(container, data = {}) {
  const overall = data.overall || {};
  const globalAnalytics = data.globalAnalytics || {};
  const analytics = data.analytics || globalAnalytics;
  const banks = Array.isArray(data.banks) ? data.banks : [];
  const activeTab = normalizeStatsTab(data.activeTab);
  const scope = String(data.scope || 'global');
  const windowDays = Number(data.windowDays) === 30 ? 30 : 7;
  const accuracy = clampPercent(overall.accuracy);

  container.innerHTML = `
    <section class="learning-hero learning-stats-hero learning-hero-whole" data-learning-scene="stats">
      <div class="learning-hero-art learning-hero-art-stats" data-scene-art="stats" aria-hidden="true"></div>
      <div class="learning-hero-content learning-stats-hero-content">
        <span class="learning-kicker">學習統計</span>
        <h2>先看全局，再深入趨勢與弱點</h2>
        <p>統計由目前保存在此裝置的學習紀錄計算；啟用跨裝置同步後，將納入已同步裝置的歷史紀錄。</p>

        <div class="learning-focus-strip stats learning-hero-stat-strip">
          ${metricCard('歷史總作答', overall.attempts || 0, '▤')}
          ${metricCard('已作答題', overall.answeredQuestions || 0, '✓')}
          ${metricCard('今日到期', overall.due || 0, '↻')}
        </div>
      </div>

      <div class="learning-hero-data-visual" aria-label="整體正確率 ${accuracy}%">
        <div class="learning-accuracy-ring" style="--accuracy:${accuracy * 3.6}deg">
          <div>
            <strong>${accuracy}%</strong>
            <span>整體正確率</span>
          </div>
        </div>
        <p>${accuracyMessage(accuracy)}</p>
      </div>
    </section>

    ${renderStatsTabs(activeTab)}

    <div class="stats-workspace" data-stats-workspace="${activeTab}">
      ${renderActiveTab(activeTab, {
        overall,
        globalAnalytics,
        analytics,
        banks,
        scope,
        windowDays,
      })}
    </div>
  `;
}

export function renderStatsTabs(activeTab) {
  const active = normalizeStatsTab(activeTab);
  const items = [
    [STATS_TAB.OVERVIEW, '總覽', '最重要的學習指標'],
    [STATS_TAB.TRENDS, '趨勢', '7 / 30 日變化'],
    [STATS_TAB.WEAKNESS, '弱點分析', '題型與章節'],
    [STATS_TAB.BANKS, '題庫分析', '逐題庫掌握狀態'],
  ];

  return `
    <nav class="stats-tabs" aria-label="學習統計功能">
      ${items.map(([key, label, note]) => `
        <button
          class="stats-tab ${active === key ? 'is-active' : ''}"
          type="button"
          data-stats-tab="${key}"
          aria-current="${active === key ? 'page' : 'false'}"
        >
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(note)}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

function renderActiveTab(activeTab, model) {
  if (activeTab === STATS_TAB.TRENDS) return renderTrends(model);
  if (activeTab === STATS_TAB.WEAKNESS) return renderWeakness(model);
  if (activeTab === STATS_TAB.BANKS) return renderBankAnalysis(model);
  return renderOverview(model);
}

function renderOverview({ overall, globalAnalytics, banks }) {
  const recent7 = globalAnalytics.recent7 || {};
  const recent30 = globalAnalytics.recent30 || {};
  const weak = globalAnalytics.weakChapters?.[0] || null;
  const strongestBank = [...banks]
    .filter(item => Number(item.attempts || 0) > 0)
    .sort((a, b) =>
      Number(b.accuracy || 0) - Number(a.accuracy || 0) ||
      Number(b.attempts || 0) - Number(a.attempts || 0)
    )[0] || null;

  return `
    <section class="stats-overview-grid">
      ${overviewCard(
        '最近 7 日',
        `${Number(recent7.attempts || 0)} 次`,
        `${clampPercent(recent7.accuracy)}% 正確率 · ${Number(recent7.activeDays || 0)} 個學習日`,
        'week',
      )}
      ${overviewCard(
        '最近 30 日',
        `${Number(recent30.attempts || 0)} 次`,
        `${clampPercent(recent30.accuracy)}% 正確率 · ${Number(recent30.activeDays || 0)} 個學習日`,
        'month',
      )}
      ${overviewCard(
        '優先弱點',
        weak ? weak.key : '資料不足',
        weak
          ? `${clampPercent(weak.accuracy)}% · ${Number(weak.attempts || 0)} 次作答${weak.provisional ? ' · 樣本較少' : ''}`
          : '完成更多題目後會開始辨識弱點',
        'weak',
      )}
      ${overviewCard(
        '目前題庫表現',
        strongestBank ? `${clampPercent(strongestBank.accuracy)}%` : '—',
        strongestBank
          ? `${escapeHtml(strongestBank.bank.name || strongestBank.bank.title || strongestBank.bank.id)} · ${Number(strongestBank.attempts || 0)} 次`
          : '尚無題庫作答資料',
        'bank',
      )}
    </section>

    <section class="stats-overview-detail-grid">
      <article class="stats-panel">
        <div class="stats-panel-head">
          <div>
            <span class="learning-kicker">最近 7 日</span>
            <h3>每日作答量</h3>
          </div>
          <button type="button" class="stats-inline-action" data-stats-tab="trends">查看完整趨勢</button>
        </div>
        ${renderMiniTrend(globalAnalytics.history7 || [])}
      </article>

      <article class="stats-panel">
        <div class="stats-panel-head">
          <div>
            <span class="learning-kicker">資料概況</span>
            <h3>目前累積</h3>
          </div>
        </div>
        <div class="stats-summary-list">
          ${summaryRow('總作答', overall.attempts || 0)}
          ${summaryRow('正確作答', globalAnalytics.overall?.correct || 0)}
          ${summaryRow('錯誤作答', globalAnalytics.overall?.wrong || 0)}
          ${summaryRow('未作答', globalAnalytics.overall?.unanswered || 0)}
          ${summaryRow('跨題庫已碰觸題目', globalAnalytics.overall?.uniqueQuestions || 0)}
        </div>
      </article>
    </section>
  `;
}

function renderTrends({ analytics, banks, scope, windowDays }) {
  const series = windowDays === 30 ? analytics.history30 || [] : analytics.history7 || [];
  const summary = windowDays === 30 ? analytics.recent30 || {} : analytics.recent7 || [];

  return `
    ${renderAnalysisToolbar({ banks, scope, windowDays, showWindow: true })}

    <section class="stats-trend-summary">
      ${smallSummaryCard(`${windowDays} 日作答`, summary.attempts || 0)}
      ${smallSummaryCard(`${windowDays} 日正確率`, `${clampPercent(summary.accuracy)}%`)}
      ${smallSummaryCard('有學習天數', `${Number(summary.activeDays || 0)} / ${windowDays}`)}
      ${smallSummaryCard('題目觸及次數', summary.uniqueQuestionTouches || 0)}
    </section>

    <section class="stats-chart-grid">
      <article class="stats-panel">
        <div class="stats-panel-head">
          <div>
            <span class="learning-kicker">作答趨勢</span>
            <h3>每天做了多少題</h3>
          </div>
        </div>
        ${renderBarChart(series, 'attempts', '作答')}
      </article>

      <article class="stats-panel">
        <div class="stats-panel-head">
          <div>
            <span class="learning-kicker">正確率趨勢</span>
            <h3>每天的答題穩定度</h3>
          </div>
        </div>
        ${renderBarChart(series, 'accuracy', '正確率', { percent: true })}
      </article>
    </section>
  `;
}

function renderWeakness({ analytics, banks, scope, windowDays }) {
  const weak = Array.isArray(analytics.weakChapters) ? analytics.weakChapters : [];
  const types = Array.isArray(analytics.typeAccuracy) ? analytics.typeAccuracy : [];
  const chapters = (Array.isArray(analytics.chapterAccuracy) ? analytics.chapterAccuracy : [])
    .filter(item => item.key !== '已移除題目');

  return `
    ${renderAnalysisToolbar({ banks, scope, windowDays, showWindow: false })}

    <section class="stats-weak-grid">
      <article class="stats-panel">
        <div class="stats-panel-head">
          <div>
            <span class="learning-kicker">優先處理</span>
            <h3>弱點章節</h3>
            <p>預設至少 3 次作答才視為正式弱點；不足時會標示樣本較少。</p>
          </div>
        </div>

        <div class="stats-weak-list">
          ${weak.length ? weak.map((item, index) => `
            <div class="stats-weak-row">
              <span class="stats-rank">${String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>${escapeHtml(item.key)}</strong>
                <small>${Number(item.attempts || 0)} 次作答 · ${Number(item.wrong || 0)} 次錯誤${item.provisional ? ' · 樣本較少' : ''}</small>
              </div>
              <b>${clampPercent(item.accuracy)}%</b>
            </div>
          `).join('') : emptyInline('目前還沒有足夠資料辨識弱點。')}
        </div>
      </article>

      <article class="stats-panel">
        <div class="stats-panel-head">
          <div>
            <span class="learning-kicker">題型表現</span>
            <h3>哪一種題型比較不穩定</h3>
          </div>
        </div>

        <div class="stats-dimension-list">
          ${types.length ? types.map(item =>
            dimensionRow(TYPE_LABELS[item.key] || item.key, item)
          ).join('') : emptyInline('目前沒有題型作答資料。')}
        </div>
      </article>
    </section>

    <section class="stats-panel">
      <div class="stats-panel-head">
        <div>
          <span class="learning-kicker">章節表現</span>
          <h3>所有章節正確率</h3>
        </div>
      </div>
      <div class="stats-chapter-grid">
        ${chapters.length ? chapters.map(item => dimensionRow(item.key, item)).join('') : emptyInline('目前沒有章節統計資料。')}
      </div>
      ${renderDataQuality(analytics.dataQuality)}
    </section>
  `;
}

function renderBankAnalysis({ banks }) {
  return `
    <section class="learning-section-head compact">
      <div>
        <span class="learning-kicker">題庫分析</span>
        <h2>逐題庫查看掌握狀態</h2>
        <p>這一頁只處理題庫比較，不再混入趨勢與弱點圖表。</p>
      </div>
    </section>

    <div class="stats-bank-list learning-stats-list">
      ${banks.length ? banks.map(renderBankStats).join('') : `
        <div class="learning-empty">
          <div class="learning-empty-icon" aria-hidden="true">▥</div>
          <strong>還沒有統計資料</strong>
          <p>完成一些題目後，這裡會開始顯示你的學習進度與熟練度。</p>
        </div>
      `}
    </div>
  `;
}

function renderAnalysisToolbar({ banks, scope, windowDays, showWindow }) {
  return `
    <section class="stats-toolbar">
      <label>
        <span>分析範圍</span>
        <select data-stats-scope>
          <option value="global" ${scope === 'global' ? 'selected' : ''}>全部題庫</option>
          ${banks.map(item => `
            <option value="${escapeAttr(item.bank.id)}" ${scope === String(item.bank.id) ? 'selected' : ''}>
              ${escapeHtml(item.bank.name || item.bank.title || item.bank.id)}
            </option>
          `).join('')}
        </select>
      </label>

      ${showWindow ? `
        <div class="stats-window-switch" role="group" aria-label="趨勢期間">
          <button type="button" data-stats-window="7" class="${windowDays === 7 ? 'is-active' : ''}">7 日</button>
          <button type="button" data-stats-window="30" class="${windowDays === 30 ? 'is-active' : ''}">30 日</button>
        </div>
      ` : ''}
    </section>
  `;
}

function renderBankStats(item) {
  const m = item.mastery || {};
  const total = Math.max(
    1,
    Number(m.new || 0) +
      Number(m.learning || 0) +
      Number(m.familiar || 0) +
      Number(m.mastered || 0),
  );

  return `
    <article class="stats-bank-card learning-stats-card">
      <header class="learning-bank-header">
        <div class="learning-bank-symbol stats" aria-hidden="true">▥</div>
        <div>
          <span class="learning-bank-id">${escapeHtml(item.bank.id)}</span>
          <h3>${escapeHtml(item.bank.name || item.bank.title || item.bank.id)}</h3>
          <p>${item.questionCount} 題</p>
        </div>

        <div class="learning-bank-accuracy">
          <strong>${clampPercent(item.accuracy)}%</strong>
          <span>正確率</span>
        </div>
      </header>

      <div class="learning-stat-row">
        ${smallStat('作答次數', item.attempts)}
        ${smallStat('目前錯題', item.wrong)}
        ${smallStat('今日到期', item.due)}
      </div>

      <div class="mastery-block learning-mastery-block">
        <div class="learning-mastery-heading">
          <div>
            <span>熟練度分布</span>
            <strong>${Number(m.mastered || 0)} 題已掌握</strong>
          </div>
        </div>

        <div class="learning-mastery-bar" aria-hidden="true">
          ${masterySegment('new', m.new, total)}
          ${masterySegment('learning', m.learning, total)}
          ${masterySegment('familiar', m.familiar, total)}
          ${masterySegment('mastered', m.mastered, total)}
        </div>

        <div class="mastery-row learning-mastery-legend">
          ${masteryCell('new', m.new)}
          ${masteryCell('learning', m.learning)}
          ${masteryCell('familiar', m.familiar)}
          ${masteryCell('mastered', m.mastered)}
        </div>
      </div>
    </article>
  `;
}

function renderBarChart(series, key, label, { percent = false } = {}) {
  const values = (Array.isArray(series) ? series : []).map(item => Number(item?.[key] || 0));
  const maxValue = percent ? 100 : Math.max(1, ...values);

  if (!series?.length) return emptyInline('目前沒有可顯示的趨勢資料。');

  return `
    <div class="stats-bar-chart ${series.length > 10 ? 'is-dense' : ''}" aria-label="${escapeAttr(label)}趨勢">
      ${series.map(item => {
        const value = Number(item?.[key] || 0);
        const height = percent
          ? clampPercent(value)
          : Math.max(0, Math.min(100, Math.round(value / maxValue * 100)));
        return `
          <div class="stats-bar-column" title="${escapeAttr(`${item.dateKey} · ${label} ${percent ? `${value}%` : value}`)}">
            <div class="stats-bar-track">
              <i style="height:${height}%"></i>
            </div>
            <strong>${percent ? `${clampPercent(value)}%` : value}</strong>
            <span>${formatShortDate(item.dateKey)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderMiniTrend(series) {
  const items = Array.isArray(series) ? series : [];
  const max = Math.max(1, ...items.map(item => Number(item.attempts || 0)));

  return `
    <div class="stats-mini-trend">
      ${items.map(item => `
        <div title="${escapeAttr(`${item.dateKey} · ${Number(item.attempts || 0)} 次`)}">
          <i style="height:${Math.max(6, Math.round(Number(item.attempts || 0) / max * 100))}%"></i>
          <span>${formatShortDate(item.dateKey)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function dimensionRow(label, item) {
  const accuracy = clampPercent(item.accuracy);
  return `
    <div class="stats-dimension-row">
      <div class="stats-dimension-copy">
        <strong>${escapeHtml(label)}</strong>
        <small>${Number(item.attempts || 0)} 次 · ${Number(item.wrong || 0)} 錯${Number(item.unanswered || 0) ? ` · ${Number(item.unanswered || 0)} 未作答` : ''}</small>
      </div>
      <div class="stats-dimension-meter" aria-label="${escapeAttr(label)}正確率 ${accuracy}%">
        <i style="width:${accuracy}%"></i>
      </div>
      <b>${accuracy}%</b>
    </div>
  `;
}

function renderDataQuality(dataQuality = {}) {
  const missingTime = Number(dataQuality.attemptsWithoutValidTimestamp || 0);
  const missingQuestion = Number(dataQuality.attemptsWithoutQuestionMetadata || 0);
  if (!missingTime && !missingQuestion) return '';

  return `
    <aside class="stats-data-quality">
      <strong>資料完整性提醒</strong>
      <span>${missingTime ? `${missingTime} 筆作答缺少有效時間。` : ''}</span>
      <span>${missingQuestion ? `${missingQuestion} 筆歷史作答已找不到目前題目 metadata。` : ''}</span>
    </aside>
  `;
}

function overviewCard(label, value, note, kind) {
  return `
    <article class="stats-overview-card ${escapeAttr(kind)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${note}</small>
    </article>
  `;
}

function smallSummaryCard(label, value) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </article>
  `;
}

function summaryRow(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function metricCard(label, value, icon) {
  return `
    <div class="learning-focus-item">
      <span class="learning-metric-icon" aria-hidden="true">${escapeHtml(icon)}</span>
      <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>
    </div>
  `;
}

function smallStat(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function masterySegment(key, value, total) {
  const percent = Math.max(0, (Number(value) || 0) / total * 100);
  return `<span class="${key}" style="width:${percent}%"></span>`;
}

function masteryCell(key, value) {
  return `
    <div class="mastery-cell ${key}">
      <span>${escapeHtml(MASTERY_LABELS[key])}</span>
      <strong>${value || 0}</strong>
    </div>
  `;
}

function emptyInline(message) {
  return `<div class="stats-empty-inline">${escapeHtml(message)}</div>`;
}

function accuracyMessage(accuracy) {
  if (accuracy >= 80) return '目前整體表現穩定，可以進一步觀察零散弱點與長期趨勢。';
  if (accuracy >= 60) return '已建立一定基礎，接下來可從弱點章節與錯題集中加強。';
  return '先從錯題與低正確率章節開始，逐步建立穩定的答題記憶。';
}

function formatShortDate(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  return match ? `${Number(match[2])}/${Number(match[3])}` : String(dateKey || '');
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

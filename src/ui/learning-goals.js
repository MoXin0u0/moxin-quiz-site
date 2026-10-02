export const GLOBAL_SCOPE = 'global';

export function learningGoalIdForScope(scope) {
  const normalized = String(scope || GLOBAL_SCOPE).trim();
  return normalized === GLOBAL_SCOPE ? GLOBAL_SCOPE : `bank:${normalized}`;
}

export function createLearningGoalSaveInput({
  scope = GLOBAL_SCOPE,
  enabled = false,
  dailyPracticeTarget = 0,
  dailyReviewTarget = 0,
} = {}) {
  const normalizedScope = String(scope || GLOBAL_SCOPE).trim() || GLOBAL_SCOPE;
  const bankId = normalizedScope === GLOBAL_SCOPE ? null : normalizedScope;

  return {
    id: learningGoalIdForScope(normalizedScope),
    bankId,
    enabled: enabled === true,
    dailyPracticeTarget: clampTarget(dailyPracticeTarget),
    dailyReviewTarget: clampTarget(dailyReviewTarget),
  };
}

export function renderLearningGoalPanel(model = {}) {
  const banks = Array.isArray(model.banks) ? model.banks : [];
  const selectedScope = String(model.selectedScope || GLOBAL_SCOPE);
  const goal = model.goal || {};
  const progress = model.progress || {};
  const today = progress.today || {};
  const practice = today.practiceGoal || emptyMetric(goal.dailyPracticeTarget);
  const review = today.reviewGoal || emptyMetric(goal.dailyReviewTarget);
  const history = Array.isArray(progress.history) ? progress.history : [];
  const configured = model.configured === true;

  return `
    <section class="learning-goal-panel" aria-labelledby="learningGoalTitle">
      <div class="learning-goal-head">
        <div>
          <span class="learning-kicker">P3 · 學習目標</span>
          <h2 id="learningGoalTitle">把今天的學習量變成可追蹤的節奏</h2>
          <p>一般練習與複習分開計算；模擬考不灌入每日題數，但仍會維持連續學習天數。</p>
        </div>

        <label class="learning-goal-scope">
          <span>目標範圍</span>
          <select data-learning-goal-scope>
            <option value="${GLOBAL_SCOPE}" ${selectedScope === GLOBAL_SCOPE ? 'selected' : ''}>全部題庫</option>
            ${banks.map(bank => `
              <option
                value="${escapeAttr(bank.id)}"
                ${selectedScope === String(bank.id) ? 'selected' : ''}
              >${escapeHtml(bank.name || bank.title || bank.id)}</option>
            `).join('')}
          </select>
        </label>
      </div>

      <div class="learning-goal-dashboard">
        <article class="learning-goal-summary-card primary">
          <span>今日整體進度</span>
          <strong>${clampPercent(today.completionPercent)}%</strong>
          <small>${today.achieved ? '今日目標已完成' : goal.enabled ? '依目前目標持續累積' : '目前未啟用目標'}</small>
          <div class="learning-goal-progress-track" aria-hidden="true">
            <i style="width:${clampPercent(today.completionPercent)}%"></i>
          </div>
        </article>

        <article class="learning-goal-summary-card">
          <span>連續學習</span>
          <strong>${Number(progress.streak || 0)} 天</strong>
          <small>練習、複習或模擬考任一有作答</small>
        </article>

        <article class="learning-goal-summary-card">
          <span>近 7 日達成</span>
          <strong>${Number(progress.recentAchievedDays || 0)} / ${history.length || 7}</strong>
          <small>以目前設定的目標回看</small>
        </article>
      </div>

      <div class="learning-goal-target-grid">
        ${targetCard('每日刷題', '一般練習', practice, 'practice')}
        ${targetCard('每日複習', '到期、錯題、不熟與收藏複習', review, 'review')}
      </div>

      <div class="learning-goal-history">
        <div class="learning-goal-history-head">
          <div>
            <strong>最近 7 日</strong>
            <span>綠色代表依目前目標達成；有作答但未完成會顯示進度。</span>
          </div>
        </div>
        <div class="learning-goal-week" role="list" aria-label="最近七日學習目標">
          ${history.map(day => historyCell(day)).join('')}
        </div>
      </div>

      <form class="learning-goal-form" data-learning-goal-form>
        <input type="hidden" data-learning-goal-form-scope value="${escapeAttr(selectedScope)}" />

        <label class="learning-goal-enabled">
          <input
            type="checkbox"
            data-learning-goal-enabled
            ${goal.enabled ? 'checked' : ''}
          />
          <span>
            <strong>啟用這組每日目標</strong>
            <small>${configured ? '設定已保存在這個瀏覽器。' : '尚未建立設定，儲存後開始追蹤。'}</small>
          </span>
        </label>

        <label>
          <span>每日一般刷題</span>
          <input
            type="number"
            inputmode="numeric"
            min="0"
            max="10000"
            step="1"
            value="${escapeAttr(goal.dailyPracticeTarget || 0)}"
            data-learning-goal-practice
          />
          <small>設為 0 代表不啟用這一項。</small>
        </label>

        <label>
          <span>每日複習</span>
          <input
            type="number"
            inputmode="numeric"
            min="0"
            max="10000"
            step="1"
            value="${escapeAttr(goal.dailyReviewTarget || 0)}"
            data-learning-goal-review
          />
          <small>同一天同一題重做不會重複灌高題數。</small>
        </label>

        <button class="button primary" type="submit">儲存學習目標</button>
      </form>
    </section>
  `;
}

function targetCard(title, subtitle, metric, kind) {
  const active = metric?.active === true;
  const count = Number(metric?.count || 0);
  const target = Number(metric?.target || 0);
  const percent = clampPercent(metric?.percent);

  return `
    <article class="learning-goal-target ${escapeAttr(kind)} ${metric?.complete && active ? 'is-complete' : ''}">
      <div class="learning-goal-target-head">
        <div>
          <span>${escapeHtml(subtitle)}</span>
          <strong>${escapeHtml(title)}</strong>
        </div>
        <b>${active ? `${count} / ${target}` : `${count}`}</b>
      </div>

      <div class="learning-goal-progress-track" aria-label="${escapeAttr(title)} ${percent}%">
        <i style="width:${active ? percent : 0}%"></i>
      </div>

      <small>
        ${active
          ? metric.complete
            ? '今天已完成'
            : `還差 ${Number(metric.remaining || 0)} 題`
          : '目前沒有設定每日目標'}
      </small>
    </article>
  `;
}

function historyCell(day) {
  const percent = clampPercent(day?.completionPercent);
  const state = day?.achieved
    ? 'is-achieved'
    : day?.active
      ? 'is-active'
      : 'is-empty';

  return `
    <div class="learning-goal-day ${state}" role="listitem" title="${escapeAttr(day.dateKey || '')}">
      <span>${formatShortDate(day.dateKey)}</span>
      <strong>${day?.achieved ? '✓' : day?.active ? `${percent}%` : '—'}</strong>
      <small>${Number(day?.answered || 0)} 題</small>
    </div>
  `;
}

function formatShortDate(dateKey) {
  const parts = String(dateKey || '').split('-');
  if (parts.length !== 3) return '—';
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function clampTarget(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(10000, Math.round(number)));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function emptyMetric(target = 0) {
  const normalized = clampTarget(target);
  return {
    count: 0,
    target: normalized,
    active: normalized > 0,
    complete: normalized <= 0,
    percent: 0,
    remaining: normalized,
  };
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

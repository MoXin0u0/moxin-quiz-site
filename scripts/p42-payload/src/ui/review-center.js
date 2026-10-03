import { renderLearningGoalPanel } from './learning-goals.js';
import { renderExamSprintPanel } from './exam-sprint.js';
import {
  LEARNING_HUB_TAB,
  normalizeLearningHubTab,
  renderLearningHubOverview,
  renderLearningHubTabs,
} from './learning-hub.js';

export function renderReviewCenter(container, groups, options = {}) {
  const totalDue = groups.reduce((sum, group) => sum + group.counts.due, 0);
  const totalWrong = groups.reduce((sum, group) => sum + group.counts.wrong, 0);
  const totalUnfamiliar = groups.reduce((sum, group) => sum + group.counts.unfamiliar, 0);
  const recommended = pickReviewRecommendation(groups);
  const activeTab = normalizeLearningHubTab(options.activeTab);

  const goalModel = options.goalModel || {};
  const sprintModel = options.sprintModel || {};
  const goalProgress = goalModel.progress || {};
  const todayPractice = Number(goalProgress.today?.practiceGoal?.count || 0);
  const streak = Number(goalProgress.streak || 0);
  const sprintPlan = sprintModel.plan || {};
  const examDays = sprintPlan.examDateKey && Number.isFinite(Number(sprintPlan.daysUntilExam))
    ? Number(sprintPlan.daysUntilExam)
    : null;

  const focusText = totalDue
    ? `今天有 ${totalDue} 題排程到期；其他設定與考前安排已分到獨立頁籤。`
    : totalWrong
      ? '今天沒有排程到期，可以先整理錯題，再看目標或衝刺安排。'
      : '今天的學習工具已分層整理；先從總覽決定下一步。';

  container.innerHTML = `
    <section class="learning-hero learning-review-hero learning-hero-whole" data-learning-scene="review">
      <div class="learning-hero-art learning-hero-art-review" data-scene-art="review" aria-hidden="true"></div>
      <div class="learning-hero-content">
        <span class="learning-kicker">今日學習</span>
        <h2>把今天要做的事分清楚，不讓設定和練習全部擠在一起</h2>
        <p>${escapeHtml(focusText)}</p>

        <div class="learning-hero-cta-row">
          ${recommended
            ? `<button
                class="button primary learning-hero-primary-cta"
                type="button"
                data-review-bank="${escapeAttr(recommended.group.bank.id)}"
                data-review-mode="${escapeAttr(recommended.mode)}"
              >開始${escapeHtml(recommended.label)}</button>`
            : `<button class="button primary learning-hero-primary-cta" type="button" data-nav-library>先去練幾題</button>`}
          <button class="button secondary" type="button" data-learning-hub-tab="overview">查看今日總覽</button>
        </div>

        <div class="learning-focus-strip learning-hero-stat-strip">
          ${focusItem('今日到期', totalDue, 'due')}
          ${focusItem('今日刷題', todayPractice, 'favorite')}
          ${focusItem('連續學習', streak, 'unfamiliar')}
          ${focusItem('考試倒數', examDays === null ? '—' : Math.max(0, examDays), 'wrong')}
        </div>
      </div>

      <div class="learning-hero-floating-stat review" aria-hidden="true">
        <span>今日優先</span>
        <strong>${totalDue || totalWrong || totalUnfamiliar || 0}</strong>
        <small>${totalDue ? '排程到期' : totalWrong ? '錯題待整理' : totalUnfamiliar ? '不熟題' : '自由學習'}</small>
      </div>
    </section>

    ${renderLearningHubTabs(activeTab)}

    <div class="learning-hub-content" data-learning-hub-content="${activeTab}">
      ${renderActiveTab(activeTab, groups, { goalModel, sprintModel })}
    </div>
  `;
}

function renderActiveTab(activeTab, groups, options) {
  if (activeTab === LEARNING_HUB_TAB.GOALS) {
    return renderLearningGoalPanel(options.goalModel);
  }
  if (activeTab === LEARNING_HUB_TAB.SPRINT) {
    return renderExamSprintPanel(options.sprintModel);
  }
  if (activeTab === LEARNING_HUB_TAB.REVIEW) {
    return renderReviewRoute(groups);
  }
  return renderLearningHubOverview({
    groups,
    goalModel: options.goalModel,
    sprintModel: options.sprintModel,
  });
}

function renderReviewRoute(groups) {
  return `
    <section class="learning-section-head compact">
      <div>
        <span class="learning-kicker">複習路線</span>
        <h2>依題庫選擇今天的複習方式</h2>
        <p>每次仍以單一題庫進行，圖片與學習紀錄都保持正確關聯。</p>
      </div>
    </section>

    <div class="review-bank-list learning-review-list">
      ${groups.length ? groups.map(renderGroup).join('') : `
        <div class="learning-empty">
          <div class="learning-empty-icon" aria-hidden="true">↻</div>
          <strong>目前沒有可複習的本機題庫</strong>
          <p>先到「我的題庫」完成一些練習，這裡就會開始累積你的複習路線。</p>
        </div>
      `}
    </div>
  `;
}

function pickReviewRecommendation(groups) {
  const priorities = [
    ['due', '今日複習'],
    ['wrong', '錯題整理'],
    ['unfamiliar', '不熟題複習'],
    ['favorite', '收藏題複習'],
  ];

  for (const [mode, label] of priorities) {
    const candidates = groups
      .filter(group => Number(group.counts?.[mode] || 0) > 0)
      .sort((a, b) => Number(b.counts?.[mode] || 0) - Number(a.counts?.[mode] || 0));
    if (candidates.length) {
      return { group: candidates[0], mode, label };
    }
  }
  return null;
}

function renderGroup(group) {
  return `
    <article class="review-bank-card learning-review-bank">
      <header class="learning-bank-header">
        <div class="learning-bank-symbol" aria-hidden="true">▤</div>
        <div>
          <span class="learning-bank-id">${escapeHtml(group.bank.id)}</span>
          <h3>${escapeHtml(group.bank.name || group.bank.title || group.bank.id)}</h3>
          <p>${group.questionCount} 題可供學習</p>
        </div>
      </header>

      <div class="review-mode-grid learning-review-mode-grid">
        ${reviewMode(group, 'due', '今日到期', group.counts.due, '依間隔複習排程', '↻')}
        ${reviewMode(group, 'wrong', '錯題整理', group.counts.wrong, '最後一次作答仍為錯誤', '×')}
        ${reviewMode(group, 'unfamiliar', '不熟題', group.counts.unfamiliar, '你手動標記為不熟', '?')}
        ${reviewMode(group, 'favorite', '收藏題', group.counts.favorite, '你想再次看的題目', '☆')}
      </div>
    </article>
  `;
}

function reviewMode(group, mode, label, count, description, icon) {
  const total = Math.max(1, Number(group.questionCount) || 1);
  const ratio = Math.min(100, Math.round((Number(count) || 0) / total * 100));

  return `
    <div class="review-mode-card learning-review-mode ${mode}" style="--review-ratio:${ratio}%">
      <div class="learning-review-mode-top">
        <span class="learning-mode-icon" aria-hidden="true">${escapeHtml(icon)}</span>
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${count}</strong>
        </div>
      </div>
      <div class="learning-mini-progress" aria-hidden="true"><i></i></div>
      <small>${escapeHtml(description)}</small>
      <button
        class="button ${mode === 'due' ? 'primary' : 'secondary'}"
        type="button"
        data-review-bank="${escapeAttr(group.bank.id)}"
        data-review-mode="${escapeAttr(mode)}"
        ${count ? '' : 'disabled'}
      >${count ? '開始複習' : '目前沒有題目'}</button>
    </div>
  `;
}

function focusItem(label, value, kind) {
  return `
    <div class="learning-focus-item ${kind}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
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

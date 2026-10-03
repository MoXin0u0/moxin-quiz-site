export const LEARNING_HUB_TAB = Object.freeze({
  OVERVIEW: 'overview',
  REVIEW: 'review',
  GOALS: 'goals',
  SPRINT: 'sprint',
});

const VALID_TABS = new Set(Object.values(LEARNING_HUB_TAB));

export function normalizeLearningHubTab(value) {
  const tab = String(value || '').trim();
  return VALID_TABS.has(tab) ? tab : LEARNING_HUB_TAB.OVERVIEW;
}

export function renderLearningHubTabs(activeTab) {
  const active = normalizeLearningHubTab(activeTab);
  const items = [
    [LEARNING_HUB_TAB.OVERVIEW, '總覽', '今天先做什麼'],
    [LEARNING_HUB_TAB.REVIEW, '複習', '到期、錯題、不熟'],
    [LEARNING_HUB_TAB.GOALS, '學習目標', '每日節奏與 7 日進度'],
    [LEARNING_HUB_TAB.SPRINT, '考前衝刺', '考試題庫與今日安排'],
  ];

  return `
    <nav class="learning-hub-tabs" aria-label="今日學習功能">
      ${items.map(([key, label, note]) => `
        <button
          class="learning-hub-tab ${active === key ? 'is-active' : ''}"
          type="button"
          data-learning-hub-tab="${key}"
          aria-current="${active === key ? 'page' : 'false'}"
        >
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(note)}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

export function renderLearningHubOverview({
  groups = [],
  goalModel = {},
  sprintModel = {},
  summaryModel = {},
} = {}) {
  const progress = goalModel.progress || {};
  const today = progress.today || {};
  const practice = today.practiceGoal || {};
  const review = today.reviewGoal || {};
  const goal = goalModel.goal || {};
  const banks = Array.isArray(goalModel.banks) ? goalModel.banks : [];
  const selectedScope = String(goalModel.selectedScope || 'global');

  const globalProgress = summaryModel.progress || {};
  const globalToday = globalProgress.today || {};
  const globalPractice = Number(globalToday.practiceGoal?.count ?? globalToday.practice ?? 0);
  const globalReview = Number(globalToday.reviewGoal?.count ?? globalToday.review ?? 0);
  const globalExam = Number(globalToday.exam || 0);
  const globalStreak = Number(globalProgress.streak || 0);

  const sprintGoal = sprintModel.goal || {};
  const sprintPlan = sprintModel.plan || {};

  const totalDue = groups.reduce((sum, group) => sum + Number(group.counts?.due || 0), 0);
  const totalWrong = groups.reduce((sum, group) => sum + Number(group.counts?.wrong || 0), 0);
  const totalUnfamiliar = groups.reduce((sum, group) => sum + Number(group.counts?.unfamiliar || 0), 0);

  const goalActive =
    goal.enabled === true &&
    (Number(goal.dailyPracticeTarget || 0) > 0 || Number(goal.dailyReviewTarget || 0) > 0);

  const examActive =
    sprintGoal.sprintEnabled === true &&
    Array.isArray(sprintGoal.sprintBankIds) &&
    sprintGoal.sprintBankIds.length > 0 &&
    Boolean(sprintPlan.examDateKey);

  const examCountdown = examActive
    ? Number(sprintPlan.daysUntilExam) === 0
      ? '今天'
      : Number(sprintPlan.daysUntilExam) > 0
        ? `${Number(sprintPlan.daysUntilExam)} 天`
        : '已結束'
    : '尚未設定';

  const selectedBank = banks.find(bank => String(bank.id) === selectedScope);
  const scopeLabel = selectedScope === 'global'
    ? '全部題庫（整體目標）'
    : selectedBank?.name || selectedBank?.title || selectedScope;

  return `
    <section class="learning-hub-overview" aria-labelledby="learningHubOverviewTitle">
      <div class="learning-section-head compact">
        <div>
          <span class="learning-kicker">今日總覽</span>
          <h2 id="learningHubOverviewTitle">先看全站今天，再進入需要的工具</h2>
          <p>最上層摘要固定看全部題庫；學習目標卡才依你目前選定的目標範圍顯示。</p>
        </div>
      </div>

      <div class="learning-hub-global-strip" aria-label="全站今日學習摘要">
        <span><b>全站今日</b></span>
        <span>刷題 <strong>${globalPractice}</strong></span>
        <span>複習 <strong>${globalReview}</strong></span>
        <span>模擬考 <strong>${globalExam}</strong></span>
        <span>連續 <strong>${globalStreak} 天</strong></span>
      </div>

      <div class="learning-hub-overview-grid">
        <article class="learning-hub-overview-card goal">
          <div class="learning-hub-card-head">
            <span>學習目標</span>
            <button type="button" data-learning-hub-tab="goals">管理目標</button>
          </div>
          <strong>${goalActive ? `${Number(today.completionPercent || 0)}%` : '尚未設定'}</strong>
          <div class="learning-hub-inline-metrics">
            <span>刷題 ${Number(practice.count || 0)}${practice.active ? ` / ${Number(practice.target || 0)}` : ''}</span>
            <span>複習 ${Number(review.count || 0)}${review.active ? ` / ${Number(review.target || 0)}` : ''}</span>
          </div>
          <small>目標範圍：${escapeHtml(scopeLabel)}</small>
        </article>

        <article class="learning-hub-overview-card review">
          <div class="learning-hub-card-head">
            <span>今日複習</span>
            <button type="button" data-learning-hub-tab="review">查看複習</button>
          </div>
          <strong>${totalDue} 題到期</strong>
          <div class="learning-hub-inline-metrics">
            <span>錯題 ${totalWrong}</span>
            <span>不熟 ${totalUnfamiliar}</span>
          </div>
          <small>${totalDue ? '優先完成到期題' : totalWrong ? '今天可先整理錯題' : '目前沒有排程壓力'}</small>
        </article>

        <article class="learning-hub-overview-card sprint">
          <div class="learning-hub-card-head">
            <span>考前衝刺</span>
            <button type="button" data-learning-hub-tab="sprint">查看衝刺</button>
          </div>
          <strong>${escapeHtml(examCountdown)}</strong>
          <div class="learning-hub-inline-metrics">
            <span>${examActive ? `今日 ${Number(sprintPlan.remainingToday || 0)} 題` : '尚未啟用'}</span>
            <span>${examActive ? `${Number(sprintGoal.sprintBankIds.length)} 個題庫` : '未選題庫'}</span>
          </div>
          <small>${examActive
            ? escapeHtml(sprintGoal.examLabel || '已設定考試')
            : '考前衝刺需獨立選擇本次考試題庫'}</small>
        </article>
      </div>
    </section>
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

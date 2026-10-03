export function renderHomeDashboard(container, model = {}) {
  if (!container) return;

  const goal = model.goal || {};
  const streak = model.streak || {};
  const resume = model.resume || null;
  const review = model.review || {};
  const sprint = model.sprint || {};
  const backup = model.backup || {};

  container.innerHTML = `
    <section class="home-dashboard" aria-labelledby="homeDashboardTitle">
      <div class="learning-section-head compact home-dashboard-head">
        <div>
          <span class="learning-kicker">今日概況</span>
          <h2 id="homeDashboardTitle">先決定今天最值得做的下一步</h2>
          <p>這裡只放學習摘要與快捷入口；題庫收藏仍維持在下方，不把首頁變成另一張超長設定頁。</p>
        </div>
      </div>

      <div class="home-summary-grid">
        ${renderGoalCard(goal)}
        ${renderStreakCard(streak)}
        ${renderResumeCard(resume)}
      </div>

      <div class="home-action-grid" aria-label="學習快捷入口">
        ${renderAction({
          kind: 'review',
          kicker: '今日複習',
          value: `${Number(review.dueTotal || 0)} 題到期`,
          note: Number(review.dueTotal || 0)
            ? '直接查看今天的到期、錯題與不熟題'
            : '目前沒有到期題，仍可查看其他複習路線',
          attrs: 'data-home-review',
          label: '查看今日複習',
        })}
        ${renderAction({
          kind: 'wrong',
          kicker: '快速錯題',
          value: `${Number(review.wrongTotal || 0)} 題`,
          note: review.wrongBankName
            ? `優先：${review.wrongBankName}`
            : '目前沒有可直接啟動的錯題練習',
          attrs: review.wrongBankId
            ? `data-home-wrong-bank="${escapeAttr(review.wrongBankId)}"`
            : 'data-home-review',
          label: review.wrongBankId ? '開始錯題練習' : '查看複習',
        })}
        ${renderSprintAction(sprint)}
        ${renderBackupAction(backup)}
      </div>
    </section>
  `;
}

function renderGoalCard(goal) {
  const percent = clampPercent(goal.percent);
  return `
    <article class="home-summary-card goal">
      <div class="home-card-head">
        <span>今日目標</span>
        <button type="button" data-home-goals>管理目標</button>
      </div>
      <div class="home-goal-value">
        <strong>${goal.configured ? `${percent}%` : '尚未設定'}</strong>
        <small>${escapeHtml(goal.scopeLabel || '尚未設定')}</small>
      </div>
      <div class="home-goal-progress" aria-label="今日目標進度 ${percent}%">
        <i style="width:${goal.configured ? percent : 0}%"></i>
      </div>
      <div class="home-inline-metrics">
        <span>刷題 ${metricText(goal.practice)}</span>
        <span>複習 ${metricText(goal.review)}</span>
      </div>
    </article>
  `;
}

function renderStreakCard(streak) {
  return `
    <article class="home-summary-card streak">
      <div class="home-card-head">
        <span>連續學習</span>
        <button type="button" data-nav-stats>看統計</button>
      </div>
      <div class="home-streak-value">
        <strong>${Number(streak.days || 0)}</strong>
        <span>天</span>
      </div>
      <div class="home-inline-metrics">
        <span>今日碰觸 ${Number(streak.todayAnswered || 0)} 題</span>
        <span>刷題 ${Number(streak.todayPractice || 0)} · 複習 ${Number(streak.todayReview || 0)}</span>
      </div>
    </article>
  `;
}

function renderResumeCard(resume) {
  if (!resume) {
    return `
      <article class="home-summary-card resume is-empty">
        <div class="home-card-head"><span>繼續上次練習</span></div>
        <strong>目前沒有未完成練習</strong>
        <p>從下方選一個題庫開始，之後未完成 Session 會固定出現在這裡。</p>
      </article>
    `;
  }

  const progress = resume.total
    ? Math.round(Number(resume.completed || 0) / resume.total * 100)
    : 0;

  return `
    <article class="home-summary-card resume">
      <div class="home-card-head"><span>繼續上次練習</span></div>
      <strong>${escapeHtml(resume.bankName)}</strong>
      <p>已完成 ${Number(resume.completed || 0)} / ${Number(resume.total || 0)}，剩餘 ${Number(resume.remaining || 0)} 題。</p>
      <div class="home-resume-progress"><i style="width:${clampPercent(progress)}%"></i></div>
      <button
        class="button primary home-resume-button"
        type="button"
        data-home-resume-bank="${escapeAttr(resume.bankId)}"
      >繼續作答</button>
    </article>
  `;
}

function renderSprintAction(sprint) {
  let value = '尚未設定';
  let note = '設定考試日期與這場考試要使用的題庫';

  if (sprint.configured) {
    if (Number(sprint.daysUntilExam) === 0) value = '今天';
    else if (Number(sprint.daysUntilExam) > 0) value = `${Number(sprint.daysUntilExam)} 天`;
    else value = '已到期';

    note = `${sprint.label || '考前衝刺'} · ${Number(sprint.bankCount || 0)} 個題庫`;
  }

  return renderAction({
    kind: 'sprint',
    kicker: '考前衝刺',
    value,
    note,
    attrs: 'data-home-sprint',
    label: sprint.configured ? '查看今日衝刺' : '設定考前衝刺',
  });
}

function renderBackupAction(backup) {
  const status = backup.status || 'never';
  const stale = backup.stale === true;
  let value = '尚未完整備份';
  let note = '建議定期下載完整備份，避免瀏覽器資料遺失。';

  if (status !== 'never') {
    const days = Number(backup.daysAgo || 0);
    value = days === 0 ? '今天已備份' : `${days} 天前`;
    note = stale
      ? '距離上次完整備份已超過 7 天，建議重新備份。'
      : '完整備份狀態正常。';
  }

  return renderAction({
    kind: stale ? 'backup warning' : 'backup',
    kicker: '完整備份',
    value,
    note,
    attrs: 'data-nav-settings data-home-backup',
    label: stale ? '前往備份' : '備份與還原',
  });
}

function renderAction({ kind, kicker, value, note, attrs, label }) {
  return `
    <article class="home-action-card ${escapeAttr(kind)}">
      <span>${escapeHtml(kicker)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <p>${escapeHtml(note)}</p>
      <button type="button" class="button secondary" ${attrs}>${escapeHtml(label)}</button>
    </article>
  `;
}

function metricText(metric = {}) {
  if (!metric.active) return `${Number(metric.count || 0)}`;
  return `${Number(metric.count || 0)} / ${Number(metric.target || 0)}`;
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

export function renderExamCenter(container, groups) {
  container.innerHTML = `
    <section class="hero-card">
      <div>
        <p class="eyebrow">Mock Exam</p>
        <h2>模擬考</h2>
        <p>選擇題庫、題數與作答時間。考試期間不顯示正誤，交卷後才一次判分與顯示詳解。</p>
      </div>
      <div class="exam-rules">
        <span>最多 100 題</span>
        <span>倒數自動交卷</span>
        <span>進度本機保存</span>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Exam Setup</p>
          <h2>建立模擬考</h2>
        </div>
      </div>

      <div class="exam-bank-list">
        ${groups.length ? groups.map(renderGroup).join('') : `
          <div class="empty-state">
            <strong>目前沒有本機題庫</strong>
            <p>請先到「我的題庫」匯入題庫。</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderGroup(group) {
  const maxQuestions = Math.min(group.questionCount, 100);
  const defaultQuestions = Math.min(group.questionCount, 20);
  const resume = group.resumeExam;

  return `
    <article class="exam-bank-card" data-exam-bank-card="${escapeAttr(group.bank.id)}">
      <div class="exam-bank-heading">
        <div>
          <span class="bank-id">${escapeHtml(group.bank.id)}</span>
          <h3>${escapeHtml(group.bank.name || group.bank.title || group.bank.id)}</h3>
          <p>${group.questionCount} 題可用</p>
        </div>
        <span class="schema-chip">Schema ${escapeHtml(group.bank.schemaVersion || '2.0')}</span>
      </div>

      ${resume ? `
        <div class="exam-resume-banner">
          <div>
            <strong>有未完成的模擬考</strong>
            <span>${resume.questionCount || resume.questionIds?.length || 0} 題 · ${formatRemaining(resume.deadlineAt)}</span>
          </div>
          <button class="button primary" type="button" data-resume-exam="${escapeAttr(group.bank.id)}">繼續考試</button>
        </div>
      ` : ''}

      <div class="exam-setup-grid">
        <label>
          題數
          <input
            type="number"
            min="1"
            max="${maxQuestions}"
            value="${defaultQuestions}"
            data-exam-question-count
          />
        </label>

        <label>
          作答時間
          <select data-exam-duration>
            <option value="10">10 分鐘</option>
            <option value="20">20 分鐘</option>
            <option value="30" selected>30 分鐘</option>
            <option value="45">45 分鐘</option>
            <option value="60">60 分鐘</option>
            <option value="90">90 分鐘</option>
            <option value="120">120 分鐘</option>
          </select>
        </label>

        <button class="button secondary exam-start-button" type="button" data-start-exam="${escapeAttr(group.bank.id)}">
          開始新模擬考
        </button>
      </div>
    </article>
  `;
}

function formatRemaining(deadlineAt) {
  const ms = new Date(deadlineAt || 0).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '已到交卷時間';
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return `約剩 ${minutes} 分鐘`;
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

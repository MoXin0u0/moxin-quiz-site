export function renderExamCenter(container, groups) {
  const totalBanks = groups.length;
  const totalQuestions = groups.reduce((sum, group) => sum + Number(group.questionCount || 0), 0);
  const resumable = groups.filter(group => group.resumeExam).length;

  container.innerHTML = `
    <section class="learning-hero learning-exam-hero">
      <div class="learning-hero-copy">
        <span class="learning-kicker">模擬考場</span>
        <h2>用一場完整測驗，確認現在真正掌握多少</h2>
        <p>考試期間不顯示正誤；交卷後一次判分與檢討。題數與時間都由你決定。</p>

        <div class="learning-focus-strip exam">
          ${examStat('可用題庫', totalBanks)}
          ${examStat('可抽題目', totalQuestions)}
          ${examStat('未完成考試', resumable)}
        </div>
      </div>

      <div class="learning-exam-flow learning-scene-panel learning-scene-exam" data-learning-scene="exam" aria-label="模擬考流程">
        <div class="learning-scene-art" data-scene-art="exam" aria-hidden="true"></div>
        <div class="learning-scene-panel-heading">
          <span>考場流程</span>
          <small>設定完成後，專注把一場考試做完</small>
        </div>
        <div class="learning-exam-flow-steps">
          ${flowStep('01', '選題庫')}
          ${flowStep('02', '設定題數')}
          ${flowStep('03', '專心作答')}
          ${flowStep('04', '交卷檢討')}
        </div>
      </div>
    </section>

    <section class="learning-section-head">
      <div>
        <span class="learning-kicker">建立考卷</span>
        <h2>選擇要測驗的題庫</h2>
        <p>每一份題庫都能獨立設定題數與作答時間。</p>
      </div>
    </section>

    <div class="exam-bank-list learning-exam-list">
      ${groups.length ? groups.map(renderGroup).join('') : `
        <div class="learning-empty">
          <div class="learning-empty-icon" aria-hidden="true">▣</div>
          <strong>目前沒有本機題庫</strong>
          <p>先到「我的題庫」加入或匯入一份題庫，再回來建立模擬考。</p>
        </div>
      `}
    </div>
  `;
}

function renderGroup(group) {
  const maxQuestions = Math.min(group.questionCount, 100);
  const defaultQuestions = Math.min(group.questionCount, 20);
  const resume = group.resumeExam;

  return `
    <article class="exam-bank-card learning-exam-card" data-exam-bank-card="${escapeAttr(group.bank.id)}">
      <div class="learning-exam-card-summary">
        <div class="learning-bank-symbol exam" aria-hidden="true">▣</div>
        <div>
          <span class="learning-bank-id">${escapeHtml(group.bank.id)}</span>
          <h3>${escapeHtml(group.bank.name || group.bank.title || group.bank.id)}</h3>
          <p>${group.questionCount} 題可抽選 · Schema ${escapeHtml(group.bank.schemaVersion || '2.0')}</p>
        </div>
      </div>

      ${resume ? `
        <div class="exam-resume-banner learning-exam-resume">
          <div>
            <span>未完成</span>
            <strong>上一場模擬考還在</strong>
            <small>${resume.questionCount || resume.questionIds?.length || 0} 題 · ${formatRemaining(resume.deadlineAt)}</small>
          </div>
          <button class="button primary" type="button" data-resume-exam="${escapeAttr(group.bank.id)}">繼續考試</button>
        </div>
      ` : ''}

      <div class="learning-exam-config">
        <label class="learning-field">
          <span>題數</span>
          <small>最多 ${maxQuestions} 題</small>
          <input type="number" min="1" max="${maxQuestions}" value="${defaultQuestions}" data-exam-question-count />
        </label>

        <label class="learning-field">
          <span>作答時間</span>
          <small>時間到會自動交卷</small>
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

        <div class="learning-exam-start">
          <span>準備好了？</span>
          <button class="button primary exam-start-button" type="button" data-start-exam="${escapeAttr(group.bank.id)}">
            開始模擬考
          </button>
        </div>
      </div>
    </article>
  `;
}

function flowStep(number, label) {
  return `<div class="learning-flow-step"><span>${number}</span><strong>${label}</strong></div>`;
}

function examStat(label, value) {
  return `
    <div class="learning-focus-item">
      <span>${escapeHtml(label)}</span>
      <strong>${new Intl.NumberFormat('zh-TW').format(Number(value) || 0)}</strong>
    </div>
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

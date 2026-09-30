const MASTERY_LABELS = {
  new: '尚未建立',
  learning: '學習中',
  familiar: '熟悉',
  mastered: '已掌握',
};

export function renderLearningStats(container, data) {
  const overall = data.overall;

  container.innerHTML = `
    <section class="hero-card">
      <div>
        <p class="eyebrow">Learning Analytics</p>
        <h2>學習統計</h2>
        <p>統計只來自此瀏覽器 IndexedDB，不會上傳到伺服器。</p>
      </div>
      <div class="stats-overall">
        ${stat('總作答', overall.attempts)}
        ${stat('正確率', `${overall.accuracy}%`)}
        ${stat('已作答題', overall.answeredQuestions)}
        ${stat('今日到期', overall.due)}
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Per Bank</p>
          <h2>各題庫學習狀態</h2>
        </div>
      </div>

      <div class="stats-bank-list">
        ${data.banks.length ? data.banks.map(renderBankStats).join('') : `
          <div class="empty-state"><strong>還沒有統計資料</strong><p>完成一些題目後，這裡會顯示學習進度。</p></div>
        `}
      </div>
    </section>
  `;
}

function renderBankStats(item) {
  const m = item.mastery;
  return `
    <article class="stats-bank-card">
      <div class="stats-bank-heading">
        <div>
          <span class="bank-id">${escapeHtml(item.bank.id)}</span>
          <h3>${escapeHtml(item.bank.name || item.bank.title || item.bank.id)}</h3>
        </div>
        <span class="schema-chip">${item.questionCount} 題</span>
      </div>

      <div class="stats-mini-grid">
        ${stat('作答次數', item.attempts)}
        ${stat('正確率', `${item.accuracy}%`)}
        ${stat('目前錯題', item.wrong)}
        ${stat('今日到期', item.due)}
      </div>

      <div class="mastery-block">
        <h4>熟練度分布</h4>
        <div class="mastery-row">
          ${masteryCell('new', m.new)}
          ${masteryCell('learning', m.learning)}
          ${masteryCell('familiar', m.familiar)}
          ${masteryCell('mastered', m.mastered)}
        </div>
      </div>
    </article>
  `;
}

function masteryCell(key, value) {
  return `
    <div class="mastery-cell ${key}">
      <span>${escapeHtml(MASTERY_LABELS[key])}</span>
      <strong>${value || 0}</strong>
    </div>
  `;
}

function stat(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

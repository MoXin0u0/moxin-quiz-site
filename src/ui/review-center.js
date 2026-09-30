export function renderReviewCenter(container, groups) {
  const totalDue = groups.reduce((sum, group) => sum + group.counts.due, 0);
  const totalWrong = groups.reduce((sum, group) => sum + group.counts.wrong, 0);
  const totalFavorite = groups.reduce((sum, group) => sum + group.counts.favorite, 0);
  const totalUnfamiliar = groups.reduce((sum, group) => sum + group.counts.unfamiliar, 0);

  container.innerHTML = `
    <section class="hero-card review-hero">
      <div>
        <p class="eyebrow">Review Center</p>
        <h2>今日複習</h2>
        <p>依排程、錯題、收藏與不熟題快速建立複習輪次。每次複習仍以單一題庫進行，避免題庫內容與圖片來源混淆。</p>
      </div>
      <div class="review-summary-grid">
        ${summaryStat('今日到期', totalDue)}
        ${summaryStat('目前錯題', totalWrong)}
        ${summaryStat('收藏', totalFavorite)}
        ${summaryStat('不熟題', totalUnfamiliar)}
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Review Queues</p>
          <h2>選擇複習來源</h2>
        </div>
      </div>

      <div class="review-bank-list">
        ${groups.length ? groups.map(renderGroup).join('') : `
          <div class="empty-state">
            <strong>目前沒有可複習的本機題庫</strong>
            <p>請先回到「我的題庫」匯入題庫並完成一些練習。</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderGroup(group) {
  return `
    <article class="review-bank-card">
      <div class="review-bank-heading">
        <div>
          <span class="bank-id">${escapeHtml(group.bank.id)}</span>
          <h3>${escapeHtml(group.bank.name || group.bank.title || group.bank.id)}</h3>
        </div>
        <span class="schema-chip">${group.questionCount} 題</span>
      </div>

      <div class="review-mode-grid">
        ${reviewMode(group, 'due', '今日到期', group.counts.due, '依間隔複習排程')}
        ${reviewMode(group, 'wrong', '目前錯題', group.counts.wrong, '最後一次作答仍為錯誤')}
        ${reviewMode(group, 'favorite', '收藏', group.counts.favorite, '你手動收藏的題目')}
        ${reviewMode(group, 'unfamiliar', '不熟題', group.counts.unfamiliar, '你手動標記為不熟')}
      </div>
    </article>
  `;
}

function reviewMode(group, mode, label, count, description) {
  return `
    <div class="review-mode-card">
      <span>${escapeHtml(label)}</span>
      <strong>${count}</strong>
      <small>${escapeHtml(description)}</small>
      <button
        class="button ${mode === 'due' ? 'primary' : 'secondary'}"
        type="button"
        data-review-bank="${escapeAttr(group.bank.id)}"
        data-review-mode="${escapeAttr(mode)}"
        ${count ? '' : 'disabled'}
      >開始複習</button>
    </div>
  `;
}

function summaryStat(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
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

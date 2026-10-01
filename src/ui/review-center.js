export function renderReviewCenter(container, groups) {
  const totalDue = groups.reduce((sum, group) => sum + group.counts.due, 0);
  const totalWrong = groups.reduce((sum, group) => sum + group.counts.wrong, 0);
  const totalFavorite = groups.reduce((sum, group) => sum + group.counts.favorite, 0);
  const totalUnfamiliar = groups.reduce((sum, group) => sum + group.counts.unfamiliar, 0);
  const recommended = pickReviewRecommendation(groups);

  const focusText = totalDue
    ? `今天有 ${totalDue} 題排程到期，先把它們完成最有效率。`
    : totalWrong
      ? '今天沒有排程到期，可以從錯題開始整理。'
      : totalUnfamiliar
        ? '今天沒有排程與錯題壓力，可以先處理不熟題。'
        : '今天沒有排程壓力，可以自由挑選想加強的內容。';

  container.innerHTML = `
    <section class="learning-hero learning-review-hero learning-hero-whole" data-learning-scene="review">
      <div class="learning-hero-art learning-hero-art-review" data-scene-art="review" aria-hidden="true"></div>
      <div class="learning-hero-content">
        <span class="learning-kicker">今日複習</span>
        <h2>把今天該記住的，留到明天還能想起來</h2>
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
          <span class="learning-hero-cta-note">${recommended
            ? `${recommended.count} 題優先處理`
            : '完成作答後，這裡會自動形成複習路線'}</span>
        </div>

        <div class="learning-focus-strip learning-hero-stat-strip">
          ${focusItem('今日到期', totalDue, 'due')}
          ${focusItem('目前錯題', totalWrong, 'wrong')}
          ${focusItem('不熟題', totalUnfamiliar, 'unfamiliar')}
          ${focusItem('收藏', totalFavorite, 'favorite')}
        </div>
      </div>

      <div class="learning-hero-floating-stat review" aria-hidden="true">
        <span>今日優先</span>
        <strong>${totalDue || totalWrong || totalUnfamiliar || 0}</strong>
        <small>${totalDue ? '排程到期' : totalWrong ? '錯題待整理' : totalUnfamiliar ? '不熟題' : '自由複習'}</small>
      </div>
    </section>

    <section class="learning-section-head">
      <div>
        <span class="learning-kicker">複習路線</span>
        <h2>依題庫選擇今天的複習方式</h2>
        <p>每次仍以單一題庫進行，圖片與學習紀錄都會保持正確關聯。</p>
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
      return {
        group: candidates[0],
        mode,
        label,
        count: Number(candidates[0].counts?.[mode] || 0),
      };
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
      <strong>${value}</strong>
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

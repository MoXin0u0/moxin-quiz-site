const MASTERY_LABELS = {
  new: '尚未建立',
  learning: '學習中',
  familiar: '熟悉',
  mastered: '已掌握',
};

export function renderLearningStats(container, data) {
  const overall = data.overall;
  const accuracy = clampPercent(overall.accuracy);

  container.innerHTML = `
    <section class="learning-hero learning-stats-hero">
      <div class="learning-hero-copy">
        <span class="learning-kicker">學習統計</span>
        <h2>把作答紀錄變成下一步更清楚的方向</h2>
        <p>所有統計都只來自這個瀏覽器的 IndexedDB，不會上傳到伺服器。</p>

        <div class="learning-focus-strip stats">
          ${metricCard('總作答', overall.attempts, '▤')}
          ${metricCard('已作答題', overall.answeredQuestions, '✓')}
          ${metricCard('今日到期', overall.due, '↻')}
        </div>
      </div>

      <div class="learning-accuracy-card">
        <div class="learning-accuracy-ring" style="--accuracy:${accuracy * 3.6}deg">
          <div>
            <strong>${accuracy}%</strong>
            <span>整體正確率</span>
          </div>
        </div>
        <p>${accuracy >= 80
          ? '目前整體表現穩定，接下來可以把注意力放在零散錯題。'
          : accuracy >= 60
            ? '已建立一定基礎，持續整理錯題會讓表現更穩。'
            : '先從錯題與不熟題開始，逐步建立穩定的答題記憶。'
        }</p>
      </div>
    </section>

    <section class="learning-section-head">
      <div>
        <span class="learning-kicker">題庫分析</span>
        <h2>各題庫的掌握狀態</h2>
        <p>比較作答次數、正確率、錯題與熟練度分布，找出下一個值得加強的區域。</p>
      </div>
    </section>

    <div class="stats-bank-list learning-stats-list">
      ${data.banks.length ? data.banks.map(renderBankStats).join('') : `
        <div class="learning-empty">
          <div class="learning-empty-icon" aria-hidden="true">▥</div>
          <strong>還沒有統計資料</strong>
          <p>完成一些題目後，這裡會開始顯示你的學習進度與熟練度。</p>
        </div>
      `}
    </div>
  `;
}

function renderBankStats(item) {
  const m = item.mastery;
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

        <div class="learning-mastery-bar" aria-label="熟練度分布">
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

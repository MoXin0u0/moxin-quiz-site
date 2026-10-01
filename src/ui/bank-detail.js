const TYPE_LABELS = {
  'single-choice': '單選題',
  'multiple-choice': '複選題',
  'true-false': '是非題',
  'fill-in': '填空題',
};

const LEARNING_FILTERS = [
  ['all', '全部題目'],
  ['due', '今日到期'],
  ['wrong', '錯題'],
  ['favorite', '收藏'],
  ['unfamiliar', '不熟題'],
  ['note', '有筆記'],
];

export function renderBankDetail(container, bank, questions, learning = {}) {
  const chapters = unique(questions.map(question => question.chapter).filter(Boolean));
  const difficulties = unique(questions.map(question => question.difficulty).filter(Number.isInteger)).sort((a, b) => a - b);
  const summary = learning.summary || {};
  const resume = learning.resumeSession;
  const activeFilter = learning.activeFilter || 'all';

  container.innerHTML = `
    <section class="bank-study-shell">
      <div class="bank-study-toolbar">
        <button class="back-button" type="button" data-back-library>← 回到我的題庫</button>
        <button class="button secondary compact" type="button" data-export-bank>匯出題庫 ZIP</button>
      </div>

      <section class="bank-study-hero">
        <div class="bank-study-hero-copy">
          <span class="learning-kicker">準備開始練習</span>
          <h2>${escapeHtml(bank.name || bank.title || bank.id)}</h2>
          <p>${escapeHtml(bank.description || '這份題庫目前沒有額外說明。')}</p>

          <div class="bank-study-summary">
            ${summaryCard('總題數', questions.length, '全部可練習')}
            ${summaryCard('今日到期', summary.due || 0, '優先複習')}
            ${summaryCard('目前錯題', summary.wrong || 0, '值得再看')}
            ${summaryCard('收藏', summary.favorite || 0, '想再次複習')}
          </div>
        </div>

        <div class="bank-study-hero-panel">
          <div class="bank-study-hero-panel-top">
            <span>這次練習</span>
            <strong data-filter-count>${questions.length} 題</strong>
          </div>
          <p>先選擇學習清單，再用題型、章節或關鍵字縮小範圍。</p>
          <button class="button primary bank-study-start" type="button" data-start-practice>開始練習</button>
        </div>
      </section>

      ${resume ? `
        <section class="resume-card bank-study-resume">
          <div>
            <span class="learning-kicker">未完成練習</span>
            <h3>繼續上次的進度</h3>
            <p>${escapeHtml(String(summary.resumeCompleted ?? 0))} / ${escapeHtml(String(summary.resumeTotal ?? 0))} 題完成 · ${escapeHtml(formatDateTime(resume.updatedAt))}</p>
          </div>
          <button class="button primary" type="button" data-resume-practice>繼續上次練習</button>
        </section>
      ` : ''}

      <section class="bank-study-planner">
        <div class="bank-study-section-head">
          <div>
            <span class="learning-kicker">學習清單</span>
            <h2>先決定這次要練什麼</h2>
          </div>
          <span class="bank-study-hint">所有條件都可以再搭配下方篩選</span>
        </div>

        <div class="learning-strip bank-study-learning-strip">
          ${LEARNING_FILTERS.map(([value, label]) => `
            <button class="learning-filter ${value === activeFilter ? 'is-active' : ''}" type="button" data-learning-filter="${value}">
              <strong>${escapeHtml(String(countForFilter(value, questions.length, summary)))}</strong>
              <span>${escapeHtml(label)}</span>
            </button>
          `).join('')}
        </div>

        <details class="bank-study-filter-details" open>
          <summary>
            <span>進一步篩選</span>
            <small>搜尋、題型、難度與章節</small>
          </summary>

          <div class="filter-grid bank-study-filter-grid">
            <label>
              搜尋題目
              <input type="search" data-filter-keyword placeholder="搜尋題目、選項、標籤或詳解" />
            </label>
            <label>
              題型
              <select data-filter-type>
                <option value="all">全部題型</option>
                ${Object.entries(TYPE_LABELS).map(([value, label]) => `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`).join('')}
              </select>
            </label>
            <label>
              難度
              <select data-filter-difficulty>
                <option value="all">全部難度</option>
                ${difficulties.map(value => `<option value="${value}">難度 ${value}</option>`).join('')}
              </select>
            </label>
            <label>
              章節
              <select data-filter-chapter>
                <option value="all">全部章節</option>
                ${chapters.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join('')}
              </select>
            </label>
          </div>
        </details>
      </section>

      <section class="bank-study-preview">
        <div class="bank-study-section-head">
          <div>
            <span class="learning-kicker">題目預覽</span>
            <h2>確認這次會練到哪些題目</h2>
          </div>
          <span class="bank-study-preview-note">預覽最多顯示 60 題</span>
        </div>
        <div class="question-preview-list bank-study-question-list" data-question-results></div>
      </section>
    </section>
  `;

  renderFilteredQuestions(container, questions, learning);
}

export function readBankFilters(container) {
  return {
    keyword: container.querySelector('[data-filter-keyword]')?.value || '',
    type: container.querySelector('[data-filter-type]')?.value || 'all',
    difficulty: container.querySelector('[data-filter-difficulty]')?.value || 'all',
    chapter: container.querySelector('[data-filter-chapter]')?.value || 'all',
  };
}

export function filterQuestions(questions, filters, learning = {}) {
  const keyword = normalize(filters.keyword);
  const learningFilter = learning.activeFilter || 'all';

  return questions.filter(question => {
    if (!matchesLearningFilter(question.id, learningFilter, learning)) return false;
    if (filters.type !== 'all' && question.type !== filters.type) return false;
    if (filters.difficulty !== 'all' && String(question.difficulty) !== String(filters.difficulty)) return false;
    if (filters.chapter !== 'all' && String(question.chapter || '') !== filters.chapter) return false;

    if (keyword) {
      const optionText = Array.isArray(question.options)
        ? question.options.map(option => `${option.id} ${option.text}`).join(' ')
        : '';
      const haystack = normalize([
        question.id,
        question.question,
        optionText,
        question.explanation,
        question.chapter,
        ...(question.tags || []),
      ].join(' '));
      if (!haystack.includes(keyword)) return false;
    }

    return true;
  });
}

export function renderFilteredQuestions(container, questions, learning = {}) {
  const counts = container.querySelectorAll('[data-filter-count]');
  const list = container.querySelector('[data-question-results]');
  const startButtons = container.querySelectorAll('[data-start-practice]');

  counts.forEach(count => {
    count.textContent = `${questions.length} 題`;
  });
  startButtons.forEach(button => {
    button.disabled = questions.length === 0;
  });
  if (!list) return;

  if (questions.length === 0) {
    list.innerHTML = '<div class="learning-empty"><div class="learning-empty-icon">?</div><strong>沒有符合條件的題目</strong><p>調整學習清單或篩選條件後再試一次。</p></div>';
    return;
  }

  list.innerHTML = questions.slice(0, 60).map((question, index) => {
    const flags = statusFlags(question.id, learning);
    return `
      <article class="question-preview bank-study-question-preview">
        <div class="bank-study-question-number">${String(index + 1).padStart(2, '0')}</div>
        <div class="bank-study-question-body">
          <div class="question-preview-top">
            <span class="mini-chip">${escapeHtml(question.id)}</span>
            <span class="mini-chip">${escapeHtml(TYPE_LABELS[question.type] || question.type)}</span>
            <span class="mini-chip">難度 ${escapeHtml(String(question.difficulty ?? '—'))}</span>
            ${question.chapter ? `<span class="mini-chip">${escapeHtml(question.chapter)}</span>` : ''}
          </div>
          <p>${escapeHtml(question.question)}</p>
          ${flags.length ? `<div class="preview-status-row">${flags.join('')}</div>` : ''}
        </div>
      </article>
    `;
  }).join('') + (questions.length > 60
    ? `<div class="learning-empty compact"><strong>另有 ${questions.length - 60} 題未顯示</strong><p>開始練習時仍會包含全部篩選結果。</p></div>`
    : '');
}

function matchesLearningFilter(questionId, filter, learning) {
  if (filter === 'due') return learning.dueIds?.has(questionId);
  if (filter === 'wrong') return learning.wrongIds?.has(questionId);
  if (filter === 'favorite') return learning.favoriteIds?.has(questionId);
  if (filter === 'unfamiliar') return learning.unfamiliarIds?.has(questionId);
  if (filter === 'note') return learning.noteIds?.has(questionId);
  return true;
}

function statusFlags(questionId, learning) {
  const result = [];
  if (learning.dueIds?.has(questionId)) result.push('<span class="status-dot">今日到期</span>');
  if (learning.wrongIds?.has(questionId)) result.push('<span class="status-dot wrong">錯題</span>');
  if (learning.favoriteIds?.has(questionId)) result.push('<span class="status-dot favorite">★ 收藏</span>');
  if (learning.unfamiliarIds?.has(questionId)) result.push('<span class="status-dot unfamiliar">不熟</span>');
  if (learning.noteIds?.has(questionId)) result.push('<span class="status-dot note">有筆記</span>');
  return result;
}

function countForFilter(filter, total, summary) {
  if (filter === 'due') return summary.due || 0;
  if (filter === 'wrong') return summary.wrong || 0;
  if (filter === 'favorite') return summary.favorite || 0;
  if (filter === 'unfamiliar') return summary.unfamiliar || 0;
  if (filter === 'note') return summary.note || 0;
  return total;
}

function summaryCard(label, value, description) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(description)}</small>
    </div>
  `;
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'zh-Hant'));
}

function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function formatDateTime(value) {
  if (!value) return '未記錄時間';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
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

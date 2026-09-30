const TYPE_LABELS = {
  'single-choice': '單選題',
  'multiple-choice': '複選題',
  'true-false': '是非題',
  'fill-in': '填空題',
};

export function renderBankDetail(container, bank, questions) {
  const chapters = unique(questions.map(question => question.chapter).filter(Boolean));
  const difficulties = unique(questions.map(question => question.difficulty).filter(Number.isInteger)).sort((a, b) => a - b);

  container.innerHTML = `
    <div class="view-toolbar">
      <button class="back-button" type="button" data-back-library>← 回到我的題庫</button>
    </div>

    <section class="detail-hero">
      <div>
        <p class="eyebrow">Question Bank</p>
        <h2>${escapeHtml(bank.name || bank.title || bank.id)}</h2>
        <p class="detail-summary">${escapeHtml(bank.description || '沒有題庫說明。')}</p>
      </div>
      <div class="detail-meta">
        ${meta('題目', questions.length)}
        ${meta('版本', bank.version || '—')}
        ${meta('Schema', bank.schemaVersion || '2.0')}
        ${meta('語言', bank.language || '—')}
      </div>
    </section>

    <section class="filter-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Practice Filter</p>
          <h2>選擇這次要練習的題目</h2>
        </div>
      </div>

      <div class="filter-grid">
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

      <div class="filter-footer">
        <span class="filter-count" data-filter-count></span>
        <button class="button primary" type="button" data-start-practice>開始練習</button>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Question Preview</p>
          <h2>題目預覽</h2>
        </div>
      </div>
      <div class="question-preview-list" data-question-results></div>
    </section>
  `;

  renderFilteredQuestions(container, questions);
}

export function readBankFilters(container) {
  return {
    keyword: container.querySelector('[data-filter-keyword]')?.value || '',
    type: container.querySelector('[data-filter-type]')?.value || 'all',
    difficulty: container.querySelector('[data-filter-difficulty]')?.value || 'all',
    chapter: container.querySelector('[data-filter-chapter]')?.value || 'all',
  };
}

export function filterQuestions(questions, filters) {
  const keyword = normalize(filters.keyword);

  return questions.filter(question => {
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

export function renderFilteredQuestions(container, questions) {
  const count = container.querySelector('[data-filter-count]');
  const list = container.querySelector('[data-question-results]');
  const startButton = container.querySelector('[data-start-practice]');

  if (count) count.textContent = `目前篩選結果：${questions.length} 題`;
  if (startButton) startButton.disabled = questions.length === 0;
  if (!list) return;

  if (questions.length === 0) {
    list.innerHTML = '<div class="empty-state"><strong>沒有符合條件的題目</strong><p>請修改搜尋或篩選條件。</p></div>';
    return;
  }

  list.innerHTML = questions.slice(0, 60).map(question => `
    <article class="question-preview">
      <div class="question-preview-top">
        <span class="mini-chip">${escapeHtml(question.id)}</span>
        <span class="mini-chip">${escapeHtml(TYPE_LABELS[question.type] || question.type)}</span>
        <span class="mini-chip">難度 ${escapeHtml(String(question.difficulty ?? '—'))}</span>
        ${question.chapter ? `<span class="mini-chip">${escapeHtml(question.chapter)}</span>` : ''}
      </div>
      <p>${escapeHtml(question.question)}</p>
    </article>
  `).join('') + (questions.length > 60
    ? `<div class="empty-state"><strong>另有 ${questions.length - 60} 題未顯示</strong><p>預覽最多顯示 60 題；練習仍會包含全部篩選結果。</p></div>`
    : '');
}

function meta(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'zh-Hant'));
}

function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
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

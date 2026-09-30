const TYPE_LABELS = {
  'single-choice': '單選題',
  'multiple-choice': '複選題',
  'true-false': '是非題',
  'fill-in': '填空題',
};

export function renderPracticeQuestion(container, { bank, question, stats, errorCount = 0 }) {
  const completedPercent = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  container.innerHTML = `
    <section class="practice-shell">
      <div class="view-toolbar">
        <button class="back-button" type="button" data-exit-practice>← 結束並返回題庫</button>
      </div>

      <div class="practice-head">
        <div>
          <p class="eyebrow">Practice Session</p>
          <h2>${escapeHtml(bank.name || bank.title || bank.id)}</h2>
          <p class="detail-summary">答錯的題目會回到本輪 queue，直到本輪答對為止。</p>
        </div>
        <div class="practice-progress">
          <div class="progress-track"><span style="width:${completedPercent}%"></span></div>
          <div class="progress-label">${stats.completed} / ${stats.total} 題完成 · ${stats.accuracy}% 正確率</div>
        </div>
      </div>

      <article class="question-card">
        <div class="question-meta-row">
          <span class="mini-chip">${escapeHtml(question.id)}</span>
          <span class="mini-chip">${escapeHtml(TYPE_LABELS[question.type] || question.type)}</span>
          ${question.chapter ? `<span class="mini-chip">${escapeHtml(question.chapter)}</span>` : ''}
          <span class="mini-chip">難度 ${escapeHtml(String(question.difficulty ?? '—'))}</span>
          ${errorCount ? `<span class="status-badge error">本輪已答錯 ${errorCount} 次</span>` : ''}
        </div>

        <h3 class="question-title">${escapeHtml(question.question)}</h3>
        <div class="question-images" data-question-images></div>

        <form class="answer-form" data-answer-form>
          ${buildAnswerForm(question)}
        </form>

        <div class="practice-actions">
          <button class="button primary" type="button" data-submit-answer>提交答案</button>
          <button class="button secondary favorite-button" type="button" data-toggle-favorite>☆ 收藏</button>
          <button class="button secondary unfamiliar-button" type="button" data-toggle-unfamiliar>標記不熟</button>
        </div>

        <section class="note-editor">
          <label>
            我的筆記
            <textarea data-note-input placeholder="記錄容易混淆的觀念、口訣或補充說明…"></textarea>
            <small>筆記會與題目 ID 綁定；更新題庫時，只要題目 ID 不變就會保留。</small>
          </label>
          <div class="learning-actions">
            <button class="button secondary" type="button" data-save-note>儲存筆記</button>
          </div>
        </section>

        <div data-feedback-area></div>
      </article>
    </section>
  `;
}

export function renderAnswerFeedback(container, { question, userAnswer, correct }) {
  const area = container.querySelector('[data-feedback-area]');
  if (!area) return;

  markOptions(container, question, userAnswer);

  area.innerHTML = `
    <section class="feedback-panel ${correct ? 'correct' : 'wrong'}">
      <h3>${correct ? '答對了' : '答錯了'}</h3>
      <p><strong>你的答案：</strong>${escapeHtml(formatAnswer(question, userAnswer))}</p>
      <p><strong>正確答案：</strong>${escapeHtml(formatAnswer(question, canonicalAnswer(question)))}</p>
      <p><strong>詳解：</strong>${escapeHtml(question.explanation || '這題目前沒有詳解。')}</p>
      <div class="explanation-images" data-explanation-images></div>
      <div class="practice-actions">
        <button class="button primary" type="button" data-next-question>下一題</button>
      </div>
    </section>
  `;

  container.querySelectorAll('[data-answer-form] input').forEach(input => { input.disabled = true; });
  const submit = container.querySelector('[data-submit-answer]');
  if (submit) submit.disabled = true;
}

export function renderPracticeFinished(container, { bank, stats }) {
  container.innerHTML = `
    <section class="practice-shell">
      <div class="practice-finish">
        <p class="eyebrow">Round Complete</p>
        <h2>本輪完成</h2>
        <p class="detail-summary">${escapeHtml(bank.name || bank.title || bank.id)} 的這次練習已全部完成。</p>

        <div class="finish-stats">
          <div><span>題目數</span><strong>${stats.total}</strong></div>
          <div><span>答題次數</span><strong>${stats.attempts}</strong></div>
          <div><span>正確率</span><strong>${stats.accuracy}%</strong></div>
        </div>

        <div class="practice-actions">
          <button class="button primary" type="button" data-restart-practice>再練一次</button>
          <button class="button secondary" type="button" data-finish-to-bank>回到題庫</button>
          <button class="button secondary" type="button" data-finish-to-library>回到我的題庫</button>
        </div>
      </div>
    </section>
  `;
}

export function collectUserAnswer(container, question) {
  const form = container.querySelector('[data-answer-form]');
  if (!form) return null;

  if (question.type === 'single-choice') {
    return form.querySelector('input[name="answer"]:checked')?.value ?? '';
  }

  if (question.type === 'multiple-choice') {
    return [...form.querySelectorAll('input[name="answer"]:checked')].map(input => input.value).sort();
  }

  if (question.type === 'true-false') {
    const value = form.querySelector('input[name="answer"]:checked')?.value;
    if (value === undefined) return null;
    return value === 'true';
  }

  if (question.type === 'fill-in') {
    return form.querySelector('input[name="answer"]')?.value ?? '';
  }

  return null;
}

export function isAnswerEmpty(answer, question) {
  if (question.type === 'multiple-choice') return !Array.isArray(answer) || answer.length === 0;
  if (question.type === 'true-false') return answer === null;
  return answer === '' || answer === null || answer === undefined;
}

export function setFavoriteButton(container, active) {
  const button = container.querySelector('[data-toggle-favorite]');
  if (!button) return;
  button.classList.toggle('is-active', active);
  button.textContent = active ? '★ 已收藏' : '☆ 收藏';
  button.dataset.favoriteActive = active ? 'true' : 'false';
}

export function setUnfamiliarButton(container, active) {
  const button = container.querySelector('[data-toggle-unfamiliar]');
  if (!button) return;
  button.classList.toggle('is-active', active);
  button.textContent = active ? '已標記不熟' : '標記不熟';
  button.dataset.unfamiliarActive = active ? 'true' : 'false';
}

export function setNoteValue(container, note) {
  const input = container.querySelector('[data-note-input]');
  if (input) input.value = note?.text || '';
}

export function getNoteValue(container) {
  return container.querySelector('[data-note-input]')?.value ?? '';
}

function buildAnswerForm(question) {
  if (question.type === 'single-choice' || question.type === 'multiple-choice') {
    const inputType = question.type === 'single-choice' ? 'radio' : 'checkbox';
    return (question.options || []).map(option => `
      <label class="answer-option" data-option-id="${escapeAttr(option.id)}">
        <input type="${inputType}" name="answer" value="${escapeAttr(option.id)}" />
        <span><strong>${escapeHtml(option.id)}.</strong> ${escapeHtml(option.text)}</span>
      </label>
    `).join('');
  }

  if (question.type === 'true-false') {
    return `
      <label class="answer-option" data-option-id="true">
        <input type="radio" name="answer" value="true" />
        <span>O / 是 / 正確</span>
      </label>
      <label class="answer-option" data-option-id="false">
        <input type="radio" name="answer" value="false" />
        <span>X / 否 / 錯誤</span>
      </label>
    `;
  }

  if (question.type === 'fill-in') {
    return `
      <label class="fill-answer">
        <span>請輸入答案</span>
        <input type="text" name="answer" autocomplete="off" placeholder="輸入答案後提交" />
      </label>
    `;
  }

  return '<p>目前不支援這個題型。</p>';
}

function markOptions(container, question, userAnswer) {
  if (!['single-choice', 'multiple-choice', 'true-false'].includes(question.type)) return;

  const correct = new Set(canonicalAnswer(question).map(String));
  const selected = new Set(
    Array.isArray(userAnswer)
      ? userAnswer.map(String)
      : userAnswer === null || userAnswer === undefined || userAnswer === ''
        ? []
        : [String(userAnswer)]
  );

  container.querySelectorAll('[data-option-id]').forEach(row => {
    const value = String(row.dataset.optionId);
    row.classList.toggle('is-correct', correct.has(value));
    row.classList.toggle('is-wrong', selected.has(value) && !correct.has(value));
  });
}

function canonicalAnswer(question) {
  return Array.isArray(question.answer) ? question.answer : [];
}

function formatAnswer(question, answer) {
  if (question.type === 'true-false') {
    const value = Array.isArray(answer) ? answer[0] : answer;
    return value === true ? 'O / 是 / 正確' : value === false ? 'X / 否 / 錯誤' : '未作答';
  }

  const values = Array.isArray(answer) ? answer : [answer];
  if (question.type === 'single-choice' || question.type === 'multiple-choice') {
    return values
      .filter(value => value !== '' && value !== null && value !== undefined)
      .map(value => {
        const option = (question.options || []).find(item => String(item.id) === String(value));
        return option ? `${value}. ${option.text}` : String(value);
      })
      .join('、') || '未作答';
  }

  return values.filter(Boolean).join(' / ') || '未作答';
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

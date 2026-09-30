const TYPE_LABELS = {
  'single-choice': '單選題',
  'multiple-choice': '複選題',
  'true-false': '是非題',
  'fill-in': '填空題',
};

export function renderExamQuestion(container, { bank, session, question, index }) {
  const answered = countAnswered(session);

  container.innerHTML = `
    <section class="exam-shell">
      <header class="exam-header">
        <div>
          <p class="eyebrow">Mock Exam</p>
          <h2>${escapeHtml(bank.name || bank.title || bank.id)}</h2>
          <p>作答中不顯示正誤；答案會保存在本機。</p>
        </div>
        <div class="exam-timer" data-exam-timer aria-live="polite">--:--</div>
      </header>

      <div class="exam-status-row">
        <span>第 ${index + 1} / ${session.questionIds.length} 題</span>
        <span>已作答 ${answered} 題</span>
        <button class="button danger-ghost" type="button" data-submit-exam>交卷</button>
      </div>

      <div class="exam-layout">
        <aside class="exam-navigator" aria-label="題號導覽">
          ${session.questionIds.map((questionId, questionIndex) => `
            <button
              type="button"
              class="exam-number ${questionIndex === index ? 'is-current' : ''} ${hasAnswer(session, questionId) ? 'is-answered' : ''}"
              data-exam-go="${questionIndex}"
              aria-label="前往第 ${questionIndex + 1} 題"
            >${questionIndex + 1}</button>
          `).join('')}
        </aside>

        <article class="question-card exam-question-card">
          <div class="question-meta-row">
            <span class="mini-chip">${escapeHtml(question.id)}</span>
            <span class="mini-chip">${escapeHtml(TYPE_LABELS[question.type] || question.type)}</span>
            ${question.chapter ? `<span class="mini-chip">${escapeHtml(question.chapter)}</span>` : ''}
            <span class="mini-chip">難度 ${escapeHtml(String(question.difficulty ?? '—'))}</span>
          </div>

          <h3 class="question-title">${escapeHtml(question.question)}</h3>
          <div class="question-images" data-exam-question-images></div>

          <form class="answer-form" data-exam-answer-form>
            ${buildAnswerForm(question, session.answers?.[question.id])}
          </form>

          <div class="exam-question-actions">
            <button class="button secondary" type="button" data-exam-prev ${index <= 0 ? 'disabled' : ''}>上一題</button>
            <button class="button primary" type="button" data-exam-next ${index >= session.questionIds.length - 1 ? 'disabled' : ''}>下一題</button>
          </div>
        </article>
      </div>
    </section>
  `;
}

export function collectExamAnswer(container, question) {
  const form = container.querySelector('[data-exam-answer-form]');
  if (!form) return null;

  if (question.type === 'single-choice') {
    return form.querySelector('input[name="exam-answer"]:checked')?.value ?? '';
  }

  if (question.type === 'multiple-choice') {
    return [...form.querySelectorAll('input[name="exam-answer"]:checked')]
      .map(input => input.value)
      .sort();
  }

  if (question.type === 'true-false') {
    const value = form.querySelector('input[name="exam-answer"]:checked')?.value;
    if (value === undefined) return null;
    return value === 'true';
  }

  if (question.type === 'fill-in') {
    return form.querySelector('input[name="exam-answer"]')?.value ?? '';
  }

  return null;
}

export function updateExamTimer(container, remainingSeconds) {
  const timer = container.querySelector('[data-exam-timer]');
  if (!timer) return;

  const total = Math.max(0, Number(remainingSeconds) || 0);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  timer.classList.toggle('is-warning', total <= 300);
  timer.classList.toggle('is-danger', total <= 60);
}

export function renderExamResult(container, { bank, result, questionMap, session }) {
  container.innerHTML = `
    <section class="exam-shell">
      <div class="exam-result-hero">
        <p class="eyebrow">Exam Result</p>
        <h2>模擬考已交卷</h2>
        <p>${escapeHtml(bank.name || bank.title || bank.id)}</p>

        <div class="exam-result-score">${result.score}<small>分</small></div>

        <div class="exam-result-stats">
          ${resultStat('總題數', result.total)}
          ${resultStat('答對', result.correctCount)}
          ${resultStat('答錯', result.wrongCount)}
          ${resultStat('未作答', result.unansweredCount)}
        </div>

        <div class="practice-actions">
          <button class="button primary" type="button" data-exam-again>再考一次</button>
          <button class="button secondary" type="button" data-exam-result-center>回模擬考</button>
          <button class="button secondary" type="button" data-exam-result-library>回我的題庫</button>
        </div>
      </div>

      <section class="exam-analysis">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Answer Analysis</p>
            <h2>考後分析</h2>
          </div>
        </div>

        <div class="exam-analysis-list">
          ${result.details.map((detail, index) => {
            const question = questionMap.get(detail.questionId);
            if (!question) return '';
            return renderAnalysisItem(question, detail, index);
          }).join('')}
        </div>
      </section>
    </section>
  `;
}

function renderAnalysisItem(question, detail, index) {
  const state = detail.correct ? 'correct' : detail.answered ? 'wrong' : 'unanswered';
  const label = detail.correct ? '答對' : detail.answered ? '答錯' : '未作答';

  return `
    <details class="exam-analysis-item ${state}" ${detail.correct ? '' : 'open'}>
      <summary>
        <span>第 ${index + 1} 題</span>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(question.question)}</span>
      </summary>
      <div class="exam-analysis-body">
        <p><strong>你的答案：</strong>${escapeHtml(formatAnswer(question, detail.userAnswer))}</p>
        <p><strong>正確答案：</strong>${escapeHtml(formatAnswer(question, question.answer || []))}</p>
        <p><strong>詳解：</strong>${escapeHtml(question.explanation || '這題目前沒有詳解。')}</p>
      </div>
    </details>
  `;
}

function buildAnswerForm(question, savedAnswer) {
  if (question.type === 'single-choice' || question.type === 'multiple-choice') {
    const inputType = question.type === 'single-choice' ? 'radio' : 'checkbox';
    const selected = new Set(Array.isArray(savedAnswer) ? savedAnswer.map(String) : [String(savedAnswer ?? '')]);
    return (question.options || []).map(option => `
      <label class="answer-option">
        <input
          type="${inputType}"
          name="exam-answer"
          value="${escapeAttr(option.id)}"
          ${selected.has(String(option.id)) ? 'checked' : ''}
        />
        <span><strong>${escapeHtml(option.id)}.</strong> ${escapeHtml(option.text)}</span>
      </label>
    `).join('');
  }

  if (question.type === 'true-false') {
    return `
      <label class="answer-option">
        <input type="radio" name="exam-answer" value="true" ${savedAnswer === true ? 'checked' : ''} />
        <span>O / 是 / 正確</span>
      </label>
      <label class="answer-option">
        <input type="radio" name="exam-answer" value="false" ${savedAnswer === false ? 'checked' : ''} />
        <span>X / 否 / 錯誤</span>
      </label>
    `;
  }

  if (question.type === 'fill-in') {
    return `
      <label class="fill-answer">
        <span>請輸入答案</span>
        <input
          type="text"
          name="exam-answer"
          autocomplete="off"
          value="${escapeAttr(typeof savedAnswer === 'string' ? savedAnswer : '')}"
          placeholder="輸入答案"
        />
      </label>
    `;
  }

  return '<p>目前不支援這個題型。</p>';
}

function countAnswered(session) {
  return (session.questionIds || []).filter(questionId => hasAnswer(session, questionId)).length;
}

function hasAnswer(session, questionId) {
  const answer = session.answers?.[questionId];
  if (answer === null || answer === undefined || answer === '') return false;
  return !Array.isArray(answer) || answer.length > 0;
}

function resultStat(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function formatAnswer(question, answer) {
  if (answer === null || answer === undefined || answer === '' || (Array.isArray(answer) && !answer.length)) {
    return '未作答';
  }

  if (question.type === 'true-false') {
    const value = Array.isArray(answer) ? answer[0] : answer;
    return value === true ? 'O / 是 / 正確' : value === false ? 'X / 否 / 錯誤' : '未作答';
  }

  const values = Array.isArray(answer) ? answer : [answer];
  if (question.type === 'single-choice' || question.type === 'multiple-choice') {
    return values.map(value => {
      const option = (question.options || []).find(item => String(item.id) === String(value));
      return option ? `${value}. ${option.text}` : String(value);
    }).join('、');
  }

  return values.join(' / ');
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

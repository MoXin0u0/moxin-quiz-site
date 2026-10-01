const TYPE_LABELS = {
  'single-choice': '單選題',
  'multiple-choice': '複選題',
  'true-false': '是非題',
  'fill-in': '填空題',
};

export function renderExamQuestion(container, { bank, session, question, index }) {
  const answered = countAnswered(session);
  const total = session.questionIds.length;
  const progress = total ? Math.round(((index + 1) / total) * 100) : 0;

  container.innerHTML = `
    <section class="exam-focus-shell">
      <header class="exam-focus-topbar">
        <div class="exam-focus-title">
          <span class="learning-kicker">模擬考進行中</span>
          <strong>${escapeHtml(bank.name || bank.title || bank.id)}</strong>
        </div>

        <div class="exam-focus-progress">
          <div class="progress-track"><span style="width:${progress}%"></span></div>
          <div class="progress-label">第 ${index + 1} / ${total} 題 · 已作答 ${answered}</div>
        </div>

        <div class="exam-focus-time-block">
          <span>剩餘時間</span>
          <div class="exam-timer" data-exam-timer aria-live="polite">--:--</div>
        </div>
      </header>

      <div class="exam-focus-layout">
        <aside class="exam-focus-navigator" aria-label="題號導覽">
          <div class="exam-focus-navigator-head">
            <span>題目</span>
            <strong>${answered} / ${total}</strong>
          </div>

          <div class="exam-navigator">
            ${session.questionIds.map((questionId, questionIndex) => `
              <button
                type="button"
                class="exam-number ${questionIndex === index ? 'is-current' : ''} ${hasAnswer(session, questionId) ? 'is-answered' : ''}"
                data-exam-go="${questionIndex}"
                aria-label="前往第 ${questionIndex + 1} 題"
              >${questionIndex + 1}</button>
            `).join('')}
          </div>

          <button class="button danger-ghost exam-submit-button" type="button" data-submit-exam>交卷</button>
        </aside>

        <main class="exam-focus-main">
          <article class="question-card exam-question-card exam-focus-question">
            <div class="question-meta-row">
              <span class="mini-chip">${escapeHtml(question.id)}</span>
              <span class="mini-chip">${escapeHtml(TYPE_LABELS[question.type] || question.type)}</span>
              ${question.chapter ? `<span class="mini-chip">${escapeHtml(question.chapter)}</span>` : ''}
              <span class="mini-chip">難度 ${escapeHtml(String(question.difficulty ?? '—'))}</span>
            </div>

            <h3 class="question-title exam-focus-question-title">${escapeHtml(question.question)}</h3>
            <div class="question-images" data-exam-question-images></div>

            <form class="answer-form exam-focus-answer" data-exam-answer-form>
              ${buildAnswerForm(question, session.answers?.[question.id])}
            </form>

            <footer class="exam-question-actions exam-focus-question-actions">
              <button class="button secondary" type="button" data-exam-prev ${index <= 0 ? 'disabled' : ''}>← 上一題</button>
              <span>${index + 1} / ${total}</span>
              <button class="button primary" type="button" data-exam-next ${index >= total - 1 ? 'disabled' : ''}>下一題 →</button>
            </footer>
          </article>
        </main>
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
  const score = Math.max(0, Math.min(100, Number(result.score) || 0));

  container.innerHTML = `
    <section class="exam-result-shell">
      <section class="exam-result-hero exam-focus-result-hero">
        <div class="exam-result-copy">
          <span class="learning-kicker">模擬考結果</span>
          <h2>這一場已經完成</h2>
          <p>${escapeHtml(bank.name || bank.title || bank.id)}</p>

          <div class="exam-result-stats exam-focus-result-stats">
            ${resultStat('總題數', result.total)}
            ${resultStat('答對', result.correctCount)}
            ${resultStat('答錯', result.wrongCount)}
            ${resultStat('未作答', result.unansweredCount)}
          </div>

          <div class="practice-actions exam-result-actions">
            <button class="button primary" type="button" data-exam-again>再考一次</button>
            <button class="button secondary" type="button" data-exam-result-center>回模擬考</button>
            <button class="button secondary" type="button" data-exam-result-library>回我的題庫</button>
          </div>
        </div>

        <div class="exam-result-score-card">
          <div class="exam-result-score-ring" style="--exam-score:${score * 3.6}deg">
            <div>
              <strong>${score}</strong>
              <span>分</span>
            </div>
          </div>
          <p>${score >= 80
            ? '整體表現穩定，可以從答錯題目做最後補強。'
            : score >= 60
              ? '已有一定掌握度，整理錯題後再測一次會更穩。'
              : '先從錯題與未作答題目開始複習，再回來挑戰一次。'
          }</p>
        </div>
      </section>

      <section class="exam-analysis exam-focus-analysis">
        <div class="bank-study-section-head">
          <div>
            <span class="learning-kicker">考後分析</span>
            <h2>逐題檢查這一場的表現</h2>
          </div>
          <span class="bank-study-hint">答錯與未作答題目會預設展開</span>
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
        <span class="exam-analysis-number">${String(index + 1).padStart(2, '0')}</span>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(question.question)}</span>
      </summary>
      <div class="exam-analysis-body">
        <div class="exam-analysis-answer-grid">
          <div>
            <span>你的答案</span>
            <strong>${escapeHtml(formatAnswer(question, detail.userAnswer))}</strong>
          </div>
          <div>
            <span>正確答案</span>
            <strong>${escapeHtml(formatAnswer(question, question.answer || []))}</strong>
          </div>
        </div>
        <div class="exam-analysis-explanation">
          <span>詳解</span>
          <p>${escapeHtml(question.explanation || '這題目前沒有詳解。')}</p>
        </div>
      </div>
    </details>
  `;
}

function buildAnswerForm(question, savedAnswer) {
  if (question.type === 'single-choice' || question.type === 'multiple-choice') {
    const inputType = question.type === 'single-choice' ? 'radio' : 'checkbox';
    const selected = new Set(Array.isArray(savedAnswer) ? savedAnswer.map(String) : [String(savedAnswer ?? '')]);
    return (question.options || []).map(option => `
      <label class="answer-option exam-focus-option">
        <input
          type="${inputType}"
          name="exam-answer"
          value="${escapeAttr(option.id)}"
          ${selected.has(String(option.id)) ? 'checked' : ''}
        />
        <span class="practice-option-key">${escapeHtml(option.id)}</span>
        <span class="practice-option-text">${escapeHtml(option.text)}</span>
      </label>
    `).join('');
  }

  if (question.type === 'true-false') {
    return `
      <label class="answer-option exam-focus-option">
        <input type="radio" name="exam-answer" value="true" ${savedAnswer === true ? 'checked' : ''} />
        <span class="practice-option-key">O</span>
        <span class="practice-option-text">是 / 正確</span>
      </label>
      <label class="answer-option exam-focus-option">
        <input type="radio" name="exam-answer" value="false" ${savedAnswer === false ? 'checked' : ''} />
        <span class="practice-option-key">X</span>
        <span class="practice-option-text">否 / 錯誤</span>
      </label>
    `;
  }

  if (question.type === 'fill-in') {
    return `
      <label class="fill-answer practice-fill-answer">
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

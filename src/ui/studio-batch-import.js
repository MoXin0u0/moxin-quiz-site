import {
  BATCH_PARSE_STATUS,
  parseBatchQuestionText,
  selectBatchQuestions,
} from '../studio/batch-parser.js';

const STYLE_HREF = './styles/v4-studio-batch.css';

export function openStudioBatchImportDialog({
  existingQuestions = [],
  typeLabels = {},
} = {}) {
  ensureBatchStyles();

  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'studio-r1-dialog studio-r1-batch-dialog';
    dialog.setAttribute('aria-labelledby', 'studioBatchDialogTitle');

    dialog.innerHTML = `
      <section class="studio-r1-batch-card">
        <header class="studio-r1-batch-head">
          <div>
            <span class="studio-r1-kicker">P2B · 批次貼題</span>
            <h3 id="studioBatchDialogTitle">把文字解析成工作室草稿</h3>
            <p>只整理來源中明確提供的資料；缺少答案或題型不確定時會標成「需確認」，不會替你猜答案。</p>
          </div>
          <button class="studio-r1-batch-close" type="button" data-studio-batch-close aria-label="關閉">×</button>
        </header>

        <div class="studio-r1-batch-source">
          <label for="studioBatchSource">原始題目文字</label>
          <textarea
            id="studioBatchSource"
            data-studio-batch-source
            rows="12"
            placeholder="例如：
1. ERP 系統的核心目的是？
A. 整合企業流程與資訊
B. 只處理薪資
答案：A
解析：ERP 用於跨部門資訊整合。"></textarea>

          <div class="studio-r1-batch-source-actions">
            <small>支援 1.／1、／Q1／第1題／題目：，以及答案、詳解、章節、標籤、難度等欄位。</small>
            <button class="button primary" type="button" data-studio-batch-parse>解析題目</button>
          </div>
        </div>

        <div class="studio-r1-batch-results" data-studio-batch-results>
          <div class="studio-r1-empty">
            <strong>尚未解析</strong>
            <p>貼上題目文字後按「解析題目」。解析結果不會立即寫入草稿。</p>
          </div>
        </div>

        <footer class="studio-r1-batch-footer">
          <div data-studio-batch-selection-note>解析後可選擇要加入的題目。</div>
          <div class="studio-r1-batch-footer-actions">
            <button class="button secondary" type="button" data-studio-batch-close>取消</button>
            <button class="button primary" type="button" data-studio-batch-add disabled>加入題目</button>
          </div>
        </footer>
      </section>
    `;

    let result = null;
    let settled = false;

    const finish = value => {
      if (settled) return;
      settled = true;
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      dialog.remove();
      resolve(value);
    };

    const updateSelection = () => {
      const selected = [
        ...dialog.querySelectorAll('[data-batch-candidate-index]:checked:not(:disabled)'),
      ];
      const addButton = dialog.querySelector('[data-studio-batch-add]');
      const note = dialog.querySelector('[data-studio-batch-selection-note]');

      if (addButton) {
        addButton.disabled = selected.length === 0;
        addButton.textContent = selected.length ? `加入 ${selected.length} 題` : '加入題目';
      }

      if (note) {
        const reviewCount = selected.filter(
          input => input.dataset.batchStatus === BATCH_PARSE_STATUS.REVIEW,
        ).length;

        note.textContent = selected.length
          ? `已選 ${selected.length} 題${reviewCount ? `，其中 ${reviewCount} 題為人工確認項目` : ''}。`
          : '尚未選擇要加入的題目。';
      }
    };

    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      finish(null);
    });

    dialog.addEventListener('change', event => {
      if (event.target.matches('[data-batch-candidate-index]')) updateSelection();
    });

    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-studio-batch-close]')) {
        finish(null);
        return;
      }

      if (event.target.closest('[data-studio-batch-parse]')) {
        const source = dialog.querySelector('[data-studio-batch-source]')?.value || '';
        const host = dialog.querySelector('[data-studio-batch-results]');

        if (!source.trim()) {
          if (host) {
            host.innerHTML =
              '<div class="studio-r1-batch-message is-warning">請先貼上要解析的題目文字。</div>';
          }
          result = null;
          updateSelection();
          return;
        }

        result = parseBatchQuestionText(source, { existingQuestions });

        if (host) {
          host.innerHTML = renderBatchImportPreview(result, typeLabels);
        }
        updateSelection();
        return;
      }

      if (event.target.closest('[data-studio-batch-add]')) {
        if (!result) return;

        const selectedInputs = [
          ...dialog.querySelectorAll('[data-batch-candidate-index]:checked:not(:disabled)'),
        ];
        const selectedIndexes = selectedInputs.map(
          input => Number(input.dataset.batchCandidateIndex),
        );
        const includeReview = selectedInputs.some(
          input => input.dataset.batchStatus === BATCH_PARSE_STATUS.REVIEW,
        );

        const additions = selectBatchQuestions(result.candidates, {
          existingQuestions,
          includeReview,
          selectedIndexes,
        });

        if (additions.length) finish(additions);
      }
    });

    document.body.appendChild(dialog);

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
      dialog.classList.add('is-fallback');
    }

    dialog.querySelector('[data-studio-batch-source]')?.focus();
  });
}

function renderBatchImportPreview(result, typeLabels) {
  const summary = result?.summary || {
    total: 0,
    ready: 0,
    review: 0,
    unparsed: 0,
  };

  const preamble = result?.preamble?.trim()
    ? `
      <details class="studio-r1-batch-preamble">
        <summary>解析前偵測到未歸入題目的前言</summary>
        <pre>${escapeHtml(result.preamble)}</pre>
      </details>
    `
    : '';

  const cards = (result?.candidates || [])
    .map(candidate => renderBatchCandidateCard(candidate, typeLabels))
    .join('');

  return `
    <div class="studio-r1-batch-summary" aria-label="解析摘要">
      <div><span>全部</span><strong>${summary.total}</strong></div>
      <div class="is-ready"><span>可直接加入</span><strong>${summary.ready}</strong></div>
      <div class="is-review"><span>需確認</span><strong>${summary.review}</strong></div>
      <div class="is-unparsed"><span>未解析</span><strong>${summary.unparsed}</strong></div>
    </div>

    ${preamble}

    <div class="studio-r1-batch-list">
      ${cards || `
        <div class="studio-r1-empty">
          <strong>沒有找到題目</strong>
          <p>請檢查題號或「題目：」欄位格式。</p>
        </div>
      `}
    </div>
  `;
}

function renderBatchCandidateCard(candidate, typeLabels) {
  const status = candidate.status;
  const isReady = status === BATCH_PARSE_STATUS.READY;
  const isReview = status === BATCH_PARSE_STATUS.REVIEW;
  const isUnparsed = status === BATCH_PARSE_STATUS.UNPARSED;
  const question = candidate.question;

  const label = isReady ? '可直接加入' : isReview ? '需確認' : '未解析';
  const checked = isReady ? 'checked' : '';
  const disabled = isUnparsed ? 'disabled' : '';

  const issues = (candidate.issues || [])
    .map(item => `<li>${escapeHtml(item.message)}</li>`)
    .join('');

  const options = question?.options?.length
    ? `
      <div class="studio-r1-batch-options">
        ${question.options.map(option => `
          <span>
            <strong>${escapeHtml(option.id)}</strong>
            ${escapeHtml(option.text)}
          </span>
        `).join('')}
      </div>
    `
    : '';

  return `
    <article class="studio-r1-batch-item is-${escapeAttr(status)}">
      <div class="studio-r1-batch-item-head">
        <label class="studio-r1-batch-select">
          <input
            type="checkbox"
            data-batch-candidate-index="${candidate.index}"
            data-batch-status="${escapeAttr(status)}"
            ${checked}
            ${disabled}
          />
          <span>
            <strong>${escapeHtml(question?.id || `區塊 ${candidate.index + 1}`)}</strong>
            <small>${
              isReview
                ? '我已確認，仍加入草稿'
                : isUnparsed
                  ? '無法直接加入'
                  : '加入草稿'
            }</small>
          </span>
        </label>

        <span class="studio-r1-batch-status is-${escapeAttr(status)}">${label}</span>
      </div>

      ${question ? `
        <div class="studio-r1-batch-question">
          <div>
            <span>${escapeHtml(typeLabels[question.type] || question.type)}</span>
            <strong>${escapeHtml(question.question || '未提供題目')}</strong>
          </div>

          <dl>
            <div>
              <dt>答案</dt>
              <dd>${escapeHtml(formatBatchCandidateAnswer(question))}</dd>
            </div>
            <div>
              <dt>章節</dt>
              <dd>${escapeHtml(question.chapter || '—')}</dd>
            </div>
            <div>
              <dt>難度</dt>
              <dd>${escapeHtml(question.difficulty || 3)}</dd>
            </div>
          </dl>

          ${options}
        </div>
      ` : ''}

      ${issues ? `<ul class="studio-r1-batch-issues">${issues}</ul>` : ''}

      <details class="studio-r1-batch-raw">
        <summary>查看原始文字</summary>
        <pre>${escapeHtml(candidate.raw || '')}</pre>
      </details>
    </article>
  `;
}

function formatBatchCandidateAnswer(question) {
  const answer = Array.isArray(question?.answer) ? question.answer : [];
  if (!answer.length) return '尚未設定';
  if (question.type === 'true-false') return answer[0] === true ? '正確' : '錯誤';
  return answer.join('、');
}

function ensureBatchStyles() {
  if (document.querySelector('link[data-v4-studio-batch-styles]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  link.dataset.v4StudioBatchStyles = 'true';
  document.head.appendChild(link);
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

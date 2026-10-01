import {
  getBankPackage,
  listBanks,
  saveBankPackage,
} from '../storage/repositories/banks.js';
import {
  createDraftFromBankPackage,
  createStudioDraft,
  deleteStudioDraft,
  listStudioDrafts,
  saveStudioDraft,
  STUDIO_DRAFT_STATUS,
} from '../storage/repositories/studio.js';
import { validatePackage } from '../question-bank/validator.js';
import {
  cleanExportManifest,
  downloadQuestionBankZip,
} from '../question-bank/zip-writer.js';
import {
  createEditableCopyPackage,
  createEmptyStudioPackage,
  createQuestion,
  duplicateQuestion,
  moveQuestion,
  parseFillAnswers,
  parseTags,
  removeQuestion,
  syncManifestQuestionCount,
} from '../studio/editor-model.js';
import {
  convertQuestionType,
  normalizeQuestionDraft,
  planQuestionTypeChange,
  validateQuestionDraft,
} from '../studio/question-draft.js';
import {
  loadSettings,
  saveSettings,
} from '../storage/settings.js';

const TYPE_LABELS = Object.freeze({
  'single-choice': '單選題',
  'multiple-choice': '複選題',
  'true-false': '是非題',
  'fill-in': '填空題',
});

const LEGACY_POLLUTION_CUTOFF = Date.parse('2026-10-02T00:00:00+08:00');

const state = {
  mode: 'home',
  draft: null,
  activeQuestionId: null,
  autosaveTimer: null,
  validationTimer: null,
  mount: null,
  undo: null,
  undoTimer: null,
};

export async function mountStudioWorkspace(mount) {
  if (!mount) return;
  ensureStudioStyles();
  state.mount = mount;
  bindWorkspace(mount);

  if (state.mode === 'editor' && state.draft) {
    renderEditor();
    return;
  }

  await renderHome();
}

async function renderHome() {
  state.mode = 'home';
  state.draft = null;
  state.activeQuestionId = null;

  const mount = state.mount;
  if (!mount) return;

  mount.innerHTML = `
    <section class="studio-r1-home">
      <header class="studio-r1-home-hero">
        <div>
          <span class="studio-r1-kicker">題庫工作室</span>
          <h2>建立自己的題庫</h2>
          <p>直接在瀏覽器內建立、編輯、驗證與匯出題庫。草稿保存在本機，不會自動上傳。</p>
        </div>
        <button class="button primary" type="button" data-studio-new>＋ 建立新題庫</button>
      </header>

      <div class="studio-r1-status" data-studio-status>正在讀取本機資料…</div>

      <div class="studio-r1-home-grid">
        <section class="studio-r1-home-section">
          <div class="studio-r1-section-title">
            <div><span>草稿</span><h3>繼續上次編輯</h3></div>
          </div>
          <div data-studio-drafts class="studio-r1-card-list"></div>
        </section>

        <section class="studio-r1-home-section">
          <div class="studio-r1-section-title">
            <div><span>題庫</span><h3>從既有題庫開始</h3></div>
          </div>
          <div data-studio-banks class="studio-r1-card-list"></div>
        </section>
      </div>
    </section>
  `;

  try {
    const [drafts, banks] = await Promise.all([listStudioDrafts(), listBanks()]);
    const draftsContainer = mount.querySelector('[data-studio-drafts]');
    const banksContainer = mount.querySelector('[data-studio-banks]');

    draftsContainer.innerHTML = drafts.length
      ? drafts.map(renderDraftCard).join('')
      : renderEmptyState('目前沒有草稿', '建立新題庫後，尚未完成的內容會自動保存在這裡。');

    banksContainer.innerHTML = banks.length
      ? banks.map(renderBankCard).join('')
      : renderEmptyState('目前沒有本機題庫', '可以從「我的題庫」匯入，或直接建立新的題庫。');

    setStatus(`已載入 ${drafts.length} 份草稿、${banks.length} 個本機題庫。`, 'ok');
  } catch (error) {
    console.error(error);
    setStatus(`題庫工作室初始化失敗：${error.message}`, 'error');
  }
}

function bindWorkspace(mount) {
  if (mount.dataset.studioR1Bound === 'true') return;
  mount.dataset.studioR1Bound = 'true';

  mount.addEventListener('click', async event => {
    const openDraft = event.target.closest('[data-studio-open-draft]');
    if (openDraft) return openDraftById(openDraft.dataset.studioOpenDraft);

    const deleteDraftButton = event.target.closest('[data-studio-delete-draft]');
    if (deleteDraftButton) return removeDraft(deleteDraftButton.dataset.studioDeleteDraft);

    const editBank = event.target.closest('[data-studio-edit-bank]');
    if (editBank) return openBankForEditing(editBank.dataset.studioEditBank, false);

    const copyBank = event.target.closest('[data-studio-copy-bank]');
    if (copyBank) return openBankForEditing(copyBank.dataset.studioCopyBank, true);

    if (event.target.closest('[data-studio-new]')) return createNewDraft();

    if (event.target.closest('[data-studio-back]')) {
      await persistDraftNow();
      return renderHome();
    }

    if (event.target.closest('[data-studio-save-draft]')) {
      await persistDraftNow();
      setStatus('草稿已儲存。', 'ok');
      return;
    }

    if (event.target.closest('[data-studio-validate]')) {
      updateInspector();
      setStatus('已重新檢查目前題庫。', 'ok');
      return;
    }

    if (event.target.closest('[data-studio-save-library]')) return saveDraftToLibrary();
    if (event.target.closest('[data-studio-save-copy]')) return convertCurrentDraftToCopy();
    if (event.target.closest('[data-studio-export-zip]')) return exportZip();

    if (event.target.closest('[data-studio-export-json]')) {
      exportJson();
      return;
    }

    const selectQuestion = event.target.closest('[data-studio-select-question]');
    if (selectQuestion) {
      state.activeQuestionId = selectQuestion.dataset.studioSelectQuestion;
      renderEditor();
      return;
    }

    const typeButton = event.target.closest('[data-question-type-choice]');
    if (typeButton) return changeCurrentQuestionType(typeButton.dataset.questionTypeChoice);

    if (event.target.closest('[data-studio-add-question]')) {
      clearUndoState();
      state.draft.questions.push(createQuestion('single-choice', state.draft.questions));
      state.activeQuestionId = state.draft.questions.at(-1).id;
      await persistDraftNow();
      renderEditor();
      return;
    }

    if (event.target.closest('[data-studio-duplicate-question]')) {
      clearUndoState();
      const current = getActiveQuestion();
      if (!current) return;
      const copy = duplicateQuestion(current, state.draft.questions);
      const index = state.draft.questions.findIndex(question => question.id === current.id);
      state.draft.questions.splice(index + 1, 0, copy);
      state.activeQuestionId = copy.id;
      await persistDraftNow();
      renderEditor();
      return;
    }

    if (event.target.closest('[data-studio-delete-question]')) {
      clearUndoState();
      const current = getActiveQuestion();
      if (!current || state.draft.questions.length <= 1) return;
      if (!confirm(`確定刪除題目 ${current.id}？\n\n這個操作只會刪除工作室中的題目內容。`)) return;

      const index = state.draft.questions.findIndex(question => question.id === current.id);
      state.draft.questions = removeQuestion(state.draft.questions, current.id);
      state.activeQuestionId =
        state.draft.questions[Math.min(index, state.draft.questions.length - 1)]?.id || null;

      await persistDraftNow();
      renderEditor();
      return;
    }

    const moveButton = event.target.closest('[data-studio-move]');
    if (moveButton) {
      clearUndoState();
      const current = getActiveQuestion();
      if (!current) return;
      state.draft.questions = moveQuestion(
        state.draft.questions,
        current.id,
        moveButton.dataset.studioMove === 'up' ? -1 : 1,
      );
      await persistDraftNow();
      renderEditor();
      return;
    }

    if (event.target.closest('[data-studio-add-option]')) {
      clearUndoState();
      const current = getActiveQuestion();
      if (!current || !isChoice(current.type)) return;
      current.options.push({ id: nextOptionId(current.options), text: '' });
      await persistDraftNow();
      renderEditor();
      return;
    }

    const removeOption = event.target.closest('[data-studio-remove-option]');
    if (removeOption) {
      clearUndoState();
      const current = getActiveQuestion();
      if (!current || current.options.length <= 2) return;

      const index = Number(removeOption.dataset.studioRemoveOption);
      const removed = current.options[index];
      current.options.splice(index, 1);
      current.answer = current.answer.filter(value => value !== removed?.id);

      await persistDraftNow();
      renderEditor();
      return;
    }

    const trueAnswer = event.target.closest('[data-studio-true-answer]');
    if (trueAnswer) {
      clearUndoState();
      const current = getActiveQuestion();
      if (!current || current.type !== 'true-false') return;
      current.answer = [trueAnswer.dataset.studioTrueAnswer === 'true'];
      await persistDraftNow();
      renderEditor();
      return;
    }

    if (event.target.closest('[data-studio-undo-type-change]')) {
      await undoLastTypeChange();
      return;
    }

    if (event.target.closest('[data-studio-clear-suspect-answers]')) {
      clearUndoState();
      const suspects = findLegacySuspectQuestions(state.draft);
      if (!suspects.length) return;
      if (!confirm(
        `偵測到 ${suspects.length} 題可能受到舊版題型切換影響。\n\n` +
        '系統只會清空這些可疑的填空答案，不會修改題目文字。是否繼續？',
      )) return;

      for (const question of suspects) question.answer = [];
      await persistDraftNow();
      renderEditor();
    }
  });

  mount.addEventListener('input', event => {
    if (state.mode !== 'editor' || !state.draft) return;
    if (!applyInputToDraft(event.target)) return;
    clearUndoState();
    scheduleAutosave();
    scheduleInspectorUpdate();
  });

  mount.addEventListener('change', event => {
    if (state.mode !== 'editor' || !state.draft) return;
    if (!applyInputToDraft(event.target)) return;
    clearUndoState();
    scheduleAutosave();
    scheduleInspectorUpdate();
  });
}

async function createNewDraft() {
  const banks = await listBanks();
  const pkg = createEmptyStudioPackage({ existingBankIds: banks.map(bank => bank.id) });

  state.draft = await saveStudioDraft(createStudioDraft({
    manifest: pkg.manifest,
    questions: pkg.questions,
    assets: pkg.assets,
  }));
  state.activeQuestionId = state.draft.questions[0]?.id || null;
  state.mode = 'editor';
  renderEditor();
}

async function openDraftById(id) {
  const drafts = await listStudioDrafts();
  const draft = drafts.find(item => item.id === id);
  if (!draft) {
    setStatus('找不到指定草稿，可能已被刪除。', 'error');
    return;
  }

  state.draft = normalizeDraftForEditor(draft);
  state.activeQuestionId = state.draft.questions[0]?.id || null;
  state.mode = 'editor';
  renderEditor();
}

async function removeDraft(id) {
  if (!confirm('確定刪除這份工作室草稿？\n\n已經存入「我的題庫」的題庫不會被刪除。')) return;
  await deleteStudioDraft(id);
  await renderHome();
}

async function openBankForEditing(bankId, forceCopy) {
  const [pkg, banks, drafts] = await Promise.all([
    getBankPackage(bankId, { includeAssets: true }),
    listBanks(),
    listStudioDrafts(),
  ]);

  if (!pkg) {
    setStatus('找不到題庫資料。', 'error');
    return;
  }

  const bank = banks.find(item => item.id === bankId);
  const mustCopy = forceCopy || bank?.sourceType === 'author';

  if (!mustCopy) {
    const existingDraft = drafts.find(draft => draft.bankId === bankId);
    if (existingDraft) {
      state.draft = normalizeDraftForEditor(existingDraft);
      state.activeQuestionId = state.draft.questions[0]?.id || null;
      state.mode = 'editor';
      renderEditor();
      return;
    }
  }

  const source = mustCopy
    ? createEditableCopyPackage(pkg, banks.map(item => item.id))
    : pkg;

  let draft = createDraftFromBankPackage(source);
  if (mustCopy) {
    draft = { ...draft, bankId: null, sourceBankVersion: pkg.manifest.version || null };
  }

  state.draft = await saveStudioDraft(normalizeDraftForEditor(draft));
  state.activeQuestionId = state.draft.questions[0]?.id || null;
  state.mode = 'editor';
  renderEditor();

  if (mustCopy) setStatus('已建立可編輯副本；原作者題庫不會被修改。', 'ok');
}

async function changeCurrentQuestionType(targetType) {
  const current = getActiveQuestion();
  if (!current || current.type === targetType) return;

  const plan = planQuestionTypeChange(current, targetType);
  const settings = loadSettings();

  if (plan.requiresConfirmation && settings.studioTypeSwitchConfirm) {
    const decision = await requestTypeChangeConfirmation(targetType, plan);
    if (!decision.confirmed) return;

    if (decision.disableFutureConfirm) {
      saveSettings({
        ...settings,
        studioTypeSwitchConfirm: false,
      });
    }
  }

  const index = state.draft.questions.findIndex(question => question.id === current.id);
  const previousQuestion = cloneValue(current);
  state.draft.questions[index] = convertQuestionType(current, targetType);

  state.undo = {
    questionId: current.id,
    previousQuestion,
    message: buildTypeChangeNotice(plan, targetType),
  };

  await persistDraftNow();
  renderEditor();
  armUndoTimer();
}

function requestTypeChangeConfirmation(targetType, plan) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'studio-r1-dialog';
    dialog.setAttribute('aria-labelledby', 'studioTypeSwitchDialogTitle');

    const losses = [];
    if (plan.clearsOptions) losses.push('目前的選項');
    if (plan.clearsAnswer) losses.push('已設定的答案');

    dialog.innerHTML = `
      <form method="dialog" class="studio-r1-dialog-card">
        <div class="studio-r1-dialog-icon" aria-hidden="true">↻</div>
        <div class="studio-r1-dialog-copy">
          <span class="studio-r1-dialog-kicker">切換題型</span>
          <h3 id="studioTypeSwitchDialogTitle">切換為「${escapeHtml(TYPE_LABELS[targetType] || targetType)}」？</h3>
          <p>
            ${losses.length
              ? `這次切換會移除${escapeHtml(losses.join('與'))}。`
              : '這次切換不會移除目前內容。'}
            題目文字、詳解、圖片、章節、標籤與難度會保留。
          </p>

          <label class="studio-r1-dialog-toggle">
            <input type="checkbox" data-studio-disable-type-confirm />
            <span>
              <strong>之後不再提醒題型切換</strong>
              <small>之後會直接切換，完成後仍會顯示可復原提示；可隨時到「設定 → 題庫工作室」重新開啟。</small>
            </span>
          </label>
        </div>

        <div class="studio-r1-dialog-actions">
          <button class="button secondary" type="button" data-studio-dialog-cancel>取消</button>
          <button class="button primary" type="button" data-studio-dialog-confirm>切換題型</button>
        </div>
      </form>
    `;

    const finish = result => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      dialog.remove();
      resolve(result);
    };

    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      finish({ confirmed: false, disableFutureConfirm: false });
    });

    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        finish({ confirmed: false, disableFutureConfirm: false });
        return;
      }

      if (event.target.closest('[data-studio-dialog-cancel]')) {
        finish({ confirmed: false, disableFutureConfirm: false });
        return;
      }

      if (event.target.closest('[data-studio-dialog-confirm]')) {
        const disableFutureConfirm =
          dialog.querySelector('[data-studio-disable-type-confirm]')?.checked === true;
        finish({ confirmed: true, disableFutureConfirm });
      }
    });

    document.body.appendChild(dialog);

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
      dialog.classList.add('is-fallback');
    }

    dialog.querySelector('[data-studio-dialog-cancel]')?.focus();
  });
}

function buildTypeChangeNotice(plan, targetType) {
  const parts = [];
  if (plan.clearsOptions) parts.push('原選項已清除');
  if (plan.clearsAnswer) parts.push('原答案已清除');

  return `已切換為${TYPE_LABELS[targetType] || targetType}${parts.length ? `，${parts.join('、')}` : ''}。`;
}

async function undoLastTypeChange() {
  const undo = state.undo;
  if (!undo || !state.draft) return;

  const index = state.draft.questions.findIndex(question => question.id === undo.questionId);
  if (index < 0) {
    clearUndoState();
    return;
  }

  state.draft.questions[index] = cloneValue(undo.previousQuestion);
  state.activeQuestionId = undo.questionId;
  clearUndoState();

  await persistDraftNow();
  renderEditor();
  setStatus('已復原上一次題型切換。', 'ok');
}

function armUndoTimer() {
  clearTimeout(state.undoTimer);
  state.undoTimer = setTimeout(() => {
    state.undo = null;
    state.undoTimer = null;
    renderUndoNotice();
  }, 9000);
  renderUndoNotice();
}

function clearUndoState() {
  clearTimeout(state.undoTimer);
  state.undoTimer = null;
  state.undo = null;
  renderUndoNotice();
}

function renderUndoNotice() {
  const host = state.mount?.querySelector('[data-studio-undo-host]');
  if (!host) return;

  if (!state.undo) {
    host.innerHTML = '';
    return;
  }

  host.innerHTML = `
    <div class="studio-r1-snackbar" role="status">
      <span>${escapeHtml(state.undo.message)}</span>
      <button type="button" data-studio-undo-type-change>復原</button>
    </div>
  `;
}

function renderEditor() {
  const mount = state.mount;
  if (!mount || !state.draft) return;

  state.mode = 'editor';
  state.draft = normalizeDraftForEditor(state.draft);

  const question = getActiveQuestion() || state.draft.questions[0] || null;
  if (question) state.activeQuestionId = question.id;

  const report = validateCurrentDraft();
  const suspects = findLegacySuspectQuestions(state.draft);

  mount.innerHTML = `
    <section class="studio-r1-editor-shell">
      <header class="studio-r1-editor-topbar">
        <div class="studio-r1-editor-title">
          <button class="studio-r1-back" type="button" data-studio-back aria-label="返回工作室首頁">←</button>
          <div>
            <span>題庫工作室</span>
            <h2>${escapeHtml(state.draft.manifest.name || '未命名題庫')}</h2>
          </div>
        </div>

        <div class="studio-r1-top-actions">
          <span class="studio-r1-save-state" data-studio-status>${formatSaveState(state.draft.updatedAt)}</span>
          <button class="button secondary compact" type="button" data-studio-validate>檢查</button>
          <button class="button primary compact" type="button" data-studio-save-library ${report.valid ? '' : 'disabled'}>儲存到我的題庫</button>
        </div>
      </header>

      <div class="studio-r1-undo-host" data-studio-undo-host></div>

      ${suspects.length ? renderLegacyAuditBanner(suspects) : ''}
      ${renderBankSettings(state.draft)}

      <div class="studio-r1-layout">
        <aside class="studio-r1-question-rail">
          <div class="studio-r1-rail-head">
            <div><span>題目</span><strong>${state.draft.questions.length}</strong></div>
            <button class="studio-r1-icon-action" type="button" data-studio-add-question aria-label="新增題目">＋</button>
          </div>

          <div class="studio-r1-question-list">
            ${state.draft.questions.map((item, index) => renderQuestionNavItem(item, index)).join('')}
          </div>
        </aside>

        <main class="studio-r1-canvas">
          ${question ? renderQuestionEditor(question) : renderEmptyState('沒有題目', '請先新增一題。')}
        </main>

        <aside class="studio-r1-inspector">
          <div data-studio-preview-panel>${question ? renderPreviewPanel(question) : ''}</div>
          <div data-studio-validation-panel>${renderValidationPanel(report, question)}</div>
        </aside>
      </div>

      <footer class="studio-r1-export-bar">
        <div>
          <strong>分享與匯出</strong>
          <span>只有通過檢查的題庫才能匯出正式檔案。</span>
        </div>
        <div class="studio-r1-export-actions">
          <button class="button secondary compact" type="button" data-studio-save-copy>另存新題庫</button>
          <button class="button secondary compact" type="button" data-studio-export-json ${report.valid ? '' : 'disabled'}>匯出 JSON</button>
          <button class="button secondary compact" type="button" data-studio-export-zip ${report.valid ? '' : 'disabled'}>匯出 ZIP</button>
        </div>
      </footer>
    </section>
  `;

  renderUndoNotice();
}

function renderBankSettings(draft) {
  const manifest = draft.manifest;
  const lockedId = Boolean(draft.bankId);

  return `
    <details class="studio-r1-bank-settings">
      <summary>
        <span>
          <strong>題庫設定</strong>
          <small>${escapeHtml(manifest.id || '尚未設定 ID')} · ${escapeHtml(manifest.version || '1.0.0')}</small>
        </span>
        <span>展開</span>
      </summary>

      <div class="studio-r1-settings-grid">
        ${manifestField('題庫名稱', 'name', manifest.name || '', true)}
        ${manifestField('題庫 ID', 'id', manifest.id || '', true, lockedId)}
        ${manifestField('版本', 'version', manifest.version || '1.0.0', true)}
        ${manifestField('作者', 'author', manifest.author || '')}
        ${manifestField('分類', 'category', manifest.metadata?.category || '')}

        <label class="studio-r1-field studio-r1-span-2">
          <span>題庫說明</span>
          <textarea rows="3" data-manifest-field="description">${escapeHtml(manifest.description || '')}</textarea>
        </label>

        ${lockedId ? '<p class="studio-r1-field-note studio-r1-span-2">題庫已寫入本機後，ID 會鎖定，避免既有學習紀錄失去關聯。</p>' : ''}
      </div>
    </details>
  `;
}

function renderQuestionNavItem(question, index) {
  const report = validateQuestionDraft(question);
  const status = report.valid ? 'complete' : questionHasAnyContent(question) ? 'incomplete' : 'empty';

  return `
    <button type="button"
      class="studio-r1-question-nav-item ${question.id === state.activeQuestionId ? 'is-active' : ''}"
      data-studio-select-question="${escapeAttr(question.id)}">
      <span class="studio-r1-question-number">${index + 1}</span>
      <span class="studio-r1-question-nav-copy">
        <strong>${escapeHtml(question.id)}</strong>
        <small>${escapeHtml(shorten(question.question || '尚未輸入題目', 32))}</small>
      </span>
      <span class="studio-r1-question-state ${status}" title="${statusLabel(status)}"></span>
    </button>
  `;
}

function renderQuestionEditor(question) {
  const index = state.draft.questions.findIndex(item => item.id === question.id);

  return `
    <section class="studio-r1-editor-card">
      <div class="studio-r1-question-head">
        <div>
          <span class="studio-r1-question-id">${escapeHtml(question.id)}</span>
          <h3>編輯題目</h3>
        </div>

        <div class="studio-r1-question-actions">
          <button class="studio-r1-icon-action" type="button" data-studio-move="up" ${index === 0 ? 'disabled' : ''} title="上移">↑</button>
          <button class="studio-r1-icon-action" type="button" data-studio-move="down" ${index === state.draft.questions.length - 1 ? 'disabled' : ''} title="下移">↓</button>
          <button class="studio-r1-icon-action" type="button" data-studio-duplicate-question title="複製">⧉</button>
          <button class="studio-r1-icon-action danger" type="button" data-studio-delete-question ${state.draft.questions.length <= 1 ? 'disabled' : ''} title="刪除">⌫</button>
        </div>
      </div>

      <div class="studio-r1-type-picker" role="group" aria-label="題型">
        ${Object.entries(TYPE_LABELS).map(([type, label]) => `
          <button type="button"
            class="studio-r1-type-option ${question.type === type ? 'is-active' : ''}"
            data-question-type-choice="${escapeAttr(type)}">
            <span>${typeIcon(type)}</span><strong>${escapeHtml(label)}</strong>
          </button>
        `).join('')}
      </div>

      <label class="studio-r1-field studio-r1-question-field">
        <span>題目內容</span>
        <textarea rows="5" data-question-field="question" placeholder="輸入題目敘述…">${escapeHtml(question.question || '')}</textarea>
      </label>

      <section class="studio-r1-answer-section">
        <div class="studio-r1-section-title">
          <div><span>答案</span><h3>設定正確答案</h3></div>
          ${question.answer?.length
            ? '<span class="studio-r1-complete-chip">已設定</span>'
            : '<span class="studio-r1-incomplete-chip">尚未設定</span>'}
        </div>
        ${renderAnswerEditor(question)}
      </section>

      <details class="studio-r1-advanced">
        <summary>
          <span><strong>詳解與進階設定</strong><small>章節、難度、標籤、詳解</small></span>
          <span>展開</span>
        </summary>

        <div class="studio-r1-settings-grid">
          <label class="studio-r1-field">
            <span>章節</span>
            <input value="${escapeAttr(question.chapter || '')}" data-question-field="chapter" />
          </label>

          <label class="studio-r1-field">
            <span>難度</span>
            <select data-question-field="difficulty">
              ${[1,2,3,4,5].map(value => `<option value="${value}" ${Number(question.difficulty) === value ? 'selected' : ''}>${value}</option>`).join('')}
            </select>
          </label>

          <label class="studio-r1-field studio-r1-span-2">
            <span>標籤</span>
            <input value="${escapeAttr((question.tags || []).join(', '))}" data-question-field="tags" placeholder="例如：ERP, 第三章, 重要" />
            <small>使用逗號或換行分隔。</small>
          </label>

          <label class="studio-r1-field studio-r1-span-2">
            <span>詳解</span>
            <textarea rows="5" data-question-field="explanation" placeholder="輸入詳解、觀念或解題提示…">${escapeHtml(question.explanation || '')}</textarea>
          </label>
        </div>
      </details>
    </section>
  `;
}

function renderAnswerEditor(question) {
  if (isChoice(question.type)) {
    const multiple = question.type === 'multiple-choice';
    return `
      <div class="studio-r1-options">
        ${question.options.map((option, index) => `
          <div class="studio-r1-option-row ${question.answer.includes(option.id) ? 'is-answer' : ''}">
            <label class="studio-r1-answer-selector" title="標記為正確答案">
              <input type="${multiple ? 'checkbox' : 'radio'}" name="studio-correct-answer"
                value="${escapeAttr(option.id)}" data-option-answer="${escapeAttr(option.id)}"
                ${question.answer.includes(option.id) ? 'checked' : ''} />
              <span>${escapeHtml(option.id)}</span>
            </label>

            <input value="${escapeAttr(option.text)}" data-option-text="${index}" placeholder="輸入選項內容" />

            <button class="studio-r1-icon-action danger" type="button"
              data-studio-remove-option="${index}" ${question.options.length <= 2 ? 'disabled' : ''}
              aria-label="移除選項">×</button>
          </div>
        `).join('')}
        <button class="studio-r1-add-row" type="button" data-studio-add-option>＋ 加入選項</button>
      </div>
    `;
  }

  if (question.type === 'true-false') {
    return `
      <div class="studio-r1-boolean-grid">
        <button class="studio-r1-boolean-option ${question.answer[0] === true ? 'is-selected' : ''}"
          type="button" data-studio-true-answer="true"><span>○</span><strong>正確</strong></button>
        <button class="studio-r1-boolean-option ${question.answer[0] === false ? 'is-selected' : ''}"
          type="button" data-studio-true-answer="false"><span>×</span><strong>錯誤</strong></button>
      </div>
    `;
  }

  return `
    <label class="studio-r1-field">
      <span>可接受答案</span>
      <textarea rows="5" data-fill-answers
        placeholder="每行一個可接受答案&#10;例如：&#10;ERP&#10;Enterprise Resource Planning">${escapeHtml((question.answer || []).join('\n'))}</textarea>
      <small>每行一個答案。系統不會替你猜答案。</small>
    </label>

    <label class="studio-r1-toggle">
      <input type="checkbox" data-case-sensitive ${question.caseSensitive === true ? 'checked' : ''} />
      <span><strong>區分英文大小寫</strong><small>開啟後，ERP 與 erp 會被視為不同答案。</small></span>
    </label>
  `;
}

function renderPreviewPanel(question) {
  return `
    <section class="studio-r1-inspector-card">
      <div class="studio-r1-inspector-heading">
        <span>即時預覽</span>
        <strong>${escapeHtml(TYPE_LABELS[question.type] || question.type)}</strong>
      </div>
      <div class="studio-r1-preview-question">${escapeHtml(question.question || '尚未輸入題目')}</div>
      ${renderPreviewAnswer(question)}
      ${question.explanation
        ? `<div class="studio-r1-preview-explanation"><span>詳解</span><p>${escapeHtml(question.explanation)}</p></div>`
        : ''}
    </section>
  `;
}

function renderPreviewAnswer(question) {
  if (isChoice(question.type)) {
    return `
      <div class="studio-r1-preview-options">
        ${question.options.map(option => `
          <div class="${question.answer.includes(option.id) ? 'is-answer' : ''}">
            <span>${escapeHtml(option.id)}</span><p>${escapeHtml(option.text || '尚未輸入選項')}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (question.type === 'true-false') {
    return `<div class="studio-r1-preview-answer">${
      question.answer.length ? `正確答案：${question.answer[0] ? '正確' : '錯誤'}` : '尚未設定正確答案'
    }</div>`;
  }

  return `<div class="studio-r1-preview-answer">${
    question.answer.length ? `可接受答案：${escapeHtml(question.answer.join(' / '))}` : '尚未設定可接受答案'
  }</div>`;
}

function renderValidationPanel(report, question) {
  const questionReport = question
    ? validateQuestionDraft(question)
    : { valid: false, issues: [] };

  const uniqueBankIssues = uniqueIssues(report.issues).slice(0, 3);

  return `
    <section class="studio-r1-inspector-card">
      <div class="studio-r1-inspector-heading">
        <span>目前題目</span>
        <strong class="${questionReport.valid ? 'is-success' : 'is-danger'}">
          ${questionReport.valid ? '可用' : '未完成'}
        </strong>
      </div>

      ${questionReport.issues.length
        ? `<div class="studio-r1-issue-list">${questionReport.issues.slice(0, 5).map(issue => `
            <div class="studio-r1-issue ${issue.severity}">
              <span>!</span><p>${escapeHtml(issue.message)}</p>
            </div>
          `).join('')}</div>`
        : '<p class="studio-r1-ok-copy">這一題目前沒有必要欄位問題。</p>'}
    </section>

    <section class="studio-r1-inspector-card studio-r1-bank-health">
      <div class="studio-r1-inspector-heading">
        <span>整份題庫</span>
        <strong class="${report.valid ? 'is-success' : 'is-danger'}">
          ${report.valid ? '可以儲存' : '需要修正'}
        </strong>
      </div>

      <div class="studio-r1-health-grid">
        <div>
          <span>題目</span>
          <strong>${state.draft?.questions?.length || 0}</strong>
        </div>
        <div class="${report.summary.errors ? 'is-danger' : ''}">
          <span>錯誤</span>
          <strong>${report.summary.errors}</strong>
        </div>
        <div class="${report.summary.warnings ? 'is-warning' : ''}">
          <span>警告</span>
          <strong>${report.summary.warnings}</strong>
        </div>
      </div>

      ${uniqueBankIssues.length
        ? `<div class="studio-r1-issue-list studio-r1-bank-issue-preview">
            ${uniqueBankIssues.map(issue => `
              <div class="studio-r1-issue ${issue.severity}">
                <span>${issue.severity === 'error' ? '!' : '·'}</span>
                <p>${escapeHtml(issue.message)}</p>
              </div>
            `).join('')}
            ${report.issues.length > uniqueBankIssues.length
              ? '<small>其餘問題可切換左側題目逐題查看。</small>'
              : ''}
          </div>`
        : '<p class="studio-r1-ok-copy">Schema 2.0 檢查通過。</p>'}
    </section>
  `;
}

function uniqueIssues(issues) {
  const seen = new Set();
  return (issues || []).filter(issue => {
    const key = `${issue.severity}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderLegacyAuditBanner(suspects) {
  return `
    <div class="studio-r1-audit-banner">
      <div>
        <strong>發現可能由舊版題型切換留下的答案</strong>
        <p>${suspects.map(question => escapeHtml(question.id)).join('、')} 的填空答案只有單一 A–H 字母。若這些不是你刻意設定的答案，可以一鍵清空後重新輸入。</p>
      </div>
      <button class="button secondary compact" type="button" data-studio-clear-suspect-answers>清空可疑答案</button>
    </div>
  `;
}

function applyInputToDraft(target) {
  const draft = state.draft;
  const question = getActiveQuestion();
  if (!draft) return false;

  const manifestField = target.closest('[data-manifest-field]');
  if (manifestField) {
    const key = manifestField.dataset.manifestField;
    if (key === 'category') {
      draft.manifest.metadata = { ...(draft.manifest.metadata || {}), category: manifestField.value };
    } else {
      draft.manifest[key] = manifestField.value;
    }
    return true;
  }

  if (!question) return false;

  const questionField = target.closest('[data-question-field]');
  if (questionField) {
    const key = questionField.dataset.questionField;
    if (key === 'difficulty') question.difficulty = Number(questionField.value);
    else if (key === 'tags') question.tags = parseTags(questionField.value);
    else question[key] = questionField.value;
    return true;
  }

  const optionText = target.closest('[data-option-text]');
  if (optionText) {
    const index = Number(optionText.dataset.optionText);
    if (question.options[index]) question.options[index].text = optionText.value;
    return true;
  }

  const optionAnswer = target.closest('[data-option-answer]');
  if (optionAnswer) {
    const id = optionAnswer.dataset.optionAnswer;
    if (question.type === 'single-choice') {
      question.answer = optionAnswer.checked ? [id] : [];
    } else {
      const selected = new Set(question.answer);
      if (optionAnswer.checked) selected.add(id);
      else selected.delete(id);
      question.answer = [...selected];
    }
    return true;
  }

  const fillAnswers = target.closest('[data-fill-answers]');
  if (fillAnswers) {
    question.answer = parseFillAnswers(fillAnswers.value);
    return true;
  }

  const caseSensitive = target.closest('[data-case-sensitive]');
  if (caseSensitive) {
    question.caseSensitive = caseSensitive.checked;
    return true;
  }

  return false;
}

function scheduleAutosave() {
  clearTimeout(state.autosaveTimer);
  setStatus('尚未儲存…', 'working');

  state.autosaveTimer = setTimeout(() => {
    persistDraftNow().catch(error => {
      console.error(error);
      setStatus(`自動儲存失敗：${error.message}`, 'error');
    });
  }, 650);
}

function scheduleInspectorUpdate() {
  clearTimeout(state.validationTimer);
  state.validationTimer = setTimeout(updateInspector, 220);
}

async function persistDraftNow() {
  clearTimeout(state.autosaveTimer);
  if (!state.draft) return null;

  state.draft.manifest = syncManifestQuestionCount(state.draft.manifest, state.draft.questions);

  const report = validateCurrentDraft();
  state.draft.status = report.valid ? STUDIO_DRAFT_STATUS.READY : STUDIO_DRAFT_STATUS.DRAFT;

  state.draft = await saveStudioDraft(state.draft);
  setStatus(formatSaveState(state.draft.updatedAt), 'ok');
  return state.draft;
}

function validateCurrentDraft() {
  if (!state.draft) {
    return { valid: false, issues: [], summary: { errors: 1, warnings: 0, questionCount: 0, assetCount: 0 } };
  }

  state.draft.manifest = syncManifestQuestionCount(state.draft.manifest, state.draft.questions);

  const base = validatePackage({
    manifest: state.draft.manifest,
    questions: state.draft.questions,
    assetPaths: state.draft.assets.map(asset => asset.path),
  });

  const issues = [...base.issues];

  state.draft.questions.forEach((question, index) => {
    const report = validateQuestionDraft(question);
    for (const issue of report.issues) {
      const location = `questions[${index}].${issue.location}`;
      if (!issues.some(existing => existing.location === location && existing.message === issue.message)) {
        issues.push({ ...issue, location });
      }
    }
  });

  return {
    ...base,
    valid: !issues.some(issue => issue.severity === 'error'),
    issues,
    summary: {
      ...base.summary,
      errors: issues.filter(issue => issue.severity === 'error').length,
      warnings: issues.filter(issue => issue.severity === 'warning').length,
    },
  };
}

function updateInspector() {
  const question = getActiveQuestion();
  const report = validateCurrentDraft();

  const preview = state.mount?.querySelector('[data-studio-preview-panel]');
  const validation = state.mount?.querySelector('[data-studio-validation-panel]');
  if (preview && question) preview.innerHTML = renderPreviewPanel(question);
  if (validation) validation.innerHTML = renderValidationPanel(report, question);

  state.mount?.querySelectorAll('[data-studio-save-library], [data-studio-export-json], [data-studio-export-zip]')
    .forEach(button => { button.disabled = !report.valid; });
}

async function saveDraftToLibrary() {
  if (!state.draft) return;
  const report = validateCurrentDraft();

  if (!report.valid) {
    setStatus('請先修正題庫中的必要欄位，再儲存到我的題庫。', 'error');
    updateInspector();
    return;
  }

  const banks = await listBanks();
  const id = state.draft.manifest.id;
  const existing = banks.find(bank => bank.id === id);

  if (existing?.sourceType === 'author') {
    setStatus('不能覆蓋作者題庫。請使用「另存新題庫」。', 'error');
    return;
  }

  if (existing && state.draft.bankId !== id) {
    setStatus(`題庫 ID「${id}」已被另一個題庫使用。請修改 ID 或另存新題庫。`, 'error');
    return;
  }

  if (existing && !confirm(`確定更新本機題庫「${existing.name || id}」？\n\n題目 ID 相同的學習紀錄會保留。`)) return;

  const now = new Date().toISOString();
  const manifest = {
    ...state.draft.manifest,
    questionCount: state.draft.questions.length,
    createdAt: state.draft.manifest.createdAt || state.draft.createdAt || now,
    updatedAt: now,
  };

  await saveBankPackage({
    manifest,
    questions: state.draft.questions,
    assets: state.draft.assets,
    sourceType: 'user',
    sourceMetadata: { createdBy: 'studio-r1', draftId: state.draft.id },
  });

  state.draft.bankId = manifest.id;
  state.draft.manifest = manifest;
  await persistDraftNow();

  document.querySelector('#refreshBanksButton')?.click();
  renderEditor();
  setStatus(`已儲存到「我的題庫」：${manifest.name}`, 'ok');
}

async function convertCurrentDraftToCopy() {
  if (!state.draft) return;

  const banks = await listBanks();
  const copy = createEditableCopyPackage({
    manifest: state.draft.manifest,
    questions: state.draft.questions,
    assets: state.draft.assets,
  }, banks.map(bank => bank.id));

  state.draft = await saveStudioDraft(createStudioDraft({
    manifest: copy.manifest,
    questions: copy.questions,
    assets: copy.assets,
    sourceBankVersion: state.draft.manifest.version || null,
  }));

  state.activeQuestionId = state.draft.questions[0]?.id || null;
  renderEditor();
  setStatus('已建立新的可編輯題庫草稿；原題庫不會被修改。', 'ok');
}

async function exportZip() {
  const report = validateCurrentDraft();
  if (!report.valid) {
    setStatus('請先修正題庫錯誤，再匯出 ZIP。', 'error');
    return;
  }

  await persistDraftNow();
  const filename = await downloadQuestionBankZip({
    manifest: state.draft.manifest,
    questions: state.draft.questions,
    assets: state.draft.assets,
  });
  setStatus(`ZIP 已匯出：${filename}`, 'ok');
}

function exportJson() {
  const report = validateCurrentDraft();
  if (!report.valid) {
    setStatus('請先修正題庫錯誤，再匯出 JSON。', 'error');
    return;
  }

  const manifest = cleanExportManifest(state.draft.manifest, state.draft.questions.length);
  const blob = new Blob([
    JSON.stringify({ manifest, questions: state.draft.questions }, null, 2),
  ], { type: 'application/json;charset=utf-8' });

  const filename = `${safeFilename(manifest.id)}-${safeFilename(manifest.version || '1.0.0')}.json`;
  downloadBlob(blob, filename);

  setStatus(
    state.draft.assets.length
      ? `JSON 已匯出。此格式不包含 ${state.draft.assets.length} 個圖片檔；含圖片請使用 ZIP。`
      : `JSON 已匯出：${filename}`,
    state.draft.assets.length ? 'warning' : 'ok',
  );
}

function normalizeDraftForEditor(draft) {
  return {
    ...draft,
    manifest: {
      ...(draft.manifest || {}),
      metadata: { ...(draft.manifest?.metadata || {}) },
    },
    questions: Array.isArray(draft.questions)
      ? draft.questions.map(question => normalizeQuestionDraft(question))
      : [],
    assets: Array.isArray(draft.assets) ? [...draft.assets] : [],
  };
}

function findLegacySuspectQuestions(draft) {
  if (!draft) return [];
  const createdAt = Date.parse(draft.createdAt || '');
  if (!Number.isFinite(createdAt) || createdAt > LEGACY_POLLUTION_CUTOFF) return [];

  return (draft.questions || []).filter(question =>
    question.type === 'fill-in' &&
    Array.isArray(question.answer) &&
    question.answer.length === 1 &&
    /^[A-H]$/i.test(String(question.answer[0]).trim())
  );
}

function questionHasAnyContent(question) {
  return Boolean(
    String(question.question || '').trim() ||
    String(question.explanation || '').trim() ||
    String(question.chapter || '').trim() ||
    (question.tags || []).length ||
    (question.answer || []).length ||
    (question.options || []).some(option => String(option.text || '').trim())
  );
}

function manifestField(label, key, value, required = false, disabled = false) {
  return `
    <label class="studio-r1-field">
      <span>${escapeHtml(label)}${required ? ' *' : ''}</span>
      <input value="${escapeAttr(value)}" data-manifest-field="${escapeAttr(key)}"
        ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} />
    </label>
  `;
}

function renderDraftCard(draft) {
  const ready = draft.status === STUDIO_DRAFT_STATUS.READY;
  return `
    <article class="studio-r1-library-card">
      <div class="studio-r1-library-card-main">
        <span class="studio-r1-card-tag ${ready ? 'ready' : ''}">${ready ? '可以使用' : '編輯中'}</span>
        <h4>${escapeHtml(draft.manifest?.name || '未命名題庫')}</h4>
        <p>${escapeHtml(draft.manifest?.id || '尚未設定 ID')}</p>
        <small>${draft.questions?.length || 0} 題 · ${formatDateTime(draft.updatedAt)}</small>
      </div>
      <div class="studio-r1-card-actions">
        <button class="button primary compact" type="button" data-studio-open-draft="${escapeAttr(draft.id)}">繼續編輯</button>
        <button class="button secondary compact" type="button" data-studio-delete-draft="${escapeAttr(draft.id)}">刪除</button>
      </div>
    </article>
  `;
}

function renderBankCard(bank) {
  const author = bank.sourceType === 'author';
  return `
    <article class="studio-r1-library-card">
      <div class="studio-r1-library-card-main">
        <span class="studio-r1-card-tag ${author ? 'author' : 'user'}">${author ? '作者題庫' : '自行新增'}</span>
        <h4>${escapeHtml(bank.name || bank.title || bank.id)}</h4>
        <p>${escapeHtml(bank.id)}</p>
        <small>${bank.questionCount || 0} 題 · v${escapeHtml(bank.version || '—')}</small>
      </div>
      <div class="studio-r1-card-actions">
        <button class="button ${author ? 'secondary' : 'primary'} compact" type="button"
          ${author ? `data-studio-copy-bank="${escapeAttr(bank.id)}"` : `data-studio-edit-bank="${escapeAttr(bank.id)}"`}>
          ${author ? '建立可編輯副本' : '編輯題庫'}
        </button>
      </div>
    </article>
  `;
}

function setStatus(message, kind = 'info') {
  const status = state.mount?.querySelector('[data-studio-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

function getActiveQuestion() {
  return state.draft?.questions?.find(question => question.id === state.activeQuestionId) || null;
}

function nextOptionId(options) {
  const used = new Set((options || []).map(option => option.id));
  for (let code = 65; code <= 90; code += 1) {
    const id = String.fromCharCode(code);
    if (!used.has(id)) return id;
  }
  let index = 1;
  while (used.has(`O${index}`)) index += 1;
  return `O${index}`;
}

function isChoice(type) {
  return type === 'single-choice' || type === 'multiple-choice';
}

function typeIcon(type) {
  return ({ 'single-choice':'◉', 'multiple-choice':'☑', 'true-false':'○×', 'fill-in':'▭' })[type] || '•';
}

function statusLabel(status) {
  return ({ complete:'可用', incomplete:'未完成', empty:'空白' })[status] || status;
}

function formatSaveState(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '尚未儲存';
  return `已自動儲存 ${new Intl.DateTimeFormat('zh-TW', { hour:'2-digit', minute:'2-digit' }).format(date)}`;
}

function formatDateTime(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '時間未知';
  return new Intl.DateTimeFormat('zh-TW', { dateStyle:'short', timeStyle:'short' }).format(date);
}

function renderEmptyState(title, description) {
  return `<div class="studio-r1-empty"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div>`;
}

function shorten(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function safeFilename(value) {
  return String(value || 'question-bank')
    .trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'question-bank';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function ensureStudioStyles() {
  if (document.querySelector('link[data-v4-studio-r1-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './styles/v4-studio-r1.css';
  link.dataset.v4StudioR1Styles = 'true';
  document.head.appendChild(link);
}

function cloneValue(value) {
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`','&#096;');
}

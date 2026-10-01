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
  normalizeQuestionForType,
  parseFillAnswers,
  parseTags,
  removeQuestion,
  syncManifestQuestionCount,
} from '../studio/editor-model.js';

const TYPE_LABELS = Object.freeze({
  'single-choice': '單選題',
  'multiple-choice': '複選題',
  'true-false': '是非題',
  'fill-in': '填空題',
});

const state = {
  mode: 'home',
  draft: null,
  activeQuestionId: null,
  autosaveTimer: null,
  validationTimer: null,
  mount: null,
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
    <section class="panel studio-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Question Bank Studio</p>
          <h2>題庫工作室</h2>
          <p class="section-note">直接在瀏覽器建立、編輯、驗證與匯出 Schema 2.0 題庫。草稿與圖片只保存在本機 IndexedDB。</p>
        </div>
        <button class="button primary" type="button" data-studio-new>建立新題庫</button>
      </div>
      <div class="studio-status" data-studio-status>正在讀取本機資料…</div>
      <div class="studio-home-grid">
        <section>
          <h3>工作室草稿</h3>
          <div data-studio-drafts class="studio-card-list"></div>
        </section>
        <section>
          <h3>已加入的題庫</h3>
          <div data-studio-banks class="studio-card-list"></div>
        </section>
      </div>
    </section>
  `;

  try {
    const [drafts, banks] = await Promise.all([
      listStudioDrafts(),
      listBanks(),
    ]);

    const draftsContainer = mount.querySelector('[data-studio-drafts]');
    const banksContainer = mount.querySelector('[data-studio-banks]');

    draftsContainer.innerHTML = drafts.length
      ? drafts.map(renderDraftCard).join('')
      : emptyCard('目前沒有草稿', '建立新題庫或編輯既有題庫後，草稿會顯示在這裡。');

    banksContainer.innerHTML = banks.length
      ? banks.map(renderBankCard).join('')
      : emptyCard('目前沒有本機題庫', '可以先建立新題庫，或從「我的題庫」匯入題庫。');

    setStatus(`已載入 ${drafts.length} 份草稿、${banks.length} 個本機題庫。`, 'ok');
  } catch (error) {
    console.error(error);
    setStatus(`題庫工作室初始化失敗：${error.message}`, 'error');
  }
}

function bindWorkspace(mount) {
  if (mount.dataset.studioBound === 'true') return;
  mount.dataset.studioBound = 'true';

  mount.addEventListener('click', async event => {
    const newButton = event.target.closest('[data-studio-new]');
    if (newButton) {
      await createNewDraft();
      return;
    }

    const openDraft = event.target.closest('[data-studio-open-draft]');
    if (openDraft) {
      await openDraftById(openDraft.dataset.studioOpenDraft);
      return;
    }

    const deleteDraftButton = event.target.closest('[data-studio-delete-draft]');
    if (deleteDraftButton) {
      await removeDraft(deleteDraftButton.dataset.studioDeleteDraft);
      return;
    }

    const editBank = event.target.closest('[data-studio-edit-bank]');
    if (editBank) {
      await openBankForEditing(editBank.dataset.studioEditBank, false);
      return;
    }

    const copyBank = event.target.closest('[data-studio-copy-bank]');
    if (copyBank) {
      await openBankForEditing(copyBank.dataset.studioCopyBank, true);
      return;
    }

    if (event.target.closest('[data-studio-back]')) {
      await persistDraftNow();
      await renderHome();
      return;
    }

    if (event.target.closest('[data-studio-save-draft]')) {
      await persistDraftNow();
      setStatus('草稿已儲存。', 'ok');
      return;
    }

    if (event.target.closest('[data-studio-validate]')) {
      renderValidation();
      setStatus('已重新執行 Schema 2.0 驗證。', 'ok');
      return;
    }

    if (event.target.closest('[data-studio-save-library]')) {
      await saveDraftToLibrary();
      return;
    }

    if (event.target.closest('[data-studio-save-copy]')) {
      await convertCurrentDraftToCopy();
      return;
    }

    if (event.target.closest('[data-studio-export-zip]')) {
      await exportZip();
      return;
    }

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

    if (event.target.closest('[data-studio-add-question]')) {
      state.draft.questions.push(createQuestion('single-choice', state.draft.questions));
      state.activeQuestionId = state.draft.questions.at(-1).id;
      await persistDraftNow();
      renderEditor();
      return;
    }

    if (event.target.closest('[data-studio-duplicate-question]')) {
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
      const current = getActiveQuestion();
      if (!current || state.draft.questions.length <= 1) return;
      if (!confirm(`確定刪除題目 ${current.id}？\n\n題庫內容會改變，但既有學習紀錄不會自動刪除。`)) return;
      const previousIndex = state.draft.questions.findIndex(question => question.id === current.id);
      state.draft.questions = removeQuestion(state.draft.questions, current.id);
      state.activeQuestionId = state.draft.questions[Math.min(previousIndex, state.draft.questions.length - 1)]?.id || null;
      await persistDraftNow();
      renderEditor();
      return;
    }

    const moveButton = event.target.closest('[data-studio-move]');
    if (moveButton) {
      const current = getActiveQuestion();
      if (!current) return;
      const delta = moveButton.dataset.studioMove === 'up' ? -1 : 1;
      state.draft.questions = moveQuestion(state.draft.questions, current.id, delta);
      await persistDraftNow();
      renderEditor();
      return;
    }

    if (event.target.closest('[data-studio-add-option]')) {
      const current = getActiveQuestion();
      if (!current || !isChoice(current.type)) return;
      current.options.push({
        id: nextOptionId(current.options),
        text: '',
      });
      await persistDraftNow();
      renderEditor();
      return;
    }

    const removeOption = event.target.closest('[data-studio-remove-option]');
    if (removeOption) {
      const current = getActiveQuestion();
      if (!current || current.options.length <= 2) return;
      const index = Number(removeOption.dataset.studioRemoveOption);
      const removed = current.options[index];
      current.options.splice(index, 1);
      current.answer = current.answer.filter(value => value !== removed?.id);
      if (!current.answer.length) current.answer = [current.options[0].id];
      await persistDraftNow();
      renderEditor();
    }
  });

  mount.addEventListener('input', event => {
    if (state.mode !== 'editor' || !state.draft) return;
    if (!applyInputToDraft(event.target)) return;
    scheduleAutosave();
    scheduleValidation();
  });

  mount.addEventListener('change', event => {
    if (state.mode !== 'editor' || !state.draft) return;

    const typeField = event.target.closest('[data-question-type]');
    if (typeField) {
      const current = getActiveQuestion();
      if (!current) return;
      const normalized = normalizeQuestionForType(current, typeField.value);
      const index = state.draft.questions.findIndex(question => question.id === current.id);
      state.draft.questions[index] = normalized;
      persistDraftNow().catch(console.error);
      renderEditor();
      return;
    }

    if (!applyInputToDraft(event.target)) return;
    scheduleAutosave();
    scheduleValidation();
  });
}

async function createNewDraft() {
  const banks = await listBanks();
  const pkg = createEmptyStudioPackage({
    existingBankIds: banks.map(bank => bank.id),
  });
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

  state.draft = draft;
  state.activeQuestionId = draft.questions[0]?.id || null;
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
      state.draft = existingDraft;
      state.activeQuestionId = existingDraft.questions[0]?.id || null;
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
    draft = {
      ...draft,
      bankId: null,
      sourceBankVersion: pkg.manifest.version || null,
    };
  }

  state.draft = await saveStudioDraft(draft);
  state.activeQuestionId = state.draft.questions[0]?.id || null;
  state.mode = 'editor';
  renderEditor();

  if (mustCopy) {
    setStatus('已建立可編輯副本；原作者題庫不會被修改。', 'ok');
  }
}

function renderEditor() {
  const mount = state.mount;
  const draft = state.draft;
  if (!mount || !draft) return;

  state.mode = 'editor';
  const question = getActiveQuestion() || draft.questions[0] || null;
  if (question && !state.activeQuestionId) state.activeQuestionId = question.id;

  const report = validateCurrentDraft();
  const lockedId = Boolean(draft.bankId);

  mount.innerHTML = `
    <section class="panel studio-panel">
      <div class="studio-editor-header">
        <div>
          <p class="eyebrow">Question Bank Studio</p>
          <h2>${escapeHtml(draft.manifest.name || '未命名題庫')}</h2>
          <p class="section-note">
            ${draft.bankId
              ? `正在編輯本機題庫 ${escapeHtml(draft.bankId)}；題庫 ID 與題目 ID 會鎖定以保護既有學習紀錄。`
              : '這是尚未寫入我的題庫的新草稿；第一次儲存前可以修改題庫 ID。'}
          </p>
        </div>
        <button class="button secondary" type="button" data-studio-back>返回工作室首頁</button>
      </div>

      <div class="studio-toolbar">
        <button class="button secondary" type="button" data-studio-save-draft>儲存草稿</button>
        <button class="button secondary" type="button" data-studio-validate>立即驗證</button>
        <button class="button primary" type="button" data-studio-save-library ${report.valid ? '' : 'disabled'}>儲存到我的題庫</button>
        <button class="button secondary" type="button" data-studio-save-copy>另存新題庫</button>
        <button class="button secondary" type="button" data-studio-export-zip ${report.valid ? '' : 'disabled'}>匯出 ZIP</button>
        <button class="button secondary" type="button" data-studio-export-json ${report.valid ? '' : 'disabled'}>匯出 JSON</button>
      </div>

      <div class="studio-status ${report.valid ? 'is-ok' : 'is-warning'}" data-studio-status>
        ${report.valid
          ? `Schema 2.0 驗證通過 · ${draft.questions.length} 題 · ${draft.assets.length} 個 assets`
          : `尚有 ${report.summary.errors} 個錯誤、${report.summary.warnings} 個警告`}
      </div>

      ${renderManifestForm(draft.manifest, lockedId)}

      <div class="studio-editor-grid">
        <aside class="studio-question-nav">
          <div class="studio-question-nav-heading">
            <h3>題目</h3>
            <button class="button secondary compact" type="button" data-studio-add-question>＋ 新增</button>
          </div>
          <div class="studio-question-list">
            ${draft.questions.map((item, index) => `
              <button
                type="button"
                class="studio-question-item ${item.id === state.activeQuestionId ? 'is-active' : ''}"
                data-studio-select-question="${escapeAttr(item.id)}"
              >
                <span>${index + 1}</span>
                <strong>${escapeHtml(item.id)}</strong>
                <small>${escapeHtml(TYPE_LABELS[item.type] || item.type)}</small>
                <em>${escapeHtml(shorten(item.question || '尚未輸入題目', 38))}</em>
              </button>
            `).join('')}
          </div>
        </aside>

        <section class="studio-question-editor">
          ${question ? renderQuestionEditor(question, draft.questions) : emptyCard('沒有題目', '請新增至少一題。')}
        </section>
      </div>

      <section class="studio-validation" data-studio-validation>
        ${renderValidationReport(report)}
      </section>
    </section>
  `;

  renderPreview();
}

function renderManifestForm(manifest, lockedId) {
  return `
    <section class="studio-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Manifest</p>
          <h3>題庫基本資料</h3>
        </div>
      </div>

      <div class="studio-form-grid">
        ${field('題庫名稱', 'name', manifest.name || '', { required: true })}
        ${field('題庫 ID', 'id', manifest.id || '', {
          required: true,
          disabled: lockedId,
          help: lockedId ? '已寫入題庫後鎖定，以保護學習資料關聯。' : '只允許英文、數字、底線與連字號。',
        })}
        ${field('版本', 'version', manifest.version || '1.0.0', { required: true })}
        ${field('作者', 'author', manifest.author || '')}
        ${field('分類', 'category', manifest.metadata?.category || '')}
        <label class="studio-field studio-field-wide">
          <span>題庫說明</span>
          <textarea rows="3" data-manifest-field="description">${escapeHtml(manifest.description || '')}</textarea>
        </label>
      </div>
    </section>
  `;
}

function renderQuestionEditor(question, questions) {
  const index = questions.findIndex(item => item.id === question.id);
  const isFirst = index <= 0;
  const isLast = index >= questions.length - 1;

  return `
    <div class="studio-question-toolbar">
      <div>
        <span class="mini-chip">${escapeHtml(question.id)}</span>
        <span class="mini-chip">${escapeHtml(TYPE_LABELS[question.type] || question.type)}</span>
      </div>
      <div class="studio-inline-actions">
        <button class="button secondary compact" type="button" data-studio-move="up" ${isFirst ? 'disabled' : ''}>上移</button>
        <button class="button secondary compact" type="button" data-studio-move="down" ${isLast ? 'disabled' : ''}>下移</button>
        <button class="button secondary compact" type="button" data-studio-duplicate-question>複製</button>
        <button class="button danger compact" type="button" data-studio-delete-question ${questions.length <= 1 ? 'disabled' : ''}>刪除</button>
      </div>
    </div>

    <div class="studio-form-grid">
      <label class="studio-field">
        <span>題號（永久 ID）</span>
        <input value="${escapeAttr(question.id)}" disabled />
      </label>

      <label class="studio-field">
        <span>題型</span>
        <select data-question-type>
          ${Object.entries(TYPE_LABELS).map(([value, label]) => `
            <option value="${value}" ${question.type === value ? 'selected' : ''}>${label}</option>
          `).join('')}
        </select>
      </label>

      <label class="studio-field studio-field-wide">
        <span>題目文字</span>
        <textarea rows="4" data-question-field="question">${escapeHtml(question.question || '')}</textarea>
      </label>

      ${renderAnswerEditor(question)}

      <label class="studio-field">
        <span>章節</span>
        <input value="${escapeAttr(question.chapter || '')}" data-question-field="chapter" />
      </label>

      <label class="studio-field">
        <span>難度</span>
        <select data-question-field="difficulty">
          ${[1, 2, 3, 4, 5].map(value => `
            <option value="${value}" ${Number(question.difficulty) === value ? 'selected' : ''}>${value}</option>
          `).join('')}
        </select>
      </label>

      <label class="studio-field studio-field-wide">
        <span>標籤</span>
        <input value="${escapeAttr((question.tags || []).join(', '))}" data-question-field="tags" placeholder="例如：ERP, 第三章, 重要" />
        <small>使用逗號或換行分隔。</small>
      </label>

      <label class="studio-field studio-field-wide">
        <span>詳解</span>
        <textarea rows="5" data-question-field="explanation">${escapeHtml(question.explanation || '')}</textarea>
      </label>
    </div>

    <section class="studio-preview" data-studio-preview></section>
  `;
}

function renderAnswerEditor(question) {
  if (isChoice(question.type)) {
    const multiple = question.type === 'multiple-choice';

    return `
      <div class="studio-field studio-field-wide">
        <div class="studio-option-heading">
          <span>選項與答案</span>
          <button class="button secondary compact" type="button" data-studio-add-option>＋ 選項</button>
        </div>
        <div class="studio-options">
          ${question.options.map((option, index) => `
            <div class="studio-option-row">
              <label class="studio-answer-toggle" title="${multiple ? '正確答案' : '正確答案'}">
                <input
                  type="${multiple ? 'checkbox' : 'radio'}"
                  name="studio-correct-answer"
                  value="${escapeAttr(option.id)}"
                  data-option-answer="${escapeAttr(option.id)}"
                  ${question.answer.includes(option.id) ? 'checked' : ''}
                />
                <strong>${escapeHtml(option.id)}</strong>
              </label>
              <input
                value="${escapeAttr(option.text)}"
                data-option-text="${index}"
                placeholder="輸入選項內容"
              />
              <button class="button danger compact" type="button" data-studio-remove-option="${index}" ${question.options.length <= 2 ? 'disabled' : ''}>移除</button>
            </div>
          `).join('')}
        </div>
        <small>${multiple ? '可勾選多個正確答案。' : '請選擇一個正確答案。'}</small>
      </div>
    `;
  }

  if (question.type === 'true-false') {
    return `
      <label class="studio-field studio-field-wide">
        <span>正確答案</span>
        <select data-true-answer>
          <option value="true" ${question.answer[0] === true ? 'selected' : ''}>正確 / O</option>
          <option value="false" ${question.answer[0] === false ? 'selected' : ''}>錯誤 / X</option>
        </select>
      </label>
    `;
  }

  return `
    <label class="studio-field studio-field-wide">
      <span>可接受答案</span>
      <textarea rows="4" data-fill-answers placeholder="每行一個可接受答案">${escapeHtml((question.answer || []).join('\n'))}</textarea>
      <small>每行一個答案；至少需要一個非空白答案。</small>
    </label>

    <label class="studio-check-row studio-field-wide">
      <input type="checkbox" data-case-sensitive ${question.caseSensitive === true ? 'checked' : ''} />
      <span>區分英文大小寫</span>
    </label>
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
      draft.manifest.metadata = {
        ...(draft.manifest.metadata || {}),
        category: manifestField.value,
      };
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
      question.answer = [id];
    } else {
      const selected = new Set(question.answer);
      if (optionAnswer.checked) selected.add(id);
      else selected.delete(id);
      question.answer = [...selected];
    }
    return true;
  }

  const trueAnswer = target.closest('[data-true-answer]');
  if (trueAnswer) {
    question.answer = [trueAnswer.value === 'true'];
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
  setStatus('有尚未寫入 IndexedDB 的變更…', 'working');
  state.autosaveTimer = setTimeout(() => {
    persistDraftNow().catch(error => {
      console.error(error);
      setStatus(`自動儲存失敗：${error.message}`, 'error');
    });
  }, 700);
}

function scheduleValidation() {
  clearTimeout(state.validationTimer);
  state.validationTimer = setTimeout(() => {
    renderValidation();
    renderPreview();
  }, 250);
}

async function persistDraftNow() {
  clearTimeout(state.autosaveTimer);
  if (!state.draft) return null;

  state.draft.manifest = syncManifestQuestionCount(
    state.draft.manifest,
    state.draft.questions,
  );

  const report = validateCurrentDraft();
  state.draft.status = report.valid
    ? STUDIO_DRAFT_STATUS.READY
    : STUDIO_DRAFT_STATUS.DRAFT;

  state.draft = await saveStudioDraft(state.draft);
  setStatus(`草稿已自動儲存 · ${formatTime(state.draft.updatedAt)}`, 'ok');
  return state.draft;
}

function validateCurrentDraft() {
  if (!state.draft) {
    return {
      valid: false,
      issues: [],
      summary: { errors: 1, warnings: 0, questionCount: 0, assetCount: 0 },
    };
  }

  state.draft.manifest = syncManifestQuestionCount(
    state.draft.manifest,
    state.draft.questions,
  );

  const base = validatePackage({
    manifest: state.draft.manifest,
    questions: state.draft.questions,
    assetPaths: state.draft.assets.map(asset => asset.path),
  });

  const issues = [...base.issues];

  state.draft.questions.forEach((question, index) => {
    if (question.type === 'fill-in' && (!question.answer.length || question.answer.some(answer => !String(answer).trim()))) {
      issues.push({
        severity: 'error',
        location: `questions[${index}].answer`,
        message: '填空題至少需要一個非空白答案。',
      });
    }

    if (isChoice(question.type) && question.options.some(option => !String(option.text || '').trim())) {
      issues.push({
        severity: 'warning',
        location: `questions[${index}].options`,
        message: '有選項尚未填寫文字。',
      });
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

function renderValidation() {
  const container = state.mount?.querySelector('[data-studio-validation]');
  if (!container) return;

  const report = validateCurrentDraft();
  container.innerHTML = renderValidationReport(report);

  const saveButton = state.mount.querySelector('[data-studio-save-library]');
  const zipButton = state.mount.querySelector('[data-studio-export-zip]');
  const jsonButton = state.mount.querySelector('[data-studio-export-json]');
  if (saveButton) saveButton.disabled = !report.valid;
  if (zipButton) zipButton.disabled = !report.valid;
  if (jsonButton) jsonButton.disabled = !report.valid;
}

function renderValidationReport(report) {
  return `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Validation</p>
        <h3>Schema 2.0 驗證</h3>
      </div>
      <span class="schema-chip ${report.valid ? 'is-valid' : 'is-invalid'}">
        ${report.valid ? '可儲存 / 匯出' : `${report.summary.errors} 個錯誤`}
      </span>
    </div>

    ${report.issues.length ? `
      <div class="studio-issue-list">
        ${report.issues.slice(0, 30).map(issue => `
          <div class="studio-issue ${issue.severity}">
            <strong>${issue.severity === 'error' ? '錯誤' : '警告'}</strong>
            <code>${escapeHtml(issue.location)}</code>
            <span>${escapeHtml(issue.message)}</span>
          </div>
        `).join('')}
        ${report.issues.length > 30 ? `<p>另有 ${report.issues.length - 30} 項未顯示。</p>` : ''}
      </div>
    ` : '<p class="studio-valid-message">目前題庫結構通過 Schema 2.0 驗證。</p>'}
  `;
}

async function saveDraftToLibrary() {
  if (!state.draft) return;
  const report = validateCurrentDraft();
  if (!report.valid) {
    setStatus('請先修正驗證錯誤，再儲存到我的題庫。', 'error');
    renderValidation();
    return;
  }

  const banks = await listBanks();
  const id = state.draft.manifest.id;
  const existing = banks.find(bank => bank.id === id);

  if (existing?.sourceType === 'author') {
    setStatus('不能覆蓋作者題庫。請先使用「另存新題庫」。', 'error');
    return;
  }

  if (existing && state.draft.bankId !== id) {
    setStatus(`題庫 ID「${id}」已被另一個本機題庫使用。請修改 ID 或另存新題庫。`, 'error');
    return;
  }

  if (existing && !confirm(
    `確定更新本機題庫「${existing.name || id}」？\n\n` +
    '題目內容會更新；題目 ID 相同的學習紀錄會保留。',
  )) return;

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
    sourceMetadata: {
      createdBy: 'studio',
      draftId: state.draft.id,
    },
  });

  state.draft.bankId = manifest.id;
  state.draft.manifest = manifest;
  await persistDraftNow();

  document.querySelector('#refreshBanksButton')?.click();
  setStatus(`已儲存到「我的題庫」：${manifest.name}`, 'ok');
  renderEditor();
}

async function convertCurrentDraftToCopy() {
  if (!state.draft) return;
  const banks = await listBanks();
  const pkg = {
    manifest: state.draft.manifest,
    questions: state.draft.questions,
    assets: state.draft.assets,
  };
  const copy = createEditableCopyPackage(pkg, banks.map(bank => bank.id));
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
    setStatus('請先修正驗證錯誤，再匯出 ZIP。', 'error');
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
    setStatus('請先修正驗證錯誤，再匯出 JSON。', 'error');
    return;
  }

  const manifest = cleanExportManifest(
    state.draft.manifest,
    state.draft.questions.length,
  );
  const blob = new Blob([
    JSON.stringify({
      manifest,
      questions: state.draft.questions,
    }, null, 2),
  ], { type: 'application/json;charset=utf-8' });

  const filename = `${safeFilename(manifest.id)}-${safeFilename(manifest.version || '1.0.0')}.json`;
  downloadBlob(blob, filename);

  setStatus(
    state.draft.assets.length
      ? `JSON 已匯出：${filename}。注意：單一 JSON 不包含 ${state.draft.assets.length} 個圖片檔；含圖片請使用 ZIP。`
      : `JSON 已匯出：${filename}`,
    state.draft.assets.length ? 'warning' : 'ok',
  );
}

function renderPreview() {
  const container = state.mount?.querySelector('[data-studio-preview]');
  const question = getActiveQuestion();
  if (!container || !question) return;

  let answerBlock = '';
  if (isChoice(question.type)) {
    answerBlock = `
      <div class="studio-preview-options">
        ${question.options.map(option => `
          <div class="${question.answer.includes(option.id) ? 'is-answer' : ''}">
            <strong>${escapeHtml(option.id)}.</strong>
            <span>${escapeHtml(option.text || '（尚未輸入）')}</span>
          </div>
        `).join('')}
      </div>
    `;
  } else if (question.type === 'true-false') {
    answerBlock = `<p><strong>正確答案：</strong>${question.answer[0] ? '正確 / O' : '錯誤 / X'}</p>`;
  } else {
    answerBlock = `<p><strong>可接受答案：</strong>${escapeHtml((question.answer || []).join(' / ') || '尚未設定')}</p>`;
  }

  container.innerHTML = `
    <p class="eyebrow">Preview</p>
    <h3>題目預覽</h3>
    <div class="studio-preview-question">${escapeHtml(question.question || '尚未輸入題目')}</div>
    ${answerBlock}
    ${question.explanation ? `<div class="studio-preview-explanation"><strong>詳解</strong><p>${escapeHtml(question.explanation)}</p></div>` : ''}
    ${(question.images?.length || question.explanationImages?.length)
      ? '<p class="section-note">這份題庫已有圖片引用；P2 會加入圖片管理與即時圖片預覽。</p>'
      : ''}
  `;
}

function getActiveQuestion() {
  return state.draft?.questions?.find(question => question.id === state.activeQuestionId) || null;
}

function setStatus(message, kind = 'info') {
  const status = state.mount?.querySelector('[data-studio-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

function renderDraftCard(draft) {
  return `
    <article class="studio-home-card">
      <div>
        <span class="bank-id">${escapeHtml(draft.manifest?.id || '尚未設定 ID')}</span>
        <h4>${escapeHtml(draft.manifest?.name || '未命名題庫')}</h4>
        <p>${draft.questions?.length || 0} 題 · ${draft.status === 'ready' ? '驗證可用' : '草稿中'} · ${formatTime(draft.updatedAt)}</p>
      </div>
      <div class="studio-inline-actions">
        <button class="button primary compact" type="button" data-studio-open-draft="${escapeAttr(draft.id)}">繼續編輯</button>
        <button class="button danger compact" type="button" data-studio-delete-draft="${escapeAttr(draft.id)}">刪除草稿</button>
      </div>
    </article>
  `;
}

function renderBankCard(bank) {
  const author = bank.sourceType === 'author';
  return `
    <article class="studio-home-card">
      <div>
        <span class="bank-id">${escapeHtml(bank.id)}</span>
        <h4>${escapeHtml(bank.name || bank.title || bank.id)}</h4>
        <p>${bank.questionCount || 0} 題 · ${author ? '作者題庫（唯讀）' : '自行新增'}</p>
      </div>
      <button
        class="button ${author ? 'secondary' : 'primary'} compact"
        type="button"
        ${author
          ? `data-studio-copy-bank="${escapeAttr(bank.id)}"`
          : `data-studio-edit-bank="${escapeAttr(bank.id)}"`}
      >
        ${author ? '建立可編輯副本' : '編輯題庫'}
      </button>
    </article>
  `;
}

function field(label, key, value, options = {}) {
  return `
    <label class="studio-field">
      <span>${escapeHtml(label)}${options.required ? ' *' : ''}</span>
      <input
        value="${escapeAttr(value)}"
        data-manifest-field="${escapeAttr(key)}"
        ${options.required ? 'required' : ''}
        ${options.disabled ? 'disabled' : ''}
      />
      ${options.help ? `<small>${escapeHtml(options.help)}</small>` : ''}
    </label>
  `;
}

function emptyCard(title, description) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div>`;
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

function shorten(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatTime(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '時間未知';
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function safeFilename(value) {
  return String(value || 'question-bank')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'question-bank';
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
  if (document.querySelector('link[data-v4-studio-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './styles/v4-studio.css';
  link.dataset.v4StudioStyles = 'true';
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

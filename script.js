(() => {
  "use strict";

  const STORAGE_KEYS = {
    selectedBank: "moxin_selected_bank_v1",
    progress: "moxin_round_progress_v1",
    wrongBook: "moxin_wrong_book_v1",
    importedBanks: "moxin_imported_banks_v1",
    answerStats: "moxin_answer_stats_v1",
    roundRecords: "moxin_round_records_v1",
    uiPrefs: "moxin_ui_prefs_v1"
  };

  const SUPPORTED_TYPES = ["single_choice", "multiple_choice", "true_false", "fill_blank"];

  const state = {
    allBanks: [],
    bankDataMap: {},
    currentBank: null,
    round: null,
    lastFinishedRound: null,
    wrongBook: {},
    importedBanks: {},
    answerStats: [],
    roundRecords: [],
    uiPrefs: {},
    elements: {}
  };

  document.addEventListener("DOMContentLoaded", initApp);

  function initApp() {
    cacheElements();
    bindEvents();

    state.wrongBook = loadFromLocalStorage(STORAGE_KEYS.wrongBook, {});
    state.importedBanks = loadFromLocalStorage(STORAGE_KEYS.importedBanks, {});
    state.answerStats = loadFromLocalStorage(STORAGE_KEYS.answerStats, []);
    state.roundRecords = loadFromLocalStorage(STORAGE_KEYS.roundRecords, []);
    state.uiPrefs = loadFromLocalStorage(STORAGE_KEYS.uiPrefs, {});

    restoreUiPrefs();
    loadQuestionBanks();
    updateResumeButton();
  }

  function cacheElements() {
    const ids = [
      "messageArea", "homeSection", "practiceSection", "resultSection", "wrongBookSection", "dataPanelSection",
      "homeBtn", "openWrongBookBtn", "openDataPanelBtn", "resumeProgressBtn", "importBankInput",
      "bankSearchInput", "typeFilter", "difficultyFilter", "tagFilter", "bankList",
      "practiceBankTitle", "progressStats", "restartCurrentBtn", "clearCurrentProgressBtn", "backHomeFromPracticeBtn",
      "questionTypeBadge", "questionIdBadge", "questionDifficultyBadge", "questionTags", "questionWrongCount",
      "questionText", "answerForm", "submitAnswerBtn", "nextQuestionBtn", "explanationBox",
      "resultStats", "roundWrongList", "practiceAgainBtn", "practiceWrongFromResultBtn", "exportRoundJsonBtn",
      "exportRoundCsvBtn", "backHomeFromResultBtn", "exportWrongBookJsonBtn", "exportWrongBookCsvBtn",
      "clearWrongBookBtn", "backHomeFromWrongBookBtn", "wrongBookList", "exportAllDataBtn", "importAllDataInput",
      "clearAllLocalDataBtn", "importedBankList"
    ];

    ids.forEach((id) => {
      state.elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    const el = state.elements;

    el.homeBtn.addEventListener("click", () => showSection("home"));
    el.openWrongBookBtn.addEventListener("click", () => {
      renderWrongBook();
      showSection("wrongBook");
    });
    el.openDataPanelBtn.addEventListener("click", () => {
      renderImportedBankList();
      showSection("dataPanel");
    });

    el.bankSearchInput.addEventListener("input", () => {
      saveUiPrefs();
      renderQuestionBankList();
    });
    el.typeFilter.addEventListener("change", saveUiPrefs);
    el.difficultyFilter.addEventListener("change", saveUiPrefs);
    el.tagFilter.addEventListener("input", saveUiPrefs);

    el.importBankInput.addEventListener("change", importQuestionBank);
    el.importAllDataInput.addEventListener("change", importAllLocalData);

    el.resumeProgressBtn.addEventListener("click", loadProgress);
    el.restartCurrentBtn.addEventListener("click", () => {
      if (!state.round) return;
      startPractice(state.round.bankId, state.round.mode);
    });
    el.clearCurrentProgressBtn.addEventListener("click", clearProgress);
    el.backHomeFromPracticeBtn.addEventListener("click", () => showSection("home"));

    el.submitAnswerBtn.addEventListener("click", submitAnswer);
    el.nextQuestionBtn.addEventListener("click", nextQuestion);

    el.practiceAgainBtn.addEventListener("click", () => {
      if (!state.lastFinishedRound) return;
      startPractice(state.lastFinishedRound.bankId, "all");
    });
    el.practiceWrongFromResultBtn.addEventListener("click", () => {
      if (!state.lastFinishedRound) return;
      startWrongBookPractice(state.lastFinishedRound.bankId);
    });
    el.exportRoundJsonBtn.addEventListener("click", exportRoundRecordToJSON);
    el.exportRoundCsvBtn.addEventListener("click", exportRoundRecordToCSV);
    el.backHomeFromResultBtn.addEventListener("click", () => showSection("home"));

    el.exportWrongBookJsonBtn.addEventListener("click", exportWrongBookToJSON);
    el.exportWrongBookCsvBtn.addEventListener("click", exportWrongBookToCSV);
    el.clearWrongBookBtn.addEventListener("click", clearWrongBook);
    el.backHomeFromWrongBookBtn.addEventListener("click", () => showSection("home"));

    el.exportAllDataBtn.addEventListener("click", exportAllLocalData);
    el.clearAllLocalDataBtn.addEventListener("click", clearAllLocalData);
  }

  async function loadQuestionBanks() {
    clearMessages();
    state.allBanks = [];
    state.bankDataMap = {};

    let defaultBanks = [];
    try {
      const response = await fetch("question-banks.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      defaultBanks = await response.json();
      if (!Array.isArray(defaultBanks)) {
        throw new Error("question-banks.json 必須是陣列格式。");
      }
    } catch (error) {
      showMessage(`question-banks.json 無法讀取：${error.message}`, "error");
      defaultBanks = [];
    }

    const bankMap = new Map();

    defaultBanks
      .filter((bank) => bank && bank.enabled === true)
      .forEach((bank) => {
        bankMap.set(bank.id, {
          id: bank.id,
          title: bank.title || bank.id,
          description: bank.description || "",
          file: bank.file,
          category: bank.category || "未分類",
          folder: bank.folder || bank.category || "未分類",
          enabled: true,
          imported: false,
          questionCount: null,
          loadError: ""
        });
      });

    Object.values(state.importedBanks).forEach((bank) => {
      if (!bank || !bank.bankId) return;
      state.bankDataMap[bank.bankId] = bank;
      bankMap.set(bank.bankId, {
        id: bank.bankId,
        title: bank.title || bank.bankId,
        description: bank.description || "使用者匯入題庫",
        file: "",
        category: bank.category || "自訂題庫",
        folder: bank.folder || "自訂題庫",
        enabled: true,
        imported: true,
        questionCount: Array.isArray(bank.questions) ? bank.questions.length : 0,
        loadError: ""
      });
    });

    state.allBanks = Array.from(bankMap.values());

    await Promise.all(
      state.allBanks.map(async (meta) => {
        if (meta.imported) return;
        try {
          const bank = await loadQuestionBank(meta.id, { silent: true });
          meta.questionCount = bank.questions.length;
        } catch (error) {
          meta.questionCount = 0;
          meta.loadError = error.message;
        }
      })
    );

    renderQuestionBankList();
    renderImportedBankList();
  }

  function renderQuestionBankList() {
    const el = state.elements;
    const keyword = (el.bankSearchInput.value || "").trim().toLowerCase();

    const filteredBanks = state.allBanks.filter((bank) => {
      const target = `${bank.title} ${bank.description} ${bank.category} ${bank.folder || ""}`.toLowerCase();
      return !keyword || target.includes(keyword);
    });

    if (filteredBanks.length === 0) {
      el.bankList.innerHTML = `<div class="empty-state">目前沒有符合條件的題庫。</div>`;
      return;
    }

    const renderBankCard = (bank) => {
      const wrongCount = countWrongQuestions(bank.id);
      const sourceBadge = bank.imported ? `<span class="badge warning">自訂</span>` : `<span class="badge light">預設</span>`;
      const loadError = bank.loadError ? `<p class="notice error">題庫讀取錯誤：${escapeHtml(bank.loadError)}</p>` : "";
      const disabled = bank.loadError ? "disabled" : "";
      return `
        <article class="bank-card">
          <h3>${escapeHtml(bank.title)}</h3>
          <p class="muted">${escapeHtml(bank.description || "")}</p>
          <div class="bank-meta">
            ${sourceBadge}
            <span class="badge light">${escapeHtml(bank.category || "未分類")}</span>
            <span class="badge light">${Number(bank.questionCount || 0)} 題</span>
            <span class="badge ${wrongCount > 0 ? "danger" : "light"}">錯題 ${wrongCount} 題</span>
          </div>
          ${loadError}
          <div class="button-row">
            <button class="btn primary" type="button" data-action="start" data-bank-id="${escapeAttr(bank.id)}" ${disabled}>開始練習</button>
            <button class="btn secondary" type="button" data-action="wrong" data-bank-id="${escapeAttr(bank.id)}" ${wrongCount === 0 || bank.loadError ? "disabled" : ""}>練習錯題</button>
            ${bank.imported ? `<button class="btn danger-light" type="button" data-action="delete-imported" data-bank-id="${escapeAttr(bank.id)}">刪除匯入題庫</button>` : ""}
          </div>
        </article>
      `;
    };

    const groups = filteredBanks.reduce((acc, bank) => {
      const folder = bank.folder || bank.category || "未分類題庫";
      if (!acc[folder]) acc[folder] = [];
      acc[folder].push(bank);
      return acc;
    }, {});

    el.bankList.innerHTML = Object.entries(groups).map(([folder, banks]) => {
      const totalQuestions = banks.reduce((sum, bank) => sum + Number(bank.questionCount || 0), 0);
      return `
        <details class="bank-folder" open>
          <summary>
            <span class="folder-title">資料夾：${escapeHtml(folder)}</span>
            <span class="folder-meta">${banks.length} 個題庫｜${totalQuestions} 題</span>
          </summary>
          <div class="folder-grid">
            ${banks.map(renderBankCard).join("")}
          </div>
        </details>
      `;
    }).join("");

    el.bankList.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const action = event.currentTarget.dataset.action;
        const bankId = event.currentTarget.dataset.bankId;
        if (action === "start") startPractice(bankId, "all");
        if (action === "wrong") startWrongBookPractice(bankId);
        if (action === "delete-imported") deleteImportedQuestionBank(bankId);
      });
    });
  }

  async function loadQuestionBank(bankId, options = {}) {
    if (state.bankDataMap[bankId]) {
      return state.bankDataMap[bankId];
    }

    const meta = state.allBanks.find((bank) => bank.id === bankId);
    if (!meta) {
      throw new Error(`找不到題庫：${bankId}`);
    }

    if (!meta.file) {
      throw new Error(`題庫 ${bankId} 沒有設定檔案路徑。`);
    }

    try {
      const response = await fetch(meta.file, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`題庫 JSON 檔案不存在或無法讀取：${meta.file}，HTTP ${response.status}`);
      }

      const bank = await response.json();
      const validation = validateQuestionBank(bank);
      if (!validation.valid) {
        throw new Error(validation.errors.join("；"));
      }

      state.bankDataMap[bankId] = bank;
      return bank;
    } catch (error) {
      if (!options.silent) {
        showMessage(`題庫載入失敗：${error.message}`, "error");
      }
      throw error;
    }
  }

  function validateQuestionBank(bank) {
    const errors = [];

    if (!bank || typeof bank !== "object" || Array.isArray(bank)) {
      return { valid: false, errors: ["題庫根節點必須是物件"] };
    }

    if (!bank.bankId || typeof bank.bankId !== "string") errors.push("缺少 bankId");
    if (!bank.title || typeof bank.title !== "string") errors.push("缺少 title");
    if (!("questions" in bank)) errors.push("缺少 questions");
    if ("questions" in bank && !Array.isArray(bank.questions)) errors.push("questions 不是陣列");

    if (Array.isArray(bank.questions)) {
      const seenIds = new Set();
      bank.questions.forEach((question, index) => {
        const questionErrors = validateQuestion(question);
        if (question && question.id) {
          if (seenIds.has(question.id)) {
            questionErrors.push(`題目 id 重複：${question.id}`);
          }
          seenIds.add(question.id);
        }
        questionErrors.forEach((message) => errors.push(`第 ${index + 1} 題：${message}`));
      });
    }

    return { valid: errors.length === 0, errors };
  }

  function validateQuestion(question) {
    const errors = [];

    if (!question || typeof question !== "object" || Array.isArray(question)) {
      return ["題目必須是物件"];
    }

    if (!question.id || typeof question.id !== "string") errors.push("題目缺少 id");
    if (!question.type || typeof question.type !== "string") errors.push("題目缺少 type");
    if (question.type && !SUPPORTED_TYPES.includes(question.type)) errors.push(`題型不支援：${question.type}`);
    if (!question.question || typeof question.question !== "string") errors.push("題目缺少 question");
    if (!("answer" in question)) errors.push("題目缺少 answer");

    if (question.type === "single_choice") {
      if (!isPlainObject(question.options) || Object.keys(question.options).length === 0) {
        errors.push("單選題缺少 options");
      }
      if (typeof question.answer !== "string") {
        errors.push("單選題 answer 必須是字串，例如 \"B\"");
      }
    }

    if (question.type === "multiple_choice") {
      if (!isPlainObject(question.options) || Object.keys(question.options).length === 0) {
        errors.push("複選題缺少 options");
      }
      if (!Array.isArray(question.answer)) {
        errors.push("複選題 answer 不是陣列");
      }
    }

    if (question.type === "true_false") {
      if (typeof question.answer !== "boolean") {
        errors.push("是非題 answer 不是 true 或 false");
      }
    }

    if (question.type === "fill_blank") {
      const answerIsValid = typeof question.answer === "string" ||
        (Array.isArray(question.answer) && question.answer.every((item) => typeof item === "string"));
      if (!answerIsValid) {
        errors.push("填空題 answer 格式錯誤，必須是字串或字串陣列");
      }
      if ("caseSensitive" in question && typeof question.caseSensitive !== "boolean") {
        errors.push("填空題 caseSensitive 必須是 true 或 false");
      }
    }

    return errors;
  }

  async function startPractice(bankId, mode = "all") {
    clearMessages();

    let bank;
    try {
      bank = await loadQuestionBank(bankId);
    } catch {
      return;
    }

    let questions = applyQuestionFilters(bank.questions);

    if (mode === "wrongOnly") {
      const wrongIds = Object.keys(state.wrongBook?.[bankId]?.items || {});
      questions = bank.questions.filter((question) => wrongIds.includes(question.id));
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      showMessage(mode === "wrongOnly" ? "此題庫目前沒有可練習的錯題。" : "篩選後沒有題目，請調整題型、難度或標籤篩選。", "warning");
      return;
    }

    state.currentBank = bank;
    state.round = {
      bankId: bank.bankId,
      bankTitle: bank.title,
      mode,
      total: questions.length,
      questions,
      queue: createQuestionQueue(questions),
      currentQuestion: null,
      completedIds: [],
      errorCounts: {},
      totalAttempts: 0,
      totalWrong: 0,
      startTime: new Date().toISOString(),
      endTime: null,
      answered: false,
      roundRecords: [],
      filters: getCurrentFilters()
    };

    saveToLocalStorage(STORAGE_KEYS.selectedBank, bank.bankId);
    saveUiPrefs();
    showSection("practice");
    nextQuestion();
  }

  async function startWrongBookPractice(bankId) {
    return startPractice(bankId, "wrongOnly");
  }

  function applyQuestionFilters(questions) {
    const filters = getCurrentFilters();

    return questions.filter((question) => {
      if (filters.type !== "all" && question.type !== filters.type) return false;
      if (filters.difficulty !== "all" && question.difficulty !== filters.difficulty) return false;

      if (filters.tag) {
        const tags = Array.isArray(question.tags) ? question.tags : [];
        const joinedTags = tags.join(" ").toLowerCase();
        return joinedTags.includes(filters.tag.toLowerCase());
      }

      return true;
    });
  }

  function getCurrentFilters() {
    return {
      type: state.elements.typeFilter.value || "all",
      difficulty: state.elements.difficultyFilter.value || "all",
      tag: (state.elements.tagFilter.value || "").trim()
    };
  }

  function createQuestionQueue(questions) {
    return shuffleArray(questions.map((question) => ({ ...question })));
  }

  function shuffleArray(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function renderQuestion() {
    const round = state.round;
    if (!round || !round.currentQuestion) return;

    const question = round.currentQuestion;
    const el = state.elements;
    const errorCount = round.errorCounts[question.id] || 0;

    el.practiceBankTitle.textContent = round.bankTitle;
    el.questionTypeBadge.textContent = getTypeLabel(question.type);
    el.questionIdBadge.textContent = question.id;
    el.questionDifficultyBadge.textContent = question.difficulty || "未設定難度";
    el.questionTags.innerHTML = (Array.isArray(question.tags) ? question.tags : [])
      .map((tag) => `<span class="badge light">${escapeHtml(tag)}</span>`)
      .join("");
    el.questionWrongCount.textContent = `本題本輪已答錯 ${errorCount} 次`;
    el.questionWrongCount.classList.toggle("hidden", errorCount === 0);
    el.questionText.textContent = question.question;

    el.answerForm.innerHTML = renderAnswerInput(question);
    el.explanationBox.className = "explanation-box hidden";
    el.explanationBox.innerHTML = "";
    el.submitAnswerBtn.classList.remove("hidden");
    el.submitAnswerBtn.disabled = false;
    el.nextQuestionBtn.classList.add("hidden");

    updateProgress();
  }

  function renderAnswerInput(question) {
    if (question.type === "single_choice") {
      return Object.entries(question.options).map(([key, value]) => `
        <label class="option-row" data-option-key="${escapeAttr(key)}">
          <input type="radio" name="answer" value="${escapeAttr(key)}" />
          <span class="option-key">${escapeHtml(key)}.</span>
          <span>${escapeHtml(value)}</span>
        </label>
      `).join("");
    }

    if (question.type === "multiple_choice") {
      return Object.entries(question.options).map(([key, value]) => `
        <label class="option-row" data-option-key="${escapeAttr(key)}">
          <input type="checkbox" name="answer" value="${escapeAttr(key)}" />
          <span class="option-key">${escapeHtml(key)}.</span>
          <span>${escapeHtml(value)}</span>
        </label>
      `).join("");
    }

    if (question.type === "true_false") {
      return `
        <label class="option-row" data-option-key="true">
          <input type="radio" name="answer" value="true" />
          <span class="option-key">O.</span>
          <span>是</span>
        </label>
        <label class="option-row" data-option-key="false">
          <input type="radio" name="answer" value="false" />
          <span class="option-key">X.</span>
          <span>否</span>
        </label>
      `;
    }

    if (question.type === "fill_blank") {
      return `
        <label>
          請輸入答案
          <input class="fill-answer-input" name="answer" type="text" autocomplete="off" placeholder="輸入後按「提交答案」" />
        </label>
      `;
    }

    return `<div class="notice error">不支援的題型：${escapeHtml(question.type)}</div>`;
  }

  function submitAnswer() {
    const round = state.round;
    if (!round || !round.currentQuestion) return;

    if (round.answered) {
      showMessage("本題已提交，請按「下一題」。", "warning");
      return;
    }

    const question = round.currentQuestion;
    const userAnswer = getUserAnswer(question);

    if (!hasAnswer(userAnswer, question.type)) {
      showMessage("請先作答再提交。", "warning");
      return;
    }

    clearMessages();

    const isCorrect = checkAnswer(question, userAnswer);
    const now = new Date().toISOString();

    round.answered = true;
    round.totalAttempts += 1;

    if (isCorrect) {
      if (!round.completedIds.includes(question.id)) {
        round.completedIds.push(question.id);
      }
    } else {
      round.totalWrong += 1;
      round.errorCounts[question.id] = (round.errorCounts[question.id] || 0) + 1;
      addWrongQuestionBackToQueue(question);
      updateWrongBook(question);
    }

    const record = {
      bankTitle: round.bankTitle,
      bankId: round.bankId,
      questionId: question.id,
      type: question.type,
      question: question.question,
      userAnswer,
      correctAnswer: question.answer,
      isCorrect,
      answeredAt: now,
      wrongCount: round.errorCounts[question.id] || 0,
      explanation: question.explanation || ""
    };

    round.roundRecords.push(record);
    state.answerStats.push(record);
    state.roundRecords = round.roundRecords.slice();

    saveToLocalStorage(STORAGE_KEYS.answerStats, state.answerStats);
    saveToLocalStorage(STORAGE_KEYS.roundRecords, state.roundRecords);

    showExplanation(question, userAnswer, isCorrect);
    markCorrectAnswer(question);
    if (!isCorrect) markWrongAnswer(question, userAnswer);

    setAnswerInputsDisabled(true);
    state.elements.submitAnswerBtn.classList.add("hidden");
    state.elements.nextQuestionBtn.classList.remove("hidden");

    updateProgress();
    saveProgress();
  }

  function getUserAnswer(question) {
    const form = state.elements.answerForm;

    if (question.type === "single_choice") {
      const checked = form.querySelector("input[name='answer']:checked");
      return checked ? checked.value : "";
    }

    if (question.type === "multiple_choice") {
      return Array.from(form.querySelectorAll("input[name='answer']:checked")).map((input) => input.value);
    }

    if (question.type === "true_false") {
      const checked = form.querySelector("input[name='answer']:checked");
      if (!checked) return null;
      return checked.value === "true";
    }

    if (question.type === "fill_blank") {
      const input = form.querySelector("input[name='answer']");
      return input ? input.value : "";
    }

    return "";
  }

  function hasAnswer(answer, type) {
    if (type === "multiple_choice") return Array.isArray(answer) && answer.length > 0;
    if (type === "true_false") return typeof answer === "boolean";
    if (type === "fill_blank") return typeof answer === "string" && answer.trim() !== "";
    return typeof answer === "string" && answer.trim() !== "";
  }

  function checkAnswer(question, userAnswer) {
    if (question.type === "single_choice") {
      return normalizeAnswer(userAnswer) === normalizeAnswer(question.answer);
    }

    if (question.type === "multiple_choice") {
      const user = Array.isArray(userAnswer) ? userAnswer.map(normalizeAnswer).sort() : [];
      const correct = Array.isArray(question.answer) ? question.answer.map(normalizeAnswer).sort() : [];
      return user.length === correct.length && user.every((item, index) => item === correct[index]);
    }

    if (question.type === "true_false") {
      return userAnswer === question.answer;
    }

    if (question.type === "fill_blank") {
      const caseSensitive = question.caseSensitive === true;
      const user = normalizeAnswer(userAnswer, caseSensitive);
      const acceptable = Array.isArray(question.answer) ? question.answer : [question.answer];
      return acceptable.some((answer) => normalizeAnswer(answer, caseSensitive) === user);
    }

    return false;
  }

  function normalizeAnswer(answer, caseSensitive = true) {
    let value = String(answer ?? "").trim();
    if (!caseSensitive) value = value.toLowerCase();
    return value;
  }

  function showExplanation(question, userAnswer, isCorrect) {
    const correctText = formatAnswer(question, question.answer);
    const userText = formatAnswer(question, userAnswer);
    const wrongCount = state.round.errorCounts[question.id] || 0;
    const el = state.elements.explanationBox;

    el.className = `explanation-box ${isCorrect ? "correct" : "wrong"}`;
    el.innerHTML = `
      <h3>${isCorrect ? "答對了" : "答錯了"}</h3>
      <p>你的答案：<span class="answer-highlight ${isCorrect ? "correct" : "wrong"}">${escapeHtml(userText)}</span></p>
      <p>正確答案：<span class="answer-highlight correct">${escapeHtml(correctText)}</span></p>
      ${!isCorrect ? `<p>本題本輪已答錯 ${wrongCount} 次。</p>` : ""}
      <p><strong>詳細解析：</strong>${escapeHtml(question.explanation || "此題尚未提供詳解。")}</p>
    `;
    el.classList.remove("hidden");
  }

  function markCorrectAnswer(question) {
    const correctKeys = getCorrectOptionKeys(question);
    correctKeys.forEach((key) => {
      const row = state.elements.answerForm.querySelector(`[data-option-key="${cssEscape(key)}"]`);
      if (row) row.classList.add("correct");
    });
  }

  function markWrongAnswer(question, userAnswer) {
    const correctKeys = getCorrectOptionKeys(question);
    const userKeys = Array.isArray(userAnswer) ? userAnswer : [userAnswer];

    userKeys.forEach((key) => {
      const normalizedKey = String(key);
      if (!correctKeys.includes(normalizedKey)) {
        const row = state.elements.answerForm.querySelector(`[data-option-key="${cssEscape(normalizedKey)}"]`);
        if (row) row.classList.add("wrong");
      }
    });
  }

  function getCorrectOptionKeys(question) {
    if (question.type === "single_choice") return [String(question.answer)];
    if (question.type === "multiple_choice") return question.answer.map(String);
    if (question.type === "true_false") return [String(question.answer)];
    return [];
  }

  function addWrongQuestionBackToQueue(question) {
    if (!state.round) return;
    state.round.queue.push({ ...question });
  }

  function updateWrongBook(question) {
    const round = state.round;
    if (!round) return;

    if (!state.wrongBook[round.bankId]) {
      state.wrongBook[round.bankId] = {
        bankId: round.bankId,
        bankTitle: round.bankTitle,
        items: {}
      };
    }

    const bankEntry = state.wrongBook[round.bankId];
    const oldItem = bankEntry.items[question.id];

    bankEntry.items[question.id] = {
      bankId: round.bankId,
      bankTitle: round.bankTitle,
      questionId: question.id,
      type: question.type,
      question: question.question,
      options: question.options || null,
      answer: question.answer,
      explanation: question.explanation || "",
      tags: question.tags || [],
      difficulty: question.difficulty || "",
      wrongCount: oldItem ? oldItem.wrongCount + 1 : 1,
      lastWrongAt: new Date().toISOString()
    };

    saveToLocalStorage(STORAGE_KEYS.wrongBook, state.wrongBook);
    renderQuestionBankList();
  }

  function removeFromWrongBook(bankId, questionId) {
    if (!state.wrongBook[bankId] || !state.wrongBook[bankId].items[questionId]) return;

    delete state.wrongBook[bankId].items[questionId];

    if (Object.keys(state.wrongBook[bankId].items).length === 0) {
      delete state.wrongBook[bankId];
    }

    saveToLocalStorage(STORAGE_KEYS.wrongBook, state.wrongBook);
    renderWrongBook();
    renderQuestionBankList();
    showMessage("已從錯題本移除。", "success");
  }

  function nextQuestion() {
    const round = state.round;
    if (!round) return;

    if (round.queue.length === 0) {
      finishRound();
      return;
    }

    round.currentQuestion = round.queue.shift();
    round.answered = false;
    renderQuestion();
    saveProgress();
  }

  function updateProgress() {
    const round = state.round;
    if (!round) return;

    const completed = round.completedIds.length;
    const remaining = Math.max(round.total - completed, 0);
    const accuracy = round.totalAttempts === 0
      ? "0%"
      : `${Math.round(((round.totalAttempts - round.totalWrong) / round.totalAttempts) * 100)}%`;
    const currentWrong = round.currentQuestion ? (round.errorCounts[round.currentQuestion.id] || 0) : 0;

    state.elements.progressStats.innerHTML = [
      ["本輪總題數", round.total],
      ["已完成題數", completed],
      ["剩餘題數", remaining],
      ["本輪總答題次數", round.totalAttempts],
      ["本輪總答錯次數", round.totalWrong],
      ["目前正確率", accuracy],
      ["目前題目錯誤次數", currentWrong]
    ].map(([label, value]) => `
      <div class="stat-line"><span>${label}</span><strong>${value}</strong></div>
    `).join("");
  }

  function finishRound() {
    const round = state.round;
    if (!round) return;

    round.endTime = new Date().toISOString();
    state.lastFinishedRound = JSON.parse(JSON.stringify(round));
    clearProgress({ silent: true });

    renderFinishRound();
    showSection("result");
  }

  function renderFinishRound() {
    const round = state.lastFinishedRound;
    if (!round) return;

    const totalCorrect = round.totalAttempts - round.totalWrong;
    const accuracy = round.totalAttempts === 0 ? 0 : Math.round((totalCorrect / round.totalAttempts) * 100);
    const start = new Date(round.startTime);
    const end = new Date(round.endTime);
    const durationSeconds = Math.max(0, Math.round((end - start) / 1000));

    state.elements.resultStats.innerHTML = [
      ["題庫名稱", round.bankTitle],
      ["本輪完成時間", formatDateTime(round.endTime)],
      ["總題數", round.total],
      ["總答題次數", round.totalAttempts],
      ["總答錯次數", round.totalWrong],
      ["正確率", `${accuracy}%`],
      ["作答耗時", formatDuration(durationSeconds)]
    ].map(([label, value]) => `
      <div class="stat-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>
    `).join("");

    const wrongIds = Object.keys(round.errorCounts).filter((id) => round.errorCounts[id] > 0);
    if (wrongIds.length === 0) {
      state.elements.roundWrongList.innerHTML = `<div class="empty-state">本輪沒有錯題。</div>`;
      return;
    }

    state.elements.roundWrongList.innerHTML = wrongIds.map((questionId) => {
      const question = round.questions.find((item) => item.id === questionId) || {};
      return `
        <article class="wrong-card">
          <h3>${escapeHtml(questionId)}｜錯 ${round.errorCounts[questionId]} 次</h3>
          <p class="question-small">${escapeHtml(question.question || "")}</p>
          <p><strong>正確答案：</strong>${escapeHtml(formatAnswer(question, question.answer))}</p>
          <p><strong>詳解：</strong>${escapeHtml(question.explanation || "此題尚未提供詳解。")}</p>
        </article>
      `;
    }).join("");
  }

  function saveProgress() {
    if (!state.round) return;
    saveToLocalStorage(STORAGE_KEYS.progress, state.round);
    updateResumeButton();
  }

  async function loadProgress() {
    const saved = loadFromLocalStorage(STORAGE_KEYS.progress, null);
    if (!saved || !saved.bankId) {
      showMessage("沒有可恢復的進度。", "warning");
      updateResumeButton();
      return;
    }

    let bank;
    try {
      bank = await loadQuestionBank(saved.bankId);
    } catch {
      clearProgress({ silent: true });
      showMessage("原題庫已不存在，已清除舊進度。", "warning");
      return;
    }

    state.currentBank = bank;
    state.round = saved;

    if (state.round.answered) {
      state.round.currentQuestion = null;
      state.round.answered = false;
    }

    showSection("practice");

    if (!state.round.currentQuestion) {
      nextQuestion();
    } else {
      renderQuestion();
    }

    showMessage("已恢復上次刷題進度。", "success");
  }

  function clearProgress(options = {}) {
    localStorage.removeItem(STORAGE_KEYS.progress);
    updateResumeButton();

    if (!options.silent) {
      state.round = null;
      showMessage("已清除目前題庫進度。", "success");
      showSection("home");
    }
  }

  function saveToLocalStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      showMessage(`localStorage 儲存失敗：${error.message}`, "error");
      return false;
    }
  }

  function loadFromLocalStorage(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;

    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(key);
      showMessage(`偵測到 ${key} 資料損壞，已自動重置。`, "warning");
      return fallback;
    }
  }

  function exportWrongBookToJSON() {
    downloadFile("moxin-wrong-book.json", JSON.stringify(state.wrongBook, null, 2), "application/json");
  }

  function exportWrongBookToCSV() {
    const rows = [];

    Object.values(state.wrongBook).forEach((bank) => {
      Object.values(bank.items || {}).forEach((item) => {
        rows.push({
          題庫名稱: item.bankTitle,
          題庫ID: item.bankId,
          題目ID: item.questionId,
          題型: item.type,
          題目內容: item.question,
          使用者答案: "",
          正確答案: formatStoredAnswer(item),
          是否答對: "false",
          答題時間: formatDateTime(item.lastWrongAt),
          錯誤次數: item.wrongCount,
          詳解: item.explanation
        });
      });
    });

    downloadFile("moxin-wrong-book.csv", toCSV(rows), "text/csv;charset=utf-8");
  }

  function exportRoundRecordToJSON() {
    const records = state.lastFinishedRound?.roundRecords || state.roundRecords || [];
    downloadFile("moxin-round-record.json", JSON.stringify(records, null, 2), "application/json");
  }

  function exportRoundRecordToCSV() {
    const records = state.lastFinishedRound?.roundRecords || state.roundRecords || [];
    const rows = records.map((record) => ({
      題庫名稱: record.bankTitle,
      題庫ID: record.bankId,
      題目ID: record.questionId,
      題型: record.type,
      題目內容: record.question,
      使用者答案: formatRecordAnswer(record.userAnswer),
      正確答案: formatRecordAnswer(record.correctAnswer),
      是否答對: record.isCorrect,
      答題時間: formatDateTime(record.answeredAt),
      錯誤次數: record.wrongCount,
      詳解: record.explanation
    }));

    downloadFile("moxin-round-record.csv", toCSV(rows), "text/csv;charset=utf-8");
  }

  function exportAllLocalData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "墨忻刷題網",
      version: "1.0",
      data: {
        selectedBank: loadFromLocalStorage(STORAGE_KEYS.selectedBank, null),
        progress: loadFromLocalStorage(STORAGE_KEYS.progress, null),
        wrongBook: state.wrongBook,
        importedBanks: state.importedBanks,
        answerStats: state.answerStats,
        roundRecords: state.roundRecords,
        uiPrefs: state.uiPrefs
      }
    };

    downloadFile("moxin-local-data-backup.json", JSON.stringify(payload, null, 2), "application/json");
  }

  function importAllLocalData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const data = payload.data || payload;

        if (!data || typeof data !== "object") {
          throw new Error("備份檔格式錯誤，缺少 data。");
        }

        if (!confirm("匯入備份會覆蓋目前本機資料，是否繼續？")) {
          event.target.value = "";
          return;
        }

        saveToLocalStorage(STORAGE_KEYS.selectedBank, data.selectedBank || null);
        saveToLocalStorage(STORAGE_KEYS.progress, data.progress || null);
        saveToLocalStorage(STORAGE_KEYS.wrongBook, data.wrongBook || {});
        saveToLocalStorage(STORAGE_KEYS.importedBanks, data.importedBanks || {});
        saveToLocalStorage(STORAGE_KEYS.answerStats, data.answerStats || []);
        saveToLocalStorage(STORAGE_KEYS.roundRecords, data.roundRecords || []);
        saveToLocalStorage(STORAGE_KEYS.uiPrefs, data.uiPrefs || {});

        showMessage("本機資料備份已匯入，頁面將重新載入。", "success");
        setTimeout(() => window.location.reload(), 500);
      } catch (error) {
        showMessage(`匯入備份失敗：${error.message}`, "error");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function importQuestionBank(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bank = JSON.parse(reader.result);
        const validation = validateQuestionBank(bank);

        if (!validation.valid) {
          throw new Error(validation.errors.join("；"));
        }

        const existingDefault = state.allBanks.find((item) => item.id === bank.bankId && !item.imported);
        const existingImported = state.importedBanks[bank.bankId];

        if ((existingDefault || existingImported) && !confirm(`bankId「${bank.bankId}」已存在，是否覆蓋為匯入題庫？`)) {
          event.target.value = "";
          return;
        }

        state.importedBanks[bank.bankId] = bank;
        saveToLocalStorage(STORAGE_KEYS.importedBanks, state.importedBanks);
        showMessage(`題庫「${bank.title}」已匯入。`, "success");
        loadQuestionBanks();
      } catch (error) {
        showMessage(`匯入題庫失敗：${error.message}`, "error");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function deleteImportedQuestionBank(bankId) {
    if (!state.importedBanks[bankId]) {
      showMessage("找不到此匯入題庫。", "warning");
      return;
    }

    if (!confirm(`確定刪除匯入題庫「${bankId}」？錯題本與紀錄不會自動刪除。`)) return;

    delete state.importedBanks[bankId];
    delete state.bankDataMap[bankId];
    saveToLocalStorage(STORAGE_KEYS.importedBanks, state.importedBanks);
    loadQuestionBanks();
    showMessage("已刪除匯入題庫。", "success");
  }

  function renderWrongBook() {
    const books = Object.values(state.wrongBook);
    if (books.length === 0) {
      state.elements.wrongBookList.innerHTML = `<div class="empty-state">目前沒有錯題。</div>`;
      return;
    }

    state.elements.wrongBookList.innerHTML = books.map((bank) => {
      const items = Object.values(bank.items || {});
      return `
        <section class="panel">
          <div class="section-title-row">
            <div>
              <h3>${escapeHtml(bank.bankTitle)}</h3>
              <p class="muted">題庫 ID：${escapeHtml(bank.bankId)}｜錯題 ${items.length} 題</p>
            </div>
            <button class="btn secondary" type="button" data-action="practice-wrong-bank" data-bank-id="${escapeAttr(bank.bankId)}">練習此題庫錯題</button>
          </div>
          <div class="wrong-list">
            ${items.map((item) => `
              <article class="wrong-card">
                <h3>${escapeHtml(item.questionId)}｜${escapeHtml(getTypeLabel(item.type))}</h3>
                <p class="question-small">${escapeHtml(item.question)}</p>
                <p><strong>答錯次數：</strong>${Number(item.wrongCount || 0)}</p>
                <p><strong>最近一次答錯時間：</strong>${escapeHtml(formatDateTime(item.lastWrongAt))}</p>
                <p><strong>正確答案：</strong>${escapeHtml(formatStoredAnswer(item))}</p>
                <p><strong>詳解：</strong>${escapeHtml(item.explanation || "此題尚未提供詳解。")}</p>
                <div class="button-row">
                  <button class="btn danger-light" type="button" data-action="remove-wrong" data-bank-id="${escapeAttr(item.bankId)}" data-question-id="${escapeAttr(item.questionId)}">從錯題本移除</button>
                </div>
              </article>
            `).join("")}
          </div>
        </section>
      `;
    }).join("");

    state.elements.wrongBookList.querySelectorAll("button[data-action='practice-wrong-bank']").forEach((button) => {
      button.addEventListener("click", () => startWrongBookPractice(button.dataset.bankId));
    });

    state.elements.wrongBookList.querySelectorAll("button[data-action='remove-wrong']").forEach((button) => {
      button.addEventListener("click", () => removeFromWrongBook(button.dataset.bankId, button.dataset.questionId));
    });
  }

  function renderImportedBankList() {
    const banks = Object.values(state.importedBanks);
    if (banks.length === 0) {
      state.elements.importedBankList.innerHTML = `<div class="empty-state">目前沒有匯入題庫。</div>`;
      return;
    }

    state.elements.importedBankList.innerHTML = banks.map((bank) => `
      <article class="imported-card">
        <h3>${escapeHtml(bank.title || bank.bankId)}</h3>
        <p class="muted">${escapeHtml(bank.description || "")}</p>
        <div class="bank-meta">
          <span class="badge warning">自訂</span>
          <span class="badge light">${escapeHtml(bank.bankId)}</span>
          <span class="badge light">${Array.isArray(bank.questions) ? bank.questions.length : 0} 題</span>
        </div>
        <button class="btn danger-light" type="button" data-bank-id="${escapeAttr(bank.bankId)}">刪除匯入題庫</button>
      </article>
    `).join("");

    state.elements.importedBankList.querySelectorAll("button[data-bank-id]").forEach((button) => {
      button.addEventListener("click", () => deleteImportedQuestionBank(button.dataset.bankId));
    });
  }

  function clearWrongBook() {
    if (!confirm("確定清除全部錯題本？此動作無法復原。")) return;
    state.wrongBook = {};
    saveToLocalStorage(STORAGE_KEYS.wrongBook, state.wrongBook);
    renderWrongBook();
    renderQuestionBankList();
    showMessage("已清除錯題本。", "success");
  }

  function clearAllLocalData() {
    if (!confirm("確定清除所有本機資料？包含進度、錯題本、匯入題庫與統計紀錄。")) return;

    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    showMessage("所有本機資料已清除，頁面將重新載入。", "success");
    setTimeout(() => window.location.reload(), 500);
  }

  function countWrongQuestions(bankId) {
    return Object.keys(state.wrongBook?.[bankId]?.items || {}).length;
  }

  function setAnswerInputsDisabled(disabled) {
    state.elements.answerForm.querySelectorAll("input, textarea, select").forEach((input) => {
      input.disabled = disabled;
    });
  }

  function formatAnswer(question, answer) {
    if (!question) return formatRecordAnswer(answer);

    if (question.type === "single_choice") {
      const key = String(answer);
      const text = question.options?.[key];
      return text ? `${key}. ${text}` : key;
    }

    if (question.type === "multiple_choice") {
      const answers = Array.isArray(answer) ? answer : [];
      return answers.map((key) => {
        const text = question.options?.[key];
        return text ? `${key}. ${text}` : key;
      }).join("；");
    }

    if (question.type === "true_false") {
      return answer === true ? "是 / O" : "否 / X";
    }

    if (question.type === "fill_blank") {
      return Array.isArray(answer) ? answer.join("；") : String(answer ?? "");
    }

    return formatRecordAnswer(answer);
  }

  function formatStoredAnswer(item) {
    if (!item) return "";
    const pseudoQuestion = {
      type: item.type,
      options: item.options || {},
      answer: item.answer
    };
    return formatAnswer(pseudoQuestion, item.answer);
  }

  function formatRecordAnswer(answer) {
    if (Array.isArray(answer)) return answer.join("；");
    if (typeof answer === "boolean") return answer ? "是 / O" : "否 / X";
    return String(answer ?? "");
  }

  function getTypeLabel(type) {
    return {
      single_choice: "單選題",
      multiple_choice: "複選題",
      true_false: "是非題",
      fill_blank: "填空題"
    }[type] || type;
  }

  function showSection(sectionName) {
    const el = state.elements;
    el.homeSection.classList.toggle("hidden", sectionName !== "home");
    el.practiceSection.classList.toggle("hidden", sectionName !== "practice");
    el.resultSection.classList.toggle("hidden", sectionName !== "result");
    el.wrongBookSection.classList.toggle("hidden", sectionName !== "wrongBook");
    el.dataPanelSection.classList.toggle("hidden", sectionName !== "dataPanel");

    if (sectionName === "home") {
      renderQuestionBankList();
      updateResumeButton();
    }
  }

  function showMessage(message, type = "success") {
    const div = document.createElement("div");
    div.className = `notice ${type}`;
    div.textContent = message;
    state.elements.messageArea.appendChild(div);

    setTimeout(() => {
      div.remove();
    }, type === "error" ? 9000 : 4500);
  }

  function clearMessages() {
    state.elements.messageArea.innerHTML = "";
  }

  function updateResumeButton() {
    const saved = loadFromLocalStorage(STORAGE_KEYS.progress, null);
    state.elements.resumeProgressBtn.classList.toggle("hidden", !saved || !saved.bankId);
  }

  function saveUiPrefs() {
    state.uiPrefs = {
      bankSearch: state.elements.bankSearchInput.value || "",
      typeFilter: state.elements.typeFilter.value || "all",
      difficultyFilter: state.elements.difficultyFilter.value || "all",
      tagFilter: state.elements.tagFilter.value || ""
    };
    saveToLocalStorage(STORAGE_KEYS.uiPrefs, state.uiPrefs);
  }

  function restoreUiPrefs() {
    state.elements.bankSearchInput.value = state.uiPrefs.bankSearch || "";
    state.elements.typeFilter.value = state.uiPrefs.typeFilter || "all";
    state.elements.difficultyFilter.value = state.uiPrefs.difficultyFilter || "all";
    state.elements.tagFilter.value = state.uiPrefs.tagFilter || "";
  }

  function toCSV(rows) {
    const headers = ["題庫名稱", "題庫ID", "題目ID", "題型", "題目內容", "使用者答案", "正確答案", "是否答對", "答題時間", "錯誤次數", "詳解"];
    const lines = [headers.join(",")];

    rows.forEach((row) => {
      lines.push(headers.map((header) => csvEscape(row[header])).join(","));
    });

    return "\ufeff" + lines.join("\n");
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 0);
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("zh-TW", { hour12: false });
  }

  function formatDuration(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds} 秒`;
    return `${minutes} 分 ${seconds} 秒`;
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return CSS.escape(String(value));
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  window.moxinQuiz = {
    initApp,
    loadQuestionBanks,
    renderQuestionBankList,
    loadQuestionBank,
    validateQuestionBank,
    validateQuestion,
    startPractice,
    startWrongBookPractice,
    createQuestionQueue,
    shuffleArray,
    renderQuestion,
    submitAnswer,
    getUserAnswer,
    checkAnswer,
    normalizeAnswer,
    showExplanation,
    markCorrectAnswer,
    markWrongAnswer,
    addWrongQuestionBackToQueue,
    updateWrongBook,
    removeFromWrongBook,
    nextQuestion,
    updateProgress,
    finishRound,
    saveProgress,
    loadProgress,
    clearProgress,
    saveToLocalStorage,
    loadFromLocalStorage,
    exportWrongBookToJSON,
    exportWrongBookToCSV,
    exportRoundRecordToJSON,
    exportRoundRecordToCSV,
    exportAllLocalData,
    importAllLocalData,
    importQuestionBank,
    deleteImportedQuestionBank
  };
})();

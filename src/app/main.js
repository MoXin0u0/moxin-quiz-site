import { openDatabase } from '../storage/db.js';
import {
  deleteBank,
  getAsset,
  getBank,
  getQuestionsByBank,
  listBanks,
} from '../storage/repositories/banks.js';
import { addAttempt } from '../storage/repositories/attempts.js';
import { getFavorite, setFavorite } from '../storage/repositories/learning.js';
import { recordQuestionResult } from '../storage/repositories/progress.js';
import { saveSession } from '../storage/repositories/sessions.js';
import {
  importInspectedPackage,
  inspectQuestionBankFile,
  inspectQuestionBankFolder,
} from '../question-bank/importer.js';
import { checkAnswer } from '../quiz/scoring.js';
import {
  advanceSession,
  createPracticeSession,
  getSessionStats,
  isSessionFinished,
  recordSessionAnswer,
} from '../quiz/session-engine.js';
import {
  filterQuestions,
  readBankFilters,
  renderBankDetail,
  renderFilteredQuestions,
} from '../ui/bank-detail.js';
import {
  collectUserAnswer,
  isAnswerEmpty,
  renderAnswerFeedback,
  renderPracticeFinished,
  renderPracticeQuestion,
  setFavoriteButton,
} from '../ui/practice.js';
import {
  renderBankLibrary,
  renderInspection,
  renderStorageStatus,
  showToast,
} from '../ui/library.js';

const state = {
  inspectedPackage: null,
  banks: [],
  currentBank: null,
  allQuestions: [],
  filteredQuestions: [],
  practice: null,
  practiceQuestionMap: new Map(),
  assetUrls: [],
};

const elements = {
  libraryView: document.querySelector('#libraryView'),
  bankDetailView: document.querySelector('#bankDetailView'),
  practiceView: document.querySelector('#practiceView'),
  bankDetailArea: document.querySelector('#bankDetailArea'),
  practiceArea: document.querySelector('#practiceArea'),
  bankFileInput: document.querySelector('#bankFileInput'),
  bankFolderInput: document.querySelector('#bankFolderInput'),
  inspectionArea: document.querySelector('#inspectionArea'),
  bankList: document.querySelector('#bankList'),
  storageStatus: document.querySelector('#storageStatus'),
  refreshBanksButton: document.querySelector('#refreshBanksButton'),
  toastRegion: document.querySelector('#toastRegion'),
};

bootstrap().catch(error => {
  console.error(error);
  renderStorageStatus(elements.storageStatus, {
    ok: false,
    message: `IndexedDB 初始化失敗：${error.message}`,
  });
  showToast(elements.toastRegion, '本機資料庫初始化失敗。', 'error');
});

async function bootstrap() {
  bindEvents();
  await openDatabase();
  renderStorageStatus(elements.storageStatus, {
    ok: true,
    message: 'IndexedDB 已就緒，資料只保存在這個瀏覽器。',
  });
  await refreshBanks();
  showView('library');
}

function bindEvents() {
  document.addEventListener('click', event => {
    if (event.target.closest('[data-nav-library]')) showView('library');
  });

  elements.bankFileInput.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    await inspectFile(file);
    event.target.value = '';
  });

  elements.bankFolderInput.addEventListener('change', async event => {
    const files = event.target.files;
    if (!files?.length) return;
    await inspectFolder(files);
    event.target.value = '';
  });

  elements.refreshBanksButton.addEventListener('click', refreshBanks);

  elements.inspectionArea.addEventListener('click', async event => {
    const importButton = event.target.closest('[data-import-inspected]');
    if (importButton) await importCurrentPackage();

    const dismissButton = event.target.closest('[data-dismiss-inspection]');
    if (dismissButton) {
      state.inspectedPackage = null;
      renderInspection(elements.inspectionArea, null);
    }
  });

  elements.bankList.addEventListener('click', async event => {
    const openButton = event.target.closest('[data-open-bank]');
    if (openButton) {
      await openBankDetail(openButton.dataset.openBank);
      return;
    }

    const deleteButton = event.target.closest('[data-delete-bank]');
    if (!deleteButton) return;
    const bankId = deleteButton.dataset.deleteBank;
    const bank = state.banks.find(item => item.id === bankId);
    const label = bank?.name || bankId;
    if (!confirm(`確定要從這個瀏覽器刪除題庫「${label}」？\n\n目前只會刪除題庫內容與題庫內圖片。`)) return;
    await deleteBank(bankId);
    showToast(elements.toastRegion, `已刪除題庫：${label}`, 'success');
    await refreshBanks();
  });

  elements.bankDetailArea.addEventListener('input', event => {
    if (event.target.closest('[data-filter-keyword]')) applyDetailFilters();
  });

  elements.bankDetailArea.addEventListener('change', event => {
    if (event.target.closest('[data-filter-type], [data-filter-difficulty], [data-filter-chapter]')) {
      applyDetailFilters();
    }
  });

  elements.bankDetailArea.addEventListener('click', async event => {
    if (event.target.closest('[data-back-library]')) {
      showView('library');
      return;
    }

    if (event.target.closest('[data-start-practice]')) {
      await startPractice(state.filteredQuestions);
    }
  });

  elements.practiceArea.addEventListener('click', async event => {
    if (event.target.closest('[data-exit-practice]')) {
      if (!confirm('確定結束目前這輪練習並回到題庫？')) return;
      await persistPracticeSession();
      await reopenCurrentBank();
      return;
    }

    if (event.target.closest('[data-submit-answer]')) {
      await submitPracticeAnswer();
      return;
    }

    if (event.target.closest('[data-next-question]')) {
      await showNextPracticeQuestion();
      return;
    }

    if (event.target.closest('[data-toggle-favorite]')) {
      await toggleCurrentFavorite();
      return;
    }

    if (event.target.closest('[data-restart-practice]')) {
      await startPractice(state.filteredQuestions.length ? state.filteredQuestions : state.allQuestions);
      return;
    }

    if (event.target.closest('[data-finish-to-bank]')) {
      await reopenCurrentBank();
      return;
    }

    if (event.target.closest('[data-finish-to-library]')) {
      showView('library');
    }
  });
}

async function inspectFile(file) {
  setBusy(true, `正在檢查 ${file.name}…`);
  try {
    const pkg = await inspectQuestionBankFile(file);
    state.inspectedPackage = pkg;
    renderInspection(elements.inspectionArea, pkg, {
      existingBankIds: new Set(state.banks.map(bank => bank.id)),
    });
  } catch (error) {
    state.inspectedPackage = null;
    renderInspection(elements.inspectionArea, {
      fatalError: error.message,
      source: { name: file.name, kind: 'file' },
    });
  } finally {
    setBusy(false);
  }
}

async function inspectFolder(files) {
  setBusy(true, '正在檢查題庫資料夾…');
  try {
    const pkg = await inspectQuestionBankFolder(files);
    state.inspectedPackage = pkg;
    renderInspection(elements.inspectionArea, pkg, {
      existingBankIds: new Set(state.banks.map(bank => bank.id)),
    });
  } catch (error) {
    state.inspectedPackage = null;
    renderInspection(elements.inspectionArea, {
      fatalError: error.message,
      source: { name: '題庫資料夾', kind: 'folder' },
    });
  } finally {
    setBusy(false);
  }
}

async function importCurrentPackage() {
  const pkg = state.inspectedPackage;
  if (!pkg?.report?.valid) return;

  const existing = state.banks.find(bank => bank.id === pkg.manifest.id);
  if (existing) {
    const confirmed = confirm(
      `題庫 ID「${pkg.manifest.id}」已存在。\n\n` +
      `目前版本：${existing.version || '未標示'}\n` +
      `匯入版本：${pkg.manifest.version || '未標示'}\n\n` +
      '繼續會更新題庫內容，但學習資料會保留。是否繼續？',
    );
    if (!confirmed) return;
  }

  setBusy(true, '正在寫入 IndexedDB…');
  try {
    await importInspectedPackage(pkg);
    showToast(
      elements.toastRegion,
      existing ? '題庫已更新，題目與圖片已重新寫入。' : '題庫已匯入本機資料庫。',
      'success',
    );
    state.inspectedPackage = null;
    renderInspection(elements.inspectionArea, null);
    await refreshBanks();
  } catch (error) {
    showToast(elements.toastRegion, `匯入失敗：${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function refreshBanks() {
  const banks = await listBanks();
  const withCounts = await Promise.all(banks.map(async bank => {
    if (Number.isInteger(bank.questionCount)) return bank;
    const questions = await getQuestionsByBank(bank.id);
    return { ...bank, questionCount: questions.length };
  }));
  state.banks = withCounts;
  renderBankLibrary(elements.bankList, withCounts);
}

async function openBankDetail(bankId) {
  revokeAssetUrls();
  const [bank, questions] = await Promise.all([
    getBank(bankId),
    getQuestionsByBank(bankId),
  ]);
  if (!bank) {
    showToast(elements.toastRegion, '找不到這個題庫。', 'error');
    await refreshBanks();
    showView('library');
    return;
  }

  state.currentBank = bank;
  state.allQuestions = questions;
  state.filteredQuestions = [...questions];
  renderBankDetail(elements.bankDetailArea, bank, questions);
  showView('bank-detail');
}

function applyDetailFilters() {
  const filters = readBankFilters(elements.bankDetailArea);
  state.filteredQuestions = filterQuestions(state.allQuestions, filters);
  renderFilteredQuestions(elements.bankDetailArea, state.filteredQuestions);
}

async function reopenCurrentBank() {
  const bankId = state.currentBank?.id;
  if (!bankId) {
    showView('library');
    return;
  }
  await openBankDetail(bankId);
}

async function startPractice(questions) {
  if (!state.currentBank || !questions?.length) return;

  revokeAssetUrls();
  state.practiceQuestionMap = new Map(questions.map(question => [question.id, question]));
  state.practice = createPracticeSession({
    bankId: state.currentBank.id,
    bankName: state.currentBank.name || state.currentBank.title || state.currentBank.id,
    questions,
    mode: 'filtered',
  });

  await persistPracticeSession();
  showView('practice');
  await showNextPracticeQuestion();
}

async function showNextPracticeQuestion() {
  if (!state.practice) return;

  if (isSessionFinished(state.practice)) {
    state.practice.finishedAt = new Date().toISOString();
    await persistPracticeSession();
    revokeAssetUrls();
    renderPracticeFinished(elements.practiceArea, {
      bank: state.currentBank,
      stats: getSessionStats(state.practice),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const questionId = advanceSession(state.practice);
  if (!questionId) {
    renderPracticeFinished(elements.practiceArea, {
      bank: state.currentBank,
      stats: getSessionStats(state.practice),
    });
    return;
  }

  const question = state.practiceQuestionMap.get(questionId);
  if (!question) {
    showToast(elements.toastRegion, `找不到題目：${questionId}`, 'error');
    await showNextPracticeQuestion();
    return;
  }

  revokeAssetUrls();
  renderPracticeQuestion(elements.practiceArea, {
    bank: state.currentBank,
    question,
    stats: getSessionStats(state.practice),
    errorCount: state.practice.errorsByQuestion[question.id] || 0,
  });

  const favorite = await getFavorite(state.currentBank.id, question.id);
  setFavoriteButton(elements.practiceArea, Boolean(favorite));
  await hydrateAssetImages(question.images || [], '[data-question-images]');
  await persistPracticeSession();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitPracticeAnswer() {
  const questionId = state.practice?.currentQuestionId;
  const question = state.practiceQuestionMap.get(questionId);
  if (!question || state.practice.answered) return;

  const userAnswer = collectUserAnswer(elements.practiceArea, question);
  if (isAnswerEmpty(userAnswer, question)) {
    showToast(elements.toastRegion, '請先作答再提交。', 'error');
    return;
  }

  const correct = checkAnswer(question, userAnswer);
  const responseTime = Number.isFinite(state.practice.questionStartedAt)
    ? Math.max(0, Date.now() - state.practice.questionStartedAt)
    : null;

  recordSessionAnswer(state.practice, question.id, correct);

  await Promise.all([
    addAttempt({
      bankId: state.currentBank.id,
      questionId: question.id,
      selectedAnswer: userAnswer,
      correct,
      responseTime,
      mode: state.practice.mode,
    }),
    recordQuestionResult(state.currentBank.id, question.id, correct),
    persistPracticeSession(),
  ]);

  renderAnswerFeedback(elements.practiceArea, {
    question,
    userAnswer,
    correct,
  });
  await hydrateAssetImages(question.explanationImages || [], '[data-explanation-images]');
}

async function toggleCurrentFavorite() {
  const questionId = state.practice?.currentQuestionId;
  if (!questionId || !state.currentBank) return;

  const button = elements.practiceArea.querySelector('[data-toggle-favorite]');
  const active = button?.dataset.favoriteActive === 'true';
  await setFavorite(state.currentBank.id, questionId, !active);
  setFavoriteButton(elements.practiceArea, !active);
  showToast(elements.toastRegion, !active ? '已加入收藏。' : '已取消收藏。', 'success');
}

async function persistPracticeSession() {
  if (!state.practice) return;
  const saved = await saveSession({
    ...state.practice,
    currentQuestionId: state.practice.currentQuestionId,
  });
  state.practice.id = saved.id;
  state.practice.createdAt = saved.createdAt;
  state.practice.updatedAt = saved.updatedAt;
}

async function hydrateAssetImages(paths, selector) {
  const container = elements.practiceArea.querySelector(selector);
  if (!container || !Array.isArray(paths) || paths.length === 0) return;

  for (const path of paths) {
    try {
      const asset = await getAsset(state.currentBank.id, path);
      if (!asset?.blob) {
        appendMissingAsset(container, path);
        continue;
      }

      const url = URL.createObjectURL(asset.blob);
      state.assetUrls.push(url);

      const figure = document.createElement('figure');
      figure.className = 'asset-figure';

      const image = document.createElement('img');
      image.src = url;
      image.alt = `題庫圖片：${path}`;
      image.loading = 'lazy';

      const caption = document.createElement('figcaption');
      caption.textContent = path;

      figure.append(image, caption);
      container.appendChild(figure);
    } catch {
      appendMissingAsset(container, path);
    }
  }
}

function appendMissingAsset(container, path) {
  const p = document.createElement('p');
  p.className = 'fatal-message';
  p.textContent = `圖片無法載入：${path}`;
  container.appendChild(p);
}

function revokeAssetUrls() {
  for (const url of state.assetUrls) URL.revokeObjectURL(url);
  state.assetUrls = [];
}

function showView(name) {
  const views = {
    library: elements.libraryView,
    'bank-detail': elements.bankDetailView,
    practice: elements.practiceView,
  };

  Object.entries(views).forEach(([key, node]) => {
    if (!node) return;
    node.hidden = key !== name;
  });

  document.querySelector('[data-nav-library]')?.classList.toggle('is-active', name === 'library');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setBusy(isBusy, message = '') {
  elements.bankFileInput.disabled = isBusy;
  elements.bankFolderInput.disabled = isBusy;
  elements.refreshBanksButton.disabled = isBusy;
  document.body.classList.toggle('is-busy', isBusy);
  if (isBusy && message) showToast(elements.toastRegion, message, 'info', { sticky: true });
  if (!isBusy) {
    elements.toastRegion.querySelectorAll('[data-sticky-toast]').forEach(node => node.remove());
  }
}

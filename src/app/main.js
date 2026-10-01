import { openDatabase } from '../storage/db.js';
import {
  deleteBank,
  getAsset,
  getBank,
  getBankPackage,
  getQuestionsByBank,
  listBanks,
} from '../storage/repositories/banks.js';
import {
  addAttempt,
  getAttemptsByBank,
} from '../storage/repositories/attempts.js';
import {
  getFavorite,
  getNote,
  getUnfamiliar,
  listFavorites,
  listNotes,
  listUnfamiliar,
  saveNote,
  setFavorite,
  setUnfamiliar,
} from '../storage/repositories/learning.js';
import {
  listQuestionProgress,
  recordQuestionResult,
} from '../storage/repositories/progress.js';
import {
  listDueReviews,
  listReviewSchedules,
  updateReviewScheduleFromResult,
} from '../storage/repositories/review.js';
import {
  getLatestUnfinishedExamForBank,
  getLatestUnfinishedSessionForBank,
  saveSession,
} from '../storage/repositories/sessions.js';
import {
  importAuthorPackage,
  importInspectedPackage,
  inspectQuestionBankFile,
  inspectQuestionBankFolder,
} from '../question-bank/importer.js';
import {
  compareVersions,
  inspectAuthorBank,
  loadAuthorCatalog,
} from '../question-bank/author-catalog.js';
import { downloadQuestionBankZip } from '../question-bank/zip-writer.js';
import {
  QUESTION_BANK_AI_PROMPT,
  renderQuestionBankTools,
} from '../ui/tools.js';
import { checkAnswer } from '../quiz/scoring.js';
import {
  advanceSession,
  createPracticeSession,
  getSessionStats,
  isSessionFinished,
  normalizeResumedSession,
  recordSessionAnswer,
} from '../quiz/session-engine.js';
import { summarizeMastery } from '../quiz/review-engine.js';
import {
  countAnswered,
  createExamSession,
  getRemainingSeconds,
  gradeExam,
  normalizeResumedExam,
  setExamAnswer,
} from '../quiz/exam-engine.js';
import {
  filterQuestions,
  readBankFilters,
  renderBankDetail,
  renderFilteredQuestions,
} from '../ui/bank-detail.js';
import {
  collectUserAnswer,
  getNoteValue,
  isAnswerEmpty,
  renderAnswerFeedback,
  renderPracticeFinished,
  renderPracticeQuestion,
  setFavoriteButton,
  setNoteValue,
  setUnfamiliarButton,
} from '../ui/practice.js';
import { renderReviewCenter } from '../ui/review-center.js';
import { renderLearningStats } from '../ui/stats.js';
import { renderExamCenter } from '../ui/exam-center.js';
import {
  collectExamAnswer,
  renderExamQuestion,
  renderExamResult,
  updateExamTimer,
} from '../ui/exam.js';
import {
  renderAuthorBankLibrary,
  renderAuthorCatalogError,
  renderBankLibrary,
  renderInspection,
  renderStorageStatus,
  showToast,
} from '../ui/library.js';

const state = {
  inspectedPackage: null,
  banks: [],
  authorCatalog: [],
  librarySourceTab: 'author',
  currentBank: null,
  allQuestions: [],
  filteredQuestions: [],
  learningFilter: 'all',
  learning: createEmptyLearningState(),
  resumeSession: null,
  practice: null,
  practiceQuestionMap: new Map(),
  assetUrls: [],
  reviewGroups: [],
  exam: null,
  examQuestionMap: new Map(),
  examTimerId: null,
  examSaveTimerId: null,
  examSubmitting: false,
};

const elements = {
  libraryView: document.querySelector('#libraryView'),
  reviewView: document.querySelector('#reviewView'),
  examCenterView: document.querySelector('#examCenterView'),
  examView: document.querySelector('#examView'),
  statsView: document.querySelector('#statsView'),
  toolsView: document.querySelector('#toolsView'),
  settingsView: document.querySelector('#settingsView'),
  bankDetailView: document.querySelector('#bankDetailView'),
  practiceView: document.querySelector('#practiceView'),
  reviewArea: document.querySelector('#reviewArea'),
  examCenterArea: document.querySelector('#examCenterArea'),
  examArea: document.querySelector('#examArea'),
  statsArea: document.querySelector('#statsArea'),
  toolsArea: document.querySelector('#toolsArea'),
  bankDetailArea: document.querySelector('#bankDetailArea'),
  practiceArea: document.querySelector('#practiceArea'),
  authorLibraryPanel: document.querySelector('#authorLibraryPanel'),
  userLibraryPanel: document.querySelector('#userLibraryPanel'),
  authorBankList: document.querySelector('#authorBankList'),
  refreshAuthorBanksButton: document.querySelector('#refreshAuthorBanksButton'),
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
  cleanupLegacyAnswerQuery();
  bindEvents();
  renderQuestionBankTools(elements.toolsArea);
  await openDatabase();
  renderStorageStatus(elements.storageStatus, {
    ok: true,
    message: 'IndexedDB 已就緒，資料只保存在這個瀏覽器。',
  });
  await refreshBanks();
  await refreshAuthorCatalog();
  setLibrarySourceTab(state.librarySourceTab);
  showView('library');
}

function bindEvents() {
  document.addEventListener('click', async event => {
    const sourceTab = event.target.closest('[data-library-source-tab]');
    if (sourceTab) {
      setLibrarySourceTab(sourceTab.dataset.librarySourceTab);
      return;
    }

    if (event.target.closest('[data-nav-library]')) {
      stopExamTimer();
      showView('library');
      return;
    }
    if (event.target.closest('[data-nav-review]')) {
      stopExamTimer();
      await openReviewCenter();
      return;
    }
    if (event.target.closest('[data-nav-exam]')) {
      await openExamCenter();
      return;
    }
    if (event.target.closest('[data-nav-stats]')) {
      stopExamTimer();
      await openStats();
      return;
    }
    if (event.target.closest('[data-nav-tools]')) {
      stopExamTimer();
      renderQuestionBankTools(elements.toolsArea);
      showView('tools');
    }
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
  elements.refreshAuthorBanksButton.addEventListener('click', refreshAuthorCatalog);

  elements.inspectionArea.addEventListener('click', async event => {
    const importButton = event.target.closest('[data-import-inspected]');
    if (importButton) await importCurrentPackage();

    const dismissButton = event.target.closest('[data-dismiss-inspection]');
    if (dismissButton) {
      state.inspectedPackage = null;
      renderInspection(elements.inspectionArea, null);
    }
  });

  elements.authorBankList.addEventListener('click', async event => {
    const openButton = event.target.closest('[data-open-bank]');
    if (openButton) {
      await openBankDetail(openButton.dataset.openBank);
      return;
    }

    const installButton = event.target.closest('[data-install-author-bank]');
    if (installButton) {
      await installAuthorBank(installButton.dataset.installAuthorBank);
      return;
    }

    const deleteButton = event.target.closest('[data-delete-author-bank]');
    if (!deleteButton) return;

    const bankId = deleteButton.dataset.deleteAuthorBank;
    const bank = state.banks.find(item => item.id === bankId);
    const label = bank?.name || bankId;
    if (!confirm(`確定要移除作者題庫「${label}」的本機版本？\n\n學習紀錄仍會保留。`)) return;
    await deleteBank(bankId);
    showToast(elements.toastRegion, `已移除作者題庫：${label}`, 'success');
    await refreshBanks();
    renderAuthorCatalog();
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

  elements.toolsArea.addEventListener('click', async event => {
    if (event.target.closest('[data-copy-ai-prompt]')) {
      try {
        await copyText(QUESTION_BANK_AI_PROMPT);
        showToast(elements.toastRegion, 'Schema v2 AI 題庫提示詞已複製。', 'success');
      } catch (error) {
        showToast(elements.toastRegion, `複製失敗：${error.message}`, 'error');
      }
      return;
    }

    if (event.target.closest('[data-download-ai-prompt]')) {
      downloadTextFile('moxin-quiz-schema-v2-ai-prompt.txt', QUESTION_BANK_AI_PROMPT);
      showToast(elements.toastRegion, '提示詞已下載。', 'success');
    }
  });

  elements.reviewArea.addEventListener('click', async event => {
    const button = event.target.closest('[data-review-bank][data-review-mode]');
    if (!button) return;
    await startDedicatedReview(button.dataset.reviewBank, button.dataset.reviewMode);
  });

  elements.examCenterArea.addEventListener('click', async event => {
    const resume = event.target.closest('[data-resume-exam]');
    if (resume) {
      await resumeExam(resume.dataset.resumeExam);
      return;
    }

    const start = event.target.closest('[data-start-exam]');
    if (!start) return;
    const bankId = start.dataset.startExam;
    const card = start.closest('[data-exam-bank-card]');
    const questionCount = Number(card?.querySelector('[data-exam-question-count]')?.value);
    const durationMinutes = Number(card?.querySelector('[data-exam-duration]')?.value);
    await startExam(bankId, questionCount, durationMinutes);
  });

  elements.examArea.addEventListener('input', event => {
    if (event.target.closest('input[name="exam-answer"]')) scheduleExamAnswerSave();
  });

  elements.examArea.addEventListener('change', event => {
    if (event.target.closest('input[name="exam-answer"]')) scheduleExamAnswerSave(0);
  });

  elements.examArea.addEventListener('submit', async event => {
    if (!event.target.closest('[data-exam-answer-form]')) return;
    event.preventDefault();
    await saveCurrentExamAnswer();
  });

  elements.examArea.addEventListener('click', async event => {
    const go = event.target.closest('[data-exam-go]');
    if (go) {
      await navigateExam(Number(go.dataset.examGo));
      return;
    }

    if (event.target.closest('[data-exam-prev]')) {
      await navigateExam((state.exam?.currentIndex || 0) - 1);
      return;
    }

    if (event.target.closest('[data-exam-next]')) {
      await navigateExam((state.exam?.currentIndex || 0) + 1);
      return;
    }

    if (event.target.closest('[data-submit-exam]')) {
      await submitExam({ auto: false });
      return;
    }

    if (event.target.closest('[data-exam-again]')) {
      await openExamCenter();
      return;
    }

    if (event.target.closest('[data-exam-result-center]')) {
      await openExamCenter();
      return;
    }

    if (event.target.closest('[data-exam-result-library]')) {
      showView('library');
    }
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

    if (event.target.closest('[data-export-bank]')) {
      await exportCurrentBank();
      return;
    }

    const learningButton = event.target.closest('[data-learning-filter]');
    if (learningButton) {
      state.learningFilter = learningButton.dataset.learningFilter || 'all';
      elements.bankDetailArea.querySelectorAll('[data-learning-filter]').forEach(button => {
        button.classList.toggle('is-active', button === learningButton);
      });
      applyDetailFilters();
      return;
    }

    if (event.target.closest('[data-resume-practice]')) {
      await resumePractice();
      return;
    }

    if (event.target.closest('[data-start-practice]')) {
      await startPractice(state.filteredQuestions);
    }
  });

  elements.practiceArea.addEventListener('submit', async event => {
    if (!event.target.closest('[data-answer-form]')) return;
    event.preventDefault();
    await submitPracticeAnswer();
  });

  elements.practiceArea.addEventListener('click', async event => {
    if (event.target.closest('[data-exit-practice]')) {
      if (!confirm('確定結束目前畫面並回到題庫？\n\n目前進度會保留，可稍後繼續。')) return;
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

    if (event.target.closest('[data-toggle-unfamiliar]')) {
      await toggleCurrentUnfamiliar();
      return;
    }

    if (event.target.closest('[data-save-note]')) {
      await saveCurrentNote();
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


function setLibrarySourceTab(tab) {
  const normalized = tab === 'user' ? 'user' : 'author';
  state.librarySourceTab = normalized;

  document.querySelectorAll('[data-library-source-tab]').forEach(button => {
    const active = button.dataset.librarySourceTab === normalized;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  if (elements.authorLibraryPanel) elements.authorLibraryPanel.hidden = normalized !== 'author';
  if (elements.userLibraryPanel) elements.userLibraryPanel.hidden = normalized !== 'user';
}

async function refreshAuthorCatalog() {
  try {
    state.authorCatalog = await loadAuthorCatalog();
    renderAuthorCatalog();
  } catch (error) {
    state.authorCatalog = [];
    renderAuthorCatalogError(elements.authorBankList, error.message);
  }
}

function renderAuthorCatalog() {
  renderAuthorBankLibrary(elements.authorBankList, state.authorCatalog, state.banks);
}

async function installAuthorBank(bankId) {
  const entry = state.authorCatalog.find(item => item.id === bankId);
  if (!entry) {
    showToast(elements.toastRegion, '找不到作者題庫清單項目。', 'error');
    return;
  }

  const existing = state.banks.find(bank => bank.id === bankId);
  if (existing) {
    const sourceLabel = existing.sourceType === 'author' ? '作者題庫' : '自行新增題庫';
    const versionLabel = existing.version || '未標示';
    const updateAvailable = existing.sourceType === 'author' &&
      compareVersions(entry.version, existing.version) > 0;

    const confirmed = confirm(
      `本機已有同 ID 題庫「${existing.name || bankId}」。\n\n` +
      `目前來源：${sourceLabel}\n` +
      `目前版本：${versionLabel}\n` +
      `作者版本：${entry.version}\n\n` +
      `${updateAvailable ? '將更新為作者提供的新版本。' : '將以作者提供版本重新寫入題庫內容。'}\n` +
      '學習紀錄會保留。是否繼續？',
    );
    if (!confirmed) return;
  }

  setBusy(true, `正在下載作者題庫：${entry.name}…`);
  try {
    const pkg = await inspectAuthorBank(entry);
    if (!pkg.report?.valid) {
      const errors = pkg.report?.summary?.errors ?? 0;
      throw new Error(`作者題庫驗證失敗，共 ${errors} 個錯誤。`);
    }

    await importAuthorPackage(pkg);
    showToast(
      elements.toastRegion,
      existing ? `作者題庫已更新：${entry.name}` : `已加入作者題庫：${entry.name}`,
      'success',
    );
    await refreshBanks();
    renderAuthorCatalog();
  } catch (error) {
    showToast(elements.toastRegion, `作者題庫加入失敗：${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
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
    setLibrarySourceTab('user');
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
  state.banks = withCounts.map(bank => ({
    ...bank,
    sourceType: bank.sourceType === 'author' ? 'author' : 'user',
  }));
  renderBankLibrary(
    elements.bankList,
    state.banks.filter(bank => bank.sourceType !== 'author'),
  );
  renderAuthorCatalog();
}

async function exportCurrentBank() {
  const bankId = state.currentBank?.id;
  if (!bankId) {
    showToast(elements.toastRegion, '目前沒有可匯出的題庫。', 'error');
    return;
  }

  showToast(elements.toastRegion, '正在建立題庫 ZIP…', 'info', { sticky: true });
  try {
    const pkg = await getBankPackage(bankId, { includeAssets: true });
    if (!pkg) throw new Error('找不到題庫資料。');
    const filename = await downloadQuestionBankZip(pkg);
    showToast(elements.toastRegion, `題庫已匯出：${filename}`, 'success');
  } catch (error) {
    console.error(error);
    showToast(elements.toastRegion, `題庫匯出失敗：${error.message}`, 'error');
  } finally {
    elements.toastRegion.querySelectorAll('[data-sticky-toast]').forEach(node => node.remove());
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch { /* fall through */ }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('瀏覽器拒絕複製到剪貼簿。');
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
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

async function openBankDetail(bankId) {
  revokeAssetUrls();

  const [bank, questions, progress, favorites, unfamiliar, notes, due, resumeSession] = await Promise.all([
    getBank(bankId),
    getQuestionsByBank(bankId),
    listQuestionProgress(bankId),
    listFavorites(bankId),
    listUnfamiliar(bankId),
    listNotes(bankId),
    listDueReviews(bankId),
    getLatestUnfinishedSessionForBank(bankId),
  ]);

  if (!bank) {
    showToast(elements.toastRegion, '找不到這個題庫。', 'error');
    await refreshBanks();
    showView('library');
    return;
  }

  state.currentBank = bank;
  state.allQuestions = questions;
  state.learningFilter = 'all';
  state.learning = buildLearningState(progress, favorites, unfamiliar, notes, due);
  state.resumeSession = resumeSession;
  state.filteredQuestions = [...questions];

  const resumeStats = resumeSession ? getSessionStats(resumeSession) : null;
  renderBankDetail(elements.bankDetailArea, bank, questions, {
    ...state.learning,
    activeFilter: state.learningFilter,
    resumeSession,
    summary: {
      due: state.learning.dueIds.size,
      wrong: state.learning.wrongIds.size,
      favorite: state.learning.favoriteIds.size,
      unfamiliar: state.learning.unfamiliarIds.size,
      note: state.learning.noteIds.size,
      resumeCompleted: resumeStats?.completed || 0,
      resumeTotal: resumeStats?.total || 0,
    },
  });
  showView('bank-detail');
}

function applyDetailFilters() {
  const filters = readBankFilters(elements.bankDetailArea);
  const learning = {
    ...state.learning,
    activeFilter: state.learningFilter,
  };
  state.filteredQuestions = filterQuestions(state.allQuestions, filters, learning);
  renderFilteredQuestions(elements.bankDetailArea, state.filteredQuestions, learning);
}

async function openReviewCenter() {
  await refreshBanks();
  const groups = await Promise.all(state.banks.map(async bank => {
    const [questions, progress, favorites, unfamiliar, due] = await Promise.all([
      getQuestionsByBank(bank.id),
      listQuestionProgress(bank.id),
      listFavorites(bank.id),
      listUnfamiliar(bank.id),
      listDueReviews(bank.id),
    ]);

    const validIds = new Set(questions.map(question => question.id));
    const wrongIds = new Set(
      progress
        .filter(item => item?.lastResult === 'wrong' && validIds.has(item.questionId))
        .map(item => item.questionId)
    );

    return {
      bank,
      questionCount: questions.length,
      counts: {
        due: due.filter(item => validIds.has(item.questionId)).length,
        wrong: wrongIds.size,
        favorite: favorites.filter(item => validIds.has(item.questionId)).length,
        unfamiliar: unfamiliar.filter(item => validIds.has(item.questionId)).length,
      },
    };
  }));

  state.reviewGroups = groups;
  renderReviewCenter(elements.reviewArea, groups);
  showView('review');
}

async function startDedicatedReview(bankId, mode) {
  const [bank, questions, progress, favorites, unfamiliar, due] = await Promise.all([
    getBank(bankId),
    getQuestionsByBank(bankId),
    listQuestionProgress(bankId),
    listFavorites(bankId),
    listUnfamiliar(bankId),
    listDueReviews(bankId),
  ]);

  if (!bank) return;

  let ids = new Set();
  if (mode === 'due') ids = new Set(due.map(item => item.questionId));
  if (mode === 'wrong') ids = new Set(progress.filter(item => item.lastResult === 'wrong').map(item => item.questionId));
  if (mode === 'favorite') ids = new Set(favorites.map(item => item.questionId));
  if (mode === 'unfamiliar') ids = new Set(unfamiliar.map(item => item.questionId));

  const selected = questions.filter(question => ids.has(question.id));
  if (!selected.length) {
    showToast(elements.toastRegion, '目前沒有符合這個複習條件的題目。', 'info');
    await openReviewCenter();
    return;
  }

  state.currentBank = bank;
  state.allQuestions = questions;
  state.filteredQuestions = selected;
  state.learningFilter = mode;
  state.learning = createEmptyLearningState();
  await startPractice(selected, mode);
}

async function openStats() {
  await refreshBanks();

  const bankStats = await Promise.all(state.banks.map(async bank => {
    const [questions, attempts, progress, due, schedules] = await Promise.all([
      getQuestionsByBank(bank.id),
      getAttemptsByBank(bank.id),
      listQuestionProgress(bank.id),
      listDueReviews(bank.id),
      listReviewSchedules(bank.id),
    ]);

    const correct = attempts.filter(item => item.correct).length;
    const accuracy = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;
    const answered = new Set(attempts.map(item => item.questionId)).size;
    const wrong = progress.filter(item => item.lastResult === 'wrong').length;

    return {
      bank,
      questionCount: questions.length,
      attempts: attempts.length,
      correct,
      accuracy,
      answered,
      wrong,
      due: due.length,
      mastery: summarizeMastery(questions.map(question => question.id), schedules),
    };
  }));

  const totalAttempts = bankStats.reduce((sum, item) => sum + item.attempts, 0);
  const totalCorrect = bankStats.reduce((sum, item) => sum + item.correct, 0);

  renderLearningStats(elements.statsArea, {
    overall: {
      attempts: totalAttempts,
      accuracy: totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
      answeredQuestions: bankStats.reduce((sum, item) => sum + item.answered, 0),
      due: bankStats.reduce((sum, item) => sum + item.due, 0),
    },
    banks: bankStats,
  });
  showView('stats');
}

async function openExamCenter() {
  stopExamTimer();
  await refreshBanks();

  const groups = await Promise.all(state.banks.map(async bank => {
    const [questions, resumeExam] = await Promise.all([
      getQuestionsByBank(bank.id),
      getLatestUnfinishedExamForBank(bank.id),
    ]);

    return {
      bank,
      questionCount: questions.length,
      resumeExam,
    };
  }));

  renderExamCenter(elements.examCenterArea, groups);
  showView('exam-center');
}

async function startExam(bankId, questionCount, durationMinutes) {
  const [bank, questions] = await Promise.all([
    getBank(bankId),
    getQuestionsByBank(bankId),
  ]);

  if (!bank || !questions.length) {
    showToast(elements.toastRegion, '這個題庫沒有可用題目。', 'error');
    return;
  }

  const normalizedCount = Math.max(1, Math.min(Number(questionCount) || 20, questions.length, 100));
  const normalizedDuration = Math.max(1, Math.min(Number(durationMinutes) || 30, 240));

  const confirmed = confirm(
    `開始模擬考？\n\n題庫：${bank.name || bank.id}\n題數：${normalizedCount}\n時間：${normalizedDuration} 分鐘\n\n開始後會立即倒數。`,
  );
  if (!confirmed) return;

  state.currentBank = bank;
  state.allQuestions = questions;
  state.examQuestionMap = new Map(questions.map(question => [question.id, question]));
  state.exam = createExamSession({
    bankId,
    bankName: bank.name || bank.title || bank.id,
    questions,
    questionCount: normalizedCount,
    durationMinutes: normalizedDuration,
  });

  await persistExamSession();
  showView('exam');
  await renderCurrentExamQuestion();
  startExamTimer();
}

async function resumeExam(bankId) {
  const [bank, questions, resume] = await Promise.all([
    getBank(bankId),
    getQuestionsByBank(bankId),
    getLatestUnfinishedExamForBank(bankId),
  ]);

  if (!bank || !resume) {
    showToast(elements.toastRegion, '找不到可恢復的模擬考。', 'error');
    await openExamCenter();
    return;
  }

  state.currentBank = bank;
  state.allQuestions = questions;
  state.examQuestionMap = new Map(questions.map(question => [question.id, question]));
  state.exam = normalizeResumedExam(resume, questions.map(question => question.id));

  if (!state.exam.questionIds.length) {
    showToast(elements.toastRegion, '這份模擬考的題目已不存在，無法恢復。', 'error');
    await openExamCenter();
    return;
  }

  showView('exam');

  if (state.exam.expired) {
    await submitExam({ auto: true });
    return;
  }

  await renderCurrentExamQuestion();
  startExamTimer();
}

async function renderCurrentExamQuestion() {
  if (!state.exam) return;

  const index = Math.max(0, Math.min(state.exam.currentIndex, state.exam.questionIds.length - 1));
  state.exam.currentIndex = index;
  const questionId = state.exam.questionIds[index];
  const question = state.examQuestionMap.get(questionId);

  if (!question) {
    showToast(elements.toastRegion, `找不到考題：${questionId}`, 'error');
    return;
  }

  revokeAssetUrls();
  renderExamQuestion(elements.examArea, {
    bank: state.currentBank,
    session: state.exam,
    question,
    index,
  });

  await hydrateExamImages(question.images || []);
  updateExamTimer(elements.examArea, getRemainingSeconds(state.exam));
  await persistExamSession();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function navigateExam(targetIndex) {
  if (!state.exam || state.examSubmitting) return;
  await saveCurrentExamAnswer();
  const next = Math.max(0, Math.min(targetIndex, state.exam.questionIds.length - 1));
  state.exam.currentIndex = next;
  await renderCurrentExamQuestion();
}

function scheduleExamAnswerSave(delay = 350) {
  if (!state.exam || state.examSubmitting) return;
  if (state.examSaveTimerId) window.clearTimeout(state.examSaveTimerId);
  state.examSaveTimerId = window.setTimeout(async () => {
    state.examSaveTimerId = null;
    await saveCurrentExamAnswer();
  }, delay);
}

async function saveCurrentExamAnswer() {
  if (!state.exam || state.examSubmitting) return;
  const questionId = state.exam.questionIds[state.exam.currentIndex];
  const question = state.examQuestionMap.get(questionId);
  if (!question) return;

  const answer = collectExamAnswer(elements.examArea, question);
  setExamAnswer(state.exam, questionId, answer);
  await persistExamSession();
}

function startExamTimer() {
  stopExamTimer();
  tickExamTimer();
  state.examTimerId = window.setInterval(tickExamTimer, 1000);
}

function stopExamTimer() {
  if (state.examTimerId) {
    window.clearInterval(state.examTimerId);
    state.examTimerId = null;
  }
  if (state.examSaveTimerId) {
    window.clearTimeout(state.examSaveTimerId);
    state.examSaveTimerId = null;
  }
}

async function tickExamTimer() {
  if (!state.exam || state.examSubmitting) return;
  const remaining = getRemainingSeconds(state.exam);
  updateExamTimer(elements.examArea, remaining);
  if (remaining <= 0) {
    stopExamTimer();
    await submitExam({ auto: true });
  }
}

async function submitExam({ auto = false } = {}) {
  if (!state.exam || state.examSubmitting) return;

  await saveCurrentExamAnswer();
  const unanswered = state.exam.questionIds.length - countAnswered(state.exam);

  if (!auto) {
    const confirmed = confirm(
      `確定交卷？\n\n已作答：${countAnswered(state.exam)} / ${state.exam.questionIds.length}\n未作答：${unanswered}\n\n交卷後不能再修改答案。`,
    );
    if (!confirmed) return;
  }

  state.examSubmitting = true;
  stopExamTimer();

  try {
    const result = gradeExam(state.exam, state.examQuestionMap);
    const submittedAt = new Date().toISOString();

    for (const detail of result.details) {
      await Promise.all([
        addAttempt({
          bankId: state.currentBank.id,
          questionId: detail.questionId,
          selectedAnswer: detail.userAnswer,
          correct: detail.correct,
          responseTime: null,
          mode: 'exam',
        }),
        recordQuestionResult(state.currentBank.id, detail.questionId, detail.correct),
        updateReviewScheduleFromResult(state.currentBank.id, detail.questionId, detail.correct),
      ]);
    }

    state.exam.submittedAt = submittedAt;
    state.exam.finishedAt = submittedAt;
    state.exam.result = {
      total: result.total,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      unansweredCount: result.unansweredCount,
      score: result.score,
    };
    await persistExamSession();

    revokeAssetUrls();
    renderExamResult(elements.examArea, {
      bank: state.currentBank,
      result,
      questionMap: state.examQuestionMap,
      session: state.exam,
    });

    if (auto) {
      showToast(elements.toastRegion, '作答時間已到，系統已自動交卷。', 'info');
    }
  } catch (error) {
    console.error(error);
    showToast(elements.toastRegion, `交卷失敗：${error.message}`, 'error');
    startExamTimer();
  } finally {
    state.examSubmitting = false;
  }
}

async function persistExamSession() {
  if (!state.exam) return;
  const saved = await saveSession(state.exam);
  state.exam.id = saved.id;
  state.exam.createdAt = saved.createdAt;
  state.exam.updatedAt = saved.updatedAt;
}

async function hydrateExamImages(paths) {
  const container = elements.examArea.querySelector('[data-exam-question-images]');
  if (!container || !Array.isArray(paths) || !paths.length) return;

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
      image.alt = `考題圖片：${path}`;
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

async function reopenCurrentBank() {
  const bankId = state.currentBank?.id;
  if (!bankId) {
    showView('library');
    return;
  }
  await openBankDetail(bankId);
}

async function startPractice(questions, modeOverride = null) {
  if (!state.currentBank || !questions?.length) return;

  revokeAssetUrls();
  state.practiceQuestionMap = new Map(questions.map(question => [question.id, question]));
  state.practice = createPracticeSession({
    bankId: state.currentBank.id,
    bankName: state.currentBank.name || state.currentBank.title || state.currentBank.id,
    questions,
    mode: modeOverride || (state.learningFilter === 'all' ? 'filtered' : state.learningFilter),
  });

  await persistPracticeSession();
  showView('practice');
  await showNextPracticeQuestion();
}

async function resumePractice() {
  if (!state.resumeSession || !state.currentBank) return;

  const validQuestionIds = state.allQuestions.map(question => question.id);
  state.practice = normalizeResumedSession(state.resumeSession, validQuestionIds);

  const sourceSet = new Set(state.practice.sourceQuestionIds);
  const practiceQuestions = state.allQuestions.filter(question => sourceSet.has(question.id));
  state.practiceQuestionMap = new Map(practiceQuestions.map(question => [question.id, question]));

  if (!practiceQuestions.length) {
    showToast(elements.toastRegion, '這個未完成 Session 的題目已不存在，無法恢復。', 'error');
    return;
  }

  showView('practice');

  if (state.practice.currentQuestionId && !state.practice.answered) {
    await renderCurrentPracticeQuestion();
  } else {
    await showNextPracticeQuestion();
  }
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

  await renderCurrentPracticeQuestion();
}

async function renderCurrentPracticeQuestion() {
  const questionId = state.practice?.currentQuestionId;
  const question = state.practiceQuestionMap.get(questionId);
  if (!question) {
    showToast(elements.toastRegion, `找不到題目：${questionId}`, 'error');
    state.practice.currentQuestionId = null;
    await showNextPracticeQuestion();
    return;
  }

  state.practice.questionStartedAt = Date.now();
  revokeAssetUrls();

  renderPracticeQuestion(elements.practiceArea, {
    bank: state.currentBank,
    question,
    stats: getSessionStats(state.practice),
    errorCount: state.practice.errorsByQuestion[question.id] || 0,
  });

  const [favorite, unfamiliar, note] = await Promise.all([
    getFavorite(state.currentBank.id, question.id),
    getUnfamiliar(state.currentBank.id, question.id),
    getNote(state.currentBank.id, question.id),
  ]);

  setFavoriteButton(elements.practiceArea, Boolean(favorite));
  setUnfamiliarButton(elements.practiceArea, Boolean(unfamiliar));
  setNoteValue(elements.practiceArea, note);

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
    updateReviewScheduleFromResult(state.currentBank.id, question.id, correct),
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

async function toggleCurrentUnfamiliar() {
  const questionId = state.practice?.currentQuestionId;
  if (!questionId || !state.currentBank) return;

  const button = elements.practiceArea.querySelector('[data-toggle-unfamiliar]');
  const active = button?.dataset.unfamiliarActive === 'true';
  await setUnfamiliar(state.currentBank.id, questionId, !active);
  setUnfamiliarButton(elements.practiceArea, !active);
  showToast(elements.toastRegion, !active ? '已標記為不熟題。' : '已取消不熟標記。', 'success');
}

async function saveCurrentNote() {
  const questionId = state.practice?.currentQuestionId;
  if (!questionId || !state.currentBank) return;

  const text = getNoteValue(elements.practiceArea);
  await saveNote(state.currentBank.id, questionId, text);
  showToast(
    elements.toastRegion,
    text.trim() ? '筆記已儲存。' : '空白筆記已移除。',
    'success',
  );
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

function buildLearningState(progress, favorites, unfamiliar, notes, due = []) {
  const progressByQuestion = new Map((progress || []).map(item => [item.questionId, item]));
  return {
    progressByQuestion,
    dueIds: new Set((due || []).map(item => item.questionId)),
    wrongIds: new Set(
      [...progressByQuestion.values()]
        .filter(item => item?.lastResult === 'wrong')
        .map(item => item.questionId)
    ),
    favoriteIds: new Set((favorites || []).map(item => item.questionId)),
    unfamiliarIds: new Set((unfamiliar || []).map(item => item.questionId)),
    noteIds: new Set((notes || []).filter(item => String(item.text || '').trim()).map(item => item.questionId)),
  };
}

function createEmptyLearningState() {
  return {
    progressByQuestion: new Map(),
    dueIds: new Set(),
    wrongIds: new Set(),
    favoriteIds: new Set(),
    unfamiliarIds: new Set(),
    noteIds: new Set(),
  };
}

function showView(name) {
  const views = {
    library: elements.libraryView,
    review: elements.reviewView,
    'exam-center': elements.examCenterView,
    exam: elements.examView,
    stats: elements.statsView,
    tools: elements.toolsView,
    settings: elements.settingsView,
    'bank-detail': elements.bankDetailView,
    practice: elements.practiceView,
  };

  Object.entries(views).forEach(([key, node]) => {
    if (!node) return;
    node.hidden = key !== name;
  });

  document.querySelector('[data-nav-library]')?.classList.toggle('is-active', name === 'library');
  document.querySelector('[data-nav-review]')?.classList.toggle('is-active', name === 'review');
  document.querySelector('[data-nav-exam]')?.classList.toggle('is-active', name === 'exam-center' || name === 'exam');
  document.querySelector('[data-nav-stats]')?.classList.toggle('is-active', name === 'stats');
  document.querySelector('[data-nav-tools]')?.classList.toggle('is-active', name === 'tools');
  document.querySelector('[data-nav-settings]')?.classList.toggle('is-active', name === 'settings');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cleanupLegacyAnswerQuery() {
  const url = new URL(window.location.href);
  let changed = false;

  for (const key of ['answer', 'exam-answer']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  if (!changed) return;

  const query = url.searchParams.toString();
  const cleanUrl = `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
  window.history.replaceState(window.history.state, '', cleanUrl);
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

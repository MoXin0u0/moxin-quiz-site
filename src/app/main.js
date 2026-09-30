import { openDatabase } from '../storage/db.js';
import {
  deleteBank,
  getQuestionsByBank,
  listBanks,
} from '../storage/repositories/banks.js';
import {
  importInspectedPackage,
  inspectQuestionBankFile,
  inspectQuestionBankFolder,
} from '../question-bank/importer.js';
import {
  renderBankLibrary,
  renderInspection,
  renderStorageStatus,
  showToast,
} from '../ui/library.js';

const state = {
  inspectedPackage: null,
  banks: [],
};

const elements = {
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
}

function bindEvents() {
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
});

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

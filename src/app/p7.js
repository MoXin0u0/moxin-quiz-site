import {
  backupSnapshotToBlob,
  createBackupFilename,
  createBackupSnapshot,
  readBackupFile,
  restoreBackupSnapshot,
  summarizeSnapshot,
} from '../storage/backup.js';
import {
  loadSettings,
  resetSettings,
  saveSettings,
} from '../storage/settings.js';
import {
  getStorageSummary,
  runPreflightChecks,
} from './preflight.js';
import {
  readSettingsForm,
  renderSettings,
} from '../ui/settings.js';
import { showToast } from '../ui/library.js';

const settingsView = document.querySelector('#settingsView');
const settingsArea = document.querySelector('#settingsArea');
const toastRegion = document.querySelector('#toastRegion');

let installPrompt = null;
let pwaRegistration = null;
let mediaQuery = null;

initP7().catch(error => {
  console.error('P7 initialization failed.', error);
});

async function initP7() {
  applySettings(loadSettings());
  bindThemeListener();
  bindNavigation();
  bindSettingsActions();
  bindInstallPrompt();
  await registerPwa();
}

function bindNavigation() {
  document.addEventListener('click', async event => {
    if (event.target.closest('[data-nav-settings]')) {
      const examVisible = document.querySelector('#examView:not([hidden])');
      if (examVisible) {
        showToast(toastRegion, '模擬考進行中，請先交卷再開啟設定。', 'error');
        return;
      }
      await openSettings();
      return;
    }

    if (event.target.closest('[data-nav-library], [data-nav-review], [data-nav-exam], [data-nav-stats], [data-nav-tools]')) {
      if (settingsView) settingsView.hidden = true;
    }
  });
}

function bindSettingsActions() {
  if (!settingsArea) return;

  settingsArea.addEventListener('change', async event => {
    if (event.target.closest(
      '[data-setting-theme], [data-setting-font-scale], [data-setting-option-spacing], ' +
      '[data-setting-reduce-motion], [data-setting-learning-style], ' +
      '[data-setting-scene-intensity], [data-setting-studio-type-switch-confirm]'
    )) {
      const settings = saveSettings(readSettingsForm(settingsArea));
      applySettings(settings);
      showToast(toastRegion, '設定已儲存。', 'success');
    }

    const fileInput = event.target.closest('[data-import-backup]');
    if (fileInput) {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (file) await restoreFromFile(file);
    }
  });

  settingsArea.addEventListener('click', async event => {
    if (event.target.closest('[data-reset-settings]')) {
      const settings = resetSettings();
      applySettings(settings);
      await openSettings();
      showToast(toastRegion, '偏好設定已重設。', 'success');
      return;
    }

    if (event.target.closest('[data-export-backup]')) {
      await exportBackup();
      return;
    }

    if (event.target.closest('[data-install-pwa]')) {
      await installPwa();
      return;
    }

    if (event.target.closest('[data-refresh-pwa]')) {
      await refreshPwaCache();
      return;
    }

    if (event.target.closest('[data-rerun-preflight]')) {
      await openSettings();
    }
  });
}

async function openSettings() {
  const [storage, checks] = await Promise.all([
    getStorageSummary(),
    runPreflightChecks(),
  ]);

  const settings = loadSettings();
  renderSettings(settingsArea, {
    settings,
    storage,
    checks,
    pwa: getPwaState(),
  });

  document.querySelectorAll('[data-view]').forEach(node => {
    node.hidden = node !== settingsView;
  });

  document.querySelectorAll('.main-nav .nav-item').forEach(button => {
    button.classList.toggle('is-active', button.hasAttribute('data-nav-settings'));
  });

  window.scrollTo({
    top: 0,
    behavior: settings.reduceMotion ? 'auto' : 'smooth',
  });
}

function applySettings(settings) {
  const root = document.documentElement;
  const effectiveTheme = settings.theme === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : settings.theme;

  root.dataset.themePreference = settings.theme;
  root.dataset.theme = effectiveTheme;
  root.dataset.fontScale = settings.fontScale;
  root.dataset.optionSpacing = settings.optionSpacing;
  root.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false';
  root.dataset.learningStyle = settings.learningStyle;
  root.dataset.sceneIntensity = settings.sceneIntensity;

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.content = effectiveTheme === 'dark' ? '#111827' : '#3559d9';
  }
}

function bindThemeListener() {
  mediaQuery = matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    const settings = loadSettings();
    if (settings.theme === 'system') applySettings(settings);
  };

  if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', handler);
  else if (mediaQuery.addListener) mediaQuery.addListener(handler);
}

async function exportBackup() {
  setSettingsBusy(true);
  try {
    showToast(toastRegion, '正在建立完整備份；圖片較多時可能需要一些時間。', 'info', { sticky: true });
    const snapshot = await createBackupSnapshot();
    const blob = await backupSnapshotToBlob(snapshot);
    downloadBlob(blob, createBackupFilename());

    const summary = summarizeSnapshot(snapshot);
    showToast(toastRegion, `備份完成，共 ${summary.totalRecords} 筆本機資料。`, 'success');
  } catch (error) {
    console.error(error);
    showToast(toastRegion, `備份失敗：${error.message}`, 'error');
  } finally {
    removeStickyToasts();
    setSettingsBusy(false);
  }
}

async function restoreFromFile(file) {
  setSettingsBusy(true);
  try {
    showToast(toastRegion, '正在檢查備份檔…', 'info', { sticky: true });
    const snapshot = await readBackupFile(file);
    const summary = summarizeSnapshot(snapshot);

    const confirmed = confirm(
      `確定從這份備份還原？\n\n` +
      `匯出時間：${snapshot.exportedAt || '未提供'}\n` +
      `資料筆數：約 ${summary.totalRecords}\n\n` +
      '目前瀏覽器中的 v3 題庫與學習資料將被完整取代。建議先下載目前備份。',
    );
    if (!confirmed) return;

    await restoreBackupSnapshot(snapshot, { replace: true });
    alert('還原完成。頁面將重新載入，讓所有資料與設定重新初始化。');
    location.reload();
  } catch (error) {
    console.error(error);
    showToast(toastRegion, `還原失敗：${error.message}`, 'error');
  } finally {
    removeStickyToasts();
    setSettingsBusy(false);
  }
}

async function registerPwa() {
  if (!('serviceWorker' in navigator) || !globalThis.isSecureContext) return;

  try {
    pwaRegistration = await navigator.serviceWorker.register('./service-worker.js', {
      scope: './',
    });

    pwaRegistration.addEventListener('updatefound', () => {
      const worker = pwaRegistration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast(toastRegion, '新版離線資源已下載，重新整理後生效。', 'info');
        }
      });
    });
  } catch (error) {
    console.warn('Service Worker registration failed.', error);
  }
}

function bindInstallPrompt() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (!settingsView?.hidden) openSettings();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    showToast(toastRegion, '墨忻刷題網已安裝。', 'success');
    if (!settingsView?.hidden) openSettings();
  });
}

async function installPwa() {
  if (!installPrompt) {
    showToast(toastRegion, '目前瀏覽器沒有提供可用的安裝提示。', 'info');
    return;
  }

  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  await openSettings();
}

async function refreshPwaCache() {
  if (!('serviceWorker' in navigator)) {
    showToast(toastRegion, '此瀏覽器不支援 Service Worker。', 'error');
    return;
  }

  try {
    const registration = pwaRegistration || await navigator.serviceWorker.getRegistration('./');
    if (!registration) {
      await registerPwa();
      showToast(toastRegion, '已嘗試建立離線快取。', 'success');
      return;
    }

    await registration.update();
    showToast(toastRegion, '已檢查最新離線資源。', 'success');
    await openSettings();
  } catch (error) {
    showToast(toastRegion, `更新離線快取失敗：${error.message}`, 'error');
  }
}

function getPwaState() {
  const installed = matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;

  return {
    registered: Boolean(pwaRegistration?.active || navigator.serviceWorker?.controller),
    installable: Boolean(installPrompt) && !installed,
    installed,
    detail: installed
      ? '目前正以已安裝 App 模式執行。'
      : pwaRegistration
        ? 'Service Worker 已建立；第一次載入後即可離線開啟 App Shell。'
        : '需要 HTTPS 且瀏覽器支援 Service Worker。',
  };
}

function setSettingsBusy(busy) {
  settingsArea?.querySelectorAll('button, input, select').forEach(control => {
    control.disabled = busy;
  });
}

function removeStickyToasts() {
  toastRegion?.querySelectorAll('[data-sticky-toast]').forEach(node => node.remove());
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


import { APP_CONFIG } from './config.js';
import {
  getSyncCenterSnapshot,
  getSyncStatusSnapshot,
} from '../ui/sync-status.js';
import {
  renameDeviceProfile,
  revokeRemoteDeviceProfile,
} from '../storage/repositories/devices.js';
import { unlinkCurrentCloudProfile } from '../sync/account-lifecycle.js';
import {
  showConfirmDialog,
  showMessageDialog,
  showPromptDialog,
} from '../ui/dialogs.js';
import {
  renderSyncCenter,
  renderSyncStatusButton,
} from '../ui/sync-center.js';
import { showToast } from '../ui/library.js';

const statusHost = document.querySelector('#syncStatusHost');
const centerHost = document.querySelector('#syncCenterHost');
const moreHost = document.querySelector('#mobileMoreMenuHost');
const toastRegion = document.querySelector('#toastRegion');

let centerPreviousFocus = null;
let moreOpen = false;
let statusTimer = null;

initSyncUi().catch(error => {
  console.error('V5 sync UI initialization failed.', error);
});

async function initSyncUi() {
  if (!APP_CONFIG.features.syncUi) {
    if (statusHost) statusHost.hidden = true;
    return;
  }

  bindGlobalActions();
  await refreshSyncStatus();

  window.addEventListener('online', refreshSyncStatus);
  window.addEventListener('offline', refreshSyncStatus);
  window.addEventListener('moxin:v5-sync-refresh', refreshSyncStatus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshSyncStatus();
  });

  statusTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') refreshSyncStatus();
  }, 15000);

  window.addEventListener('beforeunload', () => {
    if (statusTimer) window.clearInterval(statusTimer);
  }, { once: true });
}

async function refreshSyncStatus() {
  if (!APP_CONFIG.features.syncUi) return null;
  const snapshot = await getSyncStatusSnapshot();
  renderSyncStatusButton(statusHost, snapshot);

  if (centerHost && !centerHost.hidden) {
    const detailed = await getSyncCenterSnapshot();
    renderSyncCenter(centerHost, detailed);
  }

  return snapshot;
}

function bindGlobalActions() {
  document.addEventListener('click', async event => {
    const moreButton = event.target.closest('[data-nav-more]');
    if (moreButton) {
      event.preventDefault();
      toggleMoreMenu();
      return;
    }

    const moreTools = event.target.closest('[data-more-tools]');
    if (moreTools) {
      closeMoreMenu();
      markMoreNavActive(true);
      document.querySelector('[data-nav-tools]')?.click();
      return;
    }

    const moreSettings = event.target.closest('[data-more-settings]');
    if (moreSettings) {
      closeMoreMenu();
      markMoreNavActive(true);
      document.querySelector('[data-nav-settings]')?.click();
      return;
    }

    const moreSync = event.target.closest('[data-more-sync]');
    if (moreSync) {
      const moreNavButton = document.querySelector('[data-nav-more]');
      closeMoreMenu();
      await openSyncCenter(moreNavButton);
      return;
    }

    const moreBackup = event.target.closest('[data-more-backup]');
    if (moreBackup) {
      closeMoreMenu();
      closeSyncCenter();
      markMoreNavActive(true);
      document.querySelector('[data-nav-settings]')?.click();
      window.setTimeout(() => {
        document.querySelector('[data-backup-card]')?.scrollIntoView({
          behavior: document.documentElement.dataset.reduceMotion === 'true'
            ? 'auto'
            : 'smooth',
          block: 'start',
        });
      }, 50);
      return;
    }

    const openCenter = event.target.closest('[data-open-sync-center]');
    if (openCenter) {
      event.preventDefault();
      await openSyncCenter(openCenter);
      return;
    }

    if (event.target.closest('[data-close-sync-center]')) {
      event.preventDefault();
      closeSyncCenter();
      return;
    }

    const renameButton = event.target.closest('[data-rename-device]');
    if (renameButton) {
      event.preventDefault();
      await renameDevice(renameButton.dataset.renameDevice);
      return;
    }

    const revokeButton = event.target.closest('[data-revoke-device]');
    if (revokeButton) {
      event.preventDefault();
      await revokeDevice(revokeButton.dataset.revokeDevice);
      return;
    }

    if (event.target.closest('[data-unlink-cloud]')) {
      event.preventDefault();
      await unlinkCloud();
      return;
    }

    if (
      event.target.closest('[data-connect-cloud]') ||
      event.target.closest('[data-sync-now]')
    ) {
      event.preventDefault();
      await showCloudRuntimeUnavailable();
      return;
    }

    if (
      event.target.closest(
        '[data-nav-library], [data-nav-review], [data-nav-exam], [data-nav-stats]',
      )
    ) {
      closeMoreMenu();
      markMoreNavActive(false);
    }

    if (
      moreOpen &&
      !event.target.closest('#mobileMoreMenuHost') &&
      !event.target.closest('[data-nav-more]')
    ) {
      closeMoreMenu();
    }
  });

  document.addEventListener('keydown', event => {
    if (centerHost && !centerHost.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSyncCenter();
        return;
      }
      if (event.key === 'Tab') {
        trapFocus(event, centerHost.querySelector('[data-sync-center-panel]'));
        return;
      }
    }

    if (event.key === 'Escape' && moreOpen) {
      event.preventDefault();
      closeMoreMenu();
      document.querySelector('[data-nav-more]')?.focus();
    }
  });
}

async function openSyncCenter(opener = null) {
  if (!centerHost) return;

  centerPreviousFocus = opener instanceof HTMLElement
    ? opener
    : document.activeElement;

  const snapshot = await getSyncCenterSnapshot();
  renderSyncCenter(centerHost, snapshot);
  centerHost.hidden = false;
  document.body.classList.add('sync-center-open');

  queueMicrotask(() => {
    centerHost.querySelector('[data-sync-center-panel]')?.focus({
      preventScroll: true,
    });
  });
}

function closeSyncCenter() {
  if (!centerHost || centerHost.hidden) return;
  centerHost.hidden = true;
  centerHost.innerHTML = '';
  document.body.classList.remove('sync-center-open');

  if (
    centerPreviousFocus instanceof HTMLElement &&
    centerPreviousFocus.isConnected
  ) {
    centerPreviousFocus.focus({ preventScroll: true });
  }
  centerPreviousFocus = null;
}

async function renameDevice(deviceId) {
  const snapshot = await getSyncCenterSnapshot();
  const device = snapshot.devices.find(item => item.deviceId === deviceId);
  if (!device) return;

  const label = await showPromptDialog({
    title: '重新命名裝置',
    message: '這個名稱會在同步後出現在其他已連結裝置，方便辨識資料來源。',
    label: '裝置名稱',
    value: device.label || (device.isCurrent ? '此裝置' : ''),
    confirmLabel: '儲存名稱',
  });
  if (!label) return;

  await renameDeviceProfile(deviceId, label);
  showToast(
    toastRegion,
    '裝置名稱已更新；若已連結雲端，會在下一次同步送出。',
    'success',
  );
  await refreshSyncStatus();
}

async function revokeDevice(deviceId) {
  const snapshot = await getSyncCenterSnapshot();
  const device = snapshot.devices.find(item => item.deviceId === deviceId);
  if (!device || device.isCurrent) return;

  const confirmed = await showConfirmDialog({
    title: '撤銷這個裝置的未來同步？',
    message:
      '裝置「' + (device.label || device.deviceId) +
      '」之後將無法繼續同步。這個操作不會遠端刪除該裝置已經保存的本機資料。',
    confirmLabel: '撤銷未來同步',
    danger: true,
  });
  if (!confirmed) return;

  await revokeRemoteDeviceProfile(deviceId);
  showToast(
    toastRegion,
    '已排程撤銷；若雲端同步已啟用，變更會在下一次同步送出。',
    'success',
  );
  await refreshSyncStatus();
}

async function unlinkCloud() {
  const snapshot = await getSyncCenterSnapshot();
  if (!snapshot.connected) return;

  const confirmed = await showConfirmDialog({
    title: '解除這個裝置的雲端連結？',
    message:
      '本機題庫與學習資料會保留，但這個裝置將回到「僅此裝置」模式。' +
      '這不是刪除雲端資料，也不會遠端清除其他裝置。',
    confirmLabel: '解除連結',
    danger: true,
  });
  if (!confirmed) return;

  await unlinkCurrentCloudProfile();
  closeSyncCenter();
  await refreshSyncStatus();
  window.dispatchEvent(new CustomEvent('moxin:v5-sync-refresh'));
  showToast(
    toastRegion,
    '此裝置已解除雲端連結，本機資料仍保留。',
    'success',
  );
}

async function showCloudRuntimeUnavailable() {
  const snapshot = await getSyncStatusSnapshot();
  let message = '雲端連線尚未開放。';

  if (!snapshot.cloudConfigured) {
    message =
      '目前 V5 開發環境尚未設定 Google OAuth Client ID，因此不會啟動登入或雲端連線。';
  } else if (!snapshot.cloudRuntimeEnabled) {
    message =
      '雲端執行開關目前仍關閉；介面可檢查，但不會自動連線或上傳資料。';
  }

  await showMessageDialog({
    title: '雲端同步尚未啟用',
    message,
  });
}

function toggleMoreMenu() {
  if (moreOpen) {
    closeMoreMenu();
    return;
  }
  if (!moreHost) return;

  moreHost.innerHTML = [
    '<div class="mobile-more-popover" role="menu" aria-label="更多功能">',
    '<button type="button" role="menuitem" data-more-tools>',
    '<span aria-hidden="true">✦</span><span><strong>題庫工作室</strong>',
    '<small>製作與整理題庫</small></span></button>',
    '<button type="button" role="menuitem" data-more-sync>',
    '<span aria-hidden="true">↕</span><span><strong>帳號與同步</strong>',
    '<small>資料安全、裝置與同步狀態</small></span></button>',
    '<button type="button" role="menuitem" data-more-settings>',
    '<span aria-hidden="true">⚙</span><span><strong>設定</strong>',
    '<small>外觀、體驗與系統資訊</small></span></button>',
    '<button type="button" role="menuitem" data-more-backup>',
    '<span aria-hidden="true">▣</span><span><strong>完整備份</strong>',
    '<small>下載或還原本機完整備份</small></span></button>',
    '</div>',
  ].join('');

  moreHost.hidden = false;
  moreOpen = true;
  document.querySelector('[data-nav-more]')
    ?.setAttribute('aria-expanded', 'true');

  queueMicrotask(() => {
    moreHost.querySelector('[role="menuitem"]')?.focus();
  });
}

function closeMoreMenu() {
  if (!moreHost) return;
  moreHost.hidden = true;
  moreHost.innerHTML = '';
  moreOpen = false;
  document.querySelector('[data-nav-more]')
    ?.setAttribute('aria-expanded', 'false');
}

function markMoreNavActive(active) {
  document.querySelector('[data-nav-more]')
    ?.classList.toggle('is-active', Boolean(active));
}

function trapFocus(event, panel) {
  if (!panel) return;
  const focusable = [...panel.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])',
  )].filter(element => !element.hidden);

  if (!focusable.length) {
    event.preventDefault();
    panel.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

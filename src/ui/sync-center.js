
export function renderSyncStatusButton(container, snapshot) {
  if (!container) return;
  if (!snapshot?.syncUiEnabled) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  const presentation = snapshot.presentation || {};
  const detailText = snapshot.pendingCount || snapshot.conflictCount
    ? summaryCounts(snapshot)
    : formatRelativeTime(snapshot.lastSuccessfulSyncAt) || '本機優先';

  container.hidden = false;
  container.innerHTML = [
    '<button class="sync-status-button" type="button" data-open-sync-center ',
    'data-sync-state="', escapeAttr(snapshot.runtimeState), '" ',
    'data-sync-tone="', escapeAttr(presentation.tone || 'neutral'), '" ',
    'aria-label="同步狀態：', escapeAttr(presentation.label || '僅此裝置'), '。開啟資料與同步中心">',
    '<span class="sync-status-dot" aria-hidden="true"></span>',
    '<span class="sync-status-copy"><strong>',
    escapeHtml(presentation.shortLabel || presentation.label || '僅此裝置'),
    '</strong><small>', escapeHtml(detailText), '</small></span>',
    '</button>',
  ].join('');
}

export function renderSyncCenter(container, snapshot) {
  if (!container) return;

  const presentation = snapshot?.presentation || {};
  const accountName =
    snapshot?.account?.displayName ||
    snapshot?.account?.displayEmail ||
    (snapshot?.connected ? '已連結雲端帳號' : '尚未連結');
  const accountDetail =
    snapshot?.account?.displayEmail &&
    snapshot.account.displayEmail !== accountName
      ? snapshot.account.displayEmail
      : snapshot?.connected
        ? 'Google Drive App Data'
        : '目前使用本機模式';

  const cloudNote = !snapshot?.cloudConfigured
    ? '<div class="sync-inline-note"><strong>Google OAuth 尚未設定</strong>' +
      '<p>目前 V5 開發分支不會要求登入，也不會在背景自動連線。設定 OAuth Client ID 後才會開放連結與即時同步。</p></div>'
    : '';

  const cloudAction = !snapshot?.connected
    ? '<button class="button secondary" type="button" data-connect-cloud ' +
      (snapshot?.cloudConfigured && snapshot?.cloudRuntimeEnabled ? '' : 'disabled') +
      '>連結 Google</button>'
    : '<button class="button danger-ghost" type="button" data-unlink-cloud>解除此裝置連結</button>';

  container.innerHTML = [
    '<div class="sync-center-backdrop" data-close-sync-center></div>',
    '<aside class="sync-center-panel" role="dialog" aria-modal="true" ',
    'aria-labelledby="syncCenterTitle" tabindex="-1" data-sync-center-panel>',
    '<header class="sync-center-header"><div>',
    '<span class="sync-center-kicker">Data & Sync Center</span>',
    '<h2 id="syncCenterTitle">資料與同步中心</h2>',
    '<p>雲端同步是選用功能；離線或未登入時，本機學習仍可正常使用。</p>',
    '</div><button class="icon-button" type="button" data-close-sync-center ',
    'aria-label="關閉資料與同步中心">×</button></header>',

    '<section class="sync-state-card" data-tone="',
    escapeAttr(presentation.tone || 'neutral'), '">',
    '<div class="sync-state-card-heading">',
    '<span class="sync-state-large-dot" aria-hidden="true"></span><div>',
    '<strong>', escapeHtml(presentation.label || '● 僅此裝置'), '</strong>',
    '<p>', escapeHtml(presentation.description || ''), '</p>',
    '</div></div><dl class="sync-metrics">',
    metric('待同步', snapshot?.pendingCount || 0),
    metric('待處理衝突', snapshot?.conflictCount || 0),
    metric('已知裝置', snapshot?.devices?.length || 0),
    metric('最近成功同步', formatDateTime(snapshot?.lastSuccessfulSyncAt) || '尚無'),
    '</dl></section>',

    '<section class="sync-center-section"><div class="sync-center-section-heading"><div>',
    '<span>Account</span><h3>', escapeHtml(accountName), '</h3>',
    '<p>', escapeHtml(accountDetail), '</p></div>',
    '<span class="status-badge ', snapshot?.connected ? 'success' : 'neutral', '">',
    snapshot?.connected ? '已連結' : '本機模式', '</span></div>',
    cloudNote,
    '<div class="settings-actions">',
    '<button class="button primary" type="button" data-sync-now ',
    snapshot?.connected && snapshot?.cloudConfigured && snapshot?.cloudRuntimeEnabled ? '' : 'disabled',
    '>立即同步</button>', cloudAction, '</div></section>',

    '<section class="sync-center-section"><div class="sync-center-section-heading"><div>',
    '<span>Inventory</span><h3>資料盤點</h3>',
    '<p>顯示本機資料量與最近一次 Reconciliation 知道的雲端概況；開啟此頁不會自動上傳。</p>',
    '</div></div><div class="sync-inventory-grid"><article>',
    '<span>本機 Inventory</span><strong>',
    String(Number(snapshot?.localInventory?.meaningfulCount || 0)), ' 項</strong><small>',
    escapeHtml(localInventorySummary(snapshot?.localInventory?.summary)), '</small>',
    '</article><article><span>雲端 Inventory</span><strong>',
    snapshot?.cloudInventory?.known
      ? String(Number(snapshot.cloudInventory.fileCount || 0)) + ' 個物件'
      : '尚未盤點',
    '</strong><small>',
    snapshot?.cloudInventory?.known
      ? escapeHtml(planLabel(snapshot.cloudInventory.plan))
      : '首次連結或切換帳號時才會建立盤點。',
    '</small></article></div></section>',

    '<section class="sync-center-section"><div class="sync-center-section-heading"><div>',
    '<span>Devices</span><h3>已知裝置</h3>',
    '<p>撤銷只會阻止該裝置未來同步，不會遠端刪除該裝置已保存的本機資料。</p>',
    '</div></div><div class="sync-device-list">',
    renderDevices(snapshot?.devices || []),
    '</div></section>',

    '<section class="sync-center-section"><div class="sync-center-section-heading"><div>',
    '<span>Backup & Recovery</span><h3>備份與復原</h3></div></div>',
    '<dl class="sync-detail-list">',
    detail('最近完整備份', formatDateTime(snapshot?.lastFullBackupAt) || '尚未建立'),
    detail('最近 Checkpoint', formatDateTime(snapshot?.checkpoint?.lastCheckpointCreatedAt) || '尚未建立'),
    '</dl><div class="settings-actions">',
    '<button class="button secondary" type="button" data-more-backup>前往完整備份</button>',
    '</div></section>',

    '<details class="sync-diagnostics"><summary>進階診斷</summary>',
    '<dl class="sync-detail-list">',
    detail('Runtime State', snapshot?.runtimeState || 'LOCAL_ONLY'),
    detail('Profile', snapshot?.linkedProfileId || '未連結'),
    detail('Reconciliation', snapshot?.reconciliation?.phase || '無'),
    detail('Account Switch', snapshot?.accountSwitch?.phase || '無'),
    detail('Retry', snapshot?.retry?.code || '無'),
    detail('阻塞原因', snapshot?.blockReason || '無'),
    detail('Checkpoint ID', snapshot?.checkpoint?.lastCheckpointId || '無'),
    '</dl></details>',
    '</aside>',
  ].join('');
}

export function renderCloudSettingsCard(snapshot) {
  const presentation = snapshot?.presentation || {};
  const account =
    snapshot?.account?.displayName ||
    snapshot?.account?.displayEmail ||
    '尚未連結 Google';

  const helper = !snapshot?.cloudConfigured
    ? '目前開發環境尚未設定 Google OAuth Client ID，因此不會要求登入。'
    : !snapshot?.cloudRuntimeEnabled
      ? '雲端執行開關目前仍關閉；可先檢查介面與本機狀態。'
      : snapshot?.connected
        ? '同步採本機優先；雲端失敗不會阻止你作答。'
        : '你可以繼續只使用本機資料，也可以選擇連結 Google。';

  const action = !snapshot?.connected
    ? '<button class="button secondary" type="button" data-connect-cloud ' +
      (snapshot?.cloudConfigured && snapshot?.cloudRuntimeEnabled ? '' : 'disabled') +
      '>連結 Google</button>'
    : '<button class="button danger-ghost" type="button" data-unlink-cloud>解除此裝置連結</button>';

  return [
    '<article class="panel settings-card settings-cloud-card" data-cloud-settings-card>',
    '<div class="section-heading"><div>',
    '<p class="eyebrow">Account & Cloud</p><h2>帳號與雲端</h2></div>',
    '<span class="sync-settings-state" data-tone="',
    escapeAttr(presentation.tone || 'neutral'), '">',
    escapeHtml(presentation.label || '● 僅此裝置'), '</span></div>',
    '<div class="cloud-account-summary"><div>',
    '<span>目前帳號</span><strong>', escapeHtml(account), '</strong><small>',
    escapeHtml(snapshot?.account?.displayEmail || helper), '</small></div><div>',
    '<span>待同步 / 衝突</span><strong>',
    String(Number(snapshot?.pendingCount || 0)), ' / ',
    String(Number(snapshot?.conflictCount || 0)), '</strong><small>最近同步：',
    escapeHtml(formatDateTime(snapshot?.lastSuccessfulSyncAt) || '尚無'),
    '</small></div></div>',
    '<p class="settings-note">', escapeHtml(helper), '</p>',
    '<div class="settings-actions">',
    '<button class="button primary" type="button" data-open-sync-center>',
    '開啟資料與同步中心</button>', action,
    '</div></article>',
  ].join('');
}

function renderDevices(devices) {
  if (!devices.length) {
    return '<div class="sync-empty">尚無裝置資料。</div>';
  }

  return devices.map(device => {
    const badges = [
      device.isCurrent
        ? '<span class="status-badge success">目前裝置</span>'
        : '',
      device.status === 'revoked'
        ? '<span class="status-badge warning">已撤銷</span>'
        : '',
    ].join('');

    const revoke = !device.isCurrent && device.status !== 'revoked'
      ? '<button class="button danger-ghost" type="button" data-revoke-device="' +
        escapeAttr(device.deviceId) + '">撤銷未來同步</button>'
      : '';

    return [
      '<article class="sync-device-row" data-device-id="',
      escapeAttr(device.deviceId), '">',
      '<div class="sync-device-icon" aria-hidden="true">▣</div>',
      '<div class="sync-device-copy"><div><strong>',
      escapeHtml(device.label || (device.isCurrent ? '此裝置' : '未命名裝置')),
      '</strong>', badges, '</div><small>',
      escapeHtml(formatDateTime(device.lastSeenAt) || '尚無活動時間'),
      ' · ', escapeHtml(device.appVersion || '未知版本'),
      '</small></div><div class="sync-device-actions">',
      '<button class="button secondary" type="button" data-rename-device="',
      escapeAttr(device.deviceId), '">重新命名</button>',
      revoke, '</div></article>',
    ].join('');
  }).join('');
}

function metric(label, value) {
  return '<div><dt>' + escapeHtml(label) + '</dt><dd>' +
    escapeHtml(String(value)) + '</dd></div>';
}

function detail(label, value) {
  return '<div><dt>' + escapeHtml(label) + '</dt><dd>' +
    escapeHtml(String(value)) + '</dd></div>';
}

function summaryCounts(snapshot) {
  const parts = [];
  if (snapshot.pendingCount) parts.push(String(snapshot.pendingCount) + ' 待同步');
  if (snapshot.conflictCount) parts.push(String(snapshot.conflictCount) + ' 衝突');
  return parts.join(' · ');
}

function localInventorySummary(summary = {}) {
  const parts = [
    Number(summary.attempts || 0)
      ? String(Number(summary.attempts)) + ' 作答'
      : '',
    Number(summary.userBanks || 0)
      ? String(Number(summary.userBanks)) + ' 自製題庫'
      : '',
    Number(summary.notes || 0)
      ? String(Number(summary.notes)) + ' 筆記'
      : '',
    Number(summary.sessions || 0)
      ? String(Number(summary.sessions)) + ' Session'
      : '',
  ].filter(Boolean);
  return parts.length
    ? parts.join(' · ')
    : '目前沒有需要同步的使用者資料。';
}

function planLabel(plan) {
  const labels = {
    'both-empty': '本機與雲端皆空',
    'upload-local': '本機有資料、雲端空白',
    'download-cloud': '本機空白、雲端有資料',
    'merge-required': '本機與雲端皆有資料，需智慧合併',
  };
  return labels[plan] || '最近一次雲端盤點';
}

function formatRelativeTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '剛剛同步';
  if (diff < 60 * 60_000) {
    return String(Math.max(1, Math.floor(diff / 60_000))) + ' 分鐘前';
  }
  if (diff < 24 * 60 * 60_000) {
    return String(Math.floor(diff / (60 * 60_000))) + ' 小時前';
  }
  return formatDateTime(value);
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
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
  return escapeHtml(value)
    .replaceAll(String.fromCharCode(96), '&#096;');
}

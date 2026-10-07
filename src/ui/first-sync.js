import { showConfirmDialog } from './dialogs.js';

export const RECONCILIATION_PLAN_PRESENTATION = Object.freeze({
  'both-empty': Object.freeze({
    title: '建立新的同步空間',
    summary: '本機與雲端都沒有既有同步資料。',
  }),
  'upload-local': Object.freeze({
    title: '以本機資料開始',
    summary: '本機有資料、雲端目前沒有既有同步資料。',
  }),
  'download-cloud': Object.freeze({
    title: '從雲端帶入資料',
    summary: '本機沒有既有資料、雲端已有同步資料。',
  }),
  'merge-required': Object.freeze({
    title: '智慧合併本機與雲端',
    summary: '本機與雲端都有資料；只在真正衝突時要求你選擇。',
  }),
});

export function getReconciliationPlanPresentation(plan) {
  return RECONCILIATION_PLAN_PRESENTATION[String(plan || '')] || {
    title: '檢查同步資料',
    summary: '系統會先盤點，再決定安全的同步策略。',
  };
}

export function buildReconciliationMessage({
  kind = 'first-sync',
  account = null,
  localInventory = null,
  remoteInventory = null,
  plan = null,
} = {}) {
  const planKey = plan?.plan || plan || 'merge-required';
  const presentation = getReconciliationPlanPresentation(planKey);
  const accountText =
    account?.displayEmail ||
    account?.displayName ||
    '目前選取的 Google 帳號';

  const lines = [
    'Google 帳號：' + accountText,
    '',
    '本機：' + inventoryText(localInventory, '本機'),
    '雲端：' + remoteInventoryText(remoteInventory),
    '',
    '預計策略：' + presentation.title,
    presentation.summary,
    '',
  ];

  if (kind === 'account-switch') {
    lines.push(
      '這是帳號切換。按下「套用並開始同步」前，不會把目前裝置的資料上傳到新的 Google 帳號。',
      '套用後會先重新綁定 profile，再以相同的 Pull → Merge → Push 規則同步；舊帳號不會被遠端清除。',
    );
  } else {
    lines.push(
      '按下「套用並開始同步」前，不會建立新的雲端 profile，也不會上傳本機資料。',
      '套用後仍採本機優先；真正衝突才會停下來要求你選擇。',
    );
  }

  return lines.join('\n');
}

export function showReconciliationPlanDialog({
  kind = 'first-sync',
  account = null,
  localInventory = null,
  remoteInventory = null,
  plan = null,
} = {}) {
  const planKey = plan?.plan || plan || 'merge-required';
  const presentation = getReconciliationPlanPresentation(planKey);
  return showConfirmDialog({
    title: kind === 'account-switch'
      ? '確認切換 Google 同步帳號'
      : presentation.title,
    message: buildReconciliationMessage({
      kind,
      account,
      localInventory,
      remoteInventory,
      plan: planKey,
    }),
    confirmLabel: '套用並開始同步',
    cancelLabel: '先不要',
  });
}

function inventoryText(inventory, fallbackLabel) {
  if (!inventory) return fallbackLabel + '尚未盤點';
  const summary = inventory.summary || {};
  const details = [
    countPart(summary.attempts, '作答'),
    countPart(summary.notes, '筆記'),
    countPart(summary.goals, '目標'),
    countPart(summary.userBanks, '自製題庫'),
    countPart(summary.drafts, '草稿'),
    countPart(summary.sessions, 'Session'),
  ].filter(Boolean);
  const total = Number(inventory.meaningfulCount || 0);
  return String(total) + ' 項' +
    (details.length ? '（' + details.join('、') + '）' : '');
}

function remoteInventoryText(inventory) {
  if (!inventory) return '尚未盤點';
  const total = Number(inventory.meaningfulCount || 0);
  const files = Number(inventory.fileCount || 0);
  return String(total) + ' 個同步資料物件' +
    (files !== total ? '（Drive 檔案 ' + String(files) + '）' : '');
}

function countPart(value, label) {
  const count = Number(value || 0);
  return count > 0 ? String(count) + ' ' + label : '';
}

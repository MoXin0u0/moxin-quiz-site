
import { isConflictDirectlyResolvable } from '../sync/conflict-resolution.js';

const ENTITY_LABELS = Object.freeze({
  note: '題目筆記',
  'learning-goal': '學習目標',
  'account-settings': '帳號設定',
  'practice-session': '練習 Session',
  'exam-session': '模擬考 Session',
  'exam-answer': '模擬考答案',
  'studio-draft': '題庫工作室草稿',
  'user-bank': '自製題庫',
  attempt: '作答事件',
});

const KIND_LABELS = Object.freeze({
  'concurrent-edit': '兩個裝置同時修改',
  'delete-vs-edit': '刪除與編輯同時發生',
  'content-id-collision': '不可變資料識別衝突',
  'terminal-state-conflict': '終態資料分歧',
});

const PRESERVE_LOSING_BRANCH_TYPES = new Set([
  'practice-session',
  'studio-draft',
  'user-bank',
]);

export function getConflictPresentation(conflict) {
  const entityType = String(conflict?.entityType || 'unknown');
  const kind = String(conflict?.kind || 'concurrent-edit');
  const directlyResolvable = isConflictDirectlyResolvable(conflict);

  return {
    entityLabel: ENTITY_LABELS[entityType] || entityType,
    kindLabel: KIND_LABELS[kind] || kind,
    directlyResolvable,
    preservesLosingBranch: PRESERVE_LOSING_BRANCH_TYPES.has(entityType),
    local: summarizeConflictBranch(conflict?.localValue, {
      side: 'local',
      revision: conflict?.localRevision,
      entityType,
    }),
    remote: summarizeConflictBranch(conflict?.remoteValue, {
      side: 'remote',
      revision: conflict?.remoteRevision,
      entityType,
    }),
  };
}

export function buildConflictResolutionMessage(conflict, choice) {
  const presentation = getConflictPresentation(conflict);
  const selected = choice === 'remote' ? '雲端版本' : '此裝置版本';
  const other = choice === 'remote' ? '此裝置版本' : '雲端版本';

  const lines = [
    presentation.entityLabel + '將採用「' + selected + '」。',
    '系統會建立一個同時承接兩個 Revision 的新解決版本，之後再由正常同步流程送出。',
  ];

  if (presentation.preservesLosingBranch) {
    lines.push(
      other + '不會直接消失；系統會建立可辨識的衝突副本，避免內容被靜默覆寫。',
    );
  } else {
    lines.push(
      '原本兩個分支的 Revision 仍會留在同步歷史中，但畫面資料會以你選擇的版本為準。',
    );
  }

  return lines.join('\n\n');
}

export function renderConflictCards(conflicts = []) {
  if (!Array.isArray(conflicts) || conflicts.length === 0) {
    return '<div class="sync-empty">目前沒有待處理的同步衝突。</div>';
  }

  return conflicts
    .slice()
    .sort((left, right) =>
      String(right?.createdAt || '').localeCompare(String(left?.createdAt || '')))
    .map(renderConflictCard)
    .join('');
}

function renderConflictCard(conflict) {
  const presentation = getConflictPresentation(conflict);
  const conflictId = escapeAttr(conflict?.conflictId || '');
  const createdAt = formatDateTime(conflict?.createdAt) || '時間未知';

  const actions = presentation.directlyResolvable
    ? [
        '<div class="sync-conflict-actions">',
        '<button class="button secondary" type="button" ',
        'data-resolve-conflict-local="', conflictId, '">保留此裝置版本</button>',
        '<button class="button primary" type="button" ',
        'data-resolve-conflict-remote="', conflictId, '">採用雲端版本</button>',
        '</div>',
      ].join('')
    : [
        '<div class="sync-conflict-manual" role="note">',
        '<strong>需要人工復原</strong>',
        '<p>這筆衝突涉及不可變識別或目前不支援直接改寫的資料。系統不會自動選邊；請先保留完整備份，再依診斷資訊處理。</p>',
        '</div>',
      ].join('');

  const preserveNote = presentation.preservesLosingBranch
    ? '<p class="sync-conflict-preserve">選擇任一版本時，另一個版本會另存為衝突副本。</p>'
    : '';

  return [
    '<article class="sync-conflict-card" data-conflict-id="', conflictId, '">',
    '<div class="sync-conflict-heading"><div>',
    '<span class="sync-conflict-kind">', escapeHtml(presentation.kindLabel), '</span>',
    '<h4>', escapeHtml(presentation.entityLabel), '</h4>',
    '<p>', escapeHtml(createdAt), ' · ', escapeHtml(conflict?.entityKey || ''), '</p>',
    '</div><span class="status-badge warning">待處理</span></div>',
    '<div class="sync-conflict-branches">',
    branchCard('此裝置版本', presentation.local),
    branchCard('雲端版本', presentation.remote),
    '</div>',
    preserveNote,
    actions,
    '</article>',
  ].join('');
}

function branchCard(label, branch) {
  return [
    '<section class="sync-conflict-branch">',
    '<span>', escapeHtml(label), '</span>',
    '<strong>', escapeHtml(branch.title), '</strong>',
    '<p>', escapeHtml(branch.detail), '</p>',
    '<small>', escapeHtml(branch.meta), '</small>',
    '</section>',
  ].join('');
}

function summarizeConflictBranch(value, {
  side,
  revision,
  entityType,
} = {}) {
  const deleted = isDeletedValue(value);
  const rev = revision || value?.revision || null;

  if (deleted) {
    return {
      title: '已刪除',
      detail: '這個分支代表刪除狀態。',
      meta: revisionMeta(rev, side),
    };
  }

  if (!value || typeof value !== 'object') {
    return {
      title: '無可預覽內容',
      detail: '這個分支沒有可安全顯示的摘要。',
      meta: revisionMeta(rev, side),
    };
  }

  const title = firstNonEmpty(
    value.title,
    value.name,
    value.label,
    value.bank?.name,
    value.bank?.title,
    value.status,
    entityType === 'exam-answer' ? answerLabel(value) : '',
  ) || '內容版本';

  let detail = firstNonEmpty(
    value.content,
    value.text,
    value.note,
    value.description,
    value.goalText,
    value.bank?.description,
  );

  if (!detail && entityType?.includes('session')) {
    detail = sessionSummary(value);
  }
  if (!detail && entityType === 'user-bank') {
    const count = Array.isArray(value.questions) ? value.questions.length : null;
    detail = count === null
      ? '自製題庫內容版本'
      : '題目數：' + String(count);
  }
  if (!detail && entityType === 'account-settings') {
    detail = '帳號層級設定版本';
  }
  if (!detail && entityType === 'exam-answer') {
    detail = answerLabel(value) || '答案狀態版本';
  }

  return {
    title: truncate(String(title), 70),
    detail: truncate(String(detail || '此分支沒有額外文字摘要。'), 160),
    meta: revisionMeta(rev, side),
  };
}

function revisionMeta(revision, side) {
  const changedAt = formatDateTime(revision?.changedAt) || '時間未知';
  const device = String(revision?.changedByDeviceId || '');
  return [
    side === 'local' ? '本機分支' : '遠端分支',
    changedAt,
    device ? 'Device ' + truncate(device, 18) : '',
  ].filter(Boolean).join(' · ');
}

function sessionSummary(value) {
  const parts = [];
  if (value.status) parts.push('狀態：' + String(value.status));
  if (value.completedAt) parts.push('完成：' + formatDateTime(value.completedAt));
  if (value.submittedAt) parts.push('送出：' + formatDateTime(value.submittedAt));
  return parts.join(' · ') || 'Session 狀態版本';
}

function answerLabel(value) {
  if (Array.isArray(value.selectedOptionIds)) {
    return '選擇：' + value.selectedOptionIds.join(', ');
  }
  if (value.answer !== undefined && value.answer !== null) {
    return '答案：' + String(value.answer);
  }
  if (value.value !== undefined && value.value !== null) {
    return '答案：' + String(value.value);
  }
  return '';
}

function isDeletedValue(value) {
  return Boolean(
    value?.deletedAt ||
    value?.tombstoneId ||
    value?.operation === 'delete' ||
    value?.deleted === true
  );
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function truncate(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength
    ? text.slice(0, Math.max(0, maxLength - 1)) + '…'
    : text;
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

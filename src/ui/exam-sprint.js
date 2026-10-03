import {
  EXAM_SPRINT_GOAL_ID,
  resolveSprintBankIds,
} from '../learning/exam-sprint.js';
import {
  GLOBAL_SCOPE,
  learningGoalIdForScope,
} from './learning-goals.js';

export function createExamSprintSaveInput({
  bankIds,
  examLabel = '',
  examDate = '',
  sprintEnabled = false,
  sprintDailyTarget = 0,
  scope,
} = {}) {
  // P4.1 compatibility: old callers passed one shared P3 scope.
  if (!Array.isArray(bankIds) && scope !== undefined) {
    const normalizedScope = String(scope || GLOBAL_SCOPE).trim() || GLOBAL_SCOPE;
    const bankId = normalizedScope === GLOBAL_SCOPE ? null : normalizedScope;
    return {
      id: learningGoalIdForScope(normalizedScope),
      bankId,
      examLabel: String(examLabel || '').trim(),
      examDate: String(examDate || '').trim() || null,
      sprintEnabled: sprintEnabled === true,
    };
  }

  return {
    id: EXAM_SPRINT_GOAL_ID,
    bankId: null,
    sprintBankIds: normalizeBankIds(bankIds),
    sprintDailyTarget: clampTarget(sprintDailyTarget),
    examLabel: String(examLabel || '').trim(),
    examDate: String(examDate || '').trim() || null,
    sprintEnabled: sprintEnabled === true,
  };
}

export function renderExamSprintPanel(model = {}) {
  const goal = model.goal || {};
  const plan = model.plan || {};
  const banks = Array.isArray(model.banks) ? model.banks : [];
  const bankNameById = new Map(
    banks.map(bank => [String(bank.id), bank.name || bank.title || bank.id]),
  );
  const selectedBankIds = resolveUiSprintBankIds(goal);
  const selectedBankSet = new Set(selectedBankIds);
  const groups = groupSelectedByBank(plan.selected, bankNameById);
  const status = String(plan.status || 'disabled');
  const examDate = plan.examDateKey || inputDateValue(goal.examDate);
  const hasDate = Boolean(examDate);
  const enabled = goal.sprintEnabled === true;
  const daysUntilExam = Number.isFinite(Number(plan.daysUntilExam))
    ? Number(plan.daysUntilExam)
    : null;

  return `
    <section class="exam-sprint-panel" aria-labelledby="examSprintTitle">
      <div class="exam-sprint-head">
        <div>
          <span class="learning-kicker">P4 · 考前衝刺</span>
          <h2 id="examSprintTitle">只把這場考試真正相關的題庫放進衝刺計畫</h2>
          <p>考前衝刺已和「學習目標」範圍分離。你可以為一場考試挑 1 個或多個題庫，不會預設把整個網站的題庫全部納入。</p>
        </div>
        ${sprintStatusBadge(status)}
      </div>

      <form class="exam-sprint-form exam-sprint-form-layered" data-exam-sprint-form>
        <section class="exam-sprint-setting-block">
          <div class="exam-sprint-setting-head">
            <div>
              <strong>這場考試包含哪些題庫？</strong>
              <span>至少選 1 個。未勾選的題庫完全不會進入倒數、覆蓋率與今日清單。</span>
            </div>
            <b>${selectedBankIds.length} 個題庫</b>
          </div>

          <div class="exam-sprint-bank-picker">
            ${banks.length ? banks.map(bank => `
              <label class="exam-sprint-bank-option ${selectedBankSet.has(String(bank.id)) ? 'is-selected' : ''}">
                <input
                  type="checkbox"
                  value="${escapeAttr(bank.id)}"
                  data-exam-sprint-bank
                  ${selectedBankSet.has(String(bank.id)) ? 'checked' : ''}
                />
                <span>
                  <strong>${escapeHtml(bank.name || bank.title || bank.id)}</strong>
                  <small>${escapeHtml(bank.id)}</small>
                </span>
              </label>
            `).join('') : `
              <div class="exam-sprint-empty">
                <strong>目前沒有本機題庫</strong>
                <p>先加入至少一個題庫，才能建立考前衝刺。</p>
              </div>
            `}
          </div>
        </section>

        <section class="exam-sprint-setting-grid">
          <label class="exam-sprint-enabled">
            <input type="checkbox" data-exam-sprint-enabled ${goal.sprintEnabled ? 'checked' : ''} />
            <span>
              <strong>啟用考前衝刺</strong>
              <small>只套用到上方勾選的考試題庫。</small>
            </span>
          </label>

          <label>
            <span>考試名稱</span>
            <input type="text" maxlength="80" placeholder="例如：ERP 期末考" value="${escapeAttr(goal.examLabel || '')}" data-exam-sprint-label />
          </label>

          <label>
            <span>考試日期</span>
            <input type="date" value="${escapeAttr(examDate || '')}" data-exam-sprint-date />
          </label>

          <label>
            <span>每日衝刺題數</span>
            <input type="number" inputmode="numeric" min="0" max="10000" step="1" value="${escapeAttr(goal.sprintDailyTarget || 0)}" data-exam-sprint-daily-target />
            <small>0 = 依剩餘題量與天數自動建議。</small>
          </label>

          <button class="button primary" type="submit">儲存考前衝刺</button>
        </section>
      </form>

      <div class="exam-sprint-summary">
        ${summaryCard('距離考試', hasDate ? countdownText(daysUntilExam) : '尚未設定', hasDate ? formatDate(examDate) : '設定日期後開始倒數', 'countdown')}
        ${summaryCard(
          '今日衝刺',
          enabled && hasDate && selectedBankIds.length ? `${Number(plan.remainingToday || 0)} 題` : '—',
          enabled && hasDate && selectedBankIds.length
            ? Number(plan.remainingToday || 0) > 0
              ? `每日基準 ${Number(plan.dailyTarget || 0)} 題`
              : '今天的目標已完成'
            : '選題庫並啟用後開始安排',
          'today',
        )}
        ${summaryCard(
          '考前覆蓋',
          Number(plan.candidateCount || 0) ? `${Number(plan.projectedCoverage || 0)} / ${Number(plan.candidateCount || 0)}` : '—',
          Number(plan.coverageGap || 0) > 0
            ? `依目前節奏仍差 ${Number(plan.coverageGap || 0)} 題`
            : Number(plan.candidateCount || 0)
              ? '目前節奏可覆蓋候選題'
              : selectedBankIds.length ? '目前沒有候選題' : '尚未選擇考試題庫',
          Number(plan.coverageGap || 0) > 0 ? 'warning' : 'coverage',
        )}
      </div>

      ${renderCoverageNotice(plan)}

      <div class="exam-sprint-priority-wrap">
        <div class="exam-sprint-section-title">
          <div>
            <strong>題源構成</strong>
            <span>只統計本次勾選的考試題庫；每題只歸入最高優先層。</span>
          </div>
          <small>共 ${Number(plan.candidateCount || 0)} 題</small>
        </div>
        <div class="exam-sprint-priority-grid">
          ${priorityCard('目前錯題', plan.priorityCounts?.wrong, '01', 'wrong')}
          ${priorityCard('不熟題', plan.priorityCounts?.unfamiliar, '02', 'unfamiliar')}
          ${priorityCard('到期題', plan.priorityCounts?.due, '03', 'due')}
          ${priorityCard('低熟練', plan.priorityCounts?.['low-mastery'], '04', 'low')}
          ${priorityCard('未作答', plan.priorityCounts?.unanswered, '05', 'new')}
          ${priorityCard('其他題目', plan.priorityCounts?.other, '06', 'other')}
        </div>
      </div>

      <div class="exam-sprint-launch">
        <div class="exam-sprint-section-title">
          <div>
            <strong>今日衝刺清單</strong>
            <span>多題庫計畫仍會按題庫分開啟動，維持單題庫 Session 與圖片資產安全。</span>
          </div>
          <small>${Number(plan.selectionTarget || 0)} 題待安排</small>
        </div>
        ${renderLaunchArea(status, groups, plan)}
      </div>
    </section>
  `;
}

function renderLaunchArea(status, groups, plan) {
  if (status === 'disabled') return emptyLaunch('尚未啟用考前衝刺', '選擇考試題庫、日期並啟用後，系統才會建立今日清單。');
  if (status === 'missing-bank-selection') return emptyLaunch('還沒有選擇考試題庫', '請勾選這場考試真正包含的題庫；系統不會自動使用全部題庫。');
  if (status === 'missing-exam-date') return emptyLaunch('還缺考試日期', '設定日期後才能計算剩餘學習日與每日衝刺題數。');
  if (status === 'exam-passed') return emptyLaunch('這個考試日期已經過了', '更新考試日期後，衝刺計畫會重新計算。');
  if (status === 'no-questions') return emptyLaunch('選取的題庫目前沒有可安排題目', '確認題庫內容，或重新選擇本次考試題庫。');
  if (status === 'today-complete') return emptyLaunch('今天的題數已完成', `今日已完成 ${Number(plan.completedPracticeToday || 0)} 題一般練習。`);
  if (status === 'today-exhausted') return emptyLaunch('今天沒有新的可計入題目', '今日已做過目前候選題；明天會依新的學習狀態重新安排。');
  if (!groups.length) return emptyLaunch('目前沒有可啟動的衝刺題目', '重新整理學習狀態後會再次計算。');

  return `
    <div class="exam-sprint-bank-groups">
      ${groups.map(group => `
        <article class="exam-sprint-bank-group">
          <div>
            <span>${escapeHtml(group.bankId)}</span>
            <strong>${escapeHtml(group.bankName)}</strong>
            <small>${group.count} 題 · 依優先順序開始</small>
          </div>
          <button class="button primary" type="button" data-start-sprint-bank="${escapeAttr(group.bankId)}">開始今日衝刺</button>
        </article>
      `).join('')}
    </div>
  `;
}

function renderCoverageNotice(plan) {
  const gap = Number(plan.coverageGap || 0);
  const recommended = Number(plan.recommendedDailyTarget || 0);
  const current = Number(plan.dailyTarget || 0);
  if (!gap || !recommended) return '';
  return `
    <div class="exam-sprint-coverage-warning">
      <div>
        <strong>目前每日節奏可能無法在考前覆蓋全部候選題</strong>
        <p>目前每日 ${current} 題；若希望完整覆蓋，建議約 ${recommended} 題／日。系統不會自動替你修改每日衝刺題數。</p>
      </div>
      <span>缺口 ${gap} 題</span>
    </div>
  `;
}

function priorityCard(label, count, number, kind) {
  return `<article class="exam-sprint-priority ${escapeAttr(kind)}"><span>${escapeHtml(number)}</span><div><strong>${escapeHtml(label)}</strong><b>${Number(count || 0)}</b></div></article>`;
}
function summaryCard(label, value, note, kind) {
  return `<article class="exam-sprint-summary-card ${escapeAttr(kind)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
}
function sprintStatusBadge(status) {
  const map = {
    ready: ['今日可開始', 'ready'],
    'today-complete': ['今日已完成', 'complete'],
    'today-exhausted': ['今日已覆蓋', 'complete'],
    disabled: ['未啟用', 'muted'],
    'missing-bank-selection': ['未選題庫', 'warning'],
    'missing-exam-date': ['缺少日期', 'warning'],
    'exam-passed': ['日期已過', 'warning'],
    'no-questions': ['沒有題目', 'muted'],
  };
  const [label, kind] = map[status] || ['等待設定', 'muted'];
  return `<span class="exam-sprint-status ${kind}">${escapeHtml(label)}</span>`;
}
function emptyLaunch(title, description) {
  return `<div class="exam-sprint-empty"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div>`;
}
function groupSelectedByBank(selected, bankNameById) {
  const groups = new Map();
  for (const item of Array.isArray(selected) ? selected : []) {
    const bankId = String(item?.bankId || '');
    if (!bankId) continue;
    if (!groups.has(bankId)) groups.set(bankId, { bankId, bankName: bankNameById.get(bankId) || bankId, count: 0 });
    groups.get(bankId).count += 1;
  }
  return [...groups.values()];
}
function resolveUiSprintBankIds(goal) {
  const resolved = resolveSprintBankIds(goal);
  if (Array.isArray(resolved)) return resolved;
  if (goal?.bankId) return [String(goal.bankId)];
  return [];
}
function normalizeBankIds(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const id = String(value || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}
function clampTarget(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(10000, Math.round(number)));
}
function countdownText(days) {
  if (!Number.isFinite(days)) return '尚未設定';
  if (days < 0) return '已結束';
  if (days === 0) return '就是今天';
  return `${days} 天`;
}
function formatDate(dateKey) {
  const parts = String(dateKey || '').split('-');
  if (parts.length !== 3) return dateKey || '';
  return `${Number(parts[0])}/${Number(parts[1])}/${Number(parts[2])}`;
}
function inputDateValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}
function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

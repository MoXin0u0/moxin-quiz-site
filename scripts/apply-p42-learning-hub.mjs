import fs from 'node:fs';

const PAYLOAD = 'scripts/p42-payload';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
}
function copyPayload(from, to) {
  write(to, read(`${PAYLOAD}/${from}`));
}
function replaceOne(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Patch anchor is not unique: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

// Permanent payload files are copied only inside the CI job.
copyPayload('src/ui/learning-hub.js', 'src/ui/learning-hub.js');
copyPayload('src/ui/review-center.js', 'src/ui/review-center.js');
copyPayload('src/ui/exam-sprint.js', 'src/ui/exam-sprint.js');
copyPayload('styles/v4-learning-hub.css', 'styles/v4-learning-hub.css');
copyPayload('tests/v40-p42-learning-hub-ia-run.mjs', 'tests/v40-p42-learning-hub-ia-run.mjs');
copyPayload('docs/V4_0_P4_2_LEARNING_HUB_IA.md', 'docs/V4_0_P4_2_LEARNING_HUB_IA.md');
copyPayload('docs/V4_0_UX_DENSITY_AUDIT.md', 'docs/V4_0_UX_DENSITY_AUDIT.md');

// 1. Persist explicit P4 scope fields in existing learningGoals records.
{
  const path = 'src/storage/repositories/goals.js';
  let s = read(path);

  s = replaceOne(
    s,
`    examLabel: String(source.examLabel || '').trim(),
    sprintEnabled: source.sprintEnabled === true,
    createdAt: normalizeDateString(source.createdAt, now),`,
`    examLabel: String(source.examLabel || '').trim(),
    sprintEnabled: source.sprintEnabled === true,
    sprintBankIds: normalizeStringArray(source.sprintBankIds),
    sprintDailyTarget: clampInteger(source.sprintDailyTarget, 0, 10000),
    createdAt: normalizeDateString(source.createdAt, now),`,
    'learning goal sprint fields',
  );

  s = replaceOne(
    s,
`function normalizeOptionalDate(value) {`,
`function normalizeStringArray(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const item = String(value || '').trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function normalizeOptionalDate(value) {`,
    'learning goal array normalization',
  );

  write(path, s);
}

// 2. P3 scope UI: single-bank choices are prominent; Global is explicit.
{
  const path = 'src/ui/learning-goals.js';
  let s = read(path);

  s = replaceOne(
    s,
`          <span>目標範圍</span>
          <select data-learning-goal-scope>
            <option value="${GLOBAL_SCOPE}" ${selectedScope === GLOBAL_SCOPE ? 'selected' : ''}>全部題庫</option>
            ${banks.map(bank => `
              <option
                value="${escapeAttr(bank.id)}"
                ${selectedScope === String(bank.id) ? 'selected' : ''}
              >${escapeHtml(bank.name || bank.title || bank.id)}</option>
            `).join('')}
          </select>`,
`          <span>學習目標適用題庫</span>
          <select data-learning-goal-scope>
            ${banks.length ? `
              <optgroup label="單一題庫">
                ${banks.map(bank => `
                  <option
                    value="${escapeAttr(bank.id)}"
                    ${selectedScope === String(bank.id) ? 'selected' : ''}
                  >${escapeHtml(bank.name || bank.title || bank.id)}</option>
                `).join('')}
              </optgroup>
            ` : ''}
            <optgroup label="整體範圍">
              <option value="${GLOBAL_SCOPE}" ${selectedScope === GLOBAL_SCOPE ? 'selected' : ''}>全部題庫（整體目標）</option>
            </optgroup>
          </select>`,
    'P3 scope selector',
  );

  write(path, s);
}

// 3. P4 Core: new exam-sprint record requires explicit bank selection.
{
  const path = 'src/learning/exam-sprint.js';
  let s = read(path);

  s = replaceOne(
    s,
`export const SPRINT_LOW_MASTERY_MAX_LEVEL = 2;

export function buildExamSprintPlan(goal = {}, data = {}, {
  now = new Date(),
  timeZone = null,
  todayPracticeCount = 0,
} = {}) {`,
`export const SPRINT_LOW_MASTERY_MAX_LEVEL = 2;
export const EXAM_SPRINT_GOAL_ID = 'exam-sprint';

export function buildExamSprintPlan(goal = {}, data = {}, {
  now = new Date(),
  timeZone = null,
  todayPracticeCount = null,
} = {}) {`,
    'P4 id and today-count options',
  );

  s = replaceOne(
    s,
`  const questions = normalizeQuestions(data?.questions, goal?.bankId);`,
`  const sprintBankIds = resolveSprintBankIds(goal);
  const hasBankSelection = sprintBankIds === null || sprintBankIds.length > 0;
  const questions = normalizeQuestions(data?.questions, sprintBankIds, goal?.bankId);`,
    'P4 bank selection',
  );

  s = replaceOne(
    s,
`  const completedTodayKeys = buildTodayPracticeKeySet(data?.attempts, {
    now,
    timeZone,
    bankId: goal?.bankId,
  });`,
`  const completedTodayKeys = buildTodayPracticeKeySet(data?.attempts, {
    now,
    timeZone,
    bankIds: sprintBankIds,
    bankId: goal?.bankId,
  });`,
    'P4 multi-bank today scope',
  );

  s = replaceOne(
    s,
`  const configuredDailyTarget = clampTarget(goal?.dailyPracticeTarget);`,
`  const configuredDailyTarget =
    clampTarget(goal?.sprintDailyTarget) ||
    clampTarget(goal?.dailyPracticeTarget);`,
    'P4 independent target',
  );

  s = replaceOne(
    s,
`  const completedPracticeToday = Math.max(
    0,
    Math.round(Number(todayPracticeCount) || 0),
  );`,
`  const completedPracticeToday =
    todayPracticeCount === null || todayPracticeCount === undefined
      ? completedTodayKeys.size
      : Math.max(0, Math.round(Number(todayPracticeCount) || 0));`,
    'P4 derive today count',
  );

  s = replaceOne(
    s,
`  const active =
    enabled &&
    hasExamDate &&
    !examPassed &&
    candidateCount > 0;`,
`  const active =
    enabled &&
    hasBankSelection &&
    hasExamDate &&
    !examPassed &&
    candidateCount > 0;`,
    'P4 active scope requirement',
  );

  s = replaceOne(
    s,
`    bankId: goal?.bankId ? String(goal.bankId) : null,
    examLabel: String(goal?.examLabel || '').trim(),`,
`    bankId: goal?.bankId ? String(goal.bankId) : null,
    bankIds: sprintBankIds,
    examLabel: String(goal?.examLabel || '').trim(),`,
    'P4 result bank ids',
  );

  s = replaceOne(
    s,
`      enabled,
      hasExamDate,`,
`      enabled,
      hasBankSelection,
      hasExamDate,`,
    'P4 status scope arg',
  );

  s = replaceOne(
    s,
`export function buildTodayPracticeKeySet(attempts = [], {
  now = new Date(),
  timeZone = null,
  bankId = null,
} = {}) {
  const todayKey = localDateKey(now, { timeZone });
  const scopedBankId = bankId ? String(bankId) : null;
  const keys = new Set();

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    if (!attempt?.timestamp) continue;
    if (scopedBankId && String(attempt.bankId || '') !== scopedBankId) continue;`,
`export function buildTodayPracticeKeySet(attempts = [], {
  now = new Date(),
  timeZone = null,
  bankIds = null,
  bankId = null,
} = {}) {
  const todayKey = localDateKey(now, { timeZone });
  const explicitBankIds = Array.isArray(bankIds)
    ? new Set(bankIds.map(value => String(value)))
    : null;
  const scopedBankId = bankId ? String(bankId) : null;
  const keys = new Set();

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    if (!attempt?.timestamp) continue;
    if (explicitBankIds && !explicitBankIds.has(String(attempt.bankId || ''))) continue;
    if (!explicitBankIds && scopedBankId && String(attempt.bankId || '') !== scopedBankId) continue;`,
    'P4 today bank set',
  );

  s = replaceOne(
    s,
`export function normalizeExamDateKey(value) {`,
`export function resolveSprintBankIds(goal = {}) {
  if (Array.isArray(goal?.sprintBankIds)) {
    const result = [];
    const seen = new Set();
    for (const value of goal.sprintBankIds) {
      const id = String(value || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
    return result;
  }

  if (goal?.bankId) return [String(goal.bankId)];

  // Legacy P4 Core treated global/no-bank as all banks. New exam-sprint
  // records always persist sprintBankIds, so [] safely means no selection.
  if (String(goal?.id || '') !== EXAM_SPRINT_GOAL_ID) return null;
  return [];
}

export function normalizeExamDateKey(value) {`,
    'P4 bank resolver',
  );

  s = replaceOne(
    s,
`function normalizeQuestions(questions, fallbackBankId = null) {
  const fallback = fallbackBankId ? String(fallbackBankId) : '';
  const seen = new Set();
  const normalized = [];

  for (const question of Array.isArray(questions) ? questions : []) {
    const bankId = String(question?.bankId || fallback || '');
    const questionId = String(question?.questionId || question?.id || '');
    if (!bankId || !questionId) continue;
    if (fallback && bankId !== fallback) continue;`,
`function normalizeQuestions(questions, allowedBankIds = null, fallbackBankId = null) {
  const fallback = fallbackBankId ? String(fallbackBankId) : '';
  const allowed = Array.isArray(allowedBankIds)
    ? new Set(allowedBankIds.map(value => String(value)))
    : null;
  const seen = new Set();
  const normalized = [];

  for (const question of Array.isArray(questions) ? questions : []) {
    const bankId = String(question?.bankId || fallback || '');
    const questionId = String(question?.questionId || question?.id || '');
    if (!bankId || !questionId) continue;
    if (allowed && !allowed.has(bankId)) continue;
    if (!allowed && fallback && bankId !== fallback) continue;`,
    'P4 normalize selected banks',
  );

  s = replaceOne(
    s,
`function sprintStatus({
  enabled,
  hasExamDate,`,
`function sprintStatus({
  enabled,
  hasBankSelection,
  hasExamDate,`,
    'P4 status signature',
  );

  s = replaceOne(
    s,
`  if (!enabled) return 'disabled';
  if (!hasExamDate) return 'missing-exam-date';`,
`  if (!enabled) return 'disabled';
  if (!hasBankSelection) return 'missing-bank-selection';
  if (!hasExamDate) return 'missing-exam-date';`,
    'P4 missing-bank status',
  );

  write(path, s);
}

// 4. Append P4.2 picker styles to existing P4 stylesheet.
{
  const path = 'styles/v4-exam-sprint.css';
  let css = read(path);
  const append = read(`${PAYLOAD}/styles/v4-exam-sprint-p42-append.css`);
  if (!css.includes('P4.2 — explicit exam bank selection')) css += `\n${append}`;
  write(path, css);
}

// 5. Application wiring: separate P3 scope from P4 scope and add Hub state.
{
  const path = 'src/app/main.js';
  let s = read(path);

  s = replaceOne(
    s,
`import { buildExamSprintPlan } from '../learning/exam-sprint.js';`,
`import {
  EXAM_SPRINT_GOAL_ID,
  buildExamSprintPlan,
} from '../learning/exam-sprint.js';`,
    'main P4 import',
  );

  s = replaceOne(
    s,
`  reviewGroups: [],
  learningGoalScope: GLOBAL_SCOPE,
  sprintPlan: null,`,
`  reviewGroups: [],
  learningGoalScope: null,
  learningHubTab: 'overview',
  sprintPlan: null,`,
    'main hub state',
  );

  s = replaceOne(
    s,
`  elements.reviewArea.addEventListener('change', async event => {
    const scope = event.target.closest('[data-learning-goal-scope]');`,
`  elements.reviewArea.addEventListener('click', async event => {
    const tab = event.target.closest('[data-learning-hub-tab]');
    if (!tab) return;
    state.learningHubTab = tab.dataset.learningHubTab || 'overview';
    await openReviewCenter();
  });

  elements.reviewArea.addEventListener('change', async event => {
    const scope = event.target.closest('[data-learning-goal-scope]');`,
    'main hub listener',
  );

  s = replaceOne(
    s,
`  elements.reviewArea.addEventListener('submit', async event => {
    const sprintForm = event.target.closest('[data-exam-sprint-form]');
    if (!sprintForm) return;
    event.preventDefault();

    const scope =
      sprintForm.querySelector('[data-exam-sprint-scope]')?.value ||
      state.learningGoalScope ||
      GLOBAL_SCOPE;

    const payload = createExamSprintSaveInput({
      scope,
      examLabel: sprintForm.querySelector('[data-exam-sprint-label]')?.value,
      examDate: sprintForm.querySelector('[data-exam-sprint-date]')?.value,
      sprintEnabled: sprintForm.querySelector('[data-exam-sprint-enabled]')?.checked === true,
    });

    await saveLearningGoal(payload);
    state.learningGoalScope = scope;
    showToast(elements.toastRegion, '考前衝刺設定已儲存。', 'success');
    await openReviewCenter();
  });`,
`  elements.reviewArea.addEventListener('submit', async event => {
    const sprintForm = event.target.closest('[data-exam-sprint-form]');
    if (!sprintForm) return;
    event.preventDefault();

    const bankIds = [...sprintForm.querySelectorAll('[data-exam-sprint-bank]:checked')]
      .map(input => input.value)
      .filter(Boolean);
    const sprintEnabled =
      sprintForm.querySelector('[data-exam-sprint-enabled]')?.checked === true;

    if (sprintEnabled && !bankIds.length) {
      showToast(elements.toastRegion, '請至少選擇一個這場考試要使用的題庫。', 'error');
      return;
    }

    const payload = createExamSprintSaveInput({
      bankIds,
      examLabel: sprintForm.querySelector('[data-exam-sprint-label]')?.value,
      examDate: sprintForm.querySelector('[data-exam-sprint-date]')?.value,
      sprintEnabled,
      sprintDailyTarget: sprintForm.querySelector('[data-exam-sprint-daily-target]')?.value,
    });

    await saveLearningGoal(payload);
    state.learningHubTab = 'sprint';
    showToast(elements.toastRegion, '考前衝刺設定已儲存。', 'success');
    await openReviewCenter();
  });`,
    'main P4 independent form',
  );

  const start = s.indexOf('async function openReviewCenter() {');
  const end = s.indexOf('\nasync function startDedicatedReview', start);
  if (start < 0 || end < 0) throw new Error('main openReviewCenter boundaries missing');

  const block = `async function openReviewCenter() {
  await refreshBanks();

  const [goals, attempts, groups] = await Promise.all([
    listLearningGoals(),
    listAllAttempts(),
    Promise.all(state.banks.map(async bank => {
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
    })),
  ]);

  const p3Goals = goals.filter(goal => goal.id !== EXAM_SPRINT_GOAL_ID);
  const validScopes = new Set([GLOBAL_SCOPE, ...state.banks.map(bank => String(bank.id))]);

  if (!state.learningGoalScope || !validScopes.has(state.learningGoalScope)) {
    const configuredGoal = p3Goals.find(goal =>
      goal.enabled === true &&
      (!goal.bankId || validScopes.has(String(goal.bankId)))
    );
    state.learningGoalScope = configuredGoal
      ? configuredGoal.bankId || GLOBAL_SCOPE
      : state.banks[0]?.id || GLOBAL_SCOPE;
  }

  const selectedScope = state.learningGoalScope;
  const goalId = learningGoalIdForScope(selectedScope);
  const existingGoal = p3Goals.find(goal => goal.id === goalId) || null;
  const bankId = selectedScope === GLOBAL_SCOPE ? null : selectedScope;
  const goal = existingGoal || normalizeLearningGoal({
    id: selectedScope === GLOBAL_SCOPE ? GLOBAL_GOAL_ID : goalId,
    bankId,
    enabled: false,
    dailyPracticeTarget: 0,
    dailyReviewTarget: 0,
  });

  const progress = buildLearningGoalProgress(goal, attempts, { historyDays: 7 });

  const explicitSprintGoal = goals.find(item => item.id === EXAM_SPRINT_GOAL_ID) || null;
  const legacySprintGoal = explicitSprintGoal
    ? null
    : goals.find(item =>
        item.id !== EXAM_SPRINT_GOAL_ID &&
        (item.sprintEnabled === true || item.examDate || item.examLabel)
      ) || null;

  const sprintGoal = normalizeLearningGoal(
    explicitSprintGoal || {
      id: EXAM_SPRINT_GOAL_ID,
      bankId: null,
      sprintEnabled: legacySprintGoal?.sprintEnabled === true,
      examDate: legacySprintGoal?.examDate || null,
      examLabel: legacySprintGoal?.examLabel || '',
      sprintBankIds: legacySprintGoal?.bankId ? [legacySprintGoal.bankId] : [],
      sprintDailyTarget: legacySprintGoal?.dailyPracticeTarget || 0,
    }
  );

  const sprintData = await collectSprintData(sprintGoal.sprintBankIds);
  sprintData.attempts = attempts;
  const sprintPlan = buildExamSprintPlan(sprintGoal, sprintData);

  state.reviewGroups = groups;
  state.sprintPlan = sprintPlan;

  renderReviewCenter(elements.reviewArea, groups, {
    activeTab: state.learningHubTab,
    goalModel: {
      banks: state.banks,
      selectedScope,
      configured: Boolean(existingGoal),
      goal,
      progress,
    },
    sprintModel: {
      banks: state.banks,
      goal: sprintGoal,
      plan: sprintPlan,
    },
  });
  showView('review');
}

async function collectSprintData(bankIds = []) {
  const selected = new Set(
    (Array.isArray(bankIds) ? bankIds : [])
      .map(value => String(value))
      .filter(Boolean)
  );
  const targetBanks = state.banks.filter(bank => selected.has(String(bank.id)));

  const chunks = await Promise.all(targetBanks.map(async bank => {
    const [questions, progressRecords, unfamiliarRecords, reviewRecords] = await Promise.all([
      getQuestionsByBank(bank.id),
      listQuestionProgress(bank.id),
      listUnfamiliar(bank.id),
      listReviewSchedules(bank.id),
    ]);

    return {
      questions: questions.map(question => ({
        ...question,
        bankId: bank.id,
        questionId: question.id || question.questionId,
      })),
      progressRecords,
      unfamiliarRecords,
      reviewRecords,
    };
  }));

  return {
    questions: chunks.flatMap(chunk => chunk.questions),
    progressRecords: chunks.flatMap(chunk => chunk.progressRecords),
    unfamiliarRecords: chunks.flatMap(chunk => chunk.unfamiliarRecords),
    reviewRecords: chunks.flatMap(chunk => chunk.reviewRecords),
  };
}

async function startExamSprint(bankId) {
  const plan = state.sprintPlan;
  if (!plan) {
    showToast(elements.toastRegion, '請先重新整理考前衝刺計畫。', 'error');
    state.learningHubTab = 'sprint';
    await openReviewCenter();
    return;
  }

  const selectedIds = new Set(
    (plan.selected || [])
      .filter(item => String(item.bankId) === String(bankId))
      .map(item => item.questionId),
  );

  if (!selectedIds.size) {
    showToast(elements.toastRegion, '這個題庫目前沒有待衝刺題目。', 'info');
    state.learningHubTab = 'sprint';
    await openReviewCenter();
    return;
  }

  const [bank, questions] = await Promise.all([
    getBank(bankId),
    getQuestionsByBank(bankId),
  ]);

  if (!bank) {
    showToast(elements.toastRegion, '找不到這個題庫。', 'error');
    state.learningHubTab = 'sprint';
    await openReviewCenter();
    return;
  }

  const byId = new Map(questions.map(question => [question.id, question]));
  const selectedQuestions = (plan.selected || [])
    .filter(item => String(item.bankId) === String(bankId))
    .map(item => byId.get(item.questionId))
    .filter(Boolean);

  if (!selectedQuestions.length) {
    showToast(elements.toastRegion, '衝刺題目已不存在，已重新計算。', 'info');
    state.learningHubTab = 'sprint';
    await openReviewCenter();
    return;
  }

  state.currentBank = bank;
  state.allQuestions = questions;
  state.filteredQuestions = selectedQuestions;
  state.learningFilter = 'all';
  state.learning = createEmptyLearningState();

  await startPractice(selectedQuestions, 'sprint', { shuffleQuestions: false });
}

`;

  s = s.slice(0, start) + block + s.slice(end);
  write(path, s);
}

// 6. Rename main entry to 今日學習 and load Hub stylesheet.
for (const path of ['v3.html', 'index.html']) {
  let html = read(path);
  html = html.replace(
    '<button class="nav-item" type="button" data-nav-review>今日複習</button>',
    '<button class="nav-item" type="button" data-nav-review>今日學習</button>',
  );
  html = html.replace(
    '<button class="button secondary learning-hero-secondary-cta" type="button" data-nav-review>今日複習</button>',
    '<button class="button secondary learning-hero-secondary-cta" type="button" data-nav-review>今日學習</button>',
  );

  if (!html.includes('styles/v4-learning-hub.css')) {
    html = replaceOne(
      html,
      '  <link rel="stylesheet" href="styles/v4-learning-styles.css" />',
      '  <link rel="stylesheet" href="styles/v4-learning-styles.css" />\n  <link rel="stylesheet" href="styles/v4-learning-hub.css" />',
      `${path} hub stylesheet`,
    );
  }
  write(path, html);
}
if (read('index.html') !== read('v3.html')) {
  throw new Error('P4.2 release entry mismatch: index.html and v3.html must stay identical');
}

// 7. Service Worker.
{
  const path = 'service-worker.js';
  let sw = read(path);
  if (!sw.includes("'./styles/v4-learning-hub.css'")) {
    sw = replaceOne(
      sw,
      "  './styles/v4-learning-styles.css',",
      "  './styles/v4-learning-styles.css',\n  './styles/v4-learning-hub.css',",
      'Hub CSS APP_SHELL',
    );
  }
  if (!sw.includes("'./src/ui/learning-hub.js'")) {
    sw = replaceOne(
      sw,
      "  './src/ui/learning-goals.js',",
      "  './src/ui/learning-goals.js',\n  './src/ui/learning-hub.js',",
      'Hub JS APP_SHELL',
    );
  }
  sw = replaceOne(
    sw,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-12';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-13';",
    'P4.2 cache revision',
  );
  write(path, sw);
}

// 8. Regression chain.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const anchor =
    'node tests/v40-p41-exam-sprint-ui-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const replacement =
    'node tests/v40-p41-exam-sprint-ui-run.mjs && node tests/v40-p42-learning-hub-ia-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  if (!pkg.scripts.test.includes('v40-p42-learning-hub-ia-run.mjs')) {
    if (!pkg.scripts.test.includes(anchor)) throw new Error('package.json P4.2 anchor missing');
    pkg.scripts.test = pkg.scripts.test.replace(anchor, replacement);
  }
  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

// 9. Consolidated changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);
  if (!changelog.includes('## P4.2 — Learning Hub IA Refactor')) {
    const anchor = '## P4.1 — Exam Sprint UI & Session Integration';
    const section =
`## P4.2 — Learning Hub IA Refactor
- 主導覽「今日複習」升級為「今日學習」，建立總覽 / 複習 / 學習目標 / 考前衝刺第二層。
- P3、P4、Review 不再垂直完整堆疊；總覽只保留今日決策資訊。
- P4 與 P3 scope 完全解耦，使用獨立 exam-sprint record。
- P4 新增 sprintBankIds 多題庫明確選擇；空選擇不再等同全部題庫。
- P4 新增 sprintDailyTarget；0 代表依剩餘題量與天數自動建議。
- P3 題庫範圍改成單一題庫優先、Global 明確標示「全部題庫（整體目標）」。
- 沒有既有 P3 設定時，預設第一個本機題庫，不自動使用 Global。
- 新增全站 UX Density Audit，P5 統計開始前先建立次層架構。
- APP cache 更新至 r2k.5-13。

`;
    if (!changelog.includes(anchor)) throw new Error('P4.1 changelog anchor missing');
    changelog = changelog.replace(anchor, section + anchor);
  }
  write(path, changelog);
}

// 10. Strong self-check before full CI.
{
  const main = read('src/app/main.js');
  const core = read('src/learning/exam-sprint.js');
  const sprintUi = read('src/ui/exam-sprint.js');
  const goalUi = read('src/ui/learning-goals.js');
  const goals = read('src/storage/repositories/goals.js');
  const sw = read('service-worker.js');
  const pkg = JSON.parse(read('package.json'));

  for (const [source, marker, label] of [
    [main, "learningHubTab: 'overview'", 'Hub state'],
    [main, 'EXAM_SPRINT_GOAL_ID', 'separate P4 record'],
    [main, 'data-exam-sprint-bank', 'P4 bank form'],
    [main, 'collectSprintData(sprintGoal.sprintBankIds)', 'P4 scoped collection'],
    [core, 'resolveSprintBankIds', 'P4 bank resolver'],
    [core, "'missing-bank-selection'", 'safe empty P4 scope'],
    [sprintUi, '這場考試包含哪些題庫', 'P4 picker'],
    [goalUi, '全部題庫（整體目標）', 'explicit P3 global'],
    [goals, 'sprintBankIds', 'persist P4 banks'],
    [goals, 'sprintDailyTarget', 'persist P4 daily target'],
    [sw, "'./src/ui/learning-hub.js'", 'Hub offline cache'],
  ]) {
    if (!source.includes(marker)) throw new Error(`P4.2 self-check failed: ${label}`);
  }

  if (!pkg.scripts.test.includes('v40-p42-learning-hub-ia-run.mjs')) {
    throw new Error('P4.2 regression missing from package.json');
  }
  if (!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-13'")) {
    throw new Error('P4.2 cache revision missing');
  }
  if (read('index.html') !== read('v3.html')) {
    throw new Error('P4.2 release entries diverged');
  }
}

console.log('P4.2 Learning Hub IA refactor applied successfully.');

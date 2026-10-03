import fs from 'node:fs';

const PAYLOAD = 'scripts/p42-payload';
const REPLACEMENTS = [{"label": "learning goal sprint fields", "path": "src/storage/repositories/goals.js", "search": "    examLabel: String(source.examLabel || '').trim(),\n    sprintEnabled: source.sprintEnabled === true,\n    createdAt: normalizeDateString(source.createdAt, now),", "replacement": "    examLabel: String(source.examLabel || '').trim(),\n    sprintEnabled: source.sprintEnabled === true,\n    sprintBankIds: normalizeStringArray(source.sprintBankIds),\n    sprintDailyTarget: clampInteger(source.sprintDailyTarget, 0, 10000),\n    createdAt: normalizeDateString(source.createdAt, now),"}, {"label": "learning goal array normalization", "path": "src/storage/repositories/goals.js", "search": "function normalizeOptionalDate(value) {", "replacement": "function normalizeStringArray(values) {\n  const result = [];\n  const seen = new Set();\n  for (const value of Array.isArray(values) ? values : []) {\n    const item = String(value || '').trim();\n    if (!item || seen.has(item)) continue;\n    seen.add(item);\n    result.push(item);\n  }\n  return result;\n}\n\nfunction normalizeOptionalDate(value) {"}, {"label": "P3 scope selector", "path": "src/ui/learning-goals.js", "search": "          <span>目標範圍</span>\n          <select data-learning-goal-scope>\n            <option value=\"${GLOBAL_SCOPE}\" ${selectedScope === GLOBAL_SCOPE ? 'selected' : ''}>全部題庫</option>\n            ${banks.map(bank => `\n              <option\n                value=\"${escapeAttr(bank.id)}\"\n                ${selectedScope === String(bank.id) ? 'selected' : ''}\n              >${escapeHtml(bank.name || bank.title || bank.id)}</option>\n            `).join('')}\n          </select>", "replacement": "          <span>學習目標適用題庫</span>\n          <select data-learning-goal-scope>\n            ${banks.length ? `\n              <optgroup label=\"單一題庫\">\n                ${banks.map(bank => `\n                  <option\n                    value=\"${escapeAttr(bank.id)}\"\n                    ${selectedScope === String(bank.id) ? 'selected' : ''}\n                  >${escapeHtml(bank.name || bank.title || bank.id)}</option>\n                `).join('')}\n              </optgroup>\n            ` : ''}\n            <optgroup label=\"整體範圍\">\n              <option value=\"${GLOBAL_SCOPE}\" ${selectedScope === GLOBAL_SCOPE ? 'selected' : ''}>全部題庫（整體目標）</option>\n            </optgroup>\n          </select>"}, {"label": "P4 id and today-count options", "path": "src/learning/exam-sprint.js", "search": "export const SPRINT_LOW_MASTERY_MAX_LEVEL = 2;\n\nexport function buildExamSprintPlan(goal = {}, data = {}, {\n  now = new Date(),\n  timeZone = null,\n  todayPracticeCount = 0,\n} = {}) {", "replacement": "export const SPRINT_LOW_MASTERY_MAX_LEVEL = 2;\nexport const EXAM_SPRINT_GOAL_ID = 'exam-sprint';\n\nexport function buildExamSprintPlan(goal = {}, data = {}, {\n  now = new Date(),\n  timeZone = null,\n  todayPracticeCount = null,\n} = {}) {"}, {"label": "P4 bank selection", "path": "src/learning/exam-sprint.js", "search": "  const questions = normalizeQuestions(data?.questions, goal?.bankId);", "replacement": "  const sprintBankIds = resolveSprintBankIds(goal);\n  const hasBankSelection = sprintBankIds === null || sprintBankIds.length > 0;\n  const questions = normalizeQuestions(data?.questions, sprintBankIds, goal?.bankId);"}, {"label": "P4 multi-bank today scope", "path": "src/learning/exam-sprint.js", "search": "  const completedTodayKeys = buildTodayPracticeKeySet(data?.attempts, {\n    now,\n    timeZone,\n    bankId: goal?.bankId,\n  });", "replacement": "  const completedTodayKeys = buildTodayPracticeKeySet(data?.attempts, {\n    now,\n    timeZone,\n    bankIds: sprintBankIds,\n    bankId: goal?.bankId,\n  });"}, {"label": "P4 independent target", "path": "src/learning/exam-sprint.js", "search": "  const configuredDailyTarget = clampTarget(goal?.dailyPracticeTarget);", "replacement": "  const configuredDailyTarget =\n    clampTarget(goal?.sprintDailyTarget) ||\n    clampTarget(goal?.dailyPracticeTarget);"}, {"label": "P4 derive today count", "path": "src/learning/exam-sprint.js", "search": "  const completedPracticeToday = Math.max(\n    0,\n    Math.round(Number(todayPracticeCount) || 0),\n  );", "replacement": "  const completedPracticeToday =\n    todayPracticeCount === null || todayPracticeCount === undefined\n      ? completedTodayKeys.size\n      : Math.max(0, Math.round(Number(todayPracticeCount) || 0));"}, {"label": "P4 active scope requirement", "path": "src/learning/exam-sprint.js", "search": "  const active =\n    enabled &&\n    hasExamDate &&\n    !examPassed &&\n    candidateCount > 0;", "replacement": "  const active =\n    enabled &&\n    hasBankSelection &&\n    hasExamDate &&\n    !examPassed &&\n    candidateCount > 0;"}, {"label": "P4 result bank ids", "path": "src/learning/exam-sprint.js", "search": "    bankId: goal?.bankId ? String(goal.bankId) : null,\n    examLabel: String(goal?.examLabel || '').trim(),", "replacement": "    bankId: goal?.bankId ? String(goal.bankId) : null,\n    bankIds: sprintBankIds,\n    examLabel: String(goal?.examLabel || '').trim(),"}, {"label": "P4 status scope arg", "path": "src/learning/exam-sprint.js", "search": "      enabled,\n      hasExamDate,", "replacement": "      enabled,\n      hasBankSelection,\n      hasExamDate,"}, {"label": "P4 today bank set", "path": "src/learning/exam-sprint.js", "search": "export function buildTodayPracticeKeySet(attempts = [], {\n  now = new Date(),\n  timeZone = null,\n  bankId = null,\n} = {}) {\n  const todayKey = localDateKey(now, { timeZone });\n  const scopedBankId = bankId ? String(bankId) : null;\n  const keys = new Set();\n\n  for (const attempt of Array.isArray(attempts) ? attempts : []) {\n    if (!attempt?.timestamp) continue;\n    if (scopedBankId && String(attempt.bankId || '') !== scopedBankId) continue;", "replacement": "export function buildTodayPracticeKeySet(attempts = [], {\n  now = new Date(),\n  timeZone = null,\n  bankIds = null,\n  bankId = null,\n} = {}) {\n  const todayKey = localDateKey(now, { timeZone });\n  const explicitBankIds = Array.isArray(bankIds)\n    ? new Set(bankIds.map(value => String(value)))\n    : null;\n  const scopedBankId = bankId ? String(bankId) : null;\n  const keys = new Set();\n\n  for (const attempt of Array.isArray(attempts) ? attempts : []) {\n    if (!attempt?.timestamp) continue;\n    if (explicitBankIds && !explicitBankIds.has(String(attempt.bankId || ''))) continue;\n    if (!explicitBankIds && scopedBankId && String(attempt.bankId || '') !== scopedBankId) continue;"}, {"label": "P4 bank resolver", "path": "src/learning/exam-sprint.js", "search": "export function normalizeExamDateKey(value) {", "replacement": "export function resolveSprintBankIds(goal = {}) {\n  if (Array.isArray(goal?.sprintBankIds)) {\n    const result = [];\n    const seen = new Set();\n    for (const value of goal.sprintBankIds) {\n      const id = String(value || '').trim();\n      if (!id || seen.has(id)) continue;\n      seen.add(id);\n      result.push(id);\n    }\n    return result;\n  }\n\n  if (goal?.bankId) return [String(goal.bankId)];\n\n  // Legacy P4 Core treated global/no-bank as all banks. New exam-sprint\n  // records always persist sprintBankIds, so [] safely means no selection.\n  if (String(goal?.id || '') !== EXAM_SPRINT_GOAL_ID) return null;\n  return [];\n}\n\nexport function normalizeExamDateKey(value) {"}, {"label": "P4 normalize selected banks", "path": "src/learning/exam-sprint.js", "search": "function normalizeQuestions(questions, fallbackBankId = null) {\n  const fallback = fallbackBankId ? String(fallbackBankId) : '';\n  const seen = new Set();\n  const normalized = [];\n\n  for (const question of Array.isArray(questions) ? questions : []) {\n    const bankId = String(question?.bankId || fallback || '');\n    const questionId = String(question?.questionId || question?.id || '');\n    if (!bankId || !questionId) continue;\n    if (fallback && bankId !== fallback) continue;", "replacement": "function normalizeQuestions(questions, allowedBankIds = null, fallbackBankId = null) {\n  const fallback = fallbackBankId ? String(fallbackBankId) : '';\n  const allowed = Array.isArray(allowedBankIds)\n    ? new Set(allowedBankIds.map(value => String(value)))\n    : null;\n  const seen = new Set();\n  const normalized = [];\n\n  for (const question of Array.isArray(questions) ? questions : []) {\n    const bankId = String(question?.bankId || fallback || '');\n    const questionId = String(question?.questionId || question?.id || '');\n    if (!bankId || !questionId) continue;\n    if (allowed && !allowed.has(bankId)) continue;\n    if (!allowed && fallback && bankId !== fallback) continue;"}, {"label": "P4 status signature", "path": "src/learning/exam-sprint.js", "search": "function sprintStatus({\n  enabled,\n  hasExamDate,", "replacement": "function sprintStatus({\n  enabled,\n  hasBankSelection,\n  hasExamDate,"}, {"label": "P4 missing-bank status", "path": "src/learning/exam-sprint.js", "search": "  if (!enabled) return 'disabled';\n  if (!hasExamDate) return 'missing-exam-date';", "replacement": "  if (!enabled) return 'disabled';\n  if (!hasBankSelection) return 'missing-bank-selection';\n  if (!hasExamDate) return 'missing-exam-date';"}, {"label": "main P4 import", "path": "src/app/main.js", "search": "import { buildExamSprintPlan } from '../learning/exam-sprint.js';", "replacement": "import {\n  EXAM_SPRINT_GOAL_ID,\n  buildExamSprintPlan,\n} from '../learning/exam-sprint.js';"}, {"label": "main hub state", "path": "src/app/main.js", "search": "  reviewGroups: [],\n  learningGoalScope: GLOBAL_SCOPE,\n  sprintPlan: null,", "replacement": "  reviewGroups: [],\n  learningGoalScope: null,\n  learningHubTab: 'overview',\n  sprintPlan: null,"}, {"label": "main hub listener", "path": "src/app/main.js", "search": "  elements.reviewArea.addEventListener('change', async event => {\n    const scope = event.target.closest('[data-learning-goal-scope]');", "replacement": "  elements.reviewArea.addEventListener('click', async event => {\n    const tab = event.target.closest('[data-learning-hub-tab]');\n    if (!tab) return;\n    state.learningHubTab = tab.dataset.learningHubTab || 'overview';\n    await openReviewCenter();\n  });\n\n  elements.reviewArea.addEventListener('change', async event => {\n    const scope = event.target.closest('[data-learning-goal-scope]');"}, {"label": "main P4 independent form", "path": "src/app/main.js", "search": "  elements.reviewArea.addEventListener('submit', async event => {\n    const sprintForm = event.target.closest('[data-exam-sprint-form]');\n    if (!sprintForm) return;\n    event.preventDefault();\n\n    const scope =\n      sprintForm.querySelector('[data-exam-sprint-scope]')?.value ||\n      state.learningGoalScope ||\n      GLOBAL_SCOPE;\n\n    const payload = createExamSprintSaveInput({\n      scope,\n      examLabel: sprintForm.querySelector('[data-exam-sprint-label]')?.value,\n      examDate: sprintForm.querySelector('[data-exam-sprint-date]')?.value,\n      sprintEnabled: sprintForm.querySelector('[data-exam-sprint-enabled]')?.checked === true,\n    });\n\n    await saveLearningGoal(payload);\n    state.learningGoalScope = scope;\n    showToast(elements.toastRegion, '考前衝刺設定已儲存。', 'success');\n    await openReviewCenter();\n  });", "replacement": "  elements.reviewArea.addEventListener('submit', async event => {\n    const sprintForm = event.target.closest('[data-exam-sprint-form]');\n    if (!sprintForm) return;\n    event.preventDefault();\n\n    const bankIds = [...sprintForm.querySelectorAll('[data-exam-sprint-bank]:checked')]\n      .map(input => input.value)\n      .filter(Boolean);\n    const sprintEnabled =\n      sprintForm.querySelector('[data-exam-sprint-enabled]')?.checked === true;\n\n    if (sprintEnabled && !bankIds.length) {\n      showToast(elements.toastRegion, '請至少選擇一個這場考試要使用的題庫。', 'error');\n      return;\n    }\n\n    const payload = createExamSprintSaveInput({\n      bankIds,\n      examLabel: sprintForm.querySelector('[data-exam-sprint-label]')?.value,\n      examDate: sprintForm.querySelector('[data-exam-sprint-date]')?.value,\n      sprintEnabled,\n      sprintDailyTarget: sprintForm.querySelector('[data-exam-sprint-daily-target]')?.value,\n    });\n\n    await saveLearningGoal(payload);\n    state.learningHubTab = 'sprint';\n    showToast(elements.toastRegion, '考前衝刺設定已儲存。', 'success');\n    await openReviewCenter();\n  });"}];
const OPEN_REVIEW_BLOCK = "async function openReviewCenter() {\n  await refreshBanks();\n\n  const [goals, attempts, groups] = await Promise.all([\n    listLearningGoals(),\n    listAllAttempts(),\n    Promise.all(state.banks.map(async bank => {\n      const [questions, progress, favorites, unfamiliar, due] = await Promise.all([\n        getQuestionsByBank(bank.id),\n        listQuestionProgress(bank.id),\n        listFavorites(bank.id),\n        listUnfamiliar(bank.id),\n        listDueReviews(bank.id),\n      ]);\n\n      const validIds = new Set(questions.map(question => question.id));\n      const wrongIds = new Set(\n        progress\n          .filter(item => item?.lastResult === 'wrong' && validIds.has(item.questionId))\n          .map(item => item.questionId)\n      );\n\n      return {\n        bank,\n        questionCount: questions.length,\n        counts: {\n          due: due.filter(item => validIds.has(item.questionId)).length,\n          wrong: wrongIds.size,\n          favorite: favorites.filter(item => validIds.has(item.questionId)).length,\n          unfamiliar: unfamiliar.filter(item => validIds.has(item.questionId)).length,\n        },\n      };\n    })),\n  ]);\n\n  const p3Goals = goals.filter(goal => goal.id !== EXAM_SPRINT_GOAL_ID);\n  const validScopes = new Set([GLOBAL_SCOPE, ...state.banks.map(bank => String(bank.id))]);\n\n  if (!state.learningGoalScope || !validScopes.has(state.learningGoalScope)) {\n    const configuredGoal = p3Goals.find(goal =>\n      goal.enabled === true &&\n      (!goal.bankId || validScopes.has(String(goal.bankId)))\n    );\n    state.learningGoalScope = configuredGoal\n      ? configuredGoal.bankId || GLOBAL_SCOPE\n      : state.banks[0]?.id || GLOBAL_SCOPE;\n  }\n\n  const selectedScope = state.learningGoalScope;\n  const goalId = learningGoalIdForScope(selectedScope);\n  const existingGoal = p3Goals.find(goal => goal.id === goalId) || null;\n  const bankId = selectedScope === GLOBAL_SCOPE ? null : selectedScope;\n  const goal = existingGoal || normalizeLearningGoal({\n    id: selectedScope === GLOBAL_SCOPE ? GLOBAL_GOAL_ID : goalId,\n    bankId,\n    enabled: false,\n    dailyPracticeTarget: 0,\n    dailyReviewTarget: 0,\n  });\n\n  const progress = buildLearningGoalProgress(goal, attempts, { historyDays: 7 });\n\n  const explicitSprintGoal = goals.find(item => item.id === EXAM_SPRINT_GOAL_ID) || null;\n  const legacySprintGoal = explicitSprintGoal\n    ? null\n    : goals.find(item =>\n        item.id !== EXAM_SPRINT_GOAL_ID &&\n        (item.sprintEnabled === true || item.examDate || item.examLabel)\n      ) || null;\n\n  const sprintGoal = normalizeLearningGoal(\n    explicitSprintGoal || {\n      id: EXAM_SPRINT_GOAL_ID,\n      bankId: null,\n      sprintEnabled: legacySprintGoal?.sprintEnabled === true,\n      examDate: legacySprintGoal?.examDate || null,\n      examLabel: legacySprintGoal?.examLabel || '',\n      sprintBankIds: legacySprintGoal?.bankId ? [legacySprintGoal.bankId] : [],\n      sprintDailyTarget: legacySprintGoal?.dailyPracticeTarget || 0,\n    }\n  );\n\n  const sprintData = await collectSprintData(sprintGoal.sprintBankIds);\n  sprintData.attempts = attempts;\n  const sprintPlan = buildExamSprintPlan(sprintGoal, sprintData);\n\n  state.reviewGroups = groups;\n  state.sprintPlan = sprintPlan;\n\n  renderReviewCenter(elements.reviewArea, groups, {\n    activeTab: state.learningHubTab,\n    goalModel: {\n      banks: state.banks,\n      selectedScope,\n      configured: Boolean(existingGoal),\n      goal,\n      progress,\n    },\n    sprintModel: {\n      banks: state.banks,\n      goal: sprintGoal,\n      plan: sprintPlan,\n    },\n  });\n  showView('review');\n}\n\nasync function collectSprintData(bankIds = []) {\n  const selected = new Set(\n    (Array.isArray(bankIds) ? bankIds : [])\n      .map(value => String(value))\n      .filter(Boolean)\n  );\n  const targetBanks = state.banks.filter(bank => selected.has(String(bank.id)));\n\n  const chunks = await Promise.all(targetBanks.map(async bank => {\n    const [questions, progressRecords, unfamiliarRecords, reviewRecords] = await Promise.all([\n      getQuestionsByBank(bank.id),\n      listQuestionProgress(bank.id),\n      listUnfamiliar(bank.id),\n      listReviewSchedules(bank.id),\n    ]);\n\n    return {\n      questions: questions.map(question => ({\n        ...question,\n        bankId: bank.id,\n        questionId: question.id || question.questionId,\n      })),\n      progressRecords,\n      unfamiliarRecords,\n      reviewRecords,\n    };\n  }));\n\n  return {\n    questions: chunks.flatMap(chunk => chunk.questions),\n    progressRecords: chunks.flatMap(chunk => chunk.progressRecords),\n    unfamiliarRecords: chunks.flatMap(chunk => chunk.unfamiliarRecords),\n    reviewRecords: chunks.flatMap(chunk => chunk.reviewRecords),\n  };\n}\n\nasync function startExamSprint(bankId) {\n  const plan = state.sprintPlan;\n  if (!plan) {\n    showToast(elements.toastRegion, '請先重新整理考前衝刺計畫。', 'error');\n    state.learningHubTab = 'sprint';\n    await openReviewCenter();\n    return;\n  }\n\n  const selectedIds = new Set(\n    (plan.selected || [])\n      .filter(item => String(item.bankId) === String(bankId))\n      .map(item => item.questionId),\n  );\n\n  if (!selectedIds.size) {\n    showToast(elements.toastRegion, '這個題庫目前沒有待衝刺題目。', 'info');\n    state.learningHubTab = 'sprint';\n    await openReviewCenter();\n    return;\n  }\n\n  const [bank, questions] = await Promise.all([\n    getBank(bankId),\n    getQuestionsByBank(bankId),\n  ]);\n\n  if (!bank) {\n    showToast(elements.toastRegion, '找不到這個題庫。', 'error');\n    state.learningHubTab = 'sprint';\n    await openReviewCenter();\n    return;\n  }\n\n  const byId = new Map(questions.map(question => [question.id, question]));\n  const selectedQuestions = (plan.selected || [])\n    .filter(item => String(item.bankId) === String(bankId))\n    .map(item => byId.get(item.questionId))\n    .filter(Boolean);\n\n  if (!selectedQuestions.length) {\n    showToast(elements.toastRegion, '衝刺題目已不存在，已重新計算。', 'info');\n    state.learningHubTab = 'sprint';\n    await openReviewCenter();\n    return;\n  }\n\n  state.currentBank = bank;\n  state.allQuestions = questions;\n  state.filteredQuestions = selectedQuestions;\n  state.learningFilter = 'all';\n  state.learning = createEmptyLearningState();\n\n  await startPractice(selectedQuestions, 'sprint', { shuffleQuestions: false });\n}\n\n";

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
}
function copyPayload(from, to) {
  write(to, read(PAYLOAD + '/' + from));
}
function replaceOne(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error('Missing patch anchor: ' + label);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error('Patch anchor is not unique: ' + label);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}
function applyReplacement(patch) {
  const source = read(patch.path);
  write(
    patch.path,
    replaceOne(source, patch.search, patch.replacement, patch.label),
  );
}

// Permanent payload files are copied only inside the CI job.
copyPayload('src/ui/learning-hub.js', 'src/ui/learning-hub.js');
copyPayload('src/ui/review-center.js', 'src/ui/review-center.js');
copyPayload('src/ui/exam-sprint.js', 'src/ui/exam-sprint.js');
copyPayload('styles/v4-learning-hub.css', 'styles/v4-learning-hub.css');
copyPayload('tests/v40-p42-learning-hub-ia-run.mjs', 'tests/v40-p42-learning-hub-ia-run.mjs');
copyPayload('docs/V4_0_P4_2_LEARNING_HUB_IA.md', 'docs/V4_0_P4_2_LEARNING_HUB_IA.md');
copyPayload('docs/V4_0_UX_DENSITY_AUDIT.md', 'docs/V4_0_UX_DENSITY_AUDIT.md');

// Apply all exact baseline replacements safely. Target-code ${...} is data,
// not an installer template literal, so it cannot execute here.
for (const patch of REPLACEMENTS) applyReplacement(patch);

// Append P4.2 picker styles.
{
  const path = 'styles/v4-exam-sprint.css';
  let css = read(path);
  const append = read(PAYLOAD + '/styles/v4-exam-sprint-p42-append.css');
  if (!css.includes('P4.2 — explicit exam bank selection')) css += '\n' + append;
  write(path, css);
}

// Replace the existing review/sprint orchestration block.
{
  const path = 'src/app/main.js';
  let s = read(path);
  const start = s.indexOf('async function openReviewCenter() {');
  const end = s.indexOf('\nasync function startDedicatedReview', start);
  if (start < 0 || end < 0) throw new Error('main openReviewCenter boundaries missing');
  s = s.slice(0, start) + OPEN_REVIEW_BLOCK + s.slice(end);
  write(path, s);
}

// Rename the main entry and load Hub stylesheet.
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
      path + ' hub stylesheet',
    );
  }
  write(path, html);
}

if (read('index.html') !== read('v3.html')) {
  throw new Error('P4.2 release entry mismatch: index.html and v3.html must stay identical');
}

// Service Worker.
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

// Regression chain.
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

// Changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);
  if (!changelog.includes('## P4.2 — Learning Hub IA Refactor')) {
    const anchor = '## P4.1 — Exam Sprint UI & Session Integration';
    const section =
      '## P4.2 — Learning Hub IA Refactor\n' +
      '- 主導覽「今日複習」升級為「今日學習」，建立總覽 / 複習 / 學習目標 / 考前衝刺第二層。\n' +
      '- P3、P4、Review 不再垂直完整堆疊；總覽只保留今日決策資訊。\n' +
      '- P4 與 P3 scope 完全解耦，使用獨立 exam-sprint record。\n' +
      '- P4 新增 sprintBankIds 多題庫明確選擇；空選擇不再等同全部題庫。\n' +
      '- P4 新增 sprintDailyTarget；0 代表依剩餘題量與天數自動建議。\n' +
      '- P3 題庫範圍改成單一題庫優先、Global 明確標示「全部題庫（整體目標）」。\n' +
      '- 沒有既有 P3 設定時，預設第一個本機題庫，不自動使用 Global。\n' +
      '- 新增全站 UX Density Audit，P5 統計開始前先建立次層架構。\n' +
      '- APP cache 更新至 r2k.5-13。\n\n';
    if (!changelog.includes(anchor)) throw new Error('P4.1 changelog anchor missing');
    changelog = changelog.replace(anchor, section + anchor);
  }
  write(path, changelog);
}

// Strong self-check before full CI.
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
    if (!source.includes(marker)) throw new Error('P4.2 self-check failed: ' + label);
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

import {
  buildLearningGoalProgress,
  localDateKey,
} from './goal-progress.js';
import { EXAM_SPRINT_GOAL_ID } from './exam-sprint.js';

export const HOME_BACKUP_STALE_DAYS = 7;

export function buildHomeDashboard({
  banks = [],
  goals = [],
  attempts = [],
  summaries = [],
  resumeSession = null,
  lastBackupAt = null,
  now = new Date(),
  timeZone = null,
} = {}) {
  const installedBanks = Array.isArray(banks) ? banks : [];
  const bankMap = new Map(
    installedBanks.map(bank => [String(bank.id), bank]),
  );
  const validBankIds = new Set(bankMap.keys());

  const primaryGoal = pickPrimaryHomeGoal(goals, validBankIds);
  const goalProgress = primaryGoal
    ? buildLearningGoalProgress(primaryGoal, attempts, {
        now,
        timeZone,
        historyDays: 7,
      })
    : null;

  const globalProgress = buildLearningGoalProgress({
    id: 'home-global',
    bankId: null,
    enabled: false,
    dailyPracticeTarget: 0,
    dailyReviewTarget: 0,
  }, attempts, {
    now,
    timeZone,
    historyDays: 7,
  });

  const normalizedSummaries = (Array.isArray(summaries) ? summaries : [])
    .filter(item => item?.bank && validBankIds.has(String(item.bank.id)))
    .map(item => ({
      bank: item.bank,
      due: Math.max(0, Number(item.due || 0)),
      wrong: Math.max(0, Number(item.wrong || 0)),
    }));

  const dueTotal = normalizedSummaries.reduce((sum, item) => sum + item.due, 0);
  const wrongTotal = normalizedSummaries.reduce((sum, item) => sum + item.wrong, 0);
  const wrongBank = [...normalizedSummaries]
    .filter(item => item.wrong > 0)
    .sort((a, b) =>
      b.wrong - a.wrong ||
      String(a.bank.name || a.bank.title || a.bank.id)
        .localeCompare(String(b.bank.name || b.bank.title || b.bank.id))
    )[0] || null;

  const sprintGoal = (Array.isArray(goals) ? goals : [])
    .find(goal => String(goal?.id || '') === EXAM_SPRINT_GOAL_ID) || null;

  return {
    goal: buildGoalCard(primaryGoal, goalProgress, bankMap),
    streak: {
      days: Number(globalProgress.streak || 0),
      todayAnswered: Number(globalProgress.today?.answered || 0),
      todayPractice: Number(globalProgress.today?.practice || 0),
      todayReview: Number(globalProgress.today?.review || 0),
    },
    resume: buildResumeCard(resumeSession, bankMap),
    review: {
      dueTotal,
      wrongTotal,
      wrongBankId: wrongBank ? String(wrongBank.bank.id) : null,
      wrongBankName: wrongBank
        ? String(wrongBank.bank.name || wrongBank.bank.title || wrongBank.bank.id)
        : null,
    },
    sprint: buildSprintCard(sprintGoal, bankMap, { now, timeZone }),
    backup: buildBackupStatus(lastBackupAt, {
      now,
      staleAfterDays: HOME_BACKUP_STALE_DAYS,
    }),
  };
}

export function pickPrimaryHomeGoal(goals = [], validBankIds = new Set()) {
  const source = (Array.isArray(goals) ? goals : [])
    .filter(goal => {
      if (!goal || String(goal.id || '') === EXAM_SPRINT_GOAL_ID) return false;
      if (goal.enabled !== true) return false;

      const practice = Math.max(0, Number(goal.dailyPracticeTarget || 0));
      const review = Math.max(0, Number(goal.dailyReviewTarget || 0));
      if (practice + review <= 0) return false;

      if (!goal.bankId) return true;
      return validBankIds.has(String(goal.bankId));
    });

  const globals = source
    .filter(goal => !goal.bankId)
    .sort(compareUpdatedDesc);
  if (globals.length) return globals[0];

  return source.sort(compareUpdatedDesc)[0] || null;
}

export function buildBackupStatus(lastBackupAt, {
  now = new Date(),
  staleAfterDays = HOME_BACKUP_STALE_DAYS,
} = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const backupDate = lastBackupAt instanceof Date
    ? lastBackupAt
    : new Date(lastBackupAt || '');

  if (
    Number.isNaN(nowDate.getTime()) ||
    Number.isNaN(backupDate.getTime())
  ) {
    return {
      status: 'never',
      lastBackupAt: null,
      daysAgo: null,
      stale: true,
    };
  }

  const elapsed = Math.max(0, nowDate.getTime() - backupDate.getTime());
  const daysAgo = Math.floor(elapsed / 86400000);
  const threshold = Math.max(1, Number(staleAfterDays || HOME_BACKUP_STALE_DAYS));

  return {
    status: daysAgo >= threshold ? 'stale' : 'fresh',
    lastBackupAt: backupDate.toISOString(),
    daysAgo,
    stale: daysAgo >= threshold,
  };
}

export function calendarDaysUntil(dateKey, {
  now = new Date(),
  timeZone = null,
} = {}) {
  const target = parseDateKey(dateKey);
  const todayKey = localDateKey(now, { timeZone });
  const today = parseDateKey(todayKey);
  if (!target || !today) return null;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function buildGoalCard(goal, progress, bankMap) {
  if (!goal || !progress) {
    return {
      configured: false,
      scopeLabel: '尚未設定',
      percent: 0,
      practice: { count: 0, target: 0, active: false },
      review: { count: 0, target: 0, active: false },
    };
  }

  const bankId = goal.bankId ? String(goal.bankId) : null;
  const bank = bankId ? bankMap.get(bankId) : null;

  return {
    configured: true,
    scopeLabel: bankId
      ? String(bank?.name || bank?.title || bankId)
      : '全部題庫',
    percent: Number(progress.today?.completionPercent || 0),
    practice: {
      count: Number(progress.today?.practiceGoal?.count || 0),
      target: Number(progress.today?.practiceGoal?.target || 0),
      active: progress.today?.practiceGoal?.active === true,
    },
    review: {
      count: Number(progress.today?.reviewGoal?.count || 0),
      target: Number(progress.today?.reviewGoal?.target || 0),
      active: progress.today?.reviewGoal?.active === true,
    },
  };
}

function buildResumeCard(session, bankMap) {
  if (!session?.bankId || !bankMap.has(String(session.bankId))) {
    return null;
  }

  const source = Array.isArray(session.sourceQuestionIds)
    ? session.sourceQuestionIds
    : [];
  const completed = new Set(
    Array.isArray(session.completedIds) ? session.completedIds : [],
  );
  const total = source.length;
  const completedCount = source.filter(id => completed.has(id)).length;
  const bank = bankMap.get(String(session.bankId));

  return {
    bankId: String(session.bankId),
    bankName: String(bank?.name || bank?.title || session.bankName || session.bankId),
    mode: String(session.mode || 'filtered'),
    completed: completedCount,
    total,
    remaining: Math.max(0, total - completedCount),
    updatedAt: session.updatedAt || null,
  };
}

function buildSprintCard(goal, bankMap, { now, timeZone }) {
  const bankIds = Array.isArray(goal?.sprintBankIds)
    ? [...new Set(goal.sprintBankIds.map(String))]
      .filter(id => bankMap.has(id))
    : [];

  const daysUntilExam = calendarDaysUntil(goal?.examDate, { now, timeZone });
  const configured =
    goal?.sprintEnabled === true &&
    Boolean(goal?.examDate) &&
    bankIds.length > 0;

  return {
    configured,
    label: String(goal?.examLabel || '考前衝刺'),
    examDate: goal?.examDate || null,
    daysUntilExam,
    bankCount: bankIds.length,
  };
}

function compareUpdatedDesc(a, b) {
  return String(b?.updatedAt || '').localeCompare(String(a?.updatedAt || ''));
}

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;

  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ));
  return Number.isNaN(date.getTime()) ? null : date;
}

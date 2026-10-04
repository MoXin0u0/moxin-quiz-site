import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createExamSprintSaveInput,
  renderExamSprintPanel,
} from '../src/ui/exam-sprint.js';

import {
  buildExamSprintPlan,
} from '../src/learning/exam-sprint.js';

import {
  createPracticeSession,
} from '../src/quiz/session-engine.js';

const saveInput = createExamSprintSaveInput({
  scope: 'erp',
  examLabel: ' ERP 期末考 ',
  examDate: '2026-11-15',
  sprintEnabled: true,
});

assert.deepEqual(saveInput, {
  id: 'bank:erp',
  bankId: 'erp',
  examLabel: 'ERP 期末考',
  examDate: '2026-11-15',
  sprintEnabled: true,
});

const html = renderExamSprintPanel({
  selectedScope: 'erp',
  banks: [{ id: 'erp', name: 'ERP 題庫' }],
  goal: {
    id: 'bank:erp',
    bankId: 'erp',
    sprintEnabled: true,
    examLabel: 'ERP 期末考',
    examDate: '2026-11-15T00:00:00.000Z',
  },
  plan: {
    status: 'ready',
    examDateKey: '2026-11-15',
    daysUntilExam: 43,
    remainingToday: 18,
    dailyTarget: 30,
    completedPracticeToday: 12,
    candidateCount: 100,
    projectedCoverage: 80,
    coverageGap: 20,
    recommendedDailyTarget: 38,
    selectionTarget: 18,
    priorityCounts: {
      wrong: 5,
      unfamiliar: 4,
      due: 3,
      'low-mastery': 20,
      unanswered: 60,
      other: 8,
    },
    selected: [
      { bankId: 'erp', questionId: 'Q1' },
      { bankId: 'erp', questionId: 'Q2' },
    ],
  },
});

assert.match(html, /P4 · 考前衝刺/);
assert.match(html, /43 天/);
assert.match(html, /18 題/);
assert.match(html, /缺口 20 題/);
assert.match(html, /建議約 38 題／日/);
assert.match(html, /目前錯題/);
assert.match(html, /低熟練/);
assert.match(html, /ERP 題庫/);
assert.match(html, /data-start-sprint-bank="erp"/);
assert.match(html, /data-exam-sprint-form/);
assert.match(html, /data-exam-sprint-date/);

// Sprint must keep Core priority order instead of shuffling the selected queue.
const ordered = createPracticeSession({
  bankId: 'erp',
  bankName: 'ERP',
  questions: [{ id: 'W' }, { id: 'U' }, { id: 'D' }],
  mode: 'sprint',
  shuffleQuestions: false,
});
assert.deepEqual(ordered.queue, ['W', 'U', 'D']);
assert.equal(ordered.mode, 'sprint');

// Questions already counted as today's normal practice are excluded from the
// sprint selection pool, otherwise retrying them cannot advance P3 unique count.
{
  const now = new Date('2026-10-03T12:00:00.000Z');
  const plan = buildExamSprintPlan({
    id: 'bank:erp',
    bankId: 'erp',
    sprintEnabled: true,
    examDate: '2026-10-10',
    dailyPracticeTarget: 2,
  }, {
    questions: [
      { bankId: 'erp', questionId: 'Q1' },
      { bankId: 'erp', questionId: 'Q2' },
      { bankId: 'erp', questionId: 'Q3' },
    ],
    attempts: [
      {
        bankId: 'erp',
        questionId: 'Q1',
        timestamp: '2026-10-03T01:00:00.000Z',
        mode: 'filtered',
      },
    ],
  }, {
    now,
    timeZone: 'Asia/Taipei',
    todayPracticeCount: 1,
  });

  assert.equal(plan.remainingToday, 1);
  assert.equal(plan.availableTodayCount, 2);
  assert.equal(plan.selected.length, 1);
  assert.notEqual(plan.selected[0].questionId, 'Q1');
}

const main = fs.readFileSync('src/app/main.js', 'utf8');
const review = fs.readFileSync('src/ui/review-center.js', 'utf8');
const session = fs.readFileSync('src/quiz/session-engine.js', 'utf8');
const css = fs.readFileSync('styles/v4-exam-sprint.css', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const index = fs.readFileSync('app.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(main, /buildExamSprintPlan/);
assert.match(main, /createExamSprintSaveInput/);
assert.match(main, /data-exam-sprint-form/);
assert.match(main, /data-start-sprint-bank/);
assert.match(main, /startExamSprint/);
assert.match(main, /collectSprintData/);
assert.match(main, /shuffleQuestions: false/);
assert.match(main, /modeOverride = null, options = \{\}/);

assert.match(review, /renderExamSprintPanel/);
assert.match(review, /sprintModel/);

assert.match(session, /shuffleQuestions = true/);
assert.match(session, /shuffleQuestions \? shuffle\(ids, random\) : \[\.\.\.ids\]/);

assert.match(css, /\.exam-sprint-panel/);
assert.match(css, /\.exam-sprint-priority-grid/);
assert.match(css, /@media \(max-width: 560px\)/);

assert.match(v3, /styles\/v4-exam-sprint\.css/);
assert.equal(index, v3);
assert.match(sw, /\.\/styles\/v4-exam-sprint\.css/);
assert.match(sw, /\.\/src\/ui\/exam-sprint\.js/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);

console.log('MoXin Quiz v4.0 P4.1 exam sprint UI/session integration tests passed.');

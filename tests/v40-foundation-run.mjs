import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_CONFIG } from '../src/app/config.js';
import {
  createStudioDraft,
  normalizeStudioDraft,
  STUDIO_DRAFT_STATUS,
} from '../src/storage/repositories/studio.js';
import {
  GLOBAL_GOAL_ID,
  normalizeLearningGoal,
} from '../src/storage/repositories/goals.js';

assert.equal(APP_CONFIG.dbVersion, 3);

const dbSource = fs.readFileSync('src/storage/db.js', 'utf8');
assert.match(dbSource, /studioDrafts:/);
assert.match(dbSource, /learningGoals:/);

const draft = createStudioDraft({
  bankId: 'bank_a',
  manifest: { id: 'bank_a', name: 'A' },
  questions: [{ id: 'Q001' }],
});
assert.match(draft.id, /^draft-/);
assert.equal(draft.bankId, 'bank_a');
assert.equal(draft.status, STUDIO_DRAFT_STATUS.DRAFT);
assert.equal(draft.questions.length, 1);

const normalizedDraft = normalizeStudioDraft({
  id: 'draft-fixed',
  status: 'invalid',
  assets: [{ path: 'assets/images/a.png', size: 12 }],
});
assert.equal(normalizedDraft.id, 'draft-fixed');
assert.equal(normalizedDraft.status, STUDIO_DRAFT_STATUS.DRAFT);
assert.equal(normalizedDraft.assets[0].path, 'assets/images/a.png');

const goal = normalizeLearningGoal({
  id: GLOBAL_GOAL_ID,
  enabled: true,
  dailyPracticeTarget: 25.4,
  dailyReviewTarget: -1,
  examDate: '2026-12-31T00:00:00.000Z',
  sprintEnabled: true,
});
assert.equal(goal.id, GLOBAL_GOAL_ID);
assert.equal(goal.dailyPracticeTarget, 25);
assert.equal(goal.dailyReviewTarget, 0);
assert.equal(goal.sprintEnabled, true);
assert.ok(goal.examDate);

const backupSource = fs.readFileSync('src/storage/backup.js', 'utf8');
assert.match(backupSource, /'studioDrafts'/);
assert.match(backupSource, /'learningGoals'/);

console.log('MoXin Quiz v4.0 foundation tests passed.');

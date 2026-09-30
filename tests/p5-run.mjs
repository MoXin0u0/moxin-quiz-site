import assert from 'node:assert/strict';
import {
  calculateNextReview,
  isReviewDue,
  masteryLabel,
  summarizeMastery,
} from '../src/quiz/review-engine.js';
import { filterQuestions } from '../src/ui/bank-detail.js';

const now = new Date('2026-10-01T00:00:00.000Z');

const first = calculateNextReview(null, true, now);
assert.equal(first.level, 1);
assert.equal(first.intervalDays, 1);
assert.equal(first.mastery, 'learning');
assert.equal(first.correctStreak, 1);

const second = calculateNextReview(first, true, now);
assert.equal(second.level, 2);
assert.equal(second.intervalDays, 3);

const wrong = calculateNextReview({ level: 5, correctStreak: 4, wrongCount: 1, reviewCount: 5 }, false, now);
assert.equal(wrong.level, 3);
assert.equal(wrong.intervalDays, 1);
assert.equal(wrong.correctStreak, 0);
assert.equal(wrong.wrongCount, 2);

assert.equal(masteryLabel(0), 'new');
assert.equal(masteryLabel(2), 'learning');
assert.equal(masteryLabel(4), 'familiar');
assert.equal(masteryLabel(6), 'mastered');

assert.equal(isReviewDue({ dueAt: '2026-09-30T23:59:59.000Z' }, now), true);
assert.equal(isReviewDue({ dueAt: '2026-10-02T00:00:00.000Z' }, now), false);

assert.deepEqual(
  summarizeMastery(['Q1', 'Q2', 'Q3', 'Q4'], [
    { questionId: 'Q2', level: 2, mastery: 'learning' },
    { questionId: 'Q3', level: 4, mastery: 'familiar' },
    { questionId: 'Q4', level: 6, mastery: 'mastered' },
  ]),
  { new: 1, learning: 1, familiar: 1, mastered: 1 },
);

const questions = [
  { id: 'Q1', type: 'single-choice', question: 'A', options: [], answer: ['A'], tags: [], chapter: 'C', difficulty: 1 },
  { id: 'Q2', type: 'single-choice', question: 'B', options: [], answer: ['A'], tags: [], chapter: 'C', difficulty: 1 },
];

const learning = {
  activeFilter: 'due',
  dueIds: new Set(['Q2']),
  wrongIds: new Set(),
  favoriteIds: new Set(),
  unfamiliarIds: new Set(),
  noteIds: new Set(),
};

assert.deepEqual(
  filterQuestions(questions, { keyword: '', type: 'all', difficulty: 'all', chapter: 'all' }, learning).map(q => q.id),
  ['Q2'],
);

console.log('MoXin Quiz v3 P5 unit tests passed.');

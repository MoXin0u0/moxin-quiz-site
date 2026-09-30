import assert from 'node:assert/strict';
import {
  normalizeResumedSession,
  getSessionStats,
} from '../src/quiz/session-engine.js';
import { filterQuestions } from '../src/ui/bank-detail.js';

const session = {
  id: 'practice-1',
  bankId: 'demo',
  sourceQuestionIds: ['Q1', 'Q2', 'Q3', 'REMOVED'],
  queue: ['Q2', 'Q3', 'REMOVED'],
  completedIds: ['Q1'],
  currentQuestionId: null,
  answered: true,
  attemptCount: 2,
  wrongCount: 1,
  finishedAt: null,
};

const normalized = normalizeResumedSession(session, ['Q1', 'Q2', 'Q3']);
assert.deepEqual(normalized.sourceQuestionIds, ['Q1', 'Q2', 'Q3']);
assert.deepEqual(normalized.completedIds, ['Q1']);
assert.deepEqual(normalized.queue, ['Q2', 'Q3']);
assert.equal(normalized.currentQuestionId, null);

const unanswered = normalizeResumedSession({
  ...session,
  queue: ['Q2'],
  currentQuestionId: 'Q3',
  answered: false,
}, ['Q1', 'Q2', 'Q3']);

assert.equal(unanswered.currentQuestionId, 'Q3');
assert.deepEqual(unanswered.queue, ['Q2']);

const stats = getSessionStats(normalized);
assert.equal(stats.total, 3);
assert.equal(stats.completed, 1);

const questions = [
  { id: 'Q1', type: 'single-choice', question: 'Alpha', options: [], answer: ['A'], tags: [], chapter: 'C1', difficulty: 1 },
  { id: 'Q2', type: 'single-choice', question: 'Beta', options: [], answer: ['A'], tags: [], chapter: 'C1', difficulty: 1 },
  { id: 'Q3', type: 'single-choice', question: 'Gamma', options: [], answer: ['A'], tags: [], chapter: 'C1', difficulty: 1 },
];

const learning = {
  activeFilter: 'wrong',
  wrongIds: new Set(['Q2']),
  favoriteIds: new Set(['Q1']),
  unfamiliarIds: new Set(['Q3']),
  noteIds: new Set(['Q1', 'Q3']),
};

assert.deepEqual(
  filterQuestions(questions, { keyword: '', type: 'all', difficulty: 'all', chapter: 'all' }, learning).map(q => q.id),
  ['Q2'],
);

learning.activeFilter = 'favorite';
assert.deepEqual(
  filterQuestions(questions, { keyword: '', type: 'all', difficulty: 'all', chapter: 'all' }, learning).map(q => q.id),
  ['Q1'],
);

learning.activeFilter = 'unfamiliar';
assert.deepEqual(
  filterQuestions(questions, { keyword: '', type: 'all', difficulty: 'all', chapter: 'all' }, learning).map(q => q.id),
  ['Q3'],
);

learning.activeFilter = 'note';
assert.deepEqual(
  filterQuestions(questions, { keyword: '', type: 'all', difficulty: 'all', chapter: 'all' }, learning).map(q => q.id),
  ['Q1', 'Q3'],
);

console.log('MoXin Quiz v3 P4 unit tests passed.');

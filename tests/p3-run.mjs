import assert from 'node:assert/strict';
import {
  advanceSession,
  createPracticeSession,
  getSessionStats,
  isSessionFinished,
  recordSessionAnswer,
} from '../src/quiz/session-engine.js';
import { filterQuestions } from '../src/ui/bank-detail.js';

const questions = [
  { id: 'Q1', type: 'single-choice', question: 'Alpha', options: [{ id: 'A', text: 'One' }], answer: ['A'], tags: ['tag-a'], chapter: 'C1', difficulty: 1 },
  { id: 'Q2', type: 'true-false', question: 'Beta', answer: [true], tags: ['tag-b'], chapter: 'C2', difficulty: 2 },
];

const session = createPracticeSession({
  bankId: 'demo',
  bankName: 'Demo',
  questions,
  random: () => 0.999,
});

assert.equal(session.sourceQuestionIds.length, 2);
const first = advanceSession(session);
assert.ok(['Q1', 'Q2'].includes(first));

recordSessionAnswer(session, first, false);
assert.equal(session.wrongCount, 1);
assert.ok(session.queue.includes(first));

const second = advanceSession(session);
recordSessionAnswer(session, second, true);

const repeat = advanceSession(session);
assert.equal(repeat, first);
recordSessionAnswer(session, repeat, true);

assert.equal(isSessionFinished(session), true);
const stats = getSessionStats(session);
assert.equal(stats.total, 2);
assert.equal(stats.completed, 2);
assert.equal(stats.attempts, 3);
assert.equal(stats.wrong, 1);
assert.equal(stats.accuracy, 67);

assert.equal(filterQuestions(questions, { keyword: 'alpha', type: 'all', difficulty: 'all', chapter: 'all' }).length, 1);
assert.equal(filterQuestions(questions, { keyword: '', type: 'true-false', difficulty: 'all', chapter: 'all' }).length, 1);
assert.equal(filterQuestions(questions, { keyword: '', type: 'all', difficulty: '2', chapter: 'all' }).length, 1);
assert.equal(filterQuestions(questions, { keyword: '', type: 'all', difficulty: 'all', chapter: 'C1' }).length, 1);

console.log('MoXin Quiz v3 P3 unit tests passed.');

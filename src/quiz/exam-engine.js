import { createSessionId } from '../utils/ids.js';
import { shuffle } from './shuffle.js';
import { checkAnswer } from './scoring.js';

export function createExamSession({
  bankId,
  bankName,
  questions,
  questionCount,
  durationMinutes,
  random = Math.random,
  now = new Date(),
}) {
  const count = Math.max(1, Math.min(
    Number(questionCount) || questions.length,
    questions.length,
    100,
  ));
  const duration = Math.max(1, Math.min(Number(durationMinutes) || 30, 240));
  const selected = shuffle(questions.map(question => question.id), random).slice(0, count);
  const startedAt = now.toISOString();
  const deadlineAt = new Date(now.getTime() + duration * 60 * 1000).toISOString();

  return {
    id: createSessionId('exam'),
    sessionType: 'exam',
    mode: 'exam',
    bankId,
    bankName,
    questionIds: selected,
    answers: {},
    currentIndex: 0,
    questionCount: selected.length,
    durationMinutes: duration,
    startedAt,
    deadlineAt,
    submittedAt: null,
    finishedAt: null,
    result: null,
    updatedAt: startedAt,
  };
}

export function setExamAnswer(session, questionId, answer) {
  if (!session?.answers) session.answers = {};
  if (isEmptyAnswer(answer)) {
    delete session.answers[questionId];
  } else {
    session.answers[questionId] = cloneAnswer(answer);
  }
  session.updatedAt = new Date().toISOString();
  return session;
}

export function getExamAnswer(session, questionId) {
  return cloneAnswer(session?.answers?.[questionId] ?? null);
}

export function getRemainingSeconds(session, now = new Date()) {
  const deadline = new Date(session?.deadlineAt || 0);
  if (Number.isNaN(deadline.getTime())) return 0;
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000));
}

export function gradeExam(session, questionMap) {
  const details = [];
  let correctCount = 0;
  let unansweredCount = 0;

  for (const questionId of session.questionIds || []) {
    const question = questionMap.get(questionId);
    if (!question) continue;

    const answer = getExamAnswer(session, questionId);
    const answered = !isEmptyAnswer(answer);
    const correct = answered && checkAnswer(question, answer);

    if (!answered) unansweredCount += 1;
    if (correct) correctCount += 1;

    details.push({
      questionId,
      userAnswer: answered ? answer : null,
      answered,
      correct,
    });
  }

  const total = details.length;
  const wrongCount = total - correctCount - unansweredCount;
  const score = total ? Math.round((correctCount / total) * 100) : 0;

  return {
    total,
    correctCount,
    wrongCount,
    unansweredCount,
    score,
    details,
  };
}

export function normalizeResumedExam(session, validQuestionIds, now = new Date()) {
  const valid = new Set(validQuestionIds || []);
  const questionIds = (session.questionIds || []).filter(id => valid.has(id));
  const answers = {};

  for (const id of questionIds) {
    if (Object.prototype.hasOwnProperty.call(session.answers || {}, id)) {
      answers[id] = cloneAnswer(session.answers[id]);
    }
  }

  const currentIndex = Math.max(
    0,
    Math.min(Number(session.currentIndex) || 0, Math.max(0, questionIds.length - 1)),
  );

  return {
    ...session,
    sessionType: 'exam',
    mode: 'exam',
    questionIds,
    questionCount: questionIds.length,
    answers,
    currentIndex,
    expired: getRemainingSeconds(session, now) <= 0,
  };
}

export function countAnswered(session) {
  return (session?.questionIds || []).filter(id => !isEmptyAnswer(session?.answers?.[id])).length;
}

export function isEmptyAnswer(answer) {
  if (answer === null || answer === undefined || answer === '') return true;
  if (Array.isArray(answer)) return answer.length === 0;
  return false;
}

function cloneAnswer(answer) {
  return Array.isArray(answer) ? [...answer] : answer;
}

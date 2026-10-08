import { createSessionId, createUuid } from '../utils/ids.js';
import { shuffle } from './shuffle.js';
import { checkAnswer } from './scoring.js';

export function createExamSession({
  bankId,
  bankName,
  bankVersion = null,
  bankFingerprint = null,
  questions,
  questionCount,
  durationMinutes,
  assetHashes = null,
  random = Math.random,
  now = new Date(),
}) {
  const source = Array.isArray(questions) ? questions : [];
  const count = Math.max(1, Math.min(
    Number(questionCount) || source.length,
    source.length,
    100,
  ));
  const duration = Math.max(1, Math.min(Number(durationMinutes) || 30, 240));
  const selected = shuffle(source.map(question => question.id), random).slice(0, count);
  const byId = new Map(source.map(question => [String(question.id), question]));
  const questionSnapshot = selected
    .map(id => byId.get(String(id)))
    .filter(Boolean)
    .map(question => createExamQuestionSnapshot(question, assetHashes));

  const startedAt = now.toISOString();
  const deadlineAt = new Date(now.getTime() + duration * 60 * 1000).toISOString();

  return {
    id: createSessionId('exam'),
    sessionType: 'exam',
    mode: 'exam',
    bankId,
    bankName,
    bankVersion: bankVersion ? String(bankVersion) : null,
    bankFingerprint: bankFingerprint || null,
    questionIds: questionSnapshot.map(question => question.questionId),
    questionSnapshot,
    answers: {},
    currentIndex: 0,
    questionCount: questionSnapshot.length,
    durationMinutes: duration,
    startedAt,
    deadlineAt,
    status: 'active',
    submissionReason: null,
    submittedAt: null,
    abandonedAt: null,
    finishedAt: null,
    result: null,
    activeLease: null,
    updatedAt: startedAt,
  };
}

export function createExamQuestionSnapshot(question = {}, assetHashes = null) {
  const questionId = String(question.questionId || question.id || '');
  const options = Array.isArray(question.options)
    ? question.options.map(option => ({
        id: String(option.id),
        text: String(option.text ?? ''),
      }))
    : undefined;

  return {
    questionId,
    id: questionId,
    questionFingerprint: question.questionFingerprint || null,
    type: question.type,
    question: String(question.question || ''),
    ...(options ? { options } : {}),
    answer: cloneAnswer(question.answer),
    explanation: String(question.explanation || ''),
    images: normalizeImageRefs(question.images, assetHashes),
    explanationImages: normalizeImageRefs(question.explanationImages, assetHashes),
    chapter: String(question.chapter || ''),
    tags: Array.isArray(question.tags) ? question.tags.map(String) : [],
    difficulty: Number.isFinite(Number(question.difficulty))
      ? Number(question.difficulty)
      : 0,
    ...(question.caseSensitive !== undefined
      ? { caseSensitive: question.caseSensitive === true }
      : {}),
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
  const stored = session?.answers?.[questionId];
  if (
    stored &&
    typeof stored === 'object' &&
    !Array.isArray(stored) &&
    Object.prototype.hasOwnProperty.call(stored, 'value')
  ) {
    return cloneAnswer(stored.value);
  }
  return cloneAnswer(stored ?? null);
}

export function getExamAnswerState(session, questionId) {
  const stored = session?.answers?.[questionId];
  if (
    stored &&
    typeof stored === 'object' &&
    !Array.isArray(stored) &&
    Object.prototype.hasOwnProperty.call(stored, 'value')
  ) {
    return stored;
  }
  return null;
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

export function normalizeResumedExam(session, validQuestions = [], now = new Date()) {
  const suppliedQuestions = (Array.isArray(validQuestions) ? validQuestions : [])
    .filter(item => item && typeof item === 'object');
  const suppliedById = new Map(
    suppliedQuestions.map(question => [
      String(question.id || question.questionId || ''),
      question,
    ]),
  );

  const questionIds = (session.questionIds || []).map(String);
  const existingSnapshot = Array.isArray(session?.questionSnapshot)
    ? session.questionSnapshot.map(question => createExamQuestionSnapshot(question))
    : [];

  const snapshot = existingSnapshot.length
    ? existingSnapshot
    : questionIds
        .map(id => suppliedById.get(id))
        .filter(Boolean)
        .map(question => createExamQuestionSnapshot(question));

  const snapshotById = new Map(
    snapshot.map(question => [String(question.questionId || question.id), question]),
  );
  const missingQuestionIds = questionIds.filter(id => !snapshotById.has(id));

  const answers = {};
  for (const id of questionIds) {
    if (Object.prototype.hasOwnProperty.call(session.answers || {}, id)) {
      answers[id] = cloneStoredAnswer(session.answers[id]);
    }
  }

  const currentIndex = Math.max(
    0,
    Math.min(Number(session.currentIndex) || 0, Math.max(0, questionIds.length - 1)),
  );

  const status = session.status || (
    session.submittedAt
      ? 'submitted'
      : session.abandonedAt
        ? 'abandoned'
        : 'active'
  );

  return {
    ...session,
    sessionType: 'exam',
    mode: 'exam',
    status,
    questionIds,
    questionSnapshot: snapshot,
    questionCount: questionIds.length,
    answers,
    currentIndex,
    submissionReason: session.submissionReason || null,
    abandonedAt: session.abandonedAt || null,
    activeLease: session.activeLease || null,
    integrityError: missingQuestionIds.length
      ? {
          code: 'missing-question-snapshot',
          missingQuestionIds,
          legacyFallback: existingSnapshot.length === 0,
        }
      : null,
    expired: status === 'active' && getRemainingSeconds(session, now) <= 0,
  };
}

export function countAnswered(session) {
  return (session?.questionIds || [])
    .filter(id => !isEmptyAnswer(getExamAnswer(session, id)))
    .length;
}

export function createExamLease(deviceId, {
  now = new Date(),
  ttlMs = 5 * 60 * 1000,
  revision = null,
  leaseId = null,
} = {}) {
  const claimedAt = now.toISOString();
  return {
    leaseId: leaseId || createUuid('lease'),
    holderDeviceId: String(deviceId),
    claimedAt,
    lastHeartbeatAt: claimedAt,
    expiresAt: new Date(now.getTime() + Math.max(1000, Number(ttlMs) || 0)).toISOString(),
    revision,
  };
}

export function isExamLeaseActive(lease, now = new Date()) {
  if (!lease?.expiresAt) return false;
  const expires = new Date(lease.expiresAt);
  return !Number.isNaN(expires.getTime()) && expires.getTime() > now.getTime();
}

export function isEmptyAnswer(answer) {
  if (answer === null || answer === undefined || answer === '') return true;
  if (Array.isArray(answer)) return answer.length === 0;
  return false;
}

function normalizeImageRefs(values, assetHashes) {
  return (Array.isArray(values) ? values : [])
    .map(value => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const path = String(value.path || '');
        return {
          path,
          contentHash: value.contentHash || resolveAssetHash(assetHashes, path),
        };
      }

      const path = String(value || '');
      return {
        path,
        contentHash: resolveAssetHash(assetHashes, path),
      };
    })
    .filter(item => item.path);
}

function resolveAssetHash(assetHashes, path) {
  if (!assetHashes) return null;
  if (assetHashes instanceof Map) return assetHashes.get(path) || null;
  return assetHashes[path] || null;
}

function cloneStoredAnswer(value) {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, 'value')
  ) {
    return {
      ...value,
      value: cloneAnswer(value.value),
      revision: value.revision ? { ...value.revision } : null,
    };
  }
  return cloneAnswer(value);
}

function cloneAnswer(answer) {
  if (Array.isArray(answer)) return [...answer];
  if (answer && typeof answer === 'object') return { ...answer };
  return answer;
}

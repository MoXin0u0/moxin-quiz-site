import { questionKey } from '../../utils/ids.js';
import { createSessionId, createUuid } from '../../utils/ids.js';
import { calculateNextReviewFromOutcome } from '../../quiz/review-engine.js';
import { ATTEMPT_OUTCOME } from '../../learning/attempt-events.js';
import { runReadwriteTransaction } from './transaction-utils.js';
import {
  createRevisionMutationInTransaction,
  ensureSyncIdentityInTransaction,
  enqueueImmutableMutationInTransaction,
} from './sync-mutation.js';

function activityTypeForMode(mode) {
  const value = String(mode || 'practice');
  if (value === 'exam' || value.startsWith('exam:')) return 'exam';

  const reviewModes = [
    'review',
    'due',
    'wrong',
    'unfamiliar',
    'favorite',
    'scheduled-review',
  ];
  if (reviewModes.some(prefix => value === prefix || value.startsWith(`${prefix}:`))) {
    return 'review';
  }
  return 'practice';
}

export async function writeLearningAttemptInTransaction({
  tx,
  store,
  request,
  bank,
  question,
  sessionId = null,
  eventId = createUuid('event'),
  selectedAnswer = null,
  outcome,
  responseTime = null,
  mode = 'practice',
  activityType = null,
  answeredAt = new Date().toISOString(),
} = {}) {
  if (!tx || !store || !request || !bank?.id || !question?.id) {
    throw new Error('Learning attempt transaction requires stores, bank, and question.');
  }

  const normalizedOutcome = normalizeOutcome(outcome);
  const bankId = String(bank.id);
  const questionId = String(question.id);
  const meta = await ensureSyncIdentityInTransaction(tx);
  const responseTimeMs = Number.isFinite(responseTime) ? responseTime : null;
  const correct = normalizedOutcome === ATTEMPT_OUTCOME.CORRECT;

  const attempt = {
    eventVersion: 1,
    eventId: String(eventId),
    bankId,
    questionId,
    questionKey: questionKey(bankId, questionId),
    sessionId: sessionId ? String(sessionId) : null,
    activityType: activityType || activityTypeForMode(mode),
    mode: String(mode || 'practice'),
    answeredAt,
    recordedAt: answeredAt,
    timestamp: answeredAt,
    deviceId: meta.deviceId,
    selectedAnswer,
    outcome: normalizedOutcome,
    correct,
    responseTimeMs,
    responseTime: responseTimeMs,
    context: {
      bankName: bank.name ? String(bank.name) : null,
      bankVersion: bank.version ? String(bank.version) : null,
      bankFingerprint: bank.contentFingerprint || bank.bankFingerprint || null,
      questionFingerprint: question.questionFingerprint || null,
      questionType: question.type || 'unknown',
      chapter:
        question.chapter === undefined || question.chapter === null
          ? null
          : String(question.chapter),
      difficulty: Number.isFinite(Number(question.difficulty))
        ? Number(question.difficulty)
        : null,
    },
  };

  const attemptId = await request(store('attempts').add(attempt));
  attempt.id = attemptId;

  await enqueueImmutableMutationInTransaction(tx, {
    entityType: 'attempt',
    entityKey: attempt.eventId,
    operation: 'append',
    createdAt: answeredAt,
  });

  const progressKey = questionKey(bankId, questionId);
  const existingProgress = await request(store('progress').get(progressKey));
  const progress = {
    ...(existingProgress || {
      key: progressKey,
      bankId,
      questionId,
      attempts: 0,
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: 0,
    }),
    key: progressKey,
    bankId,
    questionId,
    attempts: (existingProgress?.attempts || 0) + 1,
    correctCount:
      (existingProgress?.correctCount || 0) +
      (normalizedOutcome === ATTEMPT_OUTCOME.CORRECT ? 1 : 0),
    wrongCount:
      (existingProgress?.wrongCount || 0) +
      (normalizedOutcome === ATTEMPT_OUTCOME.WRONG ? 1 : 0),
    unansweredCount:
      (existingProgress?.unansweredCount || 0) +
      (normalizedOutcome === ATTEMPT_OUTCOME.UNANSWERED ? 1 : 0),
    lastResult: normalizedOutcome,
    lastOutcome: normalizedOutcome,
    lastAnsweredAt: answeredAt,
    ...(normalizedOutcome === ATTEMPT_OUTCOME.CORRECT
      ? { lastCorrectAt: answeredAt }
      : normalizedOutcome === ATTEMPT_OUTCOME.WRONG
        ? { lastWrongAt: answeredAt }
        : { lastUnansweredAt: answeredAt }),
  };
  store('progress').put(progress);

  const existingReview = await request(store('reviewSchedule').get(progressKey));
  const nextReview = calculateNextReviewFromOutcome(
    existingReview,
    normalizedOutcome,
    new Date(answeredAt),
  );
  const review = {
    ...(existingReview || {}),
    ...nextReview,
    key: progressKey,
    bankId,
    questionId,
    lastOutcome: normalizedOutcome,
    lastResult: normalizedOutcome,
    updatedAt: answeredAt,
  };
  store('reviewSchedule').put(review);

  return { attempt, progress, review };
}

export async function commitPracticeAnswer({
  bank,
  question,
  session,
  selectedAnswer,
  correct,
  responseTime = null,
  mode = 'practice',
  now = new Date(),
} = {}) {
  if (!bank?.id || !question?.id || !session) {
    throw new Error('Practice answer commit requires bank, question, and session.');
  }

  const answeredAt = now.toISOString();
  const sessionId = session.id || createSessionId();

  return runReadwriteTransaction([
    'attempts',
    'progress',
    'reviewSchedule',
    'sessions',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
  ], async ({ store, request, tx }) => {
    const learning = await writeLearningAttemptInTransaction({
      tx,
      store,
      request,
      bank,
      question,
      sessionId,
      selectedAnswer,
      outcome: correct ? ATTEMPT_OUTCOME.CORRECT : ATTEMPT_OUTCOME.WRONG,
      responseTime,
      mode,
      answeredAt,
    });

    const existingSession = await request(store('sessions').get(sessionId));
    const sessionStatus = session.abandonedAt
      ? 'abandoned'
      : session.finishedAt
        ? 'finished'
        : 'active';

    const { revision } = await createRevisionMutationInTransaction(tx, {
      entityType: 'practice-session',
      entityKey: sessionId,
      previousRevision: existingSession?.revision || session.revision || null,
      operation: 'upsert',
      coalesceKey: `practice-session:${sessionId}`,
      now,
    });

    const savedSession = {
      ...(existingSession || {}),
      ...session,
      id: sessionId,
      sessionType: 'practice',
      status: sessionStatus,
      createdAt: existingSession?.createdAt || session.createdAt || answeredAt,
      updatedAt: answeredAt,
      revision,
    };
    store('sessions').put(savedSession);

    return {
      ...learning,
      session: savedSession,
    };
  });
}

function normalizeOutcome(value) {
  const outcome = String(value || '').trim().toLowerCase();
  if (Object.values(ATTEMPT_OUTCOME).includes(outcome)) return outcome;
  return ATTEMPT_OUTCOME.UNANSWERED;
}

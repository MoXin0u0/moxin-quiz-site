import { questionKey } from '../../utils/ids.js';
import { createSessionId, createUuid } from '../../utils/ids.js';
import { calculateNextReview } from '../../quiz/review-engine.js';
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

  const bankId = String(bank.id);
  const questionId = String(question.id);
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
    const meta = await ensureSyncIdentityInTransaction(tx);

    const eventId = createUuid('event');
    const outcome = correct ? 'correct' : 'wrong';
    const responseTimeMs = Number.isFinite(responseTime) ? responseTime : null;
    const attempt = {
      eventVersion: 1,
      eventId,
      bankId,
      questionId,
      questionKey: questionKey(bankId, questionId),
      sessionId,
      activityType: activityTypeForMode(mode),
      mode: String(mode || 'practice'),
      answeredAt,
      recordedAt: answeredAt,
      timestamp: answeredAt,
      deviceId: meta.deviceId,
      selectedAnswer,
      outcome,
      correct: Boolean(correct),
      responseTimeMs,
      responseTime: responseTimeMs,
      context: {
        bankName: bank.name ? String(bank.name) : null,
        bankVersion: bank.version ? String(bank.version) : null,
        bankFingerprint: bank.contentFingerprint || null,
        questionFingerprint: question.questionFingerprint || null,
        questionType: question.type || 'unknown',
        chapter:
          question.chapter === undefined || question.chapter === null
            ? null
            : String(question.chapter),
        difficulty: Number.isFinite(question.difficulty) ? question.difficulty : null,
      },
    };

    const attemptId = await request(store('attempts').add(attempt));
    attempt.id = attemptId;

    await enqueueImmutableMutationInTransaction(tx, {
      entityType: 'attempt',
      entityKey: eventId,
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
      correctCount: (existingProgress?.correctCount || 0) + (correct ? 1 : 0),
      wrongCount: (existingProgress?.wrongCount || 0) + (correct ? 0 : 1),
      unansweredCount: existingProgress?.unansweredCount || 0,
      lastResult: outcome,
      lastOutcome: outcome,
      lastAnsweredAt: answeredAt,
      ...(correct
        ? { lastCorrectAt: answeredAt }
        : { lastWrongAt: answeredAt }),
    };
    store('progress').put(progress);

    const existingReview = await request(store('reviewSchedule').get(progressKey));
    const nextReview = calculateNextReview(existingReview, Boolean(correct), now);
    const review = {
      ...(existingReview || {}),
      ...nextReview,
      key: progressKey,
      bankId,
      questionId,
      updatedAt: answeredAt,
    };
    store('reviewSchedule').put(review);

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
      attempt,
      progress,
      review,
      session: savedSession,
    };
  });
}

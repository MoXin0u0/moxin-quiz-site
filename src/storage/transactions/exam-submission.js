import { createUuid } from '../../utils/ids.js';
import { gradeExam } from '../../quiz/exam-engine.js';
import { ATTEMPT_OUTCOME } from '../../learning/attempt-events.js';
import { runReadwriteTransaction } from './transaction-utils.js';
import { createRevisionMutationInTransaction } from './sync-mutation.js';
import { writeLearningAttemptInTransaction } from './learning-mutation.js';

export async function commitExamSubmission({
  sessionId,
  bank,
  reason = 'manual',
  now = new Date(),
} = {}) {
  const id = String(sessionId || '');
  if (!id) throw new Error('Exam submission requires sessionId.');

  return runReadwriteTransaction([
    'attempts',
    'progress',
    'reviewSchedule',
    'sessions',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
  ], async ({ store, request, tx }) => {
    const existing = await request(store('sessions').get(id));
    if (!existing) throw new Error('Exam session was not found.');

    if (existing.status === 'submitted' || existing.submittedAt) {
      return {
        session: existing,
        result: resultWithDetails(existing),
        idempotent: true,
      };
    }

    if (existing.status === 'abandoned' || existing.abandonedAt) {
      throw new Error('Abandoned exam cannot be submitted.');
    }

    const questionIds = (existing.questionIds || []).map(String);
    const questionMap = new Map(
      (Array.isArray(existing.questionSnapshot) ? existing.questionSnapshot : [])
        .map(question => [String(question.questionId || question.id), question]),
    );
    const missingQuestionIds = questionIds.filter(id => !questionMap.has(id));
    if (!questionMap.size || missingQuestionIds.length || questionMap.size !== new Set(questionIds).size) {
      throw new Error(
        `Exam question snapshot is incomplete; cannot finalize safely${missingQuestionIds.length
          ? `: ${missingQuestionIds.join(', ')}`
          : '.'}`,
      );
    }

    const result = gradeExam(existing, questionMap);
    const submittedAt = now.toISOString();
    const bankContext = {
      id: existing.bankId || bank?.id,
      name: existing.bankName || bank?.name || bank?.title || null,
      version: existing.bankVersion || bank?.version || null,
      contentFingerprint: existing.bankFingerprint || bank?.contentFingerprint || null,
    };

    for (const detail of result.details) {
      const eventId = `exam:${id}:${detail.questionId}`;
      const already = await request(store('attempts').index('eventId').get(eventId));
      if (already) continue;

      const question = questionMap.get(String(detail.questionId));
      const outcome = !detail.answered
        ? ATTEMPT_OUTCOME.UNANSWERED
        : detail.correct
          ? ATTEMPT_OUTCOME.CORRECT
          : ATTEMPT_OUTCOME.WRONG;

      await writeLearningAttemptInTransaction({
        tx,
        store,
        request,
        bank: bankContext,
        question: {
          ...question,
          id: String(question.questionId || question.id),
        },
        sessionId: id,
        eventId,
        selectedAnswer: detail.userAnswer,
        outcome,
        responseTime: null,
        mode: 'exam',
        activityType: 'exam',
        answeredAt: submittedAt,
      });
    }

    const { revision } = await createRevisionMutationInTransaction(tx, {
      entityType: 'exam-session',
      entityKey: id,
      previousRevision: existing.revision || null,
      operation: 'upsert',
      coalesceKey: null,
      now,
    });

    const summary = {
      total: result.total,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      unansweredCount: result.unansweredCount,
      score: result.score,
    };

    const session = {
      ...existing,
      status: 'submitted',
      submissionId: existing.submissionId || createUuid('submission'),
      submissionReason: reason === 'timeout' ? 'timeout' : 'manual',
      submittedAt,
      finishedAt: submittedAt,
      result: summary,
      activeLease: null,
      updatedAt: submittedAt,
      revision,
    };
    store('sessions').put(session);

    return {
      session,
      result,
      idempotent: false,
    };
  });
}

function resultWithDetails(session) {
  const questionMap = new Map(
    (Array.isArray(session.questionSnapshot) ? session.questionSnapshot : [])
      .map(question => [String(question.questionId || question.id), question]),
  );

  if (!questionMap.size) {
    return {
      ...(session.result || {}),
      details: [],
    };
  }

  return gradeExam(session, questionMap);
}

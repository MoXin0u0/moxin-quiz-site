import { runReadwriteTransaction } from './transaction-utils.js';
import {
  attachMutationPayloadInTransaction,
  createRevisionMutationInTransaction,
} from './sync-mutation.js';
import { getExamAnswerState } from '../../quiz/exam-engine.js';

export async function saveExamAnswerState({
  sessionId,
  questionId,
  value,
  now = new Date(),
} = {}) {
  const id = String(sessionId || '');
  const qid = String(questionId || '');
  if (!id || !qid) throw new Error('Exam answer save requires sessionId and questionId.');

  return runReadwriteTransaction([
    'sessions',
    'syncMeta',
    'syncOutbox',
    'syncRevisions',
  ], async ({ store, request, tx }) => {
    const session = await request(store('sessions').get(id));
    if (!session) throw new Error('Exam session was not found.');
    if (session.status === 'submitted' || session.submittedAt) {
      throw new Error('Submitted exam answers cannot be changed.');
    }
    if (session.status === 'abandoned' || session.abandonedAt) {
      throw new Error('Abandoned exam answers cannot be changed.');
    }

    const previous = getExamAnswerState(session, qid);
    const entityKey = `${id}::${qid}`;
    const { revision, mutation } = await createRevisionMutationInTransaction(tx, {
      entityType: 'exam-answer',
      entityKey,
      previousRevision: previous?.revision || null,
      operation: 'upsert',
      coalesceKey: null,
      now,
    });

    const answerState = {
      questionId: qid,
      value: cloneAnswerValue(value),
      updatedAt: now.toISOString(),
      revision,
    };

    const record = {
      ...session,
      answers: {
        ...(session.answers || {}),
        [qid]: answerState,
      },
      updatedAt: now.toISOString(),
    };
    store('sessions').put(record);
    attachMutationPayloadInTransaction(tx, mutation, answerState);
    return record;
  });
}

function cloneAnswerValue(value) {
  return Array.isArray(value) ? [...value] : value;
}

import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const DB_NAME = 'moxin-quiz-v3';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(new URL('docs/v5-baseline.md', BASE_URL).href, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  await page.evaluate(async dbName => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB delete blocked.'));
    });
  }, DB_NAME);

  const result = await page.evaluate(async () => {
    const { openDatabase, requestToPromise } = await import('/src/storage/db.js');
    const { runV5MigrationToCompletion } = await import('/src/storage/migrations/v5-migration.js');
    const { saveSession } = await import('/src/storage/repositories/sessions.js');
    const { createExamSession } = await import('/src/quiz/exam-engine.js');
    const { saveExamAnswerState } = await import('/src/storage/transactions/exam-session.js');
    const { commitExamSubmission } = await import('/src/storage/transactions/exam-submission.js');

    await openDatabase();
    await runV5MigrationToCompletion();

    const originalQuestions = [
      {
        id: 'Q1',
        questionFingerprint: 'sha256:q1',
        type: 'single-choice',
        question: 'Question 1',
        options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
        answer: ['A'],
        explanation: '',
        images: [],
        explanationImages: [],
        chapter: 'C1',
        tags: [],
        difficulty: 2,
      },
      {
        id: 'Q2',
        questionFingerprint: 'sha256:q2',
        type: 'true-false',
        question: 'Question 2',
        answer: [true],
        explanation: '',
        images: [],
        explanationImages: [],
        chapter: 'C2',
        tags: [],
        difficulty: 1,
      },
    ];

    let session = createExamSession({
      bankId: 'bank-a',
      bankName: 'Bank A',
      bankVersion: '1.0.0',
      bankFingerprint: 'sha256:bank',
      questions: originalQuestions,
      questionCount: 2,
      durationMinutes: 30,
      random: () => 0.999,
      now: new Date('2026-10-05T12:00:00.000Z'),
    });
    session = await saveSession(session);

    // Change live content after start; frozen answer must remain A.
    originalQuestions[0].answer = ['B'];

    session = await saveExamAnswerState({
      sessionId: session.id,
      questionId: 'Q1',
      value: 'A',
      now: new Date('2026-10-05T12:05:00.000Z'),
    });

    const first = await commitExamSubmission({
      sessionId: session.id,
      bank: {
        id: 'bank-a',
        name: 'Bank A',
        version: '9.9.9',
        contentFingerprint: 'sha256:new-bank',
      },
      reason: 'manual',
      now: new Date('2026-10-05T12:10:00.000Z'),
    });

    const second = await commitExamSubmission({
      sessionId: session.id,
      bank: { id: 'bank-a', name: 'Bank A' },
      reason: 'manual',
      now: new Date('2026-10-05T12:11:00.000Z'),
    });

    const db = await openDatabase();
    const all = storeName =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
    const get = (storeName, key) =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));

    return {
      first,
      second,
      attempts: await all('attempts'),
      outbox: await all('syncOutbox'),
      q1Progress: await get('progress', 'bank-a::Q1'),
      q2Progress: await get('progress', 'bank-a::Q2'),
      savedSession: await get('sessions', session.id),
    };
  });

  assert.equal(result.first.idempotent, false);
  assert.equal(result.second.idempotent, true);
  assert.equal(result.first.result.correctCount, 1);
  assert.equal(result.first.result.wrongCount, 0);
  assert.equal(result.first.result.unansweredCount, 1);
  assert.equal(result.first.result.score, 50);

  assert.equal(result.attempts.length, 2);
  assert.deepEqual(
    result.attempts.map(item => item.eventId).sort(),
    [
      `exam:${result.savedSession.id}:Q1`,
      `exam:${result.savedSession.id}:Q2`,
    ].sort(),
  );

  const q1 = result.attempts.find(item => item.questionId === 'Q1');
  const q2 = result.attempts.find(item => item.questionId === 'Q2');
  assert.equal(q1.outcome, 'correct');
  assert.equal(q1.context.bankFingerprint, 'sha256:bank');
  assert.equal(q2.outcome, 'unanswered');

  assert.equal(result.q1Progress.correctCount, 1);
  assert.equal(result.q2Progress.unansweredCount, 1);
  assert.equal(result.savedSession.status, 'submitted');
  assert.equal(result.savedSession.submissionReason, 'manual');
  assert.equal(result.savedSession.result.unansweredCount, 1);
  assert.equal(result.savedSession.questionSnapshot[0].answer[0], 'A');

  assert.equal(
    result.outbox.filter(item => item.entityType === 'attempt').length,
    2,
    'retrying submission must not enqueue duplicate attempt events',
  );
  assert.ok(result.outbox.some(item => item.entityType === 'exam-answer'));
  assert.ok(result.outbox.some(item => item.entityType === 'exam-session'));

  console.log('V5 exam atomic/idempotent browser gate passed.');
} finally {
  await browser.close();
}

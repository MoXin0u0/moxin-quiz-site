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
    const {
      setFavorite,
      getFavorite,
      setUnfamiliar,
      getUnfamiliar,
      saveNote,
    } = await import('/src/storage/repositories/learning.js');
    const { saveLearningGoal } = await import('/src/storage/repositories/goals.js');
    const { saveSession } = await import('/src/storage/repositories/sessions.js');
    const { commitPracticeAnswer } = await import('/src/storage/transactions/learning-mutation.js');
    const { runReadwriteTransaction } = await import('/src/storage/transactions/transaction-utils.js');

    await openDatabase();
    await runV5MigrationToCompletion();

    await setFavorite('bank-a', 'Q001', true);
    await setFavorite('bank-a', 'Q001', false);
    await setUnfamiliar('bank-a', 'Q001', true);
    await setUnfamiliar('bank-a', 'Q001', false);
    await saveNote('bank-a', 'Q001', 'hello');
    await saveNote('bank-a', 'Q001', '');

    const goal = await saveLearningGoal({
      id: 'global',
      enabled: true,
      dailyPracticeTarget: 10,
      dailyReviewTarget: 5,
    });

    const initialSession = await saveSession({
      id: 'session-a',
      bankId: 'bank-a',
      bankName: 'Bank A',
      mode: 'filtered',
      sourceQuestionIds: ['Q001'],
      queue: ['Q001'],
      completedIds: [],
      errorsByQuestion: {},
      attemptCount: 0,
      wrongCount: 0,
      currentQuestionId: 'Q001',
      answered: false,
      startedAt: '2026-10-05T12:00:00.000Z',
    });

    const committed = await commitPracticeAnswer({
      bank: {
        id: 'bank-a',
        name: 'Bank A',
        version: '1.0.0',
        contentFingerprint: 'sha256:bank',
      },
      question: {
        id: 'Q001',
        type: 'single-choice',
        chapter: 'C1',
        difficulty: 2,
        questionFingerprint: 'sha256:question',
      },
      session: {
        ...initialSession,
        completedIds: ['Q001'],
        attemptCount: 1,
        currentQuestionId: 'Q001',
        answered: true,
        finishedAt: '2026-10-05T12:01:00.000Z',
      },
      selectedAnswer: ['A'],
      correct: true,
      responseTime: 1500,
      mode: 'filtered',
      now: new Date('2026-10-05T12:01:00.000Z'),
    });

    let aborted = false;
    try {
      await runReadwriteTransaction(['favorites', 'syncOutbox'], async ({ store }) => {
        store('favorites').put({
          key: 'abort::QX',
          bankId: 'abort',
          questionId: 'QX',
          isFavorite: true,
        });
        store('syncOutbox').put({
          mutationId: 'abort-mutation',
          entityType: 'favorite',
          entityKey: 'abort::QX',
          operation: 'upsert',
          policy: 'coalescible',
          status: 'pending',
          createdAt: new Date().toISOString(),
          deviceId: 'test',
        });
        throw new Error('forced abort');
      });
    } catch {
      aborted = true;
    }

    const db = await openDatabase();
    const get = (storeName, key) =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
    const all = storeName =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());

    const outbox = await all('syncOutbox');
    const revisions = await all('syncRevisions');
    const tombstones = await all('syncTombstones');
    const attempts = await all('attempts');

    return {
      aborted,
      favoriteRaw: await get('favorites', 'bank-a::Q001'),
      favoriteVisible: await getFavorite('bank-a', 'Q001'),
      unfamiliarRaw: await get('mastery', 'bank-a::Q001'),
      unfamiliarVisible: await getUnfamiliar('bank-a', 'Q001'),
      note: await get('notes', 'bank-a::Q001'),
      goal,
      committed,
      outbox,
      revisions,
      tombstones,
      attempts,
      abortFavorite: await get('favorites', 'abort::QX'),
      abortMutation: await get('syncOutbox', 'abort-mutation'),
    };
  });

  assert.equal(result.aborted, true);
  assert.equal(result.abortFavorite, undefined);
  assert.equal(result.abortMutation, undefined);

  assert.equal(result.favoriteRaw.isFavorite, false);
  assert.equal(result.favoriteVisible, null);
  assert.equal(result.unfamiliarRaw.isUnfamiliar, false);
  assert.equal(result.unfamiliarVisible, null);
  assert.equal(result.note, undefined);

  assert.ok(result.goal.revision?.revisionId);
  assert.ok(result.committed.session.revision?.revisionId);
  assert.equal(result.committed.progress.attempts, 1);
  assert.equal(result.committed.progress.correctCount, 1);
  assert.ok(result.committed.review.dueAt);

  assert.equal(result.attempts.length, 1);
  assert.match(result.attempts[0].eventId, /^event-/);
  assert.equal(result.attempts[0].outcome, 'correct');
  assert.equal(result.attempts[0].sessionId, 'session-a');

  const byType = type => result.outbox.filter(item => item.entityType === type);
  assert.equal(byType('favorite').length, 1, 'coalescible favorite mutations should collapse');
  assert.equal(byType('unfamiliar').length, 1, 'coalescible unfamiliar mutations should collapse');
  assert.equal(byType('note').length, 2, 'conflict-sensitive note revisions must retain ancestry');
  assert.equal(byType('learning-goal').length, 1);
  assert.equal(byType('practice-session').length, 2, 'session revisions remain explicit until safe ancestry compaction exists');
  assert.equal(byType('attempt').length, 1);

  assert.ok(result.tombstones.some(item =>
    item.entityType === 'note' && item.entityKey === 'bank-a::Q001'
  ));
  assert.ok(result.revisions.length >= 7);

  console.log('V5 transactional outbox browser gate passed.');
} finally {
  await browser.close();
}

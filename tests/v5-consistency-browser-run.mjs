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

    const definitions = {
      banks: { keyPath: 'id', indexes: [['updatedAt', 'updatedAt'], ['name', 'name']] },
      questions: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['questionId', 'questionId'], ['chapter', 'chapter']] },
      assets: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['path', 'path']] },
      attempts: { keyPath: 'id', autoIncrement: true, indexes: [['bankId', 'bankId'], ['questionKey', 'questionKey'], ['timestamp', 'timestamp']] },
      progress: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
      favorites: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
      notes: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
      mastery: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
      reviewSchedule: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['dueAt', 'dueAt']] },
      sessions: { keyPath: 'id', indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt']] },
      studioDrafts: { keyPath: 'id', indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt'], ['status', 'status']] },
      learningGoals: { keyPath: 'id', indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt'], ['examDate', 'examDate']] },
    };

    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 3);
      request.onupgradeneeded = () => {
        const database = request.result;
        for (const [name, definition] of Object.entries(definitions)) {
          const store = database.createObjectStore(name, {
            keyPath: definition.keyPath,
            autoIncrement: definition.autoIncrement === true,
          });
          for (const [indexName, keyPath] of definition.indexes) {
            store.createIndex(indexName, keyPath);
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const tx = db.transaction(Object.keys(definitions), 'readwrite');
    tx.objectStore('attempts').add({
      bankId: 'legacy-bank',
      questionId: 'Q1',
      questionKey: 'legacy-bank::Q1',
      timestamp: '2026-10-01T00:00:00.000Z',
      selectedAnswer: ['A'],
      correct: true,
      responseTime: 100,
      mode: 'exam',
    });
    tx.objectStore('attempts').add({
      bankId: 'legacy-bank',
      questionId: 'Q1',
      questionKey: 'legacy-bank::Q1',
      timestamp: '2026-10-02T00:00:00.000Z',
      selectedAnswer: null,
      correct: false,
      responseTime: null,
      mode: 'exam',
    });
    tx.objectStore('progress').put({
      key: 'legacy-bank::Q1',
      bankId: 'legacy-bank',
      questionId: 'Q1',
      attempts: 999,
      correctCount: 0,
      wrongCount: 999,
      lastResult: 'wrong',
    });
    tx.objectStore('reviewSchedule').put({
      key: 'legacy-bank::Q1',
      bankId: 'legacy-bank',
      questionId: 'Q1',
      level: 6,
      wrongCount: 999,
      reviewCount: 999,
      dueAt: '2099-01-01T00:00:00.000Z',
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, DB_NAME);

  // This navigation exercises the real app bootstrap rather than importing migration directly.
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  // Do not use an async predicate here: a Promise object can make a polling
  // predicate appear truthy before the migration has actually completed.
  // The app only publishes this ready message after awaiting the full migration.
  await page.waitForFunction(() => {
    const text = document.querySelector('#storageStatus')?.textContent || '';
    return text.includes('IndexedDB 已就緒');
  }, null, { timeout: 15000 });

  const result = await page.evaluate(async () => {
    const { openDatabase, requestToPromise } = await import('/src/storage/db.js');
    const { saveNote } = await import('/src/storage/repositories/learning.js');
    const {
      saveLearningGoal,
      deleteLearningGoal,
    } = await import('/src/storage/repositories/goals.js');
    const {
      saveSession,
      saveSessionCheckpoint,
    } = await import('/src/storage/repositories/sessions.js');

    const db = await openDatabase();
    const get = (storeName, key) =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
    const all = storeName =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());

    const attempts = await all('attempts');
    const progress = await get('progress', 'legacy-bank::Q1');
    const review = await get('reviewSchedule', 'legacy-bank::Q1');
    const syncMeta = await get('syncMeta', 'global');
    const allProgress = await all('progress');
    const allReview = await all('reviewSchedule');

    await saveNote('bank-a', 'Q1', 'first');
    await saveNote('bank-a', 'Q1', '');
    const noteTombstone = (await all('syncTombstones'))
      .filter(item => item.entityType === 'note' && item.entityKey === 'bank-a::Q1')
      .at(-1);
    const recreatedNote = await saveNote('bank-a', 'Q1', 'second');

    await saveLearningGoal({
      id: 'goal-a',
      enabled: true,
      dailyPracticeTarget: 10,
      dailyReviewTarget: 5,
    });
    await deleteLearningGoal('goal-a');
    const goalTombstone = (await all('syncTombstones'))
      .filter(item => item.entityType === 'learning-goal' && item.entityKey === 'goal-a')
      .at(-1);
    const recreatedGoal = await saveLearningGoal({
      id: 'goal-a',
      enabled: true,
      dailyPracticeTarget: 20,
      dailyReviewTarget: 5,
    });

    const session = await saveSession({
      id: 'practice-checkpoint',
      bankId: 'bank-a',
      mode: 'filtered',
      sourceQuestionIds: ['Q1'],
      queue: ['Q1'],
      completedIds: [],
      startedAt: '2026-10-05T00:00:00.000Z',
    });
    const beforeCheckpointOutbox = (await all('syncOutbox')).length;
    await saveSessionCheckpoint({
      ...session,
      currentQuestionId: 'Q1',
      finishedAt: '2026-10-05T00:05:00.000Z',
      status: 'active',
    });
    const afterCheckpointOutbox = (await all('syncOutbox')).length;
    const finishedSession = await get('sessions', 'practice-checkpoint');

    return {
      attempts,
      progress,
      review,
      syncMeta,
      allProgress,
      allReview,
      noteTombstone,
      recreatedNote,
      goalTombstone,
      recreatedGoal,
      beforeCheckpointOutbox,
      afterCheckpointOutbox,
      finishedSession,
    };
  });

  assert.equal(result.syncMeta?.migration?.phase, 'completed');
  assert.equal(result.syncMeta?.migration?.status, 'completed');
  assert.ok(result.syncMeta?.migration?.derivedRebuiltAt);

  const legacyExam = result.attempts
    .filter(item => item.bankId === 'legacy-bank' && item.questionId === 'Q1')
    .sort((a, b) => String(a.answeredAt).localeCompare(String(b.answeredAt)));
  assert.equal(legacyExam[0].outcome, 'correct');
  assert.equal(legacyExam[1].outcome, 'unanswered');

  if (result.progress?.attempts !== 2) {
    console.error('V5 consistency diagnostics', JSON.stringify({
      migration: result.syncMeta?.migration || null,
      attempts: result.attempts,
      allProgress: result.allProgress,
      allReview: result.allReview,
    }, null, 2));
  }
  assert.equal(result.progress.attempts, 2, 'derived rebuild must replace stale legacy counters');
  assert.equal(result.progress.correctCount, 1);
  assert.equal(result.progress.wrongCount, 0);
  assert.equal(result.progress.unansweredCount, 1);

  assert.equal(result.review.level, 1, 'unanswered must not demote the prior correct review level');
  assert.equal(result.review.wrongCount, 0);
  assert.equal(result.review.unansweredCount, 1);
  assert.equal(result.review.reviewCount, 1);

  assert.equal(
    result.recreatedNote.revision.parentRevisionIds[0],
    result.noteTombstone.revision.revisionId,
    'recreated note must descend from delete tombstone',
  );
  assert.equal(
    result.recreatedGoal.revision.parentRevisionIds[0],
    result.goalTombstone.revision.revisionId,
    'recreated goal must descend from delete tombstone',
  );

  assert.equal(
    result.beforeCheckpointOutbox,
    result.afterCheckpointOutbox,
    'navigation checkpoint must not create a cloud mutation',
  );
  assert.equal(result.finishedSession.status, 'finished');

  console.log('V5 B07.5 consistency browser integration passed.');
} finally {
  await browser.close();
}

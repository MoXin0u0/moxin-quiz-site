import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const DB_NAME = 'moxin-quiz-v3';

async function establishOrigin(page) {
  await page.goto(new URL('docs/v5-baseline.md', BASE_URL).href, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
}

async function deleteDatabase(page) {
  await page.evaluate(async dbName => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB delete was blocked.'));
    });
  }, DB_NAME);
}

async function seedLegacyV3(page, { shiftAttemptIds = false } = {}) {
  await page.evaluate(async ({ dbName, shiftAttemptIds }) => {
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

    const t1 = '2026-09-20T01:02:03.000Z';
    const t2 = '2026-09-21T04:05:06.000Z';
    const tx = db.transaction(Object.keys(definitions), 'readwrite');

    tx.objectStore('banks').put({
      id: 'legacy-bank',
      schemaVersion: '2.0',
      name: 'Legacy Bank',
      description: '',
      version: '1.0.0',
      author: 'Tester',
      language: 'zh-TW',
      questionCount: 1,
      sourceType: 'user',
      sourceMetadata: null,
      importedAt: t1,
      storedAt: t1,
      updatedAt: t2,
    });

    tx.objectStore('questions').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      id: 'Q001',
      type: 'multiple-choice',
      question: 'Legacy?',
      options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
      answer: ['B', 'A'],
      explanation: '',
      images: ['assets/images/a.txt'],
      explanationImages: [],
      chapter: 'C1',
      tags: ['z', 'a'],
      difficulty: 2,
    });

    tx.objectStore('assets').put({
      key: 'legacy-bank::assets/images/a.txt',
      bankId: 'legacy-bank',
      path: 'assets/images/a.txt',
      mimeType: 'text/plain',
      size: 3,
      blob: new Blob(['abc'], { type: 'text/plain' }),
    });

    if (shiftAttemptIds) {
      tx.objectStore('attempts').add({
        bankId: 'other-bank',
        questionId: 'QX',
        questionKey: 'other-bank::QX',
        timestamp: '2026-09-19T00:00:00.000Z',
        selectedAnswer: ['X'],
        correct: false,
        responseTime: 50,
        mode: 'filtered',
      });
    }

    const duplicate = {
      bankId: 'legacy-bank',
      questionId: 'Q001',
      questionKey: 'legacy-bank::Q001',
      timestamp: t1,
      selectedAnswer: ['A', 'B'],
      correct: true,
      responseTime: 1234,
      mode: 'filtered',
    };
    tx.objectStore('attempts').add(duplicate);
    tx.objectStore('attempts').add(duplicate);

    tx.objectStore('favorites').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      addedAt: t1,
    });

    tx.objectStore('mastery').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      status: 'unfamiliar',
      markedAt: t1,
      updatedAt: t2,
    });

    tx.objectStore('notes').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      text: 'legacy note',
      updatedAt: t2,
    });

    tx.objectStore('learningGoals').put({
      id: 'global',
      bankId: null,
      enabled: true,
      dailyPracticeTarget: 10,
      dailyReviewTarget: 5,
      examDate: '2026-11-20T00:00:00.000Z',
      examLabel: '期中考',
      sprintEnabled: true,
      sprintBankIds: ['legacy-bank'],
      sprintDailyTarget: 20,
      createdAt: t1,
      updatedAt: t2,
    });

    tx.objectStore('sessions').put({
      id: 'legacy-session',
      bankId: 'legacy-bank',
      bankName: 'Legacy Bank',
      mode: 'filtered',
      sourceQuestionIds: ['Q001'],
      queue: ['Q001'],
      completedIds: [],
      errorsByQuestion: {},
      attemptCount: 0,
      wrongCount: 0,
      currentQuestionId: null,
      answered: false,
      startedAt: t1,
      updatedAt: t2,
      finishedAt: null,
    });

    tx.objectStore('studioDrafts').put({
      id: 'legacy-draft',
      bankId: 'legacy-bank',
      manifest: { id: 'legacy-bank', name: 'Draft' },
      questions: [
        { id: 'Q001', type: 'fill-in', question: 'A', answer: ['A'], tags: [] },
        { id: 'Q001', type: 'fill-in', question: 'B', answer: ['B'], tags: [] },
      ],
      assets: [{
        path: 'assets/images/draft.txt',
        mimeType: 'text/plain',
        size: 3,
        blob: new Blob(['xyz'], { type: 'text/plain' }),
      }],
      status: 'draft',
      sourceBankVersion: '1.0.0',
      createdAt: t1,
      updatedAt: t2,
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, { dbName: DB_NAME, shiftAttemptIds });
}

async function migrateAndInspect(page) {
  return page.evaluate(async () => {
    const { openDatabase } = await import('/src/storage/db.js');
    await openDatabase();
    const migration = await import('/src/storage/migrations/v5-migration.js');
    const state = await migration.runV5MigrationToCompletion();

    const db = await openDatabase();
    const readAll = storeName => new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const readOne = (storeName, key) => new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    const attempts = await readAll('attempts');
    const duplicateIds = attempts
      .filter(item => item.bankId === 'legacy-bank' && item.questionId === 'Q001')
      .map(item => item.eventId)
      .sort();

    return {
      state,
      syncMeta: await readOne('syncMeta', 'global'),
      attempts,
      duplicateIds,
      favorite: await readOne('favorites', 'legacy-bank::Q001'),
      unfamiliar: await readOne('mastery', 'legacy-bank::Q001'),
      note: await readOne('notes', 'legacy-bank::Q001'),
      goal: await readOne('learningGoals', 'global'),
      session: await readOne('sessions', 'legacy-session'),
      bank: await readOne('banks', 'legacy-bank'),
      question: await readOne('questions', 'legacy-bank::Q001'),
      asset: await readOne('assets', 'legacy-bank::assets/images/a.txt'),
      draft: await readOne('studioDrafts', 'legacy-draft'),
      revisions: await readAll('syncRevisions'),
    };
  });
}

const browser = await chromium.launch({ headless: true });

try {
  const results = [];

  for (const shiftAttemptIds of [false, true]) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await establishOrigin(page);
    await deleteDatabase(page);
    await seedLegacyV3(page, { shiftAttemptIds });
    results.push(await migrateAndInspect(page));
    await context.close();
  }

  const [a, b] = results;

  for (const result of results) {
    assert.equal(result.state.phase, 'completed');
    assert.equal(result.state.status, 'completed');
    assert.match(result.syncMeta.deviceId, /^device-/);

    assert.equal(result.duplicateIds.length, 2);
    assert.notEqual(result.duplicateIds[0], result.duplicateIds[1]);
    assert.ok(result.duplicateIds.every(id => /^legacy-sha256:[a-f0-9]+:[12]$/.test(id)));

    assert.equal(result.favorite.isFavorite, true);
    assert.equal(result.unfamiliar.isUnfamiliar, true);
    assert.match(result.favorite.revision.revisionId, /^legacy-revision:/);
    assert.match(result.note.revision.revisionId, /^legacy-revision:/);
    assert.equal(result.goal.examDateKey, '2026-11-20');
    assert.equal(result.session.sessionType, 'practice');
    assert.equal(result.session.status, 'active');

    assert.match(result.bank.contentFingerprint, /^sha256:/);
    assert.match(result.bank.revision.revisionId, /^legacy-revision:/);
    assert.match(result.question.questionFingerprint, /^sha256:/);
    assert.match(result.asset.contentHash, /^sha256:/);
    assert.equal(result.asset.hashStatus, 'ready');

    assert.equal(result.draft.questions.length, 2);
    assert.notEqual(result.draft.questions[0].questionUid, result.draft.questions[1].questionUid);
    assert.ok(result.draft.questions.every(item => /^legacy-question:/.test(item.questionUid)));
    assert.match(result.draft.contentFingerprint, /^sha256:/);
    assert.match(result.draft.revision.revisionId, /^legacy-revision:/);

    assert.ok(result.revisions.some(item => item.entityType === 'note'));
    assert.ok(result.revisions.some(item => item.entityType === 'user-bank'));
    assert.ok(result.revisions.some(item => item.entityType === 'studio-draft'));
  }

  assert.deepEqual(
    a.duplicateIds,
    b.duplicateIds,
    'legacy duplicate attempt IDs must not depend on local autoIncrement primary keys',
  );
  assert.equal(
    a.note.revision.revisionId,
    b.note.revision.revisionId,
    'identical legacy notes must generate identical genesis revisions',
  );
  assert.equal(
    a.bank.contentFingerprint,
    b.bank.contentFingerprint,
    'identical legacy bank content must generate the same fingerprint',
  );
  assert.deepEqual(
    a.draft.questions.map(item => item.questionUid),
    b.draft.questions.map(item => item.questionUid),
    'legacy draft question UIDs must be deterministic',
  );

  console.log('V5 deterministic migration browser tests passed.');
} finally {
  await browser.close();
}

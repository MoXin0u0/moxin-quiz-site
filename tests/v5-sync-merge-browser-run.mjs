import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const DB_NAME = 'moxin-quiz-v3';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() =>
    (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'),
  null, { timeout: 15000 });

  const result = await page.evaluate(async dbName => {
    const { closeDatabase, openDatabase, requestToPromise } = await import('/src/storage/db.js');
    const { runV5MigrationToCompletion } = await import('/src/storage/migrations/v5-migration.js');
    const { saveNote, setFavorite } = await import('/src/storage/repositories/learning.js');
    const { createCloudCommit } = await import('/src/sync/cloud-contract.js');
    const { applyRemoteCommitAtomically } = await import('/src/sync/remote-apply.js');
    const { buildLocalSyncInventory, planFirstSync } = await import('/src/sync/reconciliation.js');

    await closeDatabase();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB delete blocked.'));
    });
    await openDatabase();
    await runV5MigrationToCompletion();

    const localNote = await saveNote('bank-a', 'Q1', 'local-note');
    const localFavorite = await setFavorite('bank-a', 'Q2', true);

    const remoteNoteRevision = {
      revisionId: 'remote-note-rev',
      parentRevisionIds: [],
      changedAt: '2026-10-06T08:10:00.000Z',
      changedByDeviceId: 'device-remote',
      clock: {
        physicalMs: new Date('2026-10-06T08:10:00.000Z').getTime(),
        logical: 0,
        deviceId: 'device-remote',
      },
    };
    const remoteFavoritePhysicalMs =
      Number(localFavorite.revision?.clock?.physicalMs || Date.now()) + 1000;
    const remoteFavoriteRevision = {
      revisionId: 'remote-favorite-rev',
      parentRevisionIds: [],
      changedAt: new Date(remoteFavoritePhysicalMs).toISOString(),
      changedByDeviceId: 'device-remote',
      clock: {
        physicalMs: remoteFavoritePhysicalMs,
        logical: 0,
        deviceId: 'device-remote',
      },
    };

    const attempt = {
      eventVersion: 1,
      eventId: 'remote-attempt-1',
      bankId: 'bank-a',
      questionId: 'Q3',
      questionKey: 'bank-a::Q3',
      sessionId: null,
      activityType: 'practice',
      mode: 'normal',
      answeredAt: '2026-10-06T08:12:00.000Z',
      recordedAt: '2026-10-06T08:12:00.000Z',
      deviceId: 'device-remote',
      selectedAnswer: ['A'],
      outcome: 'correct',
      responseTimeMs: 500,
      context: {
        bankName: 'Bank A',
        bankVersion: '1.0.0',
        bankFingerprint: null,
        questionFingerprint: null,
        questionType: 'single-choice',
        chapter: null,
        difficulty: null,
      },
    };

    const commit = await createCloudCommit({
      profileId: 'profile-a',
      deviceId: 'device-remote',
      deviceSequence: 1,
      commitId: 'remote-b10-1',
      createdAt: '2026-10-06T08:13:00.000Z',
      mutations: [
        {
          mutationId: 'remote-note-mutation',
          type: 'note',
          key: 'bank-a::Q1',
          op: 'upsert',
          policy: 'conflict-sensitive',
          revision: remoteNoteRevision,
          value: {
            key: 'bank-a::Q1',
            bankId: 'bank-a',
            questionId: 'Q1',
            text: 'remote-note',
            createdAt: '2026-10-06T08:00:00.000Z',
            updatedAt: '2026-10-06T08:10:00.000Z',
            revision: remoteNoteRevision,
          },
        },
        {
          mutationId: 'remote-favorite-mutation',
          type: 'favorite',
          key: 'bank-a::Q2',
          op: 'upsert',
          policy: 'coalescible',
          revision: remoteFavoriteRevision,
          value: {
            key: 'bank-a::Q2',
            bankId: 'bank-a',
            questionId: 'Q2',
            isFavorite: false,
            changedAt: '2026-10-06T08:11:00.000Z',
            revision: remoteFavoriteRevision,
          },
        },
        {
          mutationId: 'remote-attempt-mutation',
          type: 'attempt',
          key: 'remote-attempt-1',
          op: 'append',
          policy: 'immutable',
          revision: null,
          value: attempt,
        },
      ],
    });

    const applied = await applyRemoteCommitAtomically(commit, {
      file: {
        id: 'drive-remote-b10-1',
        modifiedTime: '2026-10-06T08:13:00.000Z',
      },
      now: new Date('2026-10-06T08:14:00.000Z'),
    });
    const replay = await applyRemoteCommitAtomically(commit, {
      file: { id: 'drive-remote-b10-1' },
      now: new Date('2026-10-06T08:15:00.000Z'),
    });

    const db = await openDatabase();
    const get = (storeName, key) =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
    const all = storeName =>
      requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());

    const note = await get('notes', 'bank-a::Q1');
    const favorite = await get('favorites', 'bank-a::Q2');
    const progress = await get('progress', 'bank-a::Q3');
    const review = await get('reviewSchedule', 'bank-a::Q3');
    const conflicts = await all('syncConflicts');
    const receipts = await all('syncReceipts');
    const attempts = await all('attempts');
    const meta = await get('syncMeta', 'global');
    const inventory = await buildLocalSyncInventory();

    return {
      localNoteRevisionId: localNote.revision.revisionId,
      localFavoriteRevisionId: localFavorite.revision.revisionId,
      noteText: note.text,
      favorite: favorite.isFavorite,
      progress,
      review,
      conflicts: conflicts.map(item => ({
        id: item.conflictId,
        kind: item.kind,
        entityType: item.entityType,
        localText: item.localValue?.text || null,
        remoteText: item.remoteValue?.text || null,
      })),
      receiptIds: receipts.map(item => item.commitId),
      remoteAttemptCount: attempts.filter(item => item.eventId === 'remote-attempt-1').length,
      applied,
      replay,
      linkedProfileId: meta.linkedProfileId,
      clockPhysicalMs: meta.clock?.physicalMs || 0,
      inventory,
      firstSyncPlan: planFirstSync(inventory, { isEmpty: false }).plan,
      remoteFavoritePhysicalMs,
    };
  }, DB_NAME);

  assert.equal(result.noteText, 'local-note', 'concurrent note edit must not silently overwrite local content');
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].kind, 'concurrent-edit');
  assert.equal(result.conflicts[0].entityType, 'note');
  assert.equal(result.conflicts[0].localText, 'local-note');
  assert.equal(result.conflicts[0].remoteText, 'remote-note');

  assert.equal(result.favorite, false, 'coalescible boolean state should use deterministic LWW');
  assert.equal(result.remoteAttemptCount, 1);
  assert.equal(result.progress.attempts, 1);
  assert.equal(result.progress.correctCount, 1);
  assert.equal(result.review.level, 1);

  assert.deepEqual(result.receiptIds, ['remote-b10-1']);
  assert.equal(result.applied.receiptRecorded, true);
  assert.equal(result.applied.skipped, false);
  assert.equal(result.replay.skipped, true, 'replaying the same commit must be idempotent');
  assert.equal(result.linkedProfileId, 'profile-a');
  assert.ok(result.clockPhysicalMs >= result.remoteFavoritePhysicalMs);

  assert.equal(result.inventory.isEmpty, false);
  assert.equal(result.firstSyncPlan, 'merge-required');

  console.log('V5 B10 remote apply browser gate passed.');
} finally {
  await browser.close();
}

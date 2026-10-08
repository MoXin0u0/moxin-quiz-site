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
    (document.querySelector('#storageStatus')?.textContent || '')
      .includes('IndexedDB 已就緒'),
  null, { timeout: 15000 });

  const result = await page.evaluate(async dbName => {
    const {
      closeDatabase,
      openDatabase,
      requestToPromise,
    } = await import('/src/storage/db.js');
    const {
      runV5MigrationToCompletion,
    } = await import('/src/storage/migrations/v5-migration.js');
    const { saveNote } =
      await import('/src/storage/repositories/learning.js');
    const { createCloudCommit } =
      await import('/src/sync/cloud-contract.js');
    const { applyRemoteCommitAtomically } =
      await import('/src/sync/remote-apply.js');

    await closeDatabase();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error('IndexedDB delete blocked.'));
    });
    await openDatabase();
    await runV5MigrationToCompletion();

    const local = await saveNote('bank-live-fix', 'Q1', '00');
    const remoteRevision = {
      revisionId: 'rev-live-fix-remote-11',
      parentRevisionIds: [],
      changedAt: '2026-10-07T12:00:01.000Z',
      changedByDeviceId: 'device-b',
      clock: {
        physicalMs: new Date('2026-10-07T12:00:01.000Z').getTime(),
        logical: 0,
        deviceId: 'device-b',
      },
    };

    const divergent = await createCloudCommit({
      profileId: 'profile-live-fix',
      deviceId: 'device-b',
      deviceSequence: 1,
      commitId: 'commit-live-fix-divergent',
      createdAt: '2026-10-07T12:00:02.000Z',
      mutations: [{
        mutationId: 'mutation-live-fix-remote-11',
        type: 'note',
        key: 'bank-live-fix::Q1',
        op: 'upsert',
        policy: 'conflict-sensitive',
        revision: remoteRevision,
        value: {
          key: 'bank-live-fix::Q1',
          bankId: 'bank-live-fix',
          questionId: 'Q1',
          text: '11',
          updatedAt: '2026-10-07T12:00:01.000Z',
          revision: remoteRevision,
        },
      }],
    });

    await applyRemoteCommitAtomically(divergent, {
      file: { id: 'drive-live-fix-divergent' },
      now: new Date('2026-10-07T12:00:03.000Z'),
    });

    const dbBefore = await openDatabase();
    const beforeTx = dbBefore.transaction(
      ['notes', 'syncConflicts'],
      'readonly',
    );
    const beforeNote = await requestToPromise(
      beforeTx.objectStore('notes').get('bank-live-fix::Q1'),
    );
    const beforeConflicts = await requestToPromise(
      beforeTx.objectStore('syncConflicts').getAll(),
    );
    const openConflict = beforeConflicts.find(item => item.status === 'open');

    const mergedRevision = {
      revisionId: 'rev-live-fix-merged-0011',
      parentRevisionIds: [
        local.revision.revisionId,
        remoteRevision.revisionId,
      ],
      changedAt: '2026-10-07T12:00:04.000Z',
      changedByDeviceId: 'device-b',
      clock: {
        physicalMs: new Date('2026-10-07T12:00:04.000Z').getTime(),
        logical: 0,
        deviceId: 'device-b',
      },
    };

    const merged = await createCloudCommit({
      profileId: 'profile-live-fix',
      deviceId: 'device-b',
      deviceSequence: 2,
      commitId: 'commit-live-fix-merged',
      createdAt: '2026-10-07T12:00:05.000Z',
      mutations: [{
        mutationId: 'mutation-live-fix-merged',
        type: 'note',
        key: 'bank-live-fix::Q1',
        op: 'upsert',
        policy: 'conflict-sensitive',
        revision: mergedRevision,
        value: {
          key: 'bank-live-fix::Q1',
          bankId: 'bank-live-fix',
          questionId: 'Q1',
          text: '0011',
          updatedAt: '2026-10-07T12:00:04.000Z',
          revision: mergedRevision,
        },
      }],
    });

    const appliedMerged = await applyRemoteCommitAtomically(merged, {
      file: { id: 'drive-live-fix-merged' },
      now: new Date('2026-10-07T12:00:06.000Z'),
    });

    const dbAfter = await openDatabase();
    const afterTx = dbAfter.transaction(
      ['notes', 'syncConflicts'],
      'readonly',
    );
    const afterNote = await requestToPromise(
      afterTx.objectStore('notes').get('bank-live-fix::Q1'),
    );
    const afterConflict = await requestToPromise(
      afterTx.objectStore('syncConflicts').get(openConflict.conflictId),
    );
    const allConflicts = await requestToPromise(
      afterTx.objectStore('syncConflicts').getAll(),
    );

    return {
      beforeText: beforeNote?.text || null,
      beforeConflictStatus: openConflict?.status || null,
      conflictId: openConflict?.conflictId || null,
      afterText: afterNote?.text || null,
      afterRevisionId: afterNote?.revision?.revisionId || null,
      afterConflictStatus: afterConflict?.status || null,
      resolutionRevisionId: afterConflict?.resolutionRevisionId || null,
      resolutionSource: afterConflict?.resolutionSource || null,
      openConflictCount: allConflicts.filter(item => item.status === 'open').length,
      supersededConflicts:
        appliedMerged?.results?.[0]?.supersededConflicts || [],
    };
  }, DB_NAME);

  assert.equal(result.beforeText, '00');
  assert.equal(result.beforeConflictStatus, 'open');
  assert.ok(result.conflictId);

  assert.equal(result.afterText, '0011');
  assert.equal(result.afterRevisionId, 'rev-live-fix-merged-0011');
  assert.equal(result.afterConflictStatus, 'resolved');
  assert.equal(result.resolutionRevisionId, 'rev-live-fix-merged-0011');
  assert.equal(result.resolutionSource, 'remote-descendant');
  assert.equal(result.openConflictCount, 0);
  assert.deepEqual(result.supersededConflicts, [result.conflictId]);

  console.log(
    'V5 live conflict-resolution convergence browser gate passed.',
  );
} finally {
  await browser.close();
}


import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 960, height: 820 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  await page.goto(BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForFunction(() =>
    (document.querySelector('#storageStatus')?.textContent || '')
      .includes('IndexedDB 已就緒'),
  null, { timeout: 15000 });

  await page.evaluate(async () => {
    const {
      openDatabase,
      requestToPromise,
      transactionDone,
    } = await import('/src/storage/db.js');

    const localRevision = {
      revisionId: 'rev-b13c5-local',
      parentRevisionIds: ['rev-b13c5-base'],
      changedAt: '2026-10-07T08:00:00.000Z',
      changedByDeviceId: 'device-local',
      clock: {
        physicalMs: 1791360000000,
        logical: 0,
        deviceId: 'device-local',
      },
    };
    const remoteRevision = {
      revisionId: 'rev-b13c5-remote',
      parentRevisionIds: ['rev-b13c5-base'],
      changedAt: '2026-10-07T08:01:00.000Z',
      changedByDeviceId: 'device-remote',
      clock: {
        physicalMs: 1791360060000,
        logical: 0,
        deviceId: 'device-remote',
      },
    };

    const db = await openDatabase();
    const tx = db.transaction(
      ['notes', 'syncMeta', 'syncOutbox', 'syncRevisions', 'syncConflicts'],
      'readwrite',
    );
    const done = transactionDone(tx);
    const metaStore = tx.objectStore('syncMeta');
    const meta = await requestToPromise(metaStore.get('global'));

    tx.objectStore('syncOutbox').clear();
    tx.objectStore('syncConflicts').clear();

    tx.objectStore('notes').put({
      key: 'bank-b13c5::Q1',
      bankId: 'bank-b13c5',
      questionId: 'Q1',
      content: '本機版本第一段',
      updatedAt: localRevision.changedAt,
      revision: localRevision,
    });

    for (const [revision, side] of [
      [localRevision, 'local'],
      [remoteRevision, 'remote'],
    ]) {
      tx.objectStore('syncRevisions').put({
        ...revision,
        entityType: 'note',
        entityKey: 'bank-b13c5::Q1',
        side,
      });
    }

    tx.objectStore('syncConflicts').put({
      conflictId: 'conflict-b13c5-note',
      entityType: 'note',
      entityKey: 'bank-b13c5::Q1',
      kind: 'concurrent-edit',
      localRevision,
      remoteRevision,
      commonParentRevisionId: 'rev-b13c5-base',
      localValue: {
        key: 'bank-b13c5::Q1',
        bankId: 'bank-b13c5',
        questionId: 'Q1',
        content: '本機版本第一段',
        revision: localRevision,
      },
      remoteValue: {
        key: 'bank-b13c5::Q1',
        bankId: 'bank-b13c5',
        questionId: 'Q1',
        content: '雲端版本第二段',
        revision: remoteRevision,
      },
      createdAt: '2026-10-07T08:02:00.000Z',
      status: 'open',
      resolutionRevisionId: null,
    });

    metaStore.put({
      ...meta,
      runtimeState: 'CONFLICT',
      blockReason: null,
    });
    await done;

    window.dispatchEvent(new CustomEvent('moxin:v5-sync-refresh'));
  });

  await page.waitForFunction(() =>
    (document.querySelector('#syncStatusHost')?.textContent || '')
      .includes('需要處理'),
  );

  await page.click('#syncStatusHost [data-open-sync-center]');
  const center = page.locator('#syncCenterHost');
  await center.waitFor({ state: 'visible' });

  const mergeButton = center.locator(
    '[data-conflict-id="conflict-b13c5-note"] ' +
    '[data-resolve-conflict-merge]',
  );
  await mergeButton.waitFor({ state: 'visible' });
  assert.equal(await mergeButton.innerText(), '合併文字');

  await mergeButton.click();

  const dialog = page.locator('[data-app-dialog]');
  await dialog.waitFor({ state: 'visible' });
  const textarea = dialog.locator('textarea.app-dialog-textarea');
  assert.equal(await textarea.count(), 1);

  const seed = await textarea.inputValue();
  assert.match(seed, /本機版本第一段/);
  assert.match(seed, /雲端版本第二段/);

  const mergedText = '合併後第一段\n\n合併後第二段';
  await textarea.fill(mergedText);

  const a11y = await new AxeBuilder({ page })
    .include('[data-app-dialog]')
    .analyze();
  const severe = a11y.violations
    .filter(item => ['critical', 'serious'].includes(item.impact))
    .map(item => item.id);
  assert.deepEqual(severe, []);

  await dialog.locator('.button.primary').click();
  await dialog.waitFor({ state: 'hidden' });

  await page.waitForFunction(() =>
    !document.querySelector(
      '[data-conflict-id="conflict-b13c5-note"]',
    ),
  );

  const result = await page.evaluate(async () => {
    const {
      openDatabase,
      requestToPromise,
    } = await import('/src/storage/db.js');

    const db = await openDatabase();
    const tx = db.transaction(
      ['notes', 'syncMeta', 'syncOutbox', 'syncConflicts'],
      'readonly',
    );
    const [note, meta, outbox, conflict] = await Promise.all([
      requestToPromise(
        tx.objectStore('notes').get('bank-b13c5::Q1'),
      ),
      requestToPromise(
        tx.objectStore('syncMeta').get('global'),
      ),
      requestToPromise(
        tx.objectStore('syncOutbox').getAll(),
      ),
      requestToPromise(
        tx.objectStore('syncConflicts').get('conflict-b13c5-note'),
      ),
    ]);

    return {
      content: note?.content || null,
      parents: note?.revision?.parentRevisionIds || [],
      revisionId: note?.revision?.revisionId || null,
      runtimeState: meta?.runtimeState || null,
      conflictStatus: conflict?.status || null,
      conflictChoice: conflict?.resolutionChoice || null,
      conflictResolutionRevisionId:
        conflict?.resolutionRevisionId || null,
      outbox: outbox.map(item => ({
        type: item.entityType,
        key: item.entityKey,
        revisionId: item.targetRevisionId,
      })),
    };
  });

  assert.equal(result.content, mergedText);
  assert.deepEqual(
    [...result.parents].sort(),
    ['rev-b13c5-local', 'rev-b13c5-remote'].sort(),
  );
  assert.equal(result.runtimeState, 'PENDING');
  assert.equal(result.conflictStatus, 'resolved');
  assert.equal(result.conflictChoice, 'merged');
  assert.equal(
    result.conflictResolutionRevisionId,
    result.revisionId,
  );
  assert.ok(
    result.outbox.some(item =>
      item.type === 'note' &&
      item.key === 'bank-b13c5::Q1' &&
      item.revisionId === result.revisionId
    ),
  );


  const repairSeed = await page.evaluate(async () => {
    const {
      openDatabase,
      requestToPromise,
      transactionDone,
    } = await import('/src/storage/db.js');
    const { resolveSyncConflict, CONFLICT_RESOLUTION_CHOICE } =
      await import('/src/sync/conflict-resolution.js');

    const db = await openDatabase();
    const tx = db.transaction(
      ['notes', 'syncMeta', 'syncOutbox', 'syncRevisions', 'syncConflicts'],
      'readwrite',
    );
    const done = transactionDone(tx);
    const metaStore = tx.objectStore('syncMeta');
    const meta = await requestToPromise(metaStore.get('global'));

    const deleteLocal = {
      revisionId: 'rev-b13c51-delete-local',
      parentRevisionIds: ['rev-b13c51-delete-base'],
      changedAt: '2026-10-07T08:10:00.000Z',
      changedByDeviceId: 'device-local',
      clock: {
        physicalMs: 1791360600000,
        logical: 0,
        deviceId: 'device-local',
      },
    };
    const deleteRemote = {
      revisionId: 'rev-b13c51-delete-remote',
      parentRevisionIds: ['rev-b13c51-delete-base'],
      changedAt: '2026-10-07T08:11:00.000Z',
      changedByDeviceId: 'device-remote',
      clock: {
        physicalMs: 1791360660000,
        logical: 0,
        deviceId: 'device-remote',
      },
    };

    tx.objectStore('notes').put({
      key: 'bank-b13c51::Q-delete',
      bankId: 'bank-b13c51',
      questionId: 'Q-delete',
      content: '不可直接與刪除分支合併的本機筆記',
      updatedAt: deleteLocal.changedAt,
      revision: deleteLocal,
    });
    tx.objectStore('syncRevisions').put({
      ...deleteLocal,
      entityType: 'note',
      entityKey: 'bank-b13c51::Q-delete',
    });
    tx.objectStore('syncRevisions').put({
      ...deleteRemote,
      entityType: 'note',
      entityKey: 'bank-b13c51::Q-delete',
    });
    tx.objectStore('syncConflicts').put({
      conflictId: 'conflict-b13c51-delete-edit',
      entityType: 'note',
      entityKey: 'bank-b13c51::Q-delete',
      kind: 'delete-vs-edit',
      localRevision: deleteLocal,
      remoteRevision: deleteRemote,
      commonParentRevisionId: 'rev-b13c51-delete-base',
      localValue: {
        key: 'bank-b13c51::Q-delete',
        bankId: 'bank-b13c51',
        questionId: 'Q-delete',
        content: '不可直接與刪除分支合併的本機筆記',
        revision: deleteLocal,
      },
      remoteValue: {
        tombstoneId: 'tomb-b13c51-delete',
        entityType: 'note',
        entityKey: 'bank-b13c51::Q-delete',
        deletedAt: deleteRemote.changedAt,
        revision: deleteRemote,
      },
      createdAt: '2026-10-07T08:12:00.000Z',
      status: 'open',
      resolutionRevisionId: null,
    });

    const staleLocalSnapshot = {
      revisionId: 'rev-b13c51-stale-l1',
      parentRevisionIds: ['rev-b13c51-stale-base'],
      changedAt: '2026-10-07T08:20:00.000Z',
      changedByDeviceId: 'device-local',
      clock: {
        physicalMs: 1791361200000,
        logical: 0,
        deviceId: 'device-local',
      },
    };
    const currentLocal = {
      revisionId: 'rev-b13c51-stale-l2',
      parentRevisionIds: ['rev-b13c51-stale-l1'],
      changedAt: '2026-10-07T08:21:00.000Z',
      changedByDeviceId: 'device-local',
      clock: {
        physicalMs: 1791361260000,
        logical: 0,
        deviceId: 'device-local',
      },
    };
    const staleRemote = {
      revisionId: 'rev-b13c51-stale-r1',
      parentRevisionIds: ['rev-b13c51-stale-base'],
      changedAt: '2026-10-07T08:22:00.000Z',
      changedByDeviceId: 'device-remote',
      clock: {
        physicalMs: 1791361320000,
        logical: 0,
        deviceId: 'device-remote',
      },
    };

    tx.objectStore('notes').put({
      key: 'bank-b13c51::Q-stale',
      bankId: 'bank-b13c51',
      questionId: 'Q-stale',
      content: 'L2：衝突建立後又修改的最新本機內容',
      updatedAt: currentLocal.changedAt,
      revision: currentLocal,
    });
    for (const revision of [
      staleLocalSnapshot,
      currentLocal,
      staleRemote,
    ]) {
      tx.objectStore('syncRevisions').put({
        ...revision,
        entityType: 'note',
        entityKey: 'bank-b13c51::Q-stale',
      });
    }
    tx.objectStore('syncConflicts').put({
      conflictId: 'conflict-b13c51-stale',
      entityType: 'note',
      entityKey: 'bank-b13c51::Q-stale',
      kind: 'concurrent-edit',
      localRevision: staleLocalSnapshot,
      remoteRevision: staleRemote,
      commonParentRevisionId: 'rev-b13c51-stale-base',
      localValue: {
        key: 'bank-b13c51::Q-stale',
        bankId: 'bank-b13c51',
        questionId: 'Q-stale',
        content: 'L1：衝突建立當下的舊本機內容',
        revision: staleLocalSnapshot,
      },
      remoteValue: {
        key: 'bank-b13c51::Q-stale',
        bankId: 'bank-b13c51',
        questionId: 'Q-stale',
        content: 'R1：雲端衝突內容',
        revision: staleRemote,
      },
      createdAt: '2026-10-07T08:23:00.000Z',
      status: 'open',
      resolutionRevisionId: null,
    });

    metaStore.put({
      ...meta,
      runtimeState: 'CONFLICT',
      blockReason: null,
    });

    await done;

    let deleteMergeCode = null;
    try {
      await resolveSyncConflict('conflict-b13c51-delete-edit', {
        choice: CONFLICT_RESOLUTION_CHOICE.MERGED,
        mergedValue: { content: '這個合併不應被接受' },
      });
    } catch (error) {
      deleteMergeCode = error?.code || null;
    }

    const checkDb = await openDatabase();
    const checkTx = checkDb.transaction(
      ['syncConflicts'],
      'readonly',
    );
    const deleteConflict = await requestToPromise(
      checkTx.objectStore('syncConflicts')
        .get('conflict-b13c51-delete-edit'),
    );

    window.dispatchEvent(new CustomEvent('moxin:v5-sync-refresh'));

    return {
      deleteMergeCode,
      deleteConflictStatus: deleteConflict?.status || null,
    };
  });

  assert.equal(
    repairSeed.deleteMergeCode,
    'CONFLICT_MERGE_DELETE_EDIT',
  );
  assert.equal(repairSeed.deleteConflictStatus, 'open');

  await page.waitForSelector(
    '[data-conflict-id="conflict-b13c51-stale"]',
  );
  const staleCard = center.locator(
    '[data-conflict-id="conflict-b13c51-stale"]',
  );
  assert.match(await staleCard.innerText(), /L1：衝突建立當下的舊本機內容/);

  await staleCard.locator('[data-resolve-conflict-remote]').click();
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /採用雲端版本/);
  await dialog.locator('.button.primary').click();

  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /本機內容已更新/);
  assert.match(
    await dialog.innerText(),
    /沒有套用剛才的選擇/,
  );
  await dialog.locator('.button.primary').click();
  await dialog.waitFor({ state: 'hidden' });

  await page.waitForFunction(() => {
    const card = document.querySelector(
      '[data-conflict-id="conflict-b13c51-stale"]',
    );
    return (card?.textContent || '').includes(
      'L2：衝突建立後又修改的最新本機內容',
    );
  });

  assert.match(
    await staleCard.innerText(),
    /L2：衝突建立後又修改的最新本機內容/,
  );

  await staleCard.locator('[data-resolve-conflict-remote]').click();
  await dialog.waitFor({ state: 'visible' });
  await dialog.locator('.button.primary').click();
  await dialog.waitFor({ state: 'hidden' });

  await page.waitForFunction(() =>
    !document.querySelector(
      '[data-conflict-id="conflict-b13c51-stale"]',
    ),
  );

  const staleResolved = await page.evaluate(async () => {
    const {
      openDatabase,
      requestToPromise,
    } = await import('/src/storage/db.js');

    const db = await openDatabase();
    const tx = db.transaction(
      ['notes', 'syncConflicts'],
      'readonly',
    );
    const [note, conflict] = await Promise.all([
      requestToPromise(
        tx.objectStore('notes').get('bank-b13c51::Q-stale'),
      ),
      requestToPromise(
        tx.objectStore('syncConflicts')
          .get('conflict-b13c51-stale'),
      ),
    ]);

    return {
      content: note?.content || null,
      parents: note?.revision?.parentRevisionIds || [],
      status: conflict?.status || null,
      choice: conflict?.resolutionChoice || null,
      previousLocalRevisionId:
        conflict?.localSnapshotPreviousRevisionId || null,
      localRevisionId:
        conflict?.localRevision?.revisionId || null,
    };
  });

  assert.equal(staleResolved.content, 'R1：雲端衝突內容');
  assert.equal(staleResolved.status, 'resolved');
  assert.equal(staleResolved.choice, 'remote');
  assert.equal(
    staleResolved.previousLocalRevisionId,
    'rev-b13c51-stale-l1',
  );
  assert.equal(
    staleResolved.localRevisionId,
    'rev-b13c51-stale-l2',
  );
  assert.deepEqual(
    [...staleResolved.parents].sort(),
    ['rev-b13c51-stale-l2', 'rev-b13c51-stale-r1'].sort(),
  );

  console.log('V5 B13C5.1 conflict consistency browser gate passed.');
} finally {
  await browser.close();
}

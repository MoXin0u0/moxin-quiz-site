
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

  console.log('V5 B13C5 note merge browser gate passed.');
} finally {
  await browser.close();
}

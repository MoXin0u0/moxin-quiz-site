
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 1040, height: 860 },
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

  await page.waitForFunction(() => {
    const host = document.querySelector('#syncStatusHost');
    return host && !host.hidden &&
      Boolean(host.querySelector('[data-open-sync-center]'));
  }, null, { timeout: 10000 });

  const seeded = await page.evaluate(async () => {
    const {
      openDatabase,
      requestToPromise,
      transactionDone,
    } = await import('/src/storage/db.js');

    const localRevision = {
      revisionId: 'rev-b13c3-local',
      parentRevisionIds: ['rev-b13c3-base'],
      changedAt: '2026-10-07T06:00:00.000Z',
      changedByDeviceId: 'device-local',
      clock: {
        physicalMs: 1791352800000,
        logical: 0,
        deviceId: 'device-local',
      },
    };
    const remoteRevision = {
      revisionId: 'rev-b13c3-remote',
      parentRevisionIds: ['rev-b13c3-base'],
      changedAt: '2026-10-07T06:01:00.000Z',
      changedByDeviceId: 'device-remote',
      clock: {
        physicalMs: 1791352860000,
        logical: 0,
        deviceId: 'device-remote',
      },
    };

    const db = await openDatabase();
    const tx = db.transaction(
      [
        'notes',
        'syncMeta',
        'syncOutbox',
        'syncRevisions',
        'syncConflicts',
      ],
      'readwrite',
    );
    const done = transactionDone(tx);
    const metaStore = tx.objectStore('syncMeta');
    const meta = await requestToPromise(metaStore.get('global'));

    tx.objectStore('syncOutbox').clear();
    tx.objectStore('syncConflicts').clear();

    tx.objectStore('notes').put({
      key: 'bank-b13c3::Q1',
      bankId: 'bank-b13c3',
      questionId: 'Q1',
      content: '此裝置保留的筆記版本',
      updatedAt: localRevision.changedAt,
      revision: localRevision,
    });
    tx.objectStore('syncRevisions').put({
      ...localRevision,
      entityType: 'note',
      entityKey: 'bank-b13c3::Q1',
    });
    tx.objectStore('syncRevisions').put({
      ...remoteRevision,
      entityType: 'note',
      entityKey: 'bank-b13c3::Q1',
    });

    tx.objectStore('syncConflicts').put({
      conflictId: 'conflict-b13c3-note',
      entityType: 'note',
      entityKey: 'bank-b13c3::Q1',
      kind: 'concurrent-edit',
      localRevision,
      remoteRevision,
      commonParentRevisionId: 'rev-b13c3-base',
      localValue: {
        key: 'bank-b13c3::Q1',
        bankId: 'bank-b13c3',
        questionId: 'Q1',
        content: '此裝置保留的筆記版本',
        updatedAt: localRevision.changedAt,
        revision: localRevision,
      },
      remoteValue: {
        key: 'bank-b13c3::Q1',
        bankId: 'bank-b13c3',
        questionId: 'Q1',
        content: '雲端較新的筆記分支',
        updatedAt: remoteRevision.changedAt,
        revision: remoteRevision,
      },
      baseValue: null,
      sourceCommitId: 'commit-b13c3',
      sourceMutationId: 'mutation-b13c3-note',
      createdAt: '2026-10-07T06:02:00.000Z',
      status: 'open',
      resolutionRevisionId: null,
    });

    tx.objectStore('syncConflicts').put({
      conflictId: 'conflict-b13c3-attempt',
      entityType: 'attempt',
      entityKey: 'event-b13c3',
      kind: 'content-id-collision',
      localRevision: null,
      remoteRevision: null,
      commonParentRevisionId: null,
      localValue: {
        eventId: 'event-b13c3',
        bankId: 'bank-b13c3',
        questionId: 'Q2',
        selectedOptionIds: ['A'],
      },
      remoteValue: {
        eventId: 'event-b13c3',
        bankId: 'bank-b13c3',
        questionId: 'Q2',
        selectedOptionIds: ['B'],
      },
      baseValue: null,
      sourceCommitId: 'commit-b13c3-attempt',
      sourceMutationId: 'mutation-b13c3-attempt',
      createdAt: '2026-10-07T06:03:00.000Z',
      status: 'open',
      resolutionRevisionId: null,
    });

    metaStore.put({
      ...meta,
      runtimeState: 'CONFLICT',
      blockReason: null,
    });

    await done;
    return {
      deviceId: meta.deviceId,
    };
  });

  assert.ok(seeded.deviceId);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('moxin:v5-sync-refresh'));
  });

  await page.waitForFunction(() =>
    (document.querySelector('#syncStatusHost')?.textContent || '')
      .includes('需要處理'),
  );

  await page.click('#syncStatusHost [data-open-sync-center]');
  const center = page.locator('#syncCenterHost');
  await center.waitFor({ state: 'visible' });
  await page.waitForSelector('[data-sync-conflicts-section]');

  const conflictText = await center.locator(
    '[data-sync-conflicts-section]',
  ).innerText();
  assert.match(conflictText, /同步衝突/);
  assert.match(conflictText, /題目筆記/);
  assert.match(conflictText, /此裝置保留的筆記版本/);
  assert.match(conflictText, /雲端較新的筆記分支/);
  assert.match(conflictText, /不可變資料識別衝突/);
  assert.match(conflictText, /需要人工復原/);

  assert.equal(
    await center.locator(
      '[data-conflict-id="conflict-b13c3-note"] ' +
      '[data-resolve-conflict-remote]',
    ).count(),
    1,
  );
  assert.equal(
    await center.locator(
      '[data-conflict-id="conflict-b13c3-attempt"] ' +
      '[data-resolve-conflict-remote]',
    ).count(),
    0,
  );

  const a11y = await new AxeBuilder({ page })
    .include('[data-sync-conflicts-section]')
    .analyze();
  const severe = a11y.violations
    .filter(item => ['critical', 'serious'].includes(item.impact))
    .map(item => item.id);
  assert.deepEqual(severe, [], JSON.stringify(
    a11y.violations.filter(item => ['critical', 'serious'].includes(item.impact))
      .map(item => ({
        id: item.id,
        nodes: item.nodes.map(node => ({
          target: node.target,
          summary: node.failureSummary,
          data: node.any.map(check => check.data),
        })),
      })),
    null,
    2,
  ));

  await center.locator(
    '[data-conflict-id="conflict-b13c3-note"] ' +
    '[data-resolve-conflict-remote]',
  ).click();

  const dialog = page.locator('[data-app-dialog]');
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /採用雲端版本/);
  assert.match(await dialog.innerText(), /同時承接兩個 Revision/);
  await dialog.locator('.button.primary').click();
  await dialog.waitFor({ state: 'hidden' });

  await page.waitForFunction(() => {
    const section = document.querySelector('[data-sync-conflicts-section]');
    return section && !section.textContent.includes('題目筆記');
  });

  const resolved = await page.evaluate(async () => {
    const {
      openDatabase,
      requestToPromise,
    } = await import('/src/storage/db.js');

    const db = await openDatabase();
    const tx = db.transaction(
      ['notes', 'syncMeta', 'syncOutbox', 'syncConflicts'],
      'readonly',
    );
    const [note, meta, outbox, noteConflict, attemptConflict] =
      await Promise.all([
        requestToPromise(
          tx.objectStore('notes').get('bank-b13c3::Q1'),
        ),
        requestToPromise(
          tx.objectStore('syncMeta').get('global'),
        ),
        requestToPromise(
          tx.objectStore('syncOutbox').getAll(),
        ),
        requestToPromise(
          tx.objectStore('syncConflicts').get('conflict-b13c3-note'),
        ),
        requestToPromise(
          tx.objectStore('syncConflicts').get('conflict-b13c3-attempt'),
        ),
      ]);

    return {
      noteContent: note?.content || null,
      noteRevision: note?.revision || null,
      runtimeState: meta?.runtimeState || null,
      outbox: outbox.map(item => ({
        type: item.entityType,
        key: item.entityKey,
        targetRevisionId: item.targetRevisionId,
      })),
      noteConflict: {
        status: noteConflict?.status || null,
        choice: noteConflict?.resolutionChoice || null,
        resolutionRevisionId:
          noteConflict?.resolutionRevisionId || null,
      },
      attemptStatus: attemptConflict?.status || null,
    };
  });

  assert.equal(resolved.noteContent, '雲端較新的筆記分支');
  assert.equal(resolved.runtimeState, 'PENDING');
  assert.equal(resolved.noteConflict.status, 'resolved');
  assert.equal(resolved.noteConflict.choice, 'remote');
  assert.equal(
    resolved.noteConflict.resolutionRevisionId,
    resolved.noteRevision.revisionId,
  );
  assert.deepEqual(
    [...resolved.noteRevision.parentRevisionIds].sort(),
    ['rev-b13c3-local', 'rev-b13c3-remote'].sort(),
  );
  assert.ok(
    resolved.outbox.some(item =>
      item.type === 'note' &&
      item.key === 'bank-b13c3::Q1' &&
      item.targetRevisionId === resolved.noteRevision.revisionId
    ),
  );
  assert.equal(resolved.attemptStatus, 'open');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(50);
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
    ),
    true,
  );

  console.log('V5 B13C3 conflict resolution browser gate passed.');
} finally {
  await browser.close();
}

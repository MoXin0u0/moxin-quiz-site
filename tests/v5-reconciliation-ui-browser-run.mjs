import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const DB_NAME = 'moxin-quiz-v3';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 960, height: 800 },
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

  const planned = await page.evaluate(async dbName => {
    const {
      closeDatabase,
      openDatabase,
      requestToPromise,
    } = await import('/src/storage/db.js');
    const { runV5MigrationToCompletion } =
      await import('/src/storage/migrations/v5-migration.js');
    const { setFavorite } =
      await import('/src/storage/repositories/learning.js');
    const { planFirstCloudConnection } =
      await import('/src/app/cloud-sync-flow.js');

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
    await setFavorite('bank-b13c2', 'Q1', true);

    const createStore = () => ({
      files: [],
      payloads: new Map(),
      writes: 0,
    });
    const stores = {
      a: createStore(),
      b: createStore(),
    };

    const provider = {
      currentAccount: 'a',
      get store() {
        return stores[this.currentAccount];
      },
      async getAccountProfile() {
        return {
          provider: 'google',
          providerSubject: 'subject-' + this.currentAccount,
          displayName: 'Account ' + this.currentAccount.toUpperCase(),
          displayEmail: this.currentAccount + '@example.com',
          photoUrl: null,
        };
      },
      async listFiles({ appProperties = {}, pageToken = null } = {}) {
        if (pageToken) return { files: [], nextPageToken: null };
        return {
          files: this.store.files
            .filter(file =>
              Object.entries(appProperties).every(([key, value]) =>
                String(file.appProperties?.[key] || '') === String(value)
              )
            )
            .map(item => structuredClone(item)),
          nextPageToken: null,
        };
      },
      async createJsonFile({ name, data, appProperties = {} }) {
        const store = this.store;
        store.writes += 1;
        const file = {
          id: this.currentAccount + '-file-' + String(store.files.length + 1),
          name,
          mimeType: 'application/json',
          modifiedTime: '2026-10-07T05:30:00.000Z',
          appProperties: { ...appProperties },
        };
        store.files.push(file);
        store.payloads.set(file.id, structuredClone(data));
        return structuredClone(file);
      },
      async updateJsonFile(fileId, {
        name = null,
        data,
        appProperties = {},
      }) {
        const store = this.store;
        store.writes += 1;
        const index = store.files.findIndex(file => file.id === fileId);
        if (index < 0) throw new Error('file not found: ' + fileId);
        store.files[index] = {
          ...store.files[index],
          ...(name ? { name } : {}),
          modifiedTime: '2026-10-07T05:31:00.000Z',
          appProperties: { ...appProperties },
        };
        store.payloads.set(fileId, structuredClone(data));
        return structuredClone(store.files[index]);
      },
      async downloadJson(fileId) {
        return structuredClone(this.store.payloads.get(fileId));
      },
      async getFileMetadata(fileId) {
        const file = this.store.files.find(item => item.id === fileId);
        return file ? structuredClone(file) : null;
      },
      clearAuthorization() {},
    };

    window.__b13c2Provider = provider;
    window.__b13c2Stores = stores;

    const plan = await planFirstCloudConnection(provider, {
      now: () => new Date('2026-10-07T05:30:00.000Z'),
    });
    window.__b13c2Plan = plan;

    const db = await openDatabase();
    const meta = await requestToPromise(
      db.transaction('syncMeta', 'readonly')
        .objectStore('syncMeta')
        .get('global'),
    );

    return {
      writes: stores.a.writes,
      files: stores.a.files.length,
      phase: meta.reconciliation?.phase || null,
      linkedProfileId: meta.linkedProfileId || null,
      plan: plan.plan.plan,
      targetProfileId: plan.reconciliation.targetProfileId,
    };
  }, DB_NAME);

  assert.equal(planned.writes, 0);
  assert.equal(planned.files, 0);
  assert.equal(planned.phase, 'planning');
  assert.ok(planned.linkedProfileId);
  assert.equal(planned.plan, 'upload-local');
  assert.equal(planned.linkedProfileId, planned.targetProfileId);

  await page.evaluate(async () => {
    const { showReconciliationPlanDialog } =
      await import('/src/ui/first-sync.js');
    window.__b13c2Dialog = 'pending';
    showReconciliationPlanDialog({
      kind: 'first-sync',
      account: window.__b13c2Plan.account,
      localInventory: window.__b13c2Plan.localInventory,
      remoteInventory: window.__b13c2Plan.remoteInventory,
      plan: window.__b13c2Plan.plan,
    }).then(value => {
      window.__b13c2Dialog = value;
    });
  });

  const dialog = page.locator('[data-app-dialog]');
  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /套用並開始同步/);
  assert.match(await dialog.innerText(), /不會建立新的雲端 profile/);
  await dialog.locator('.button.secondary').click();
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => window.__b13c2Dialog === false);

  const cancelled = await page.evaluate(async () => {
    const { cancelFirstCloudConnection } =
      await import('/src/app/cloud-sync-flow.js');
    const { openDatabase, requestToPromise } =
      await import('/src/storage/db.js');

    const result = await cancelFirstCloudConnection(window.__b13c2Plan);
    const db = await openDatabase();
    const meta = await requestToPromise(
      db.transaction('syncMeta', 'readonly')
        .objectStore('syncMeta')
        .get('global'),
    );
    return {
      result,
      linkedProfileId: meta.linkedProfileId || null,
      reconciliation: meta.reconciliation || null,
      runtimeState: meta.runtimeState,
      writes: window.__b13c2Stores.a.writes,
    };
  });

  assert.equal(cancelled.result.status, 'cancelled');
  assert.equal(cancelled.linkedProfileId, null);
  assert.equal(cancelled.reconciliation, null);
  assert.equal(cancelled.runtimeState, 'LOCAL_ONLY');
  assert.equal(cancelled.writes, 0);

  await page.evaluate(async () => {
    const { planFirstCloudConnection } =
      await import('/src/app/cloud-sync-flow.js');
    window.__b13c2Plan = await planFirstCloudConnection(
      window.__b13c2Provider,
      { now: () => new Date('2026-10-07T05:32:00.000Z') },
    );
    const { showReconciliationPlanDialog } =
      await import('/src/ui/first-sync.js');
    window.__b13c2Dialog = 'pending';
    showReconciliationPlanDialog({
      kind: 'first-sync',
      account: window.__b13c2Plan.account,
      localInventory: window.__b13c2Plan.localInventory,
      remoteInventory: window.__b13c2Plan.remoteInventory,
      plan: window.__b13c2Plan.plan,
    }).then(value => {
      window.__b13c2Dialog = value;
    });
  });

  await dialog.waitFor({ state: 'visible' });
  assert.equal(
    await page.evaluate(() => window.__b13c2Stores.a.writes),
    0,
  );
  await dialog.locator('.button.primary').click();
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => window.__b13c2Dialog === true);

  const applied = await page.evaluate(async () => {
    const { applyFirstCloudConnection } =
      await import('/src/app/cloud-sync-flow.js');
    const { openDatabase, requestToPromise } =
      await import('/src/storage/db.js');

    const result = await applyFirstCloudConnection(
      window.__b13c2Provider,
      window.__b13c2Plan,
      { now: () => new Date('2026-10-07T05:33:00.000Z') },
    );

    const db = await openDatabase();
    const meta = await requestToPromise(
      db.transaction('syncMeta', 'readonly')
        .objectStore('syncMeta')
        .get('global'),
    );
    const outbox = await requestToPromise(
      db.transaction('syncOutbox', 'readonly')
        .objectStore('syncOutbox')
        .count(),
    );

    return {
      status: result.status,
      cycleStatus: result.cycle.status,
      runtimeState: meta.runtimeState,
      linkedProfileId: meta.linkedProfileId,
      cloudSubject: meta.cloudAccount?.providerSubject || null,
      outbox,
      writes: window.__b13c2Stores.a.writes,
      profileFiles: window.__b13c2Stores.a.files.filter(file =>
        file.appProperties?.objectType === 'profile'
      ).length,
    };
  });

  assert.equal(applied.status, 'synced');
  assert.equal(applied.cycleStatus, 'synced');
  assert.equal(applied.runtimeState, 'SYNCED');
  assert.equal(applied.cloudSubject, 'subject-a');
  assert.equal(applied.outbox, 0);
  assert.ok(applied.writes >= 2);
  assert.equal(applied.profileFiles, 1);

  const switchPlan = await page.evaluate(async () => {
    const { planCloudAccountSwitch } =
      await import('/src/app/cloud-sync-flow.js');
    const { openDatabase, requestToPromise } =
      await import('/src/storage/db.js');

    window.__b13c2Provider.currentAccount = 'b';
    const plan = await planCloudAccountSwitch(
      window.__b13c2Provider,
      { now: () => new Date('2026-10-07T05:34:00.000Z') },
    );
    window.__b13c2SwitchPlan = plan;

    const db = await openDatabase();
    const meta = await requestToPromise(
      db.transaction('syncMeta', 'readonly')
        .objectStore('syncMeta')
        .get('global'),
    );
    return {
      status: plan.status,
      plan: plan.plan.plan,
      linkedProfileId: meta.linkedProfileId,
      accountSwitchPhase: meta.accountSwitch?.phase || null,
      targetProfileId: plan.reconciliation.targetProfileId,
      writesB: window.__b13c2Stores.b.writes,
    };
  });

  assert.equal(switchPlan.status, 'planning');
  assert.equal(switchPlan.plan, 'upload-local');
  assert.equal(switchPlan.accountSwitchPhase, 'planning');
  assert.notEqual(switchPlan.targetProfileId, switchPlan.linkedProfileId);
  assert.equal(switchPlan.writesB, 0);

  await page.evaluate(async () => {
    const { showReconciliationPlanDialog } =
      await import('/src/ui/first-sync.js');
    window.__b13c2Dialog = 'pending';
    showReconciliationPlanDialog({
      kind: 'account-switch',
      account: window.__b13c2SwitchPlan.account,
      localInventory: window.__b13c2SwitchPlan.localInventory,
      remoteInventory: window.__b13c2SwitchPlan.remoteInventory,
      plan: window.__b13c2SwitchPlan.plan,
    }).then(value => {
      window.__b13c2Dialog = value;
    });
  });

  await dialog.waitFor({ state: 'visible' });
  assert.match(await dialog.innerText(), /確認切換 Google 同步帳號/);
  assert.match(
    await dialog.innerText(),
    /不會把目前裝置的資料上傳到新的 Google 帳號/,
  );
  await dialog.locator('.button.secondary').click();
  await dialog.waitFor({ state: 'hidden' });

  const switchCancelled = await page.evaluate(async () => {
    const { cancelCloudAccountSwitch } =
      await import('/src/app/cloud-sync-flow.js');
    const { openDatabase, requestToPromise } =
      await import('/src/storage/db.js');

    const before = window.__b13c2SwitchPlan.reconciliation.sourceProfileId;
    const result = await cancelCloudAccountSwitch(
      window.__b13c2SwitchPlan,
    );
    const db = await openDatabase();
    const meta = await requestToPromise(
      db.transaction('syncMeta', 'readonly')
        .objectStore('syncMeta')
        .get('global'),
    );
    return {
      result,
      sourceProfileId: before,
      linkedProfileId: meta.linkedProfileId,
      accountSwitch: meta.accountSwitch || null,
      writesB: window.__b13c2Stores.b.writes,
    };
  });

  assert.equal(switchCancelled.result.status, 'cancelled');
  assert.equal(
    switchCancelled.linkedProfileId,
    switchCancelled.sourceProfileId,
  );
  assert.equal(switchCancelled.accountSwitch, null);
  assert.equal(switchCancelled.writesB, 0);

  console.log('V5 B13C2 first-sync/account-switch UX browser gate passed.');
} finally {
  await browser.close();
}

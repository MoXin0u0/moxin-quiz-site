
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 1000, height: 780 },
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

  // Production branch remains dormant-by-default: scheduler startup must not
  // inject GIS or request authorization while cloudSync=false.
  await page.waitForTimeout(120);
  assert.equal(
    await page.locator(
      'script[src*="accounts.google.com/gsi/client"]',
    ).count(),
    0,
  );

  const eventResult = await page.evaluate(async () => {
    const { setFavorite } =
      await import('/src/storage/repositories/learning.js');

    let events = 0;
    const handler = () => { events += 1; };
    window.addEventListener('moxin:v5-sync-pending', handler);
    await setFavorite('bank-scheduler', 'Q1', true);
    await new Promise(resolve => setTimeout(resolve, 0));
    window.removeEventListener('moxin:v5-sync-pending', handler);

    return { events };
  });
  assert.ok(eventResult.events >= 1);

  const schedulerResult = await page.evaluate(async () => {
    const {
      SyncScheduler,
      SYNC_PENDING_EVENT,
    } = await import('/src/sync/sync-scheduler.js');

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const makeTargets = () => {
      const win = new EventTarget();
      const doc = new EventTarget();
      doc.visibilityState = 'visible';
      const nav = { onLine: true };
      return { win, doc, nav };
    };

    // Local-only startup: no sync cycle.
    {
      const { win, doc, nav } = makeTargets();
      let runs = 0;
      const scheduler = new SyncScheduler({
        getSnapshot: async () => ({
          cloudRuntimeEnabled: false,
          cloudConfigured: false,
          connected: false,
          linkedProfileId: null,
          conflictCount: 0,
          runtimeState: 'LOCAL_ONLY',
        }),
        runSync: async () => {
          runs += 1;
          return { status: 'synced' };
        },
        windowRef: win,
        documentRef: doc,
        navigatorRef: nav,
        idleDebounceMs: 20,
        activePendingMaxMs: 60,
      });
      scheduler.start();
      await sleep(35);
      scheduler.stop();
      if (runs !== 0) {
        throw new Error('Local-only startup triggered automatic sync.');
      }
    }

    // Debounce: repeated local mutations collapse into one cycle.
    let debounceRuns = 0;
    {
      const { win, doc, nav } = makeTargets();
      let eligible = false;
      const scheduler = new SyncScheduler({
        getSnapshot: async () => eligible
          ? {
              cloudRuntimeEnabled: true,
              cloudConfigured: true,
              connected: true,
              linkedProfileId: 'profile-debounce',
              conflictCount: 0,
              runtimeState: 'PENDING',
            }
          : {
              cloudRuntimeEnabled: false,
              cloudConfigured: false,
              connected: false,
              linkedProfileId: null,
              conflictCount: 0,
              runtimeState: 'LOCAL_ONLY',
            },
        runSync: async () => {
          debounceRuns += 1;
          return { status: 'synced' };
        },
        windowRef: win,
        documentRef: doc,
        navigatorRef: nav,
        idleDebounceMs: 30,
        activePendingMaxMs: 90,
      });

      scheduler.start();
      await sleep(35);
      eligible = true;
      win.dispatchEvent(new Event(SYNC_PENDING_EVENT));
      await sleep(10);
      win.dispatchEvent(new Event(SYNC_PENDING_EVENT));
      await sleep(10);
      win.dispatchEvent(new Event(SYNC_PENDING_EVENT));
      await sleep(20);
      const beforeIdle = debounceRuns;
      await sleep(25);
      const afterIdle = debounceRuns;
      scheduler.stop();

      if (beforeIdle !== 0 || afterIdle !== 1) {
        throw new Error(
          'Idle debounce mismatch: ' + beforeIdle + '/' + afterIdle,
        );
      }
    }

    // Active-pending ceiling: continuous mutations cannot defer forever.
    let maxRuns = 0;
    {
      const { win, doc, nav } = makeTargets();
      let eligible = false;
      const scheduler = new SyncScheduler({
        getSnapshot: async () => eligible
          ? {
              cloudRuntimeEnabled: true,
              cloudConfigured: true,
              connected: true,
              linkedProfileId: 'profile-max',
              conflictCount: 0,
              runtimeState: 'PENDING',
            }
          : {
              cloudRuntimeEnabled: false,
              cloudConfigured: false,
              connected: false,
              linkedProfileId: null,
              conflictCount: 0,
              runtimeState: 'LOCAL_ONLY',
            },
        runSync: async () => {
          maxRuns += 1;
          return { status: 'synced' };
        },
        windowRef: win,
        documentRef: doc,
        navigatorRef: nav,
        idleDebounceMs: 35,
        activePendingMaxMs: 80,
      });

      scheduler.start();
      await sleep(40);
      eligible = true;

      for (let index = 0; index < 6; index += 1) {
        win.dispatchEvent(new Event(SYNC_PENDING_EVENT));
        await sleep(15);
      }
      await sleep(20);
      scheduler.stop();

      if (maxRuns < 1) {
        throw new Error('Active pending ceiling did not run sync.');
      }
    }

    // Offline mutation waits; reconnect triggers the cycle.
    let reconnectRuns = 0;
    {
      const { win, doc, nav } = makeTargets();
      nav.onLine = false;
      const scheduler = new SyncScheduler({
        getSnapshot: async () => ({
          cloudRuntimeEnabled: true,
          cloudConfigured: true,
          connected: true,
          linkedProfileId: 'profile-reconnect',
          conflictCount: 0,
          runtimeState: 'PENDING',
        }),
        runSync: async () => {
          reconnectRuns += 1;
          return { status: 'synced' };
        },
        windowRef: win,
        documentRef: doc,
        navigatorRef: nav,
        idleDebounceMs: 20,
        activePendingMaxMs: 60,
      });

      scheduler.start();
      win.dispatchEvent(new Event(SYNC_PENDING_EVENT));
      await sleep(35);
      const whileOffline = reconnectRuns;

      nav.onLine = true;
      win.dispatchEvent(new Event('online'));
      await sleep(20);
      const afterReconnect = reconnectRuns;
      scheduler.stop();

      if (whileOffline !== 0 || afterReconnect !== 1) {
        throw new Error(
          'Reconnect trigger mismatch: ' +
          whileOffline + '/' + afterReconnect,
        );
      }
    }

    // Conflicts block automatic cycles.
    let conflictRuns = 0;
    {
      const { win, doc, nav } = makeTargets();
      const scheduler = new SyncScheduler({
        getSnapshot: async () => ({
          cloudRuntimeEnabled: true,
          cloudConfigured: true,
          connected: true,
          linkedProfileId: 'profile-conflict',
          conflictCount: 1,
          runtimeState: 'CONFLICT',
        }),
        runSync: async () => {
          conflictRuns += 1;
          return { status: 'synced' };
        },
        windowRef: win,
        documentRef: doc,
        navigatorRef: nav,
        idleDebounceMs: 15,
        activePendingMaxMs: 50,
      });

      scheduler.start();
      await sleep(25);
      win.dispatchEvent(new Event(SYNC_PENDING_EVENT));
      await sleep(25);
      scheduler.stop();

      if (conflictRuns !== 0) {
        throw new Error('Conflict state triggered automatic sync.');
      }
    }

    return {
      debounceRuns,
      maxRuns,
      reconnectRuns,
      conflictRuns,
    };
  });

  assert.equal(schedulerResult.debounceRuns, 1);
  assert.ok(schedulerResult.maxRuns >= 1);
  assert.equal(schedulerResult.reconnectRuns, 1);
  assert.equal(schedulerResult.conflictRuns, 0);

  console.log('V5 B13C4 automatic sync scheduler browser gate passed.');
} finally {
  await browser.close();
}

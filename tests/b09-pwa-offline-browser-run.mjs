import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// B09-01 tests actual Service Worker / CacheStorage / IndexedDB in Chromium.
// This complements (not replaces) manual installed-PWA and physical-device checks.
const APP_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const BOOTSTRAP_URL = new URL('./terms.html', APP_URL).href;
const DEMO_ID = 'MoXin_QuickStart_Demo';
const swSource = readFileSync('service-worker.js', 'utf8');
const cacheName = swSource.match(/const CACHE_VERSION = '([^']+)'/)?.[1];
assert.ok(cacheName?.startsWith('moxin-quiz-v5-'), 'Expected production v5 cache namespace');

const browser = await chromium.launch({ headless: true });
let context;

async function waitForLocalApp(page) {
  await page.waitForFunction(() =>
    (document.querySelector('#storageStatus')?.textContent || '')
      .includes('IndexedDB 已就緒'), null, { timeout: 25000 });
  assert.equal(await page.locator('#libraryView').isVisible(), true);
}

async function readLocalDemo(page) {
  return page.evaluate(async bankId => {
    const { getBank, getQuestionsByBank } =
      await import('./src/storage/repositories/banks.js');
    const bank = await getBank(bankId);
    const questions = await getQuestionsByBank(bankId);
    return { id: bank?.id, count: questions.length, sourceType: bank?.sourceType };
  }, DEMO_ID);
}

async function readAttempts(page) {
  return page.evaluate(async bankId => {
    const { getAttemptsByBank } = await import('./src/storage/repositories/attempts.js');
    const attempts = await getAttemptsByBank(bankId);
    return attempts.map(item => ({
      questionId: item.questionId,
      correct: item.correct,
    }));
  }, DEMO_ID);
}

try {
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'allow',
    reducedMotion: 'reduce',
  });
  let page = await context.newPage();

  // Seed old namespaces before the app registers its current Service Worker.
  await page.goto(BOOTSTRAP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await caches.open('moxin-quiz-v5-b09-obsolete-test');
    await caches.open('moxin-quiz-scenes-b09-obsolete-test');
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForLocalApp(page);
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration('./');
    return registration?.active?.state === 'activated';
  }, null, { timeout: 35000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForLocalApp(page);

  const onlineCache = await page.evaluate(async () => ({
    keys: await caches.keys(),
    controlled: Boolean(navigator.serviceWorker.controller),
  }));
  assert.equal(onlineCache.controlled, true, 'Reload should be SW-controlled');
  assert.ok(onlineCache.keys.includes(cacheName), 'Latest app shell cache not installed');
  assert.ok(!onlineCache.keys.includes('moxin-quiz-v5-b09-obsolete-test'),
    'Activation must evict obsolete app shell cache');
  assert.ok(!onlineCache.keys.includes('moxin-quiz-scenes-b09-obsolete-test'),
    'Activation must evict obsolete scene cache');

  // Use the actual user flow; do not inject a fabricated bank into IndexedDB.
  await page.locator('#authorLibraryTab').click();
  const demoAdd = page.locator('#authorBankList [data-install-author-bank="' + DEMO_ID + '"]');
  await demoAdd.waitFor({ timeout: 20000 });
  await demoAdd.click();
  await page.locator('#bankList [data-open-bank="' + DEMO_ID + '"]')
    .waitFor({ timeout: 20000 });
  assert.equal(await page.locator('#userLibraryTab').getAttribute('aria-selected'), 'true');
  assert.deepEqual(await readLocalDemo(page),
    { id: DEMO_ID, count: 4, sourceType: 'author' });
  console.log('B09-01 online seed PASS: demo bank installed through Explore');

  // Closing the tab and opening a fresh tab while offline approximates
  // a cold start while preserving the same browser profile and IndexedDB.
  await context.setOffline(true);
  await page.close();
  page = await context.newPage();
  const offlineResponse = await page.goto(APP_URL, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  assert.equal(offlineResponse?.status(), 200, 'Offline navigation must use cached shell');
  await waitForLocalApp(page);
  await page.locator('#bankList [data-open-bank="' + DEMO_ID + '"]').waitFor();
  assert.deepEqual(await readLocalDemo(page),
    { id: DEMO_ID, count: 4, sourceType: 'author' });

  // Demonstrate a real offline local write through the practice UI.
  await page.locator('#bankList [data-open-bank="' + DEMO_ID + '"]').click();
  await page.locator('#bankDetailView:not([hidden]) [data-filter-keyword]')
    .fill('一本筆記本');
  await page.waitForFunction(() =>
    document.querySelector('[data-filter-count]')?.textContent?.includes('1 題'));
  await page.locator('#bankDetailView [data-start-practice]').click();
  await page.locator('#practiceView:not([hidden]) .question-title')
    .getByText('一本筆記本', { exact: false }).waitFor();
  await page.locator('#practiceView [data-option-id="B"]').click();
  assert.equal(await page.locator('#practiceView [data-answer-form] input[value="B"]').isChecked(), true,
    'Clicking the visible answer option must select its radio input');
  await page.locator('#practiceView [data-submit-answer]').click();
  await page.locator('#practiceView .feedback-panel.correct').waitFor();
  assert.deepEqual(await readAttempts(page),
    [{ questionId: 'DEMO001', correct: true }]);
  console.log('B09-01 offline practice PASS: correct answer persisted to IndexedDB');

  await page.close();
  page = await context.newPage();
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForLocalApp(page);
  assert.deepEqual(await readAttempts(page),
    [{ questionId: 'DEMO001', correct: true }],
    'Attempt must survive an additional offline cold start');
  assert.equal(await page.locator('#bankList [data-open-bank="' + DEMO_ID + '"]')
    .count(), 1);
  console.log('B09-01 offline cold restart PASS: bank and attempt retained');

  await context.setOffline(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForLocalApp(page);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('./');
    assertRegistration(registration);
    await registration.update();

    function assertRegistration(value) {
      if (!value?.active) throw new Error('PWA registration disappeared after reconnect');
    }
  });
  assert.deepEqual(await readAttempts(page),
    [{ questionId: 'DEMO001', correct: true }]);
  console.log('B09-01 reconnect PASS: update check leaves local work intact');

  console.log('B09-01 PASS: legacy cache cleanup, SW-controlled offline cold starts, local practice persistence, and reconnect.');
} finally {
  await context?.close();
  await browser.close();
}

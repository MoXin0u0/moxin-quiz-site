import assert from 'node:assert/strict';
import { firefox, webkit } from 'playwright';

// B09-02 is browser-engine coverage, not evidence of physical iOS/Android
// devices, installed PWAs, or live Google account / cross-device sync.
const APP_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const DEMO_ID = 'MoXin_QuickStart_Demo';
const cases = [
  { name: 'Firefox desktop', engine: firefox, viewport: { width: 1366, height: 768 }, download: true },
  { name: 'Firefox narrow viewport', engine: firefox, viewport: { width: 390, height: 844 }, download: false },
  { name: 'WebKit desktop', engine: webkit, viewport: { width: 1366, height: 768 }, download: true },
  { name: 'WebKit mobile-like', engine: webkit, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, download: false },
];

async function waitForReady(page) {
  await page.waitForFunction(() =>
    (document.querySelector('#storageStatus')?.textContent || '')
      .includes('IndexedDB 已就緒'), null, { timeout: 30000 });
}

async function savedAttemptCount(page) {
  return page.evaluate(async bankId => {
    const { getAttemptsByBank } = await import('./src/storage/repositories/attempts.js');
    const attempts = await getAttemptsByBank(bankId);
    return attempts.filter(attempt => attempt.questionId === 'DEMO001' && attempt.correct).length;
  }, DEMO_ID);
}

async function runCase(testCase, browser) {
  const context = await browser.newContext({
    viewport: testCase.viewport,
    isMobile: testCase.isMobile || false,
    hasTouch: testCase.hasTouch || false,
    colorScheme: testCase.viewport.width < 500 ? 'dark' : 'light',
    reducedMotion: 'reduce',
    locale: 'zh-TW',
    serviceWorkers: 'block',
    acceptDownloads: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForReady(page);
    assert.equal(await page.locator('#userLibraryTab').getAttribute('aria-selected'), 'true',
      testCase.name + ': should open in My Banks');
    assert.equal(await page.locator('#userLibraryPanel').isVisible(), true);

    await page.locator('#authorLibraryTab').click();
    const add = page.locator('#authorBankList [data-install-author-bank="' + DEMO_ID + '"]');
    await add.waitFor({ timeout: 30000 });
    await add.click();
    const myBank = page.locator('#bankList [data-open-bank="' + DEMO_ID + '"]');
    await myBank.waitFor({ timeout: 30000 });
    assert.equal(await page.locator('#userLibraryTab').getAttribute('aria-selected'), 'true');
    const libraryOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(libraryOverflow <= 2,
      testCase.name + ': library horizontal overflow ' + libraryOverflow);

    await myBank.click();
    await page.locator('#bankDetailView:not([hidden]) [data-start-practice]').waitFor();

    if (testCase.download) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        page.locator('#bankDetailView [data-export-bank]').click(),
      ]);
      assert.match(download.suggestedFilename(), /\.zip$/i,
        testCase.name + ': bank export should be ZIP');
      assert.equal(await download.failure(), null,
        testCase.name + ': bank export must finish without an error');
    }

    await page.locator('#bankDetailView [data-filter-keyword]').fill('一本筆記本');
    await page.waitForFunction(() =>
      document.querySelector('#bankDetailView [data-filter-count]')?.textContent?.includes('1 題'));
    await page.locator('#bankDetailView [data-start-practice]').click();
    await page.locator('#practiceView:not([hidden]) .question-title').waitFor();
    await page.locator('#practiceView [data-option-id="B"]').click();
    assert.equal(await page.locator('#practiceView [data-answer-form] input[value="B"]').isChecked(), true);
    await page.locator('#practiceView [data-submit-answer]').click();
    await page.locator('#practiceView .feedback-panel.correct').waitFor();
    assert.equal(await savedAttemptCount(page), 1,
      testCase.name + ': expected an IndexedDB attempt after submitting');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForReady(page);
    assert.equal(await savedAttemptCount(page), 1,
      testCase.name + ': submitted answer must persist after reload');
    assert.equal(await page.locator('#bankList [data-open-bank="' + DEMO_ID + '"]').count(), 1);
    console.log('B09-02 PASS:', testCase.name,
      'My Banks, demo import, practice, IndexedDB retention',
      testCase.download ? 'and ZIP download' : '');
  } finally {
    await context.close();
  }
}

for (const type of [firefox, webkit]) {
  const browser = await type.launch({ headless: true });
  try {
    for (const scenario of cases.filter(item => item.engine === type)) {
      await runCase(scenario, browser);
    }
  } finally {
    await browser.close();
  }
}
console.log('B09-02 PASS: Firefox/WebKit engine matrix; physical-device checks remain pending.');

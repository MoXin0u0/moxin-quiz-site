import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 850 },
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
      transactionDone,
    } = await import('/src/storage/db.js');

    const db = await openDatabase();
    const tx = db.transaction(
      ['banks', 'questions', 'favorites', 'mastery', 'notes'],
      'readwrite',
    );
    const done = transactionDone(tx);

    tx.objectStore('banks').put({
      id: 'bank-runtime-refresh',
      name: 'Runtime Refresh Test',
      description: 'V5 runtime sync refresh browser fixture',
      version: '1.0.0',
      language: 'zh-TW',
      sourceType: 'user',
      questionCount: 1,
      storedAt: '2026-10-07T13:00:00.000Z',
      updatedAt: '2026-10-07T13:00:00.000Z',
    });

    tx.objectStore('questions').put({
      key: 'bank-runtime-refresh::Q1',
      bankId: 'bank-runtime-refresh',
      questionId: 'Q1',
      id: 'Q1',
      type: 'single-choice',
      question: 'Runtime refresh question',
      options: [
        { id: 'A', text: 'A' },
        { id: 'B', text: 'B' },
      ],
      answer: 'A',
      explanation: 'fixture',
      chapter: 'Runtime',
      difficulty: 1,
      tags: [],
    });

    tx.objectStore('favorites').put({
      key: 'bank-runtime-refresh::Q1',
      bankId: 'bank-runtime-refresh',
      questionId: 'Q1',
      isFavorite: true,
      firstAddedAt: '2026-10-07T13:00:01.000Z',
      changedAt: '2026-10-07T13:00:01.000Z',
    });

    tx.objectStore('mastery').put({
      key: 'bank-runtime-refresh::Q1',
      bankId: 'bank-runtime-refresh',
      questionId: 'Q1',
      isUnfamiliar: false,
      status: 'familiar',
      changedAt: '2026-10-07T13:00:01.000Z',
      updatedAt: '2026-10-07T13:00:01.000Z',
    });

    tx.objectStore('notes').put({
      key: 'bank-runtime-refresh::Q1',
      bankId: 'bank-runtime-refresh',
      questionId: 'Q1',
      text: '同步前筆記',
      createdAt: '2026-10-07T13:00:01.000Z',
      updatedAt: '2026-10-07T13:00:01.000Z',
    });

    await done;
  });

  await page.click('#refreshBanksButton');
  await page.click('[data-library-source-tab="user"]');
  await page.click('[data-open-bank="bank-runtime-refresh"]');
  await page.waitForSelector('#bankDetailView:not([hidden])');

  assert.equal(
    await page.locator(
      '[data-learning-filter="favorite"] strong',
    ).innerText(),
    '1',
  );

  await page.click('[data-start-practice]');
  await page.waitForSelector('#practiceView:not([hidden])');

  const favoriteButton = page.locator('[data-toggle-favorite]');
  const unfamiliarButton = page.locator('[data-toggle-unfamiliar]');
  assert.match(await favoriteButton.innerText(), /已收藏/);
  assert.equal(
    await favoriteButton.getAttribute('data-favorite-active'),
    'true',
  );

  await page.click('.practice-note-details > summary');
  const noteInput = page.locator('[data-note-input]');
  assert.equal(await noteInput.inputValue(), '同步前筆記');
  await noteInput.fill('尚未儲存的本機草稿');

  await page.evaluate(async () => {
    const {
      openDatabase,
      transactionDone,
    } = await import('/src/storage/db.js');
    const {
      dispatchSyncDataRefresh,
    } = await import('/src/app/sync-data-refresh.js');

    const db = await openDatabase();
    const tx = db.transaction(
      ['favorites', 'mastery', 'notes'],
      'readwrite',
    );
    const done = transactionDone(tx);

    tx.objectStore('favorites').put({
      key: 'bank-runtime-refresh::Q1',
      bankId: 'bank-runtime-refresh',
      questionId: 'Q1',
      isFavorite: false,
      firstAddedAt: '2026-10-07T13:00:01.000Z',
      changedAt: '2026-10-07T13:05:00.000Z',
    });
    tx.objectStore('mastery').put({
      key: 'bank-runtime-refresh::Q1',
      bankId: 'bank-runtime-refresh',
      questionId: 'Q1',
      isUnfamiliar: true,
      status: 'unfamiliar',
      firstMarkedAt: '2026-10-07T13:05:00.000Z',
      changedAt: '2026-10-07T13:05:00.000Z',
      updatedAt: '2026-10-07T13:05:00.000Z',
    });
    tx.objectStore('notes').put({
      key: 'bank-runtime-refresh::Q1',
      bankId: 'bank-runtime-refresh',
      questionId: 'Q1',
      text: '雲端套用後筆記',
      createdAt: '2026-10-07T13:00:01.000Z',
      updatedAt: '2026-10-07T13:05:00.000Z',
    });

    await done;

    dispatchSyncDataRefresh({
      source: 'browser-regression',
      entities: [
        {
          entityType: 'favorite',
          entityKey: 'bank-runtime-refresh::Q1',
        },
        {
          entityType: 'unfamiliar',
          entityKey: 'bank-runtime-refresh::Q1',
        },
        {
          entityType: 'note',
          entityKey: 'bank-runtime-refresh::Q1',
        },
      ],
    }, window);
  });

  await page.waitForFunction(() =>
    document.querySelector('[data-toggle-favorite]')
      ?.dataset.favoriteActive === 'false' &&
    document.querySelector('[data-toggle-unfamiliar]')
      ?.dataset.unfamiliarActive === 'true',
  );

  assert.equal(
    await favoriteButton.getAttribute('data-favorite-active'),
    'false',
  );
  assert.match(await favoriteButton.innerText(), /☆ 收藏/);
  assert.equal(
    await unfamiliarButton.getAttribute('data-unfamiliar-active'),
    'true',
  );
  assert.equal(
    await noteInput.inputValue(),
    '尚未儲存的本機草稿',
    'runtime refresh must not overwrite unsaved note input',
  );

  page.once('dialog', dialog => dialog.accept());
  await page.click('[data-exit-practice]');
  await page.waitForSelector('#bankDetailView:not([hidden])');

  const keyword = page.locator('[data-filter-keyword]');
  await keyword.fill('Runtime');
  assert.equal(
    await page.locator(
      '[data-learning-filter="favorite"] strong',
    ).innerText(),
    '0',
  );

  await page.evaluate(async () => {
    const {
      openDatabase,
      transactionDone,
    } = await import('/src/storage/db.js');
    const {
      dispatchSyncDataRefresh,
    } = await import('/src/app/sync-data-refresh.js');

    const db = await openDatabase();
    const tx = db.transaction('favorites', 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore('favorites').put({
      key: 'bank-runtime-refresh::Q1',
      bankId: 'bank-runtime-refresh',
      questionId: 'Q1',
      isFavorite: true,
      firstAddedAt: '2026-10-07T13:00:01.000Z',
      changedAt: '2026-10-07T13:10:00.000Z',
    });
    await done;

    dispatchSyncDataRefresh({
      source: 'browser-regression',
      entities: [{
        entityType: 'favorite',
        entityKey: 'bank-runtime-refresh::Q1',
      }],
    }, window);
  });

  await page.waitForFunction(() =>
    document.querySelector(
      '[data-learning-filter="favorite"] strong',
    )?.textContent === '1',
  );

  assert.equal(await keyword.inputValue(), 'Runtime');
  assert.match(
    await page.locator('[data-question-results]').innerText(),
    /★ 收藏/,
  );

  console.log('V5 runtime sync UI refresh browser gate passed.');
} finally {
  await browser.close();
}

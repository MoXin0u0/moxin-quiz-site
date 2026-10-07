import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const APP_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const LANDING_URL = new URL('./', APP_URL).href;

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 900 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  await page.goto(APP_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForFunction(() =>
    (document.querySelector('#storageStatus')?.textContent || '')
      .includes('IndexedDB 已就緒'),
  null, { timeout: 15000 });

  assert.match(
    await page.locator('.brand-block').innerText(),
    /v5/,
  );

  await page.click('[data-nav-settings]');
  await page.waitForSelector('#settingsView:not([hidden])');
  await page.waitForSelector('.preflight-list');

  const rows = await page.locator('.preflight-row').evaluateAll(nodes =>
    nodes.map(node => ({
      text: node.textContent || '',
      className: node.className,
    })),
  );

  const rowFor = label =>
    rows.find(row => row.text.includes(label));

  for (const label of [
    '資料庫版本',
    'V5 資料遷移',
    '雲端授權狀態',
    '雲端 Schema',
    '同步待送佇列',
    '同步衝突',
    '最近同步',
    '雲端功能開關',
    'Google OAuth 設定',
  ]) {
    assert.ok(rowFor(label), `Missing preflight row: ${label}`);
  }

  assert.match(rowFor('資料庫版本').text, /IndexedDB v4/);
  assert.match(rowFor('V5 資料遷移').text, /遷移已完成/);
  assert.match(rowFor('雲端授權狀態').text, /Local-only/);
  assert.match(rowFor('雲端 Schema').text, /Cloud Schema v1/);
  assert.match(rowFor('雲端功能開關').text, /目前停用/);
  assert.match(
    rowFor('Google OAuth 設定').text,
    /不會觸發登入/,
  );

  assert.equal(
    await page.locator(
      'script[src*="accounts.google.com/gsi/client"]',
    ).count(),
    0,
  );

  await page.goto(LANDING_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  const landingText = await page.locator('body').innerText();
  assert.match(landingText, /v5/i);
  assert.match(landingText, /雲端同步可選用/);
  assert.match(landingText, /完整備份/);
  assert.match(landingText, /不登入也能完整練習與離線使用/);
  assert.match(landingText, /Optional Cloud Sync/i);

  console.log('V5 B13D1 release readiness browser gate passed.');
} finally {
  await browser.close();
}

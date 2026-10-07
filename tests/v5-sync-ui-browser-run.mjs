
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';

const browser = await chromium.launch({ headless: true });

async function assertNoSevereA11y(page, selector, scope) {
  const report = await new AxeBuilder({ page })
    .include(selector)
    .analyze();
  const severe = report.violations
    .filter(item => ['critical', 'serious'].includes(item.impact))
    .map(item => ({
      id: item.id,
      impact: item.impact,
      nodes: item.nodes.slice(0, 6).map(node => node.target),
    }));
  assert.deepEqual(severe, [], scope + ' must have no serious/critical Axe violations.');
}

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
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
      (host.textContent || '').includes('僅此裝置');
  }, null, { timeout: 10000 });

  assert.equal(
    await page.locator(
      'script[src*="accounts.google.com/gsi/client"]',
    ).count(),
    0,
  );

  assert.match(
    await page.locator('#homeDashboardArea').innerText(),
    /資料安全/,
  );

  const statusButton = page.locator(
    '#syncStatusHost [data-open-sync-center]',
  );
  await statusButton.focus();
  await statusButton.click();

  const center = page.locator('#syncCenterHost');
  await center.waitFor({ state: 'visible' });
  assert.match(await center.innerText(), /資料與同步中心/);
  assert.match(await center.innerText(), /● 僅此裝置/);
  assert.match(await center.innerText(), /本機 Inventory/);
  assert.match(await center.innerText(), /雲端 Inventory/);
  assert.match(await center.innerText(), /Google|雲端/);
  assert.equal(
    await center.locator('[data-connect-cloud]').isDisabled(),
    false,
  );
  assert.equal(
    await center.locator('[data-sync-now]').isDisabled(),
    true,
  );

  await assertNoSevereA11y(
    page,
    '#syncCenterHost',
    'Sync Center light theme',
  );

  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await assertNoSevereA11y(
    page,
    '#syncCenterHost',
    'Sync Center dark theme',
  );
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });

  const activeInCenter = await page.evaluate(() =>
    Boolean(
      document.querySelector('#syncCenterHost [data-sync-center-panel]')
        ?.contains(document.activeElement),
    ),
  );
  assert.equal(activeInCenter, true);

  await page.keyboard.press('Escape');
  await center.waitFor({ state: 'hidden' });
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.matches(
        '#syncStatusHost [data-open-sync-center]',
      ) === true,
    ),
    true,
  );

  await page.click('[data-nav-settings]');
  await page.waitForSelector('[data-cloud-settings-card]');
  const cloudCardText = await page.locator(
    '[data-cloud-settings-card]',
  ).innerText();
  assert.match(cloudCardText, /帳號與雲端/);
  assert.match(cloudCardText, /尚未連結 Google/);

  await page.evaluate(async () => {
    const { showConfirmDialog } = await import('/src/ui/dialogs.js');
    window.__b13cDialogResult = 'pending';
    showConfirmDialog({
      title: '測試高風險對話框',
      message: '確認鍵盤與焦點行為。',
      confirmLabel: '套用',
      cancelLabel: '取消',
      danger: true,
    }).then(value => {
      window.__b13cDialogResult = value;
    });
  });

  const dialog = page.locator('[data-app-dialog]');
  await dialog.waitFor({ state: 'visible' });
  assert.equal(
    await page.evaluate(() =>
      document.querySelector('[data-app-dialog] [role="dialog"]')
        ?.contains(document.activeElement) === true,
    ),
    true,
  );
  await assertNoSevereA11y(
    page,
    '#appDialogHost',
    'Custom confirmation dialog',
  );
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() =>
    window.__b13cDialogResult === false,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-nav-library]');
  await page.waitForTimeout(50);

  const visibleNav390 = await page.locator(
    '.main-nav > .nav-item',
  ).evaluateAll(nodes =>
    nodes.filter(node => getComputedStyle(node).display !== 'none').length,
  );
  assert.equal(visibleNav390, 5);

  assert.equal(
    await page.locator('[data-nav-tools]').evaluate(
      node => getComputedStyle(node).display === 'none',
    ),
    true,
  );
  assert.equal(
    await page.locator('[data-nav-settings]').evaluate(
      node => getComputedStyle(node).display === 'none',
    ),
    true,
  );

  await page.click('[data-nav-more]');
  const moreMenu = page.locator('#mobileMoreMenuHost');
  await moreMenu.waitFor({ state: 'visible' });
  const moreText = await moreMenu.innerText();
  assert.match(moreText, /題庫工作室/);
  assert.match(moreText, /帳號與同步/);
  assert.match(moreText, /設定/);
  assert.match(moreText, /完整備份/);
  await assertNoSevereA11y(
    page,
    '#mobileMoreMenuHost',
    'Mobile More menu',
  );

  await page.click('[data-more-sync]');
  await center.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await center.waitFor({ state: 'hidden' });
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.matches('[data-nav-more]') === true,
    ),
    true,
  );

  assert.equal(
    await page.evaluate(() =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
    ),
    true,
  );

  await page.setViewportSize({ width: 320, height: 740 });
  await page.waitForTimeout(50);

  const visibleNav320 = await page.locator(
    '.main-nav > .nav-item',
  ).evaluateAll(nodes =>
    nodes.filter(node => getComputedStyle(node).display !== 'none').length,
  );
  assert.equal(visibleNav320, 5);

  assert.equal(
    await page.evaluate(() =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
    ),
    true,
  );

  console.log('V5 B13C1 Sync Center product UI browser gate passed.');
} finally {
  await browser.close();
}

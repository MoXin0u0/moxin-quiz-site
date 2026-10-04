import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = path.resolve('artifacts/v41-landing-browser');
const SCREEN_DIR = path.join(OUT_DIR, 'screenshots');

fs.mkdirSync(SCREEN_DIR, { recursive: true });

const viewports = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
];

const failures = [];
const screenshots = [];

function fail(scope, message) {
  failures.push({ scope, message });
}

async function auditViewport(browser, viewport, theme) {
  const scope = `${viewport.name}-${theme}`;
  const context = await browser.newContext({ viewport, colorScheme: theme });
  const page = await context.newPage();

  page.on('pageerror', error => fail(scope, `pageerror: ${error.message}`));
  page.on('console', message => {
    if (
      message.type() === 'error' &&
      !/Service Worker registration (failed|blocked by Playwright)/i.test(message.text())
    ) {
      fail(scope, `console: ${message.text()}`);
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  const title = await page.title();
  if (title !== '墨忻刷題網｜首頁') fail(scope, `unexpected title: ${title}`);

  const primary = page.locator('.landing-hero-actions .landing-button.primary');
  await primary.waitFor({ state: 'visible' });

  const box = await primary.boundingBox();
  if (!box || box.height < 44 || box.width < 44) {
    fail(scope, `primary CTA below 44px touch target`);
  }

  const href = await primary.getAttribute('href');
  if (href !== './app.html') fail(scope, `primary CTA href is ${href}`);

  const overflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
    document.documentElement.clientWidth
  );
  if (overflow > 1) fail(scope, `horizontal overflow: ${overflow}px`);

  const axe = await new AxeBuilder({ page }).analyze();
  for (const violation of axe.violations) {
    if (['critical', 'serious'].includes(violation.impact)) {
      fail(scope, `a11y ${violation.id}: ${violation.help}`);
    }
  }

  const file = path.join(SCREEN_DIR, `${scope}.png`);
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push(file);

  if (viewport.name === 'mobile' && theme === 'light') {
    await primary.click();
    await page.waitForURL(/app\.html/, { timeout: 10000 });
    await page.waitForSelector('#storageStatus', { timeout: 15000 });
    await page.waitForFunction(() => {
      const text = document.querySelector('#storageStatus')?.textContent || '';
      return text.includes('IndexedDB 已就緒');
    }, null, { timeout: 15000 });

    assert.equal(await page.locator('[data-nav-library]').count() > 0, true);
  }

  await context.close();
}

const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    for (const theme of ['light', 'dark']) {
      await auditViewport(browser, viewport, theme);
    }
  }
} finally {
  await browser.close();
}

const summary = {
  generatedAt: new Date().toISOString(),
  viewportCount: viewports.length,
  themeCount: 2,
  screenshotCount: screenshots.length,
  failures,
};

fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

if (failures.length) {
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log(`v4.1 landing browser audit passed: ${screenshots.length} screenshots, 0 failures.`);

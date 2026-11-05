import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const url = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: viewport.width === 390 ? 'dark' : 'light',
      serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() =>
        (document.querySelector('#storageStatus')?.textContent || '')
          .includes('IndexedDB 已就緒'),
      null, { timeout: 20000 });

      const layout = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
        const source = rect('#libraryView .library-priority-head');
        const author = rect('#authorLibraryPanel');
        const hero = rect('#libraryView .learning-hero-library');
        const dashboard = rect('#homeDashboardArea');
        const tab = rect('[data-library-source-tab="author"]');
        return {
          source: source?.top,
          author: author?.top,
          hero: hero?.top,
          dashboard: dashboard?.top,
          tabHeight: tab?.height,
          tabTop: tab?.top,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      assert.ok(layout.source < layout.author, viewport.name + ': source selection must precede bank cards');
      assert.ok(layout.author < layout.hero, viewport.name + ': cards must precede scene hero');
      assert.ok(layout.hero < layout.dashboard, viewport.name + ': dashboard follows study guidance');
      assert.ok(layout.source < viewport.height, viewport.name + ': source selector must be reachable in initial viewport');
      assert.ok(layout.tabHeight >= 44, viewport.name + ': source tab touch target is too small');
      assert.ok(layout.overflow <= 1, viewport.name + ': unexpected horizontal overflow ' + layout.overflow);

      const authorTab = page.locator('[data-library-source-tab="author"]');
      const userTab = page.locator('[data-library-source-tab="user"]');
      const authorPanel = page.locator('#authorLibraryPanel');
      const userPanel = page.locator('#userLibraryPanel');

      assert.equal(await authorTab.getAttribute('aria-controls'), 'authorLibraryPanel');
      assert.equal(await userTab.getAttribute('aria-controls'), 'userLibraryPanel');
      assert.equal(await authorTab.getAttribute('aria-selected'), 'true');
      assert.equal(await authorPanel.isVisible(), true);
      assert.equal(await userPanel.isVisible(), false);

      await userTab.click();
      assert.equal(await userTab.getAttribute('aria-selected'), 'true');
      assert.equal(await authorTab.getAttribute('aria-selected'), 'false');
      assert.equal(await authorPanel.isVisible(), false);
      assert.equal(await userPanel.isVisible(), true);
      assert.equal(await page.locator('#bankFileInput').count(), 1);

      await authorTab.click();
      assert.equal(await authorTab.getAttribute('aria-selected'), 'true');
      assert.equal(await authorPanel.isVisible(), true);
      assert.equal(await userPanel.isVisible(), false);

      const href = await page.locator('#libraryView .learning-hero-primary-cta').getAttribute('href');
      assert.equal(href, '#homeDashboardArea');

      const result = await new AxeBuilder({ page }).include('#libraryView').analyze();
      const severe = result.violations.filter(v => ['critical', 'serious'].includes(v.impact));
      assert.deepEqual(severe.map(v => v.id), [], viewport.name + ': serious accessibility issues in library');

      console.log('B03 library viewport PASS:', viewport.name, JSON.stringify(layout));
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

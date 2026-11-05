import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: 'small-mobile', width: 320, height: 568, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'tablet', width: 768, height: 1024, theme: 'light' },
  { name: 'desktop', width: 1366, height: 768, theme: 'dark' },
];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: viewport.theme,
      serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() =>
        (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'),
      null, { timeout: 20000 });

      // Each CI context contains only synthetic, temporary IndexedDB records.
      await page.evaluate(() => document.querySelector('[data-nav-tools]')?.click());
      await page.locator('#studioWorkspaceMount .studio-r1-home').waitFor();
      await page.locator('#studioWorkspaceMount [data-studio-new]').click();
      await page.locator('#studioWorkspaceMount .studio-r1-editor-shell').waitFor();

      const mount = page.locator('#studioWorkspaceMount');
      assert.match(await mount.locator('.studio-r1-workflow-note').innerText(), /本機草稿/);
      assert.match(await mount.locator('.studio-r1-workflow-note').innerText(), /不會自動上傳或公開/);
      assert.match(await mount.locator('.studio-r1-export-bar').innerText(), /新草稿/);
      assert.equal(await mount.locator('[data-studio-export-json]').isDisabled(), true);
      assert.equal(await mount.locator('[data-studio-export-zip]').isDisabled(), true);
      assert.equal(await mount.locator('[data-studio-save-library]').isDisabled(), true);

      const mobile = viewport.width <= 820;
      const nav = mount.locator('.studio-r1-mobile-nav');
      assert.equal(await nav.isVisible(), mobile, viewport.name + ': mobile shortcuts should only show on narrow layouts');

      if (mobile) {
        for (const step of ['questions', 'edit', 'inspect', 'export']) {
          const action = mount.locator('[data-studio-jump="' + step + '"]');
          assert.equal(await action.isVisible(), true);
          assert.ok((await action.boundingBox())?.height >= 44, viewport.name + ': ' + step + ' touch target');
        }

        await mount.locator('[data-studio-add-question]').click();
        await page.waitForFunction(() =>
          document.querySelectorAll('#studioWorkspaceMount [data-studio-select-question]').length === 2,
        );
        await mount.locator('[data-studio-select-question]').first().click();
        assert.equal(await mount.locator('[data-studio-select-question][aria-current="true"]').count(), 1);
        const editPosition = await mount.locator('.studio-r1-canvas').boundingBox();
        assert.ok(editPosition && editPosition.y < viewport.height,
          viewport.name + ': changing the question should bring editor into view');

        await mount.locator('[data-studio-jump="inspect"]').click();
        const inspectPosition = await mount.locator('.studio-r1-inspector').boundingBox();
        assert.ok(inspectPosition && inspectPosition.y < viewport.height,
          viewport.name + ': inspector shortcut must reveal its panel');

        await mount.locator('[data-studio-jump="export"]').click();
        const exportPosition = await mount.locator('.studio-r1-export-bar').boundingBox();
        assert.ok(exportPosition && exportPosition.y < viewport.height,
          viewport.name + ': export shortcut must reveal download actions');

        const navAudit = await new AxeBuilder({ page }).include('.studio-r1-mobile-nav').analyze();
        const noteAudit = await new AxeBuilder({ page }).include('.studio-r1-workflow-note').analyze();
        const severe = [...navAudit.violations, ...noteAudit.violations]
          .filter(item => ['critical', 'serious'].includes(item.impact))
          .map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }));
        assert.deepEqual(severe, [], viewport.name + ': mobile navigation / save guidance accessibility');
      }

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, viewport.name + ': horizontal overflow ' + overflow);

      console.log('B03-03 mobile studio PASS:', viewport.name);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

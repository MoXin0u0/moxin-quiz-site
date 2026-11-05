import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const browser = await chromium.launch({ headless: true });
const profiles = [
  { name: 'small-light', width: 320, height: 568, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 780, theme: 'dark' },
  { name: 'desktop-dark', width: 1366, height: 768, theme: 'dark' },
];
try {
  for (const profile of profiles) {
    const ctx = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, serviceWorkers: 'block' });
    try {
      const page = await ctx.newPage();
      await page.addInitScript(theme => {
        const data = JSON.parse(localStorage.getItem('moxin.v3.settings') || '{}');
        localStorage.setItem('moxin.v3.settings', JSON.stringify({ ...data, theme, reduceMotion: true }));
      }, profile.theme);
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'));
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), profile.theme);
      const transition = await page.locator('.learning-hero-art').first().evaluate(el => getComputedStyle(el).transitionDuration);
      assert.match(transition, /^0s(?:, 0s)*$/, profile.name + ': reduce-motion should stop scene fades');
      await page.evaluate(async () => {
        const { showPromptDialog } = await import(new URL('./src/ui/dialogs.js', document.baseURI).href);
        window.__b04DialogResult = '__pending__';
        void showPromptDialog({ title: '修改題庫名稱', label: '名稱', value: '舊名稱' })
          .then(value => { window.__b04DialogResult = value; });
      });
      const field = page.locator('.app-dialog-field input');
      await field.waitFor();
      assert.equal(await field.evaluate(el => el === document.activeElement), true);
      // IME composition must not accidentally confirm a Chinese name.
      await field.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })));
      assert.equal(await page.locator('.app-dialog').count(), 1);
      await field.fill('新增題庫');
      await field.press('Enter');
      await page.waitForFunction(() => window.__b04DialogResult === '新增題庫');
      assert.equal(await page.locator('.app-dialog').count(), 0);
      await page.evaluate(async () => {
        const { showTextAreaDialog } = await import(new URL('./src/ui/dialogs.js', document.baseURI).href);
        window.__b04DialogResult = '__pending__';
        void showTextAreaDialog({ title: '編輯筆記', label: '筆記', value: '初始內容' })
          .then(value => { window.__b04DialogResult = value; });
      });
      const textarea = page.locator('.app-dialog-field textarea');
      await textarea.waitFor();
      await textarea.fill('第一行');
      await textarea.press('Enter');
      assert.equal(await page.locator('.app-dialog').count(), 1, 'ordinary Enter must insert a line break in multiline');
      await textarea.type('第二行');
      if (profile.width <= 390) {
        await page.setViewportSize({ width: profile.width, height: 385 });
        await page.waitForFunction(() => {
          const overlay = document.querySelector('.app-dialog-overlay');
          return overlay && Math.abs(parseFloat(overlay.style.height) - window.visualViewport.height) < 3;
        });
        const geometry = await page.locator('.app-dialog').boundingBox();
        assert.ok(geometry && geometry.y >= -3 && geometry.y + geometry.height <= 388,
          profile.name + ': dialog must remain in small visible viewport');
      }
      await textarea.press('Control+Enter');
      await page.waitForFunction(() => window.__b04DialogResult.includes('第二行'));
      assert.equal(await page.locator('.app-dialog').count(), 0);
      console.log('B04-01 dialog and reduced motion PASS', profile.name);
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

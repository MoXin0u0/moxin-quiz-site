import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const browser = await chromium.launch({ headless: true });
const profiles = [
  { name: 'portrait-320', width: 320, height: 568, theme: 'light' },
  { name: 'landscape-short', width: 667, height: 375, theme: 'dark' },
  { name: 'dark-390', width: 390, height: 780, theme: 'dark' },
];

function insideViewport(bounds, label) {
  assert.ok(bounds.top >= -3 && bounds.bottom <= bounds.height + 3,
    `${label}: modal ${bounds.top}..${bounds.bottom} outside ${bounds.height}`);
}
async function bounds(locator) {
  return locator.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: window.visualViewport.height };
  });
}

try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(theme => {
        const current = JSON.parse(localStorage.getItem('moxin.v3.settings') || '{}');
        localStorage.setItem('moxin.v3.settings',
          JSON.stringify({ ...current, theme, reduceMotion: true }));
      }, profile.theme);
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() =>
        (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'));

      // A replacement Message dialog must cancel the previous Prompt as null.
      await page.evaluate(async () => {
        const { showPromptDialog, showMessageDialog } =
          await import(new URL('./src/ui/dialogs.js', document.baseURI).href);
        window.__b0403Old = '__pending__';
        window.__b0403New = '__pending__';
        void showPromptDialog({ title: '舊名稱' }).then(v => { window.__b0403Old = v; });
        void showMessageDialog({ title: '已切換' }).then(v => { window.__b0403New = v; });
      });
      await page.waitForFunction(() => window.__b0403Old === null);
      await page.locator('.app-dialog-actions button').last().click();
      await page.waitForFunction(() => window.__b0403New === true);

      const note = '中文筆記第一行\n' + '長文字內容及空白。'.repeat(80);
      await page.evaluate(async value => {
        const { showTextAreaDialog } = await import(new URL('./src/ui/dialogs.js', document.baseURI).href);
        window.__b0403Note = '__pending__';
        void showTextAreaDialog({ title: '長文字筆記', value, rows: 18 })
          .then(v => { window.__b0403Note = v; });
      }, note);
      const textarea = page.locator('.app-dialog-field textarea');
      await textarea.waitFor();
      assert.equal(await textarea.inputValue(), note);
      const compact = Math.min(345, profile.height);
      await page.setViewportSize({ width: profile.width, height: compact });
      await page.waitForFunction(() => {
        const layer = document.querySelector('.app-dialog-overlay');
        return layer && Math.abs(parseFloat(layer.style.height) - window.visualViewport.height) < 3;
      });
      insideViewport(await bounds(page.locator('.app-dialog')), profile.name + ': textarea');
      assert.equal(await page.locator('.app-dialog-overlay').getAttribute('data-compact-height'), 'true');
      await page.locator('.app-dialog-actions button').last().click();
      await page.waitForFunction(() => window.__b0403Note !== '__pending__');
      assert.equal(await page.evaluate(() => window.__b0403Note), note);

      // Real Studio batch-import modal with isolated synthetic data.
      await page.evaluate(() => document.querySelector('[data-nav-tools]')?.click());
      await page.locator('#studioWorkspaceMount .studio-r1-home').waitFor();
      await page.locator('#studioWorkspaceMount [data-studio-new-batch]').click();
      const batch = page.locator('dialog.studio-r1-batch-dialog');
      await batch.waitFor();
      await page.waitForFunction(() => {
        const dlg = document.querySelector('dialog.studio-r1-batch-dialog');
        return dlg && Math.abs(parseFloat(dlg.style.maxHeight) - (window.visualViewport.height - 16)) < 4;
      });
      insideViewport(await bounds(batch), profile.name + ': batch import');
      await batch.locator('[data-studio-batch-source]').fill(
        '1. 範例題目？\nA. 正確\nB. 錯誤\n答案：A');
      assert.match(await batch.locator('[data-studio-batch-source]').inputValue(), /正確/);
      await batch.locator('[data-studio-batch-close]').last().click();
      assert.equal(await batch.count(), 0, profile.name + ': batch cancel');

      // Real Studio type-change confirmation: a choice question has options,
      // so switching to fill-in must ask before destructive conversion.
      const workspace = page.locator('#studioWorkspaceMount');
      await workspace.locator('[data-question-type-choice="fill-in"]').click();
      const native = page.locator('dialog.studio-r1-dialog');
      await native.waitFor();
      await page.waitForFunction(() => {
        const dlg = document.querySelector('dialog.studio-r1-dialog');
        return dlg && Math.abs(parseFloat(dlg.style.maxHeight) - (window.visualViewport.height - 16)) < 4;
      });
      insideViewport(await bounds(native), profile.name + ': type switch');
      assert.match(await native.innerText(), /切換題型/);
      await native.locator('[data-studio-dialog-cancel]').click();
      assert.equal(await native.count(), 0, profile.name + ': cancelled type change');
      assert.equal(await workspace.locator('[data-question-type-choice="single-choice"]').getAttribute('class')
        .then(v => v.includes('is-active')), true, 'cancel must preserve original type');

      await workspace.locator('[data-question-type-choice="fill-in"]').click();
      await native.waitFor();
      await native.locator('[data-studio-dialog-confirm]').click();
      await page.waitForFunction(() => {
        const target = document.querySelector('#studioWorkspaceMount [data-question-type-choice="fill-in"]');
        return target?.classList.contains('is-active') === true;
      });
      assert.equal(await native.count(), 0, profile.name + ': confirmed type change');

      console.log('B04-03 dialog lifecycle and compact viewport PASS', profile.name);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

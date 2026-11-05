import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Browser keyboard + viewport resize are SIMULATIONS, not a physical iOS/Android
// virtual-keyboard test. Keep synthetic data in isolated browser contexts.
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const browser = await chromium.launch({ headless: true });
const cases = [
  { name: 'long-bank-320', width: 320, height: 568, questions: 30, media: false },
  { name: 'media-keyboard-390', width: 390, height: 844, questions: 3, media: true },
];
const svgImage = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">' +
  '<rect width="12" height="12" fill="#205bc4"/></svg>',
  'utf8',
);

function assertSelectedQuestionInRail(viewport, geometry) {
  assert.ok(geometry && geometry.scrollWidth > geometry.clientWidth,
    viewport + ': expected horizontally scrolling question rail');
  assert.ok(geometry.activeLeft >= geometry.railLeft - 2,
    viewport + ': selected item is clipped off the left of the rail');
  assert.ok(geometry.activeRight <= geometry.railRight + 2,
    viewport + ': selected item is clipped off the right of the rail');
}

async function getActiveRailGeometry(page) {
  return page.locator('.studio-r1-question-list').evaluate(rail => {
    const current = rail.querySelector('[aria-current="true"]');
    if (!current) return null;
    const bounds = rail.getBoundingClientRect();
    const active = current.getBoundingClientRect();
    return {
      scrollWidth: rail.scrollWidth,
      clientWidth: rail.clientWidth,
      scrollLeft: rail.scrollLeft,
      railLeft: bounds.left,
      railRight: bounds.right,
      activeLeft: active.left,
      activeRight: active.right,
    };
  });
}

try {
  for (const testCase of cases) {
    const context = await browser.newContext({
      viewport: { width: testCase.width, height: testCase.height },
      colorScheme: testCase.media ? 'dark' : 'light',
      serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() =>
        (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'),
      null, { timeout: 20000 });
      // Mobile sidebar nav is intentionally hidden; use the existing delegated route action.
      await page.evaluate(() => document.querySelector('[data-nav-tools]')?.click());
      await page.locator('#studioWorkspaceMount .studio-r1-home').waitFor();
      await page.locator('#studioWorkspaceMount [data-studio-new]').click();
      const mount = page.locator('#studioWorkspaceMount');
      await mount.locator('.studio-r1-editor-shell').waitFor();

      for (let count = 1; count < testCase.questions; count += 1) {
        await mount.locator('[data-studio-add-question]').click();
        await page.waitForFunction(expected =>
          document.querySelectorAll('#studioWorkspaceMount [data-studio-select-question]').length === expected,
        count + 1, { timeout: 20000 });
      }
      assert.equal(await mount.locator('[data-studio-select-question]').count(), testCase.questions);
      assert.equal(await mount.locator('[aria-current="true"][data-studio-select-question]').count(), 1);

      if (testCase.questions > 6) {
        assertSelectedQuestionInRail(testCase.name, await getActiveRailGeometry(page));
        await mount.locator('[data-studio-select-question]').first().click();
        assertSelectedQuestionInRail(testCase.name, await getActiveRailGeometry(page));
      }

      const selectedLast = mount.locator('[data-studio-select-question]').last();
      const lastId = await selectedLast.getAttribute('data-studio-select-question');
      await selectedLast.click();
      assertSelectedQuestionInRail(testCase.name, await getActiveRailGeometry(page));

      const textarea = mount.locator('[data-question-field="question"]');
      const expectedText = 'Synthetic ' + testCase.name + ' / ' + lastId;
      await textarea.fill(expectedText);
      // Switching while autosave is queued must not discard in-memory text.
      await mount.locator('[data-studio-select-question]').first().click();
      await mount.locator('[data-studio-select-question="' + lastId + '"]').click();
      assert.equal(await mount.locator('[data-question-field="question"]').inputValue(), expectedText);
      assertSelectedQuestionInRail(testCase.name, await getActiveRailGeometry(page));

      if (testCase.media) {
        // SVG is a harmless, original test image. No external assets or user data.
        await mount.locator('[data-studio-image-input="images"]').setInputFiles({
          name: 'sample-question.svg',
          mimeType: 'image/svg+xml',
          buffer: svgImage,
        });
        await mount.locator('.studio-r1-media-card').first().waitFor({ timeout: 10000 });
        await page.waitForFunction(() => {
          const image = document.querySelector('#studioWorkspaceMount .studio-r1-media-card img');
          return image?.complete && image.naturalWidth === 12;
        }, null, { timeout: 10000 });

        await mount.locator('[data-studio-select-question]').first().click();
        await mount.locator('[data-studio-select-question="' + lastId + '"]').click();
        assert.equal(await mount.locator('.studio-r1-media-card img').count(), 1,
          'Image reference should survive question switching');

        // Emulate a reduced visual area while entering text. Headless Chromium
        // does not open a native mobile software keyboard.
        await page.setViewportSize({ width: testCase.width, height: 430 });
        const edit = mount.locator('[data-question-field="question"]');
        await edit.click();
        await page.keyboard.type(' / keyboard input');
        assert.match(await edit.inputValue(), /keyboard input$/);
        const geometry = await edit.boundingBox();
        assert.ok(geometry && geometry.y < 430 && geometry.y + geometry.height > 0,
          'Focused input should remain at least partly reachable at reduced viewport height');
        await page.setViewportSize({ width: testCase.width, height: testCase.height });

        await mount.locator('[data-studio-back]').click();
        await mount.locator('.studio-r1-home').waitFor();
        await mount.locator('[data-studio-open-draft]').first().click();
        await mount.locator('.studio-r1-editor-shell').waitFor();
        await mount.locator('[data-studio-select-question="' + lastId + '"]').click();
        assert.equal(await mount.locator('.studio-r1-media-card img').count(), 1,
          'Image attachment should survive draft save and reopening');
        assert.match(await mount.locator('[data-question-field="question"]').inputValue(),
          /keyboard input$/, 'Text must persist across draft reopen');
      }

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, testCase.name + ': unexpected horizontal page overflow ' + overflow);
      console.log('B03-03 studio stress PASS:', testCase.name);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

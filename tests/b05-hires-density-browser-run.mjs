import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const cases = [
  { name: 'desktop-1366-dpr2', width: 1366, height: 768, dpr: 2,
    expected: 'desktop', urlPart: 'library-light.webp' },
  { name: 'desktop-1920-dpr2', width: 1920, height: 1080, dpr: 2,
    expected: 'desktop-2x', urlPart: 'probe-desktop-hd' },
  { name: 'desktop-2560-dpr2', width: 2560, height: 1440, dpr: 2,
    expected: 'desktop-2x', urlPart: 'probe-desktop-hd' },
  { name: 'phone-390-dpr3', width: 390, height: 844, dpr: 3,
    expected: 'mobile', urlPart: 'library-light-mobile.webp' },
  { name: 'phone-430-dpr3', width: 430, height: 932, dpr: 3,
    expected: 'mobile-2x', urlPart: 'probe-mobile-hd' },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const entry of cases) {
    const context = await browser.newContext({
      viewport: { width: entry.width, height: entry.height },
      deviceScaleFactor: entry.dpr, serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        const config = JSON.parse(localStorage.getItem('moxin.v3.settings') || '{}');
        localStorage.setItem('moxin.v3.settings', JSON.stringify({
          ...config, learningStyle: 'academy', theme: 'light',
          sceneIntensity: 'full', reduceMotion: true,
        }));
      });
      // Synthetic 2x candidates load EXISTING 1x image bytes with query tags.
      // They test selection only; this does NOT claim new 4K source exists.
      await page.route('**/src/ui/scene-assets.js', async route => {
        const response = await route.fetch();
        const code = await response.text();
        const anchor = "desktop: './assets/learning/styles/academy/library-light.webp',";
        assert.ok(code.includes(anchor));
        const modified = code.replace(anchor,
          "desktop2x: './assets/learning/styles/academy/library-light.webp?probe-desktop-hd',\n" +
          "        mobile2x: './assets/learning/styles/academy/library-light-mobile.webp?probe-mobile-hd',\n" +
          '        ' + anchor);
        await route.fulfill({ response, body: modified });
      });
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() =>
        (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'));

      const art = page.locator('#libraryView [data-scene-art="library"]');
      const waitVariant = async (variant, fragment) => {
        await page.waitForFunction(({ variant, fragment }) => {
          const node = document.querySelector('#libraryView [data-scene-art="library"]');
          return node?.dataset.sceneState === 'ready' &&
            node?.dataset.sceneVariant === variant &&
            node?.dataset.sceneSrc?.includes(fragment);
        }, { variant, fragment }, { timeout: 20000 });
      };
      await waitVariant(entry.expected, entry.urlPart);
      const actual = await art.evaluate(node => ({
        src: node.dataset.sceneSrc,
        variant: node.dataset.sceneVariant,
      }));
      assert.equal(actual.variant, entry.expected, entry.name);
      console.log('B05-03B PIXEL-AWARE ART PASS', entry.name, actual.variant);

      if (entry.expected.includes('2x')) {
        await page.evaluate(() => {
          document.documentElement.dataset.sceneIntensity = 'reduced';
        });
        await waitVariant(entry.width <= 760 ? 'mobile' : 'desktop',
          entry.width <= 760 ? 'library-light-mobile.webp' : 'library-light.webp');
        assert.equal((await art.getAttribute('data-scene-variant')).includes('2x'), false,
          entry.name + ': Reduced should restore 1x art');
        await page.evaluate(() => {
          document.documentElement.dataset.sceneIntensity = 'full';
        });
        await waitVariant(entry.expected, entry.urlPart);
      }

      // Resizes within desktop breakpoint must re-evaluate source density.
      if (entry.name === 'desktop-1920-dpr2') {
        await page.setViewportSize({ width: 1366, height: 768 });
        await waitVariant('desktop', 'library-light.webp');
        await page.setViewportSize({ width: 1920, height: 1080 });
        await waitVariant('desktop-2x', 'probe-desktop-hd');
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log('B05-03B PASS: runtime art loads follow measured source density, intensity and same-breakpoint resize.');

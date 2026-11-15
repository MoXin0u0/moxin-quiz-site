import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Browser viewport/DPR simulation verifies layout, not physical screen pixels.
const URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: 'phone-320-2x', width: 320, height: 568, mobile: true, expectedOpacity: .82 },
  { name: 'phone-390-2x', width: 390, height: 844, mobile: true, expectedOpacity: .82 },
  { name: 'phone-430-2x', width: 430, height: 932, mobile: true, expectedOpacity: .86 },
  { name: 'tablet-768-2x', width: 768, height: 1024, mobile: false, expectedOpacity: 1 },
  { name: 'desktop-1366-2x', width: 1366, height: 768, mobile: false, expectedOpacity: 1 },
];
const styles = ['academy', 'epic'];
const themes = ['light', 'dark'];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        const existing = JSON.parse(localStorage.getItem('moxin.v3.settings') || '{}');
        localStorage.setItem('moxin.v3.settings', JSON.stringify({
          ...existing, learningStyle: 'academy', theme: 'light',
          sceneIntensity: 'full', reduceMotion: true,
        }));
      });
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() =>
        (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'));
      const preload = page.locator('link[rel="preload"][as="image"]');
      assert.equal(await preload.count(), 1, viewport.name + ': one responsive scene preload');
      const preloadHref = await preload.getAttribute('href');
      assert.equal(preloadHref.includes('-mobile.webp'), viewport.mobile,
        viewport.name + ': preload should match runtime mobile/desktop source');
      const art = page.locator('#libraryView [data-scene-art="library"]');
      assert.equal(await art.count(), 1, viewport.name + ': library art exists');

      for (const style of styles) {
        for (const theme of themes) {
          await page.evaluate(({ style, theme }) => {
            const root = document.documentElement;
            root.dataset.learningStyle = style;
            root.dataset.theme = theme;
            root.dataset.sceneIntensity = 'full';
          }, { style, theme });

          await page.waitForFunction(({ style, theme }) => {
            const node = document.querySelector('#libraryView [data-scene-art="library"]');
            return node?.dataset.sceneState === 'ready' &&
              node.dataset.sceneSrc?.includes(`/styles/${style}/library-${theme}`);
          }, { style, theme }, { timeout: 20000 });

          const full = await art.evaluate(el => {
            const style = getComputedStyle(el);
            const parent = el.closest('.learning-hero-whole');
            return {
              opacity: Number(style.opacity),
              filter: style.filter,
              image: style.backgroundImage,
              variant: el.dataset.sceneVariant,
              src: el.dataset.sceneSrc,
              mask: getComputedStyle(parent, '::before').backgroundImage,
              dpr: devicePixelRatio,
              viewportWidth: innerWidth,
              cssMobile: matchMedia('(max-width: 760px)').matches,
              cssTiny: matchMedia('(max-width: 420px)').matches,
              rootIntensity: document.documentElement.dataset.sceneIntensity,
              stylesheetLoaded: [...document.styleSheets].some(s => s.href?.includes('v4-learning-styles.css')),
            };
          });
          const scope = `${viewport.name}/${style}/${theme}`;
          assert.equal(full.dpr, 2, scope + ': device pixel ratio');
          assert.ok(full.src.includes(`/styles/${style}/library-${theme}`));
          assert.equal(full.variant, viewport.mobile ? 'mobile' : 'desktop', scope + ': source variant');
          assert.equal(full.src.includes('-mobile.webp'), viewport.mobile, scope + ': actual mobile source');
          assert.ok(Math.abs(full.opacity - viewport.expectedOpacity) < .015,
            scope + ': Full opacity should be ' + viewport.expectedOpacity + ', diagnostics ' + JSON.stringify(full));
          assert.notEqual(full.image, 'none', scope + ': Full scene must render');
          if (viewport.mobile) {
            assert.equal(full.filter, 'none', scope + ': no softening filter');
            // CSSOM may serialize 180deg as the default downward direction.
            // The 24% stop is unique to the mobile Full text-safe scrim.
            assert.match(full.mask, /linear-gradient\(/, scope + ': text-safe gradient');
            assert.match(full.mask, /24%/, scope + ': mobile Full scrim wins theme-specific rules');
          }

          await page.evaluate(() => {
            document.documentElement.dataset.sceneIntensity = 'reduced';
          });
          const reduced = await art.evaluate(el => Number(getComputedStyle(el).opacity));
          assert.ok(reduced < .31 && full.opacity - reduced > .5,
            scope + ': Reduced must visibly differ from Full (' + reduced + ')');

          await page.evaluate(() => {
            document.documentElement.dataset.sceneIntensity = 'off';
          });
          await page.waitForFunction(() =>
            document.querySelector('#libraryView [data-scene-art="library"]')?.dataset.sceneState === 'off');
          assert.equal(await art.evaluate(el => getComputedStyle(el).backgroundImage), 'none',
            scope + ': Off must not paint art');
        }
      }

      await page.evaluate(() => {
        document.documentElement.dataset.learningStyle = 'focus';
        document.documentElement.dataset.sceneIntensity = 'full';
      });
      await page.waitForFunction(() =>
        document.querySelector('#libraryView [data-scene-art="library"]')?.dataset.sceneState === 'focus');
      assert.equal(await art.evaluate(el => getComputedStyle(el).backgroundImage), 'none',
        viewport.name + ': Focus skips artwork');
      console.log('B05-01 responsive Full/Reduced/Off/Focal PASS', viewport.name);
    } finally {
      await context.close();
    }
  }
  // Save-data mode must skip even HTML head preloads, not only the scene runtime.
  const saver = await browser.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  });
  try {
    const page = await saver.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true, value: { saveData: true },
      });
      const settings = JSON.parse(localStorage.getItem('moxin.v3.settings') || '{}');
      localStorage.setItem('moxin.v3.settings', JSON.stringify({
        ...settings, theme: 'light', learningStyle: 'academy', sceneIntensity: 'full',
      }));
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('link[rel="preload"][as="image"]').count(), 0,
      'saveData must skip scene preload');
    console.log('B05-01 save-data head preload PASS');
  } finally {
    await saver.close();
  }

  // B07: dynamic pages must still load their art without observing the entire body.
  const navigation = await browser.newContext({
    viewport: { width: 1366, height: 768 }, serviceWorkers: 'block',
    reducedMotion: 'reduce',
  });
  try {
    const page = await navigation.newPage();
    await page.addInitScript(() => {
      window.__b07SceneHosts = [];
      window.__b07ResizeUnobserves = 0;
      const BaseMutationObserver = window.MutationObserver;
      window.MutationObserver = class extends BaseMutationObserver {
        observe(target, options) {
          if (options.childList && ['reviewArea', 'examCenterArea', 'statsArea'].includes(target.id)) {
            window.__b07SceneHosts.push({ id: target.id, subtree: options.subtree === true });
          }
          return super.observe(target, options);
        }
      };
      const BaseResizeObserver = window.ResizeObserver;
      if (typeof BaseResizeObserver === 'function') {
        window.ResizeObserver = class extends BaseResizeObserver {
          unobserve(target) {
            if (target.hasAttribute('data-scene-art')) window.__b07ResizeUnobserves++;
            return super.unobserve(target);
          }
        };
      }
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'));
    const observerHosts = await page.evaluate(() => window.__b07SceneHosts);
    assert.deepEqual(observerHosts.map(row => row.id), ['reviewArea', 'examCenterArea', 'statsArea']);
    assert.ok(observerHosts.every(row => row.subtree === false), 'Do not watch deep learning-view mutations');

    const openAndAssert = async (nav, view, scene) => {
      await page.locator(nav).click();
      await page.waitForFunction(({ view, scene }) => {
        const root = document.querySelector(view);
        const node = root?.querySelector('[data-scene-art="' + scene + '"]');
        return root?.hidden === false && node?.dataset.sceneState === 'ready';
      }, { view, scene }, { timeout: 20000 });
    };
    await openAndAssert('[data-nav-review]', '#reviewView', 'review');
    await openAndAssert('[data-nav-exam]', '#examCenterView', 'exam');
    await openAndAssert('[data-nav-stats]', '#statsView', 'stats');
    await openAndAssert('[data-nav-review]', '#reviewView', 'review');

    assert.ok(await page.evaluate(() => window.__b07ResizeUnobserves) >= 1,
      'Re-rendered scene nodes should be removed from ResizeObserver');
    console.log('B07 SCOPED SCENE OBSERVER PASS: dynamic views and detached node cleanup');
  } finally {
    await navigation.close();
  }
} finally {
  await browser.close();
}

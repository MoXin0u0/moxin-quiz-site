import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const browser = await chromium.launch({ headless: true });
const profiles = [
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'tablet-900', width: 900, height: 768 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'wide-1920', width: 1920, height: 1080 },
];

try {
  for (const viewport of profiles) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        const settings = JSON.parse(localStorage.getItem('moxin.v3.settings') || '{}');
        localStorage.setItem('moxin.v3.settings', JSON.stringify({
          ...settings, theme: 'light', learningStyle: 'epic',
          sceneIntensity: 'full', reduceMotion: true,
        }));
      });
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() =>
        (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'));

      for (const theme of ['light', 'dark']) {
        for (const style of ['academy', 'epic']) {
          await page.evaluate(({ theme, style }) => {
            document.documentElement.dataset.theme = theme;
            document.documentElement.dataset.learningStyle = style;
            document.documentElement.dataset.sceneIntensity = 'full';
          }, { theme, style });
          await page.waitForFunction(({ theme, style }) =>
            document.querySelector('#libraryView [data-scene-art="library"]')
              ?.dataset.sceneSrc?.includes('/styles/' + style + '/library-' + theme) &&
            document.querySelector('#libraryView [data-scene-art="library"]')
              ?.dataset.sceneState === 'ready',
            { theme, style }, { timeout: 20000 });

          const m = await page.evaluate(() => {
            const hero = document.querySelector('#libraryView .learning-hero-whole');
            const h2 = hero.querySelector('.learning-hero-content h2');
            const para = hero.querySelector('.learning-hero-content > p');
            const primary = hero.querySelector('.learning-hero-primary-cta');
            const box = el => {
              const r = el.getBoundingClientRect();
              return { left: r.left, right: r.right, top: r.top,
                bottom: r.bottom, width: r.width, height: r.height };
            };
            return {
              hero: box(hero), heading: box(h2), para: box(para), cta: box(primary),
              headingMaxWidth: getComputedStyle(h2).maxWidth,
              docWidth: document.documentElement.scrollWidth,
              winWidth: innerWidth,
              color: getComputedStyle(h2).color,
            };
          });
          const scope = viewport.name + '/' + style + '/' + theme;
          assert.ok(m.heading.width > 10 && m.heading.height > 10, scope + ': nonempty title');
          assert.ok(m.heading.left >= m.hero.left - 2, scope + ': heading within left bound');
          assert.ok(m.heading.right <= m.hero.right + 2, scope + ': heading within right bound');
          assert.ok(m.heading.bottom <= m.cta.top + 2, scope + ': title must not overlap CTA');
          assert.ok(m.cta.bottom <= m.hero.bottom + 3, scope + ': CTA within hero');
          assert.ok(m.docWidth <= m.winWidth + 3, scope + ': no horizontal page overflow');
          if (style === 'epic' && viewport.width > 760) {
            const headlineEdge = (m.heading.right - m.hero.left) / m.hero.width;
            const paraEdge = (m.para.right - m.hero.left) / m.hero.width;
            assert.ok(headlineEdge < .65,
              scope + ': Epic title crosses image focal area: ' + JSON.stringify(m));
            assert.ok(paraEdge < .72,
              scope + ': Epic subtitle crosses image focal area: ' + JSON.stringify(m));
            assert.ok(m.heading.width <= 445,
              scope + ': desktop Epic copy cap ineffective: ' + JSON.stringify(m));
          }
          console.log('B05-03A HERO COPY PASS', scope);
        }
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// B05-02 is a diagnostic. Pixel density is measured from the ACTUAL hero
// element and decoded art, not guessed from the user's monitor resolution.
const URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const OUTPUT = path.resolve('artifacts/b05-scene-quality');
fs.mkdirSync(OUTPUT, { recursive: true });

const profiles = [
  { name: 'phone-390-dpr3', width: 390, height: 844, dpr: 3, capture: true, mobile: true },
  { name: 'desktop-1366-dpr2', width: 1366, height: 768, dpr: 2, capture: true, mobile: false },
  { name: 'desktop-1920-dpr2', width: 1920, height: 1080, dpr: 2, capture: false, mobile: false },
  { name: 'desktop-2560-dpr2', width: 2560, height: 1440, dpr: 2, capture: false, mobile: false },
];
const styles = ['academy', 'epic'];
const themes = ['light', 'dark'];
const warnings = [];
let shots = 0;
let scenes = 0;

function pixelDifference(first, second) {
  assert.equal(first.length, second.length);
  let total = 0;
  for (let i = 0; i < first.length; i += 4) {
    total += Math.abs(first[i] - second[i]);
    total += Math.abs(first[i + 1] - second[i + 1]);
    total += Math.abs(first[i + 2] - second[i + 2]);
  }
  return total / ((first.length / 4) * 3 * 255);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.dpr,
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        const old = JSON.parse(localStorage.getItem('moxin.v3.settings') || '{}');
        localStorage.setItem('moxin.v3.settings', JSON.stringify({
          ...old, theme: 'light', learningStyle: 'academy',
          sceneIntensity: 'full', reduceMotion: true,
        }));
      });
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() =>
        (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'));

      const images = new Map();
      for (const theme of themes) {
        for (const style of styles) {
          await page.evaluate(({ style, theme }) => {
            const root = document.documentElement;
            root.dataset.learningStyle = style;
            root.dataset.theme = theme;
            root.dataset.sceneIntensity = 'full';
          }, { style, theme });

          await page.waitForFunction(({ style, theme }) => {
            const el = document.querySelector('#libraryView [data-scene-art="library"]');
            return el?.dataset.sceneState === 'ready' &&
              el.dataset.sceneSrc?.includes('/styles/' + style + '/library-' + theme);
          }, { style, theme }, { timeout: 20000 });

          const metrics = await page.locator('#libraryView [data-scene-art="library"]')
            .evaluate(async el => {
              const img = new Image();
              img.src = el.dataset.sceneSrc;
              await img.decode();
              const box = el.getBoundingClientRect();
              const scaleForCover = Math.max(box.width / img.naturalWidth,
                box.height / img.naturalHeight);
              const pixelsPerDevicePixel = 1 / (scaleForCover * devicePixelRatio);
              const canvas = document.createElement('canvas');
              canvas.width = 48;
              canvas.height = 36;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(img, 0, 0, 48, 36);
              const sample = Array.from(ctx.getImageData(0, 0, 48, 36).data);
              return {
                source: el.dataset.sceneSrc,
                intrinsic: [img.naturalWidth, img.naturalHeight],
                canvas: [Math.round(box.width), Math.round(box.height)],
                density: pixelsPerDevicePixel,
                filter: getComputedStyle(el).filter,
                dpr: devicePixelRatio,
                sample,
              };
            });

          const scope = profile.name + '/' + style + '/' + theme;
          assert.ok(Number.isFinite(metrics.density) && metrics.density > 0,
            scope + ': source-to-device pixel density must be positive');
          assert.equal(metrics.dpr, profile.dpr);
          assert.equal(metrics.source.includes('-mobile.webp'), profile.mobile,
            scope + ': art direction must select correct mobile or desktop file');
          assert.equal(metrics.intrinsic[0], profile.mobile ? 1080 : 2560);
          assert.equal(metrics.intrinsic[1], 1440);
          if (profile.mobile) {
            assert.equal(metrics.filter, 'none', scope + ': Full mode must not soften mobile art');
          }

          images.set(style + '/' + theme, metrics);
          scenes += 1;
          if (metrics.density < 0.95) {
            warnings.push(scope + ': only ' + metrics.density.toFixed(2) +
              ' source pixels per physical display pixel');
          }
          console.log('B05-02 SOURCE COVERAGE', scope,
            metrics.canvas.join('x') + ' CSSpx', metrics.intrinsic.join('x') + ' source',
            'DPR=' + profile.dpr, 'coverage=' + metrics.density.toFixed(2));

          if (profile.capture) {
            const screenshotFile = path.join(OUTPUT,
              profile.name + '-' + style + '-' + theme + '.png');
            await page.locator('#libraryView .learning-hero-whole').screenshot({
              path: screenshotFile, animations: 'disabled',
            });
            shots += 1;
          }
        }
      }

      // This guards accidental asset duplication, not subjective visual meaning.
      for (const theme of themes) {
        const academy = images.get('academy/' + theme);
        const epic = images.get('epic/' + theme);
        const diff = pixelDifference(academy.sample, epic.sample);
        assert.notEqual(academy.source, epic.source);
        assert.ok(diff >= 0.05,
          profile.name + '/' + theme + ': Academy and Epic art have near-identical pixels: ' + diff);
        console.log('B05-02 PIXEL DIFFERENCE', profile.name, theme, diff.toFixed(3));
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

assert.equal(scenes, profiles.length * styles.length * themes.length);
assert.equal(shots, 8, 'Eight art-review screenshots should be available in CI artifacts');
console.log('B05-02 PASS:', scenes, 'browser samples and', shots, 'full-scene screenshots.');
console.log('B05-02 COVERAGE GAPS:', warnings.length,
  '(informational; there are no approved desktop2x/mobile2x art assets yet)');
for (const item of warnings) console.log('B05-02 HIGH-DPI REVIEW:', item);
console.log('B05-02 LIMIT: pixel difference and DPR coverage do not prove aesthetic quality; review screenshots.');

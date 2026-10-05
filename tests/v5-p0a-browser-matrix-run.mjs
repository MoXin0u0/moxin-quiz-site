import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';

const profiles = ['academy', 'epic', 'focus'].flatMap(learningStyle =>
  ['light', 'dark'].flatMap(theme =>
    ['full', 'reduced', 'off'].map(sceneIntensity => ({
      name: `${learningStyle}-${theme}-${sceneIntensity}`,
      learningStyle,
      theme,
      sceneIntensity,
    })),
  ),
);

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
];

function srgbChannel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * srgbChannel(r) +
    0.7152 * srgbChannel(g) +
    0.0722 * srgbChannel(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function parseRgb(value) {
  const match = String(value).match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/i);
  if (!match) throw new Error(`Could not parse RGB from: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function gradientColors(value) {
  return [...String(value).matchAll(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/gi)]
    .map(match => [Number(match[1]), Number(match[2]), Number(match[3])]);
}

async function waitReady(page) {
  await page.waitForSelector('#storageStatus', { timeout: 15000 });
  await page.waitForFunction(() => {
    const text = document.querySelector('#storageStatus')?.textContent || '';
    return text.includes('IndexedDB 已就緒');
  }, null, { timeout: 15000 });
}

async function applyProfile(page, profile) {
  await page.evaluate(profile => {
    localStorage.setItem('moxin.v3.settings', JSON.stringify({
      theme: profile.theme,
      fontScale: 'normal',
      optionSpacing: 'normal',
      reduceMotion: true,
      learningStyle: profile.learningStyle,
      sceneIntensity: profile.sceneIntensity,
      studioTypeSwitchConfirm: true,
    }));
  }, profile);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
}

async function mountFixture(page) {
  await page.locator('[data-nav-review]').first().click();
  await page.waitForSelector('#reviewView:not([hidden])', { timeout: 10000 });

  await page.evaluate(() => {
    document.querySelector('#v5-p0a-fixture')?.remove();
    const fixture = document.createElement('div');
    fixture.id = 'v5-p0a-fixture';
    fixture.innerHTML = `
      <button class="button primary" data-v5-primary tabindex="1">主要操作</button>
      <button class="unfamiliar-button is-active" data-v5-unfamiliar>不熟</button>
      <div class="exam-focus-time-block">
        <span class="exam-timer" data-v5-timer-neutral>10:00</span>
        <span class="exam-timer is-warning" data-v5-timer-warning>05:00</span>
        <span class="exam-timer is-danger" data-v5-timer-danger>00:45</span>
      </div>
      <div class="exam-focus-navigator">
        <button class="exam-number is-current" data-v5-current>12</button>
      </div>
    `;
    fixture.style.position = 'fixed';
    fixture.style.left = '12px';
    fixture.style.top = '12px';
    fixture.style.zIndex = '99999';
    fixture.style.display = 'grid';
    fixture.style.gap = '8px';
    fixture.style.padding = '8px';
    document.querySelector('#reviewView').append(fixture);
  });
}

async function readVisualState(page) {
  return page.evaluate(() => {
    const state = selector => {
      const el = document.querySelector(selector);
      const style = getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        borderColor: style.borderColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
      };
    };

    return {
      dataset: {
        theme: document.documentElement.dataset.theme,
        learningStyle: document.documentElement.dataset.learningStyle,
        sceneIntensity: document.documentElement.dataset.sceneIntensity,
      },
      primary: state('[data-v5-primary]'),
      unfamiliar: state('[data-v5-unfamiliar]'),
      timerNeutral: state('[data-v5-timer-neutral]'),
      timerWarning: state('[data-v5-timer-warning]'),
      timerDanger: state('[data-v5-timer-danger]'),
      current: state('[data-v5-current]'),
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    };
  });
}

function assertSolidContrast(scope, state, min = 4.5) {
  const ratio = contrast(parseRgb(state.color), parseRgb(state.backgroundColor));
  assert.ok(ratio >= min, `${scope}: contrast ${ratio.toFixed(2)} < ${min}; ${state.color} on ${state.backgroundColor}`);
}

function assertGradientContrast(scope, state, min = 4.5) {
  const foreground = parseRgb(state.color);
  const stops = gradientColors(state.backgroundImage);
  assert.ok(stops.length >= 2, `${scope}: expected computed gradient, got ${state.backgroundImage}`);
  for (const stop of stops) {
    const ratio = contrast(foreground, stop);
    assert.ok(ratio >= min, `${scope}: gradient-stop contrast ${ratio.toFixed(2)} < ${min}; fg=${state.color}; bg=${stop.join(',')}`);
  }
}

const browser = await chromium.launch({ headless: true });

try {
  let cases = 0;

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: 'block',
    });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);

    for (const profile of profiles) {
      await applyProfile(page, profile);
      await mountFixture(page);

      const state = await readVisualState(page);
      const scope = `${viewport.name}/${profile.name}`;

      assert.deepEqual(state.dataset, {
        theme: profile.theme,
        learningStyle: profile.learningStyle,
        sceneIntensity: profile.sceneIntensity,
      }, `${scope}: saved visual profile was not applied`);

      assert.ok(state.overflow <= 4, `${scope}: page overflowed horizontally by ${state.overflow}px`);

      assertGradientContrast(`${scope} primary action`, state.primary);
      assertSolidContrast(`${scope} current exam number`, state.current);
      assertSolidContrast(`${scope} unfamiliar active`, state.unfamiliar);

      assert.notDeepEqual(
        [state.timerWarning.color, state.timerWarning.backgroundColor, state.timerWarning.borderColor],
        [state.timerNeutral.color, state.timerNeutral.backgroundColor, state.timerNeutral.borderColor],
        `${scope}: warning timer is visually identical to neutral timer`,
      );
      assert.notDeepEqual(
        [state.timerDanger.color, state.timerDanger.backgroundColor, state.timerDanger.borderColor],
        [state.timerWarning.color, state.timerWarning.backgroundColor, state.timerWarning.borderColor],
        `${scope}: danger timer is visually identical to warning timer`,
      );

      assertSolidContrast(`${scope} warning timer`, state.timerWarning);
      assertSolidContrast(`${scope} danger timer`, state.timerDanger);

      await page.evaluate(() => document.activeElement?.blur());
      let reachedPrimary = false;
      for (let tabIndex = 0; tabIndex < 48; tabIndex += 1) {
        await page.keyboard.press('Tab');
        reachedPrimary = await page.evaluate(() =>
          document.activeElement?.matches?.('[data-v5-primary]') === true
        );
        if (reachedPrimary) break;
      }
      assert.equal(reachedPrimary, true, `${scope}: keyboard navigation could not reach the primary fixture`);

      const focused = await page.locator('[data-v5-primary]').evaluate(el => {
        const style = getComputedStyle(el);
        return {
          focusVisible: el.matches(':focus-visible'),
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
        };
      });
      assert.equal(focused.focusVisible, true, `${scope}: keyboard-focused primary button does not match :focus-visible`);
      assert.notEqual(focused.outlineStyle, 'none', `${scope}: keyboard focus has no visible outline`);
      assert.ok(parseFloat(focused.outlineWidth) >= 2, `${scope}: focus outline is thinner than 2px`);

      cases += 1;
    }

    await context.close();
  }

  assert.equal(cases, 54);
  console.log(`V5 P0A browser matrix passed: ${cases} theme/style/intensity × viewport cases.`);
} finally {
  await browser.close();
}

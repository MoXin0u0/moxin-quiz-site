import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const profiles = ['academy', 'epic', 'focus'].flatMap(style =>
  ['light', 'dark'].map(theme => ({ style, theme })));
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1366, height: 768 },
];

function rgba(value) {
  const str = String(value).trim();
  const rgb = str.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i);
  if (rgb) {
    return { channels: rgb.slice(1, 4).map(Number), alpha: rgb[4] === undefined ? 1 : Number(rgb[4]) };
  }
  const srgb = str.match(/^color\(srgb\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)(?:\s*\/\s*([\d.e+-]+))?\s*\)$/i);
  if (srgb) {
    return { channels: srgb.slice(1, 4).map(v => Number(v) * 255), alpha: srgb[4] === undefined ? 1 : Number(srgb[4]) };
  }
  const hex = str.match(/^#([a-f0-9]{6})$/i);
  if (hex) {
    return { channels: [0, 2, 4].map(i => parseInt(hex[1].slice(i, i+2), 16)), alpha: 1 };
  }
  throw new Error('Unrecognized browser CSS color: ' + str);
}

function over(foreground, background) {
  const f = rgba(foreground);
  const b = rgba(background);
  return f.channels.map((v, i) => v * f.alpha + b.channels[i] * (1 - f.alpha));
}
function luminance(channels) {
  const linear = x => {
    const v = x / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return channels.reduce((s, v, i) => s + linear(v) * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function verify(scope, sample) {
  const background = over(sample.background, sample.backing);
  const foreground = over(sample.foreground, sample.background);
  const ratio = contrast(foreground, background);
  assert.ok(ratio >= 4.5, scope + ': unreadable text ratio ' + ratio.toFixed(2) +
    ' (text ' + sample.foreground + ', bg ' + sample.background + ', backing ' + sample.backing + ')');
}

const browser = await chromium.launch({ headless: true });
try {
  let cases = 0;
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      for (const profile of profiles) {
        await page.evaluate(current => {
          const previous = JSON.parse(localStorage.getItem('moxin.v3.settings') || '{}');
          localStorage.setItem('moxin.v3.settings', JSON.stringify({
            ...previous, theme: current.theme, learningStyle: current.style,
            sceneIntensity: 'off', reduceMotion: true,
          }));
        }, profile);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() =>
          (document.querySelector('#storageStatus')?.textContent || '').includes('IndexedDB 已就緒'));

        const samples = await page.evaluate(() => {
          const library = document.querySelector('#libraryView');
          const warn = document.createElement('article');
          warn.className = 'home-action-card warning';
          warn.innerHTML = '<span>資料安全</span><strong>請檢查備份</strong><p>保留目前學習資料</p>';
          library.appendChild(warn);
          const backing = document.createElement('div');
          backing.style.backgroundColor = 'var(--learn-surface-strong)';
          library.appendChild(backing);
          const backingColor = getComputedStyle(backing).backgroundColor;
          const sample = (text, bg, backingColor) => ({
            foreground: getComputedStyle(text).color,
            background: getComputedStyle(bg).backgroundColor,
            backing: backingColor,
          });
          const results = {
            warningLabel: sample(warn.querySelector('span'), warn, backingColor),
            warningHeading: sample(warn.querySelector('strong'), warn, backingColor),
            kickers: {},
          };
          for (const view of ['libraryView', 'reviewView', 'examCenterView', 'statsView']) {
            const section = document.getElementById(view);
            const card = document.createElement('div');
            card.style.backgroundColor = 'var(--learn-surface-strong)';
            const kicker = document.createElement('span');
            kicker.className = 'learning-kicker';
            kicker.textContent = '學習路徑';
            card.appendChild(kicker);
            section.appendChild(card);
            results.kickers[view] = sample(kicker, card, getComputedStyle(card).backgroundColor);
            card.remove();
          }
          const center = document.querySelector('#examCenterView');
          const step = document.createElement('div');
          step.className = 'learning-flow-step';
          step.innerHTML = '<span>1</span>';
          center.appendChild(step);
          const base = document.createElement('div');
          base.style.backgroundColor = 'var(--learn-surface-strong)';
          center.appendChild(base);
          results.examStep = sample(step.querySelector('span'), step.querySelector('span'), getComputedStyle(base).backgroundColor);
          base.remove();
          step.remove();
          const symbol = document.createElement('span');
          symbol.className = 'learning-bank-symbol exam';
          symbol.textContent = '★';
          library.appendChild(symbol);
          results.examSymbol = sample(symbol, symbol, backingColor);
          symbol.remove();
          warn.remove();
          backing.remove();
          return results;
        });

        const scope = viewport.name + '/' + profile.style + '/' + profile.theme;
        verify(scope + ' warningLabel', samples.warningLabel);
        verify(scope + ' warningHeading', samples.warningHeading);
        for (const [view, value] of Object.entries(samples.kickers)) {
          verify(scope + ' ' + view + ' kicker', value);
        }
        verify(scope + ' examStep', samples.examStep);
        verify(scope + ' examSymbol', samples.examSymbol);
        cases += 1;
        console.log('B04-02 readability PASS:', scope);
      }
    } finally {
      await context.close();
    }
  }
  assert.equal(cases, 12);
} finally {
  await browser.close();
}

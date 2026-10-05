import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/app.html';
const OUT_DIR = path.resolve('artifacts/rc1-browser-ux');
const SCREEN_DIR = path.join(OUT_DIR, 'screenshots');
fs.mkdirSync(SCREEN_DIR, { recursive: true });

const failures = [];
const warnings = [];
const metrics = [];
const scenarios = [];

const FAIL_A11Y_RULES = new Set([
  'button-name',
  'label',
  'aria-valid-attr',
  'aria-valid-attr-value',
  'aria-required-attr',
  'aria-hidden-focus',
  'aria-prohibited-attr',
  'color-contrast',
]);

const viewports = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-landscape', width: 844, height: 390 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
];

const visualProfiles = [
  { name: 'academy-light-full', theme: 'light', learningStyle: 'academy', sceneIntensity: 'full' },
  { name: 'academy-dark-reduced', theme: 'dark', learningStyle: 'academy', sceneIntensity: 'reduced' },
  { name: 'epic-light-full', theme: 'light', learningStyle: 'epic', sceneIntensity: 'full' },
  { name: 'epic-dark-full', theme: 'dark', learningStyle: 'epic', sceneIntensity: 'full' },
  { name: 'focus-light-off', theme: 'light', learningStyle: 'focus', sceneIntensity: 'off' },
  { name: 'focus-dark-off', theme: 'dark', learningStyle: 'focus', sceneIntensity: 'off' },
];

function addFailure(scope, message, detail = null) {
  failures.push({ scope, message, detail });
}

function addWarning(scope, message, detail = null) {
  warnings.push({ scope, message, detail });
}

function addMetric(scope, name, value, unit = 'ms') {
  metrics.push({ scope, name, value, unit });
}

function sanitize(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, '-');
}

async function waitReady(page) {
  await page.waitForSelector('#storageStatus', { timeout: 15000 });
  await page.waitForFunction(() => {
    const text = document.querySelector('#storageStatus')?.textContent || '';
    return text.includes('IndexedDB 已就緒');
  }, null, { timeout: 15000 });
}

function attachRuntimeObservers(page, scope) {
  page.on('pageerror', error => {
    addFailure(scope, `Page error: ${error.message}`);
  });

  page.on('console', message => {
    const text = message.text();
    if (message.type() === 'error') {
      addFailure(scope, `Console error: ${text}`);
    } else if (message.type() === 'warning' && !/Service Worker registration (failed|blocked by Playwright)/i.test(text)) {
      addWarning(scope, `Console warning: ${text}`);
    }
  });

  page.on('response', response => {
    const url = response.url();
    if (url.startsWith(BASE_URL) && response.status() >= 400) {
      addFailure(scope, `HTTP ${response.status()} for ${url}`);
    }
  });

  page.on('requestfailed', request => {
    const url = request.url();
    if (url.startsWith(BASE_URL)) {
      addFailure(scope, `Request failed: ${url}`, request.failure()?.errorText || null);
    }
  });
}

async function loadPage(page, scope, pathName = '') {
  const started = Date.now();
  await page.goto(new URL(pathName, BASE_URL).href, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await waitReady(page);
  const elapsed = Date.now() - started;
  addMetric(scope, 'initial-load', elapsed);
  if (elapsed > 8000) addFailure(scope, `Initial load took ${elapsed} ms`);
  else if (elapsed > 3500) addWarning(scope, `Initial load took ${elapsed} ms`);
}

async function seedStandard(page, { bankCount = 3, questionsPerBank = 12, longText = false } = {}) {
  await page.evaluate(async ({ bankCount, questionsPerBank, longText }) => {
    const { saveBankPackage } = await import('/src/storage/repositories/banks.js');
    const { putRecord } = await import('/src/storage/db.js');
    const { learningKey, questionKey } = await import('/src/utils/ids.js');

    const now = new Date();
    const iso = offsetMs => new Date(now.getTime() + offsetMs).toISOString();
    const futureDate = days => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      return [
        String(d.getFullYear()).padStart(4, '0'),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-');
    };

    const bankIds = [];
    for (let b = 0; b < bankCount; b += 1) {
      const bankId = `rc1-bank-${String(b + 1).padStart(2, '0')}`;
      bankIds.push(bankId);
      const longName = `超長題庫名稱-${'很長的文字'.repeat(14)}-${b + 1}`;
      const name = longText && b === 0 ? longName : `RC1 測試題庫 ${b + 1}`;

      const questions = Array.from({ length: questionsPerBank }, (_, index) => {
        const id = `Q${String(index + 1).padStart(3, '0')}`;
        const typeIndex = index % 4;
        const chapter = longText && index === 0
          ? `超長章節-${'章節名稱'.repeat(15)}`
          : `第 ${Math.floor(index / 4) + 1} 章`;

        if (typeIndex === 0) {
          return {
            id,
            type: 'single-choice',
            question: longText && index === 0
              ? `這是一個用來測試超長文字與手機版面是否會水平溢出的題目：${'非常長的題目內容'.repeat(18)}`
              : `單選測試題 ${index + 1}`,
            options: [
              { id: 'A', text: '正確答案 A' },
              { id: 'B', text: longText && index === 0 ? '很長的選項 '.repeat(25) : '干擾答案 B' },
            ],
            answer: ['A'],
            explanation: '這是測試詳解。',
            chapter,
            tags: ['RC1', '測試'],
            difficulty: (index % 5) + 1,
            images: [],
            explanationImages: [],
          };
        }

        if (typeIndex === 1) {
          return {
            id,
            type: 'multiple-choice',
            question: `複選測試題 ${index + 1}`,
            options: [
              { id: 'A', text: 'A' },
              { id: 'B', text: 'B' },
              { id: 'C', text: 'C' },
            ],
            answer: ['A', 'C'],
            explanation: '複選題詳解。',
            chapter,
            tags: ['RC1'],
            difficulty: (index % 5) + 1,
            images: [],
            explanationImages: [],
          };
        }

        if (typeIndex === 2) {
          return {
            id,
            type: 'true-false',
            question: `是非測試題 ${index + 1}`,
            options: [],
            answer: [true],
            explanation: '是非題詳解。',
            chapter,
            tags: ['RC1'],
            difficulty: (index % 5) + 1,
            images: [],
            explanationImages: [],
          };
        }

        return {
          id,
          type: 'fill-in',
          question: `填空測試題 ${index + 1}`,
          options: [],
          answer: ['ERP'],
          explanation: '填空題詳解。',
          chapter,
          tags: ['RC1'],
          difficulty: (index % 5) + 1,
          caseSensitive: false,
          images: [],
          explanationImages: [],
        };
      });

      await saveBankPackage({
        manifest: {
          schemaVersion: '2.0',
          id: bankId,
          name,
          version: '1.0.0',
          author: 'RC1 Browser Audit',
          category: '測試',
          description: longText && b === 0 ? '題庫描述 '.repeat(40) : 'RC1 使用者情境測試題庫',
          language: 'zh-Hant',
          updatedAt: now.toISOString(),
        },
        questions,
        assets: [],
        sourceType: 'user',
      });

      // Seed representative learning records.
      if (questions.length >= 4) {
        await putRecord('progress', {
          key: learningKey(bankId, questions[0].id),
          bankId,
          questionId: questions[0].id,
          attempts: 3,
          correctCount: 1,
          wrongCount: 2,
          lastResult: 'wrong',
          lastAnsweredAt: iso(-3600000),
          lastWrongAt: iso(-3600000),
        });

        await putRecord('reviewSchedule', {
          key: learningKey(bankId, questions[1].id),
          bankId,
          questionId: questions[1].id,
          level: 1,
          dueAt: iso(-3600000),
          lastReviewedAt: iso(-86400000),
          updatedAt: iso(-3600000),
        });

        await putRecord('favorites', {
          key: learningKey(bankId, questions[2].id),
          bankId,
          questionId: questions[2].id,
          addedAt: iso(-7200000),
        });

        await putRecord('mastery', {
          key: learningKey(bankId, questions[3].id),
          bankId,
          questionId: questions[3].id,
          status: 'unfamiliar',
          markedAt: iso(-7200000),
          updatedAt: iso(-7200000),
        });
      }
    }

    // Attempts across today and previous days.
    for (let i = 0; i < Math.min(bankIds.length, 8); i += 1) {
      const bankId = bankIds[i];
      for (let q = 1; q <= Math.min(questionsPerBank, 6); q += 1) {
        const questionId = `Q${String(q).padStart(3, '0')}`;
        await putRecord('attempts', {
          bankId,
          questionId,
          questionKey: questionKey(bankId, questionId),
          timestamp: iso(-(i % 5) * 86400000 - q * 120000),
          selectedAnswer: ['A'],
          correct: q % 3 !== 0,
          responseTime: 1500 + q * 100,
          mode: q % 4 === 0 ? 'wrong' : 'filtered',
        });
      }
    }

    await putRecord('learningGoals', {
      id: 'global',
      bankId: null,
      enabled: true,
      dailyPracticeTarget: 10,
      dailyReviewTarget: 4,
      examDate: null,
      examLabel: '',
      sprintEnabled: false,
      sprintBankIds: [],
      sprintDailyTarget: 0,
      createdAt: iso(-86400000 * 10),
      updatedAt: iso(-3600000),
    });

    await putRecord('learningGoals', {
      id: 'exam-sprint',
      bankId: null,
      enabled: false,
      dailyPracticeTarget: 0,
      dailyReviewTarget: 0,
      examDate: futureDate(14),
      examLabel: 'RC1 期末模擬',
      sprintEnabled: true,
      sprintBankIds: bankIds.slice(0, Math.min(3, bankIds.length)),
      sprintDailyTarget: 8,
      createdAt: iso(-86400000 * 5),
      updatedAt: iso(-1800000),
    });

    if (bankIds[0]) {
      const sourceQuestionIds = Array.from(
        { length: Math.min(questionsPerBank, 6) },
        (_, i) => `Q${String(i + 1).padStart(3, '0')}`,
      );
      await putRecord('sessions', {
        id: 'practice-rc1-resume',
        bankId: bankIds[0],
        bankName: `RC1 測試題庫 1`,
        mode: 'filtered',
        sourceQuestionIds,
        queue: sourceQuestionIds.slice(2),
        completedIds: sourceQuestionIds.slice(0, 2),
        errorsByQuestion: {},
        attemptCount: 2,
        wrongCount: 0,
        currentQuestionId: null,
        answered: false,
        startedAt: iso(-7200000),
        updatedAt: iso(-600000),
        finishedAt: null,
      });
    }

    localStorage.setItem('moxin.v4.backup.meta', JSON.stringify({
      lastFullBackupAt: iso(-86400000 * 9),
    }));
  }, { bankCount, questionsPerBank, longText });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
}

async function setVisualProfile(page, profile) {
  await page.evaluate(profile => {
    const raw = localStorage.getItem('moxin.v3.settings');
    let current = {};
    try { current = raw ? JSON.parse(raw) : {}; } catch {}
    localStorage.setItem('moxin.v3.settings', JSON.stringify({
      ...current,
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

async function auditLayout(page, scope, { mobile = false } = {}) {
  const result = await page.evaluate(() => {
    const visible = el => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0;
    };

    const documentOverflow = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ) - window.innerWidth;

    const keySelectors = [
      '.app-header',
      '.main-nav',
      '[data-view]:not([hidden])',
      '.learning-hero',
      '.home-dashboard',
      '.learning-hub-tabs',
      '.stats-tabs',
      '.studio-r1-layout',
      '.practice-focus-shell',
      '.exam-focus-shell',
    ];

    const outOfViewport = [];
    for (const selector of keySelectors) {
      document.querySelectorAll(selector).forEach(el => {
        if (!visible(el)) return;
        const rect = el.getBoundingClientRect();
        if (rect.left < -4 || rect.right > window.innerWidth + 4) {
          outOfViewport.push({
            selector,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          });
        }
      });
    }

    const smallTargets = [];
    for (const el of document.querySelectorAll(
      'button, a.button, .nav-item, summary, select, input[type="text"], input[type="search"], input[type="number"]'
    )) {
      if (!visible(el) || el.disabled) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 32 || rect.height < 32) {
        smallTargets.push({
          text: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }

    const activeView = document.querySelector('[data-view]:not([hidden])')?.id || null;

    return {
      width: window.innerWidth,
      height: window.innerHeight,
      docWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      documentOverflow,
      outOfViewport,
      smallTargets: smallTargets.slice(0, 20),
      activeView,
    };
  });

  if (result.documentOverflow > 4) {
    addFailure(scope, `Document horizontally overflows viewport by ${result.documentOverflow}px`, result);
  }
  if (result.outOfViewport.length) {
    addFailure(scope, 'Key UI block extends outside viewport', result.outOfViewport);
  }
  if (mobile && result.smallTargets.length) {
    addWarning(scope, `${result.smallTargets.length} visible targets are under 32px in one dimension`, result.smallTargets);
  }
  return result;
}

async function auditA11y(page, scope) {
  const report = await new AxeBuilder({ page })
    .exclude('.learning-hero-art')
    .analyze();

  for (const violation of report.violations) {
    const entry = {
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.slice(0, 4).map(node => node.target),
    };

    if (
      violation.impact === 'critical' ||
      (violation.impact === 'serious' && FAIL_A11Y_RULES.has(violation.id))
    ) {
      addFailure(scope, `Accessibility ${violation.impact}: ${violation.id}`, entry);
    } else if (['serious', 'moderate'].includes(violation.impact)) {
      addWarning(scope, `Accessibility ${violation.impact}: ${violation.id}`, entry);
    }
  }
}

async function snap(page, scope, name) {
  const filename = `${sanitize(scope)}__${sanitize(name)}.png`;
  await page.screenshot({
    path: path.join(SCREEN_DIR, filename),
    fullPage: true,
    animations: 'disabled',
  });
}

async function navigateAndAudit(page, selector, targetSelector, scope, label, options = {}) {
  const started = Date.now();
  await page.locator(selector).first().click();
  await page.waitForSelector(targetSelector, { state: 'visible', timeout: 15000 });
  const elapsed = Date.now() - started;
  addMetric(scope, `navigate-${label}`, elapsed);
  if (elapsed > 5000) addFailure(scope, `${label} navigation took ${elapsed} ms`);
  else if (elapsed > 1800) addWarning(scope, `${label} navigation took ${elapsed} ms`);
  await page.waitForTimeout(80);
  await auditLayout(page, `${scope}:${label}`, options);
}

async function runNewUser(browser) {
  const scope = 'new-user';
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  attachRuntimeObservers(page, scope);

  await loadPage(page, scope);
  await auditLayout(page, `${scope}:library`, { mobile: true });
  assert.equal(await page.locator('#libraryView').isVisible(), true);
  await snap(page, scope, 'library-empty');

  await navigateAndAudit(page, '[data-nav-review]', '#reviewView:not([hidden])', scope, 'review', { mobile: true });
  await snap(page, scope, 'review-empty');

  await navigateAndAudit(page, '[data-nav-exam]', '#examCenterView:not([hidden])', scope, 'exam', { mobile: true });
  await snap(page, scope, 'exam-empty');

  await navigateAndAudit(page, '[data-nav-stats]', '#statsView:not([hidden])', scope, 'stats', { mobile: true });
  await snap(page, scope, 'stats-empty');

  await navigateAndAudit(page, '[data-nav-tools]', '#toolsView:not([hidden])', scope, 'studio', { mobile: true });
  await snap(page, scope, 'studio');

  await navigateAndAudit(page, '[data-nav-settings]', '#settingsView:not([hidden])', scope, 'settings', { mobile: true });
  await auditA11y(page, `${scope}:settings`);
  await snap(page, scope, 'settings');

  scenarios.push({ scope, status: 'completed' });
  await context.close();
}

async function runReturningUser(browser) {
  const scope = 'returning-user';
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    colorScheme: 'light',
    serviceWorkers: 'block',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  attachRuntimeObservers(page, scope);

  await loadPage(page, scope);
  await seedStandard(page, { bankCount: 3, questionsPerBank: 12 });

  await page.locator('[data-nav-library]').first().click();
  await page.waitForSelector('#libraryView:not([hidden])');
  await page.waitForSelector('[data-home-resume-bank]');
  await auditLayout(page, `${scope}:home`);
  await auditA11y(page, `${scope}:home`);
  await snap(page, scope, 'home');

  // Resume a real unfinished practice session and submit one answer.
  await page.locator('[data-home-resume-bank]').click();
  await page.waitForSelector('#practiceView:not([hidden])');
  await page.waitForSelector('[data-answer-form]');
  await auditLayout(page, `${scope}:practice`);
  await snap(page, scope, 'practice-resume');

  const answerInput = page.locator('[data-answer-form] input[name="answer"]').first();
  if (await answerInput.count()) {
    await answerInput.check();
    await page.locator('[data-submit-answer]').click();
    await page.waitForSelector('[data-feedback-area] .feedback-panel', { timeout: 10000 });
    await auditLayout(page, `${scope}:practice-feedback`);
    await snap(page, scope, 'practice-feedback');
  } else {
    addFailure(scope, 'Practice question did not render an answer input.');
  }

  // Learning Hub tabs.
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-exit-practice]').click();
  await page.waitForSelector('#bankDetailView:not([hidden])');
  await navigateAndAudit(page, '[data-nav-review]', '#reviewView:not([hidden])', scope, 'learning-hub');
  for (const tab of ['overview', 'review', 'goals', 'sprint']) {
    await page.locator(`[data-learning-hub-tab="${tab}"]`).first().click();
    await page.waitForTimeout(100);
    await auditLayout(page, `${scope}:hub-${tab}`);
    await snap(page, scope, `hub-${tab}`);
  }

  // Statistics tabs and controls.
  await navigateAndAudit(page, '[data-nav-stats]', '#statsView:not([hidden])', scope, 'statistics');
  for (const tab of ['overview', 'trends', 'weakness', 'banks']) {
    await page.locator(`[data-stats-tab="${tab}"]`).first().click();
    await page.waitForTimeout(100);
    await auditLayout(page, `${scope}:stats-${tab}`);
    if (tab === 'trends') {
      const window30 = page.locator('[data-stats-window="30"]');
      if (await window30.count()) {
        await window30.click();
        await page.waitForTimeout(100);
      }
      const scopeSelect = page.locator('[data-stats-scope]');
      if (await scopeSelect.count()) {
        await scopeSelect.selectOption('rc1-bank-01');
        await page.waitForTimeout(100);
      }
    }
    await snap(page, scope, `stats-${tab}`);
  }

  await auditA11y(page, `${scope}:statistics`);

  // Start a real exam and inspect the in-exam layout.
  await navigateAndAudit(page, '[data-nav-exam]', '#examCenterView:not([hidden])', scope, 'exam-center');
  const startExam = page.locator('[data-start-exam="rc1-bank-01"]');
  if (await startExam.count()) {
    page.once('dialog', dialog => dialog.accept());
    await startExam.click();
    await page.waitForSelector('#examView:not([hidden])', { timeout: 10000 });
    await auditLayout(page, `${scope}:exam-running`);
    await snap(page, scope, 'exam-running');

    // Settings should be blocked while exam is running.
    await page.locator('[data-nav-settings]').first().click();
    await page.waitForTimeout(120);
    if (await page.locator('#settingsView:not([hidden])').count()) {
      addFailure(scope, 'Settings opened while an exam was active.');
    }
  } else {
    addFailure(scope, 'Could not find start exam action for seeded bank.');
  }

  scenarios.push({ scope, status: 'completed' });
  await context.close();
}

async function runViewportMatrix(browser) {
  const scope = 'viewport-matrix';
  for (const viewport of viewports) {
    const mobile = viewport.width <= 620;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: 'dark',
      serviceWorkers: 'block',
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage();
    attachRuntimeObservers(page, `${scope}:${viewport.name}`);
    await loadPage(page, `${scope}:${viewport.name}`);
    await seedStandard(page, { bankCount: 3, questionsPerBank: 12, longText: true });
    await setVisualProfile(page, {
      theme: 'dark',
      learningStyle: 'epic',
      sceneIntensity: 'full',
    });

    await auditLayout(page, `${scope}:${viewport.name}:home`, { mobile });
    await snap(page, scope, `${viewport.name}-home`);

    await navigateAndAudit(
      page,
      '[data-nav-review]',
      '#reviewView:not([hidden])',
      `${scope}:${viewport.name}`,
      'review',
      { mobile },
    );
    await snap(page, scope, `${viewport.name}-review`);

    await navigateAndAudit(
      page,
      '[data-nav-stats]',
      '#statsView:not([hidden])',
      `${scope}:${viewport.name}`,
      'stats',
      { mobile },
    );
    await snap(page, scope, `${viewport.name}-stats`);

    if (mobile || viewport.name === 'desktop') {
      await auditA11y(page, `${scope}:${viewport.name}:stats`);
    }

    await context.close();
  }

  scenarios.push({ scope, status: 'completed', count: viewports.length });
}

async function runVisualProfiles(browser) {
  const scope = 'visual-profiles';

  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1366, height: 768 },
  ]) {
    for (const profile of visualProfiles) {
      const mobile = viewport.width <= 620;
      const caseScope = `${scope}:${viewport.name}:${profile.name}`;
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: profile.theme,
        serviceWorkers: 'block',
        hasTouch: mobile,
        isMobile: mobile,
      });
      const page = await context.newPage();
      attachRuntimeObservers(page, caseScope);
      await loadPage(page, caseScope);
      await seedStandard(page, { bankCount: 2, questionsPerBank: 8 });
      await setVisualProfile(page, profile);

      const dataset = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        style: document.documentElement.dataset.learningStyle,
        intensity: document.documentElement.dataset.sceneIntensity,
      }));

      if (
        dataset.theme !== profile.theme ||
        dataset.style !== profile.learningStyle ||
        dataset.intensity !== profile.sceneIntensity
      ) {
        addFailure(caseScope, 'Visual profile dataset does not match saved settings.', { expected: profile, actual: dataset });
      }

      await auditLayout(page, `${caseScope}:home`, { mobile });
      await snap(page, scope, `${viewport.name}-${profile.name}-home`);
      await context.close();
    }
  }

  scenarios.push({ scope, status: 'completed', count: visualProfiles.length * 2 });
}

async function runHeavyLibrary(browser) {
  const scope = 'heavy-library';
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
    serviceWorkers: 'block',
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  attachRuntimeObservers(page, scope);

  await loadPage(page, scope);
  const seedStarted = Date.now();
  await seedStandard(page, { bankCount: 36, questionsPerBank: 10 });
  addMetric(scope, 'seed-36-banks-360-questions', Date.now() - seedStarted);

  await auditLayout(page, `${scope}:home`, { mobile: true });
  await snap(page, scope, 'home-36-banks');

  const reviewStarted = Date.now();
  await page.locator('[data-nav-review]').first().click();
  await page.waitForSelector('#reviewView:not([hidden])', { timeout: 30000 });
  const reviewMs = Date.now() - reviewStarted;
  addMetric(scope, 'open-learning-hub-36-banks', reviewMs);
  if (reviewMs > 7000) addFailure(scope, `Learning Hub with 36 banks took ${reviewMs} ms`);
  else if (reviewMs > 3000) addWarning(scope, `Learning Hub with 36 banks took ${reviewMs} ms`);

  await page.locator('[data-learning-hub-tab="sprint"]').first().click();
  await page.waitForTimeout(100);
  const search = page.locator('[data-exam-sprint-bank-search]');
  if (!(await search.count())) {
    addFailure(scope, 'P4 bank search is missing with 36 local banks.');
  } else {
    await search.fill('36');
    const visibleOptions = await page.locator('[data-exam-sprint-bank-option]:visible').count();
    if (visibleOptions < 1) addFailure(scope, 'P4 large-bank search returned no visible result for "36".');
  }

  await auditLayout(page, `${scope}:sprint`, { mobile: true });
  await snap(page, scope, 'sprint-36-banks');

  const statsStarted = Date.now();
  await page.locator('[data-nav-stats]').first().click();
  await page.waitForSelector('#statsView:not([hidden])', { timeout: 30000 });
  const statsMs = Date.now() - statsStarted;
  addMetric(scope, 'open-statistics-36-banks', statsMs);
  if (statsMs > 7000) addFailure(scope, `Statistics with 36 banks took ${statsMs} ms`);
  else if (statsMs > 3000) addWarning(scope, `Statistics with 36 banks took ${statsMs} ms`);

  await auditLayout(page, `${scope}:stats`, { mobile: true });
  await snap(page, scope, 'stats-36-banks');

  scenarios.push({ scope, status: 'completed' });
  await context.close();
}

async function runBackupRoundTrip(browser) {
  const scope = 'backup-roundtrip';
  let backupPath = null;

  {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      serviceWorkers: 'block',
      acceptDownloads: true,
    });
    const page = await context.newPage();
    attachRuntimeObservers(page, `${scope}:export`);
    await loadPage(page, `${scope}:export`);
    await seedStandard(page, { bankCount: 2, questionsPerBank: 8 });

    await page.locator('[data-nav-settings]').first().click();
    await page.waitForSelector('#settingsView:not([hidden])');

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('[data-export-backup]').click();
    const download = await downloadPromise;
    backupPath = path.join(OUT_DIR, 'rc1-full-backup.json');
    await download.saveAs(backupPath);

    if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size < 200) {
      addFailure(scope, 'Full backup download was not created or was unexpectedly small.');
    }

    const meta = await page.evaluate(() => localStorage.getItem('moxin.v4.backup.meta'));
    if (!meta || !meta.includes('lastFullBackupAt')) {
      addFailure(scope, 'Successful full backup did not update backup metadata.');
    }

    await context.close();
  }

  if (!backupPath || !fs.existsSync(backupPath)) {
    scenarios.push({ scope, status: 'failed-before-restore' });
    return;
  }

  {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    attachRuntimeObservers(page, `${scope}:restore`);
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await loadPage(page, `${scope}:restore`);
    await page.locator('[data-nav-settings]').first().click();
    await page.waitForSelector('#settingsView:not([hidden])');

    await page.locator('[data-import-backup]').setInputFiles(backupPath);
    await page.waitForTimeout(1200);
    await waitReady(page);

    await page.locator('[data-nav-library]').first().click();
    await page.waitForSelector('#libraryView:not([hidden])');
    await page.locator('[data-library-source-tab="user"]').click();
    await page.waitForTimeout(120);

    const restoredBank = page.locator('[data-open-bank="rc1-bank-01"]');
    if (!(await restoredBank.count())) {
      addFailure(scope, 'Restored backup does not contain the seeded user bank.');
    }

    await auditLayout(page, `${scope}:restored`);
    await snap(page, scope, 'restored-library');
    await context.close();
  }

  scenarios.push({ scope, status: 'completed' });
}

async function runV2Migration(browser) {
  const scope = 'v3.3-to-v4-migration';
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  attachRuntimeObservers(page, scope);

  // Establish the same origin without booting the application.
  await page.goto(new URL('docs/V4_0_PLAN.md', BASE_URL).href, { waitUntil: 'domcontentloaded' });

  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase('moxin-quiz-v3');
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onblocked = () => reject(new Error('v2 seed database delete blocked'));
    });

    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('moxin-quiz-v3', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        const defs = {
          banks: { keyPath: 'id', indexes: [['updatedAt', 'updatedAt'], ['name', 'name']] },
          questions: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['questionId', 'questionId'], ['chapter', 'chapter']] },
          assets: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['path', 'path']] },
          attempts: { keyPath: 'id', autoIncrement: true, indexes: [['bankId', 'bankId'], ['questionKey', 'questionKey'], ['timestamp', 'timestamp']] },
          progress: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
          favorites: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
          notes: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
          mastery: { keyPath: 'key', indexes: [['bankId', 'bankId']] },
          reviewSchedule: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['dueAt', 'dueAt']] },
          sessions: { keyPath: 'id', indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt']] },
        };

        for (const [name, def] of Object.entries(defs)) {
          const store = db.createObjectStore(name, {
            keyPath: def.keyPath,
            autoIncrement: def.autoIncrement === true,
          });
          for (const [indexName, keyPath] of def.indexes) {
            store.createIndex(indexName, keyPath);
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const now = new Date().toISOString();
    const tx = db.transaction(
      ['banks', 'questions', 'attempts', 'progress', 'favorites', 'notes', 'mastery', 'reviewSchedule', 'sessions'],
      'readwrite',
    );

    tx.objectStore('banks').put({
      id: 'legacy-bank',
      schemaVersion: '2.0',
      name: 'v3.3 舊題庫',
      version: '3.3.0',
      questionCount: 1,
      sourceType: 'user',
      storedAt: now,
      updatedAt: now,
    });

    tx.objectStore('questions').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      id: 'Q001',
      type: 'single-choice',
      question: '舊版題目',
      options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
      answer: ['A'],
      explanation: '舊版詳解',
      chapter: '舊章節',
      tags: ['legacy'],
      difficulty: 2,
      images: [],
      explanationImages: [],
    });

    tx.objectStore('attempts').add({
      bankId: 'legacy-bank',
      questionId: 'Q001',
      questionKey: 'legacy-bank::Q001',
      timestamp: now,
      selectedAnswer: ['A'],
      correct: true,
      responseTime: 1200,
      mode: 'filtered',
    });

    tx.objectStore('progress').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      attempts: 1,
      correctCount: 1,
      wrongCount: 0,
      lastResult: 'correct',
      lastAnsweredAt: now,
    });

    tx.objectStore('favorites').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      addedAt: now,
    });

    tx.objectStore('notes').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      text: '舊版筆記',
      updatedAt: now,
    });

    tx.objectStore('mastery').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      status: 'unfamiliar',
      markedAt: now,
      updatedAt: now,
    });

    tx.objectStore('reviewSchedule').put({
      key: 'legacy-bank::Q001',
      bankId: 'legacy-bank',
      questionId: 'Q001',
      level: 1,
      dueAt: now,
      updatedAt: now,
    });

    tx.objectStore('sessions').put({
      id: 'legacy-session',
      bankId: 'legacy-bank',
      bankName: 'v3.3 舊題庫',
      mode: 'filtered',
      sourceQuestionIds: ['Q001'],
      queue: ['Q001'],
      completedIds: [],
      errorsByQuestion: {},
      attemptCount: 0,
      wrongCount: 0,
      currentQuestionId: null,
      answered: false,
      startedAt: now,
      updatedAt: now,
      finishedAt: null,
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();

    localStorage.setItem('moxin.v3.settings', JSON.stringify({
      theme: 'dark',
      fontScale: 'large',
      optionSpacing: 'comfortable',
      reduceMotion: true,
      learningStyle: 'academy',
      sceneIntensity: 'reduced',
      studioTypeSwitchConfirm: true,
    }));
  });

  await loadPage(page, scope);

  const migrationState = await page.evaluate(async () => {
    const { openDatabase, getRecord } = await import('/src/storage/db.js');
    const { getBank, getQuestion } = await import('/src/storage/repositories/banks.js');
    const { getFavorite, getNote, getUnfamiliar } = await import('/src/storage/repositories/learning.js');
    const db = await openDatabase();

    return {
      version: db.version,
      hasStudioDrafts: db.objectStoreNames.contains('studioDrafts'),
      hasLearningGoals: db.objectStoreNames.contains('learningGoals'),
      bank: await getBank('legacy-bank'),
      question: await getQuestion('legacy-bank', 'Q001'),
      favorite: await getFavorite('legacy-bank', 'Q001'),
      note: await getNote('legacy-bank', 'Q001'),
      unfamiliar: await getUnfamiliar('legacy-bank', 'Q001'),
      session: await getRecord('sessions', 'legacy-session'),
      settings: JSON.parse(localStorage.getItem('moxin.v3.settings') || '{}'),
    };
  });

  if (migrationState.version !== 4) addFailure(scope, `Expected DB version 4 after upgrade, got ${migrationState.version}`);
  if (!migrationState.hasStudioDrafts || !migrationState.hasLearningGoals) {
    addFailure(scope, 'DB upgrade did not add v4 stores.', migrationState);
  }
  for (const key of ['bank', 'question', 'favorite', 'note', 'unfamiliar', 'session']) {
    if (!migrationState[key]) addFailure(scope, `Legacy record missing after v2 → v4 upgrade: ${key}`);
  }
  if (migrationState.settings.theme !== 'dark' || migrationState.settings.fontScale !== 'large') {
    addFailure(scope, 'Legacy UI settings were not preserved.', migrationState.settings);
  }

  await page.locator('[data-library-source-tab="user"]').click();
  await page.waitForTimeout(120);
  if (!(await page.locator('[data-open-bank="legacy-bank"]').count())) {
    addFailure(scope, 'Legacy bank is not visible in the v4 user library after upgrade.');
  }

  await auditLayout(page, `${scope}:library`);
  await snap(page, scope, 'migration-library');
  scenarios.push({ scope, status: 'completed' });
  await context.close();
}

async function runOfflinePwa(browser) {
  const scope = 'offline-pwa';
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    serviceWorkers: 'allow',
  });
  const page = await context.newPage();
  attachRuntimeObservers(page, scope);

  await loadPage(page, scope);
  await seedStandard(page, { bankCount: 2, questionsPerBank: 8 });

  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready;
    }
  });
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await waitReady(page);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitReady(page);
    await auditLayout(page, `${scope}:offline`, { mobile: true });
    await snap(page, scope, 'offline-library');
  } catch (error) {
    addFailure(scope, `Offline reload failed: ${error.message}`);
  } finally {
    await context.setOffline(false);
  }

  scenarios.push({ scope, status: 'completed' });
  await context.close();
}

async function writeReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    failures,
    warnings,
    metrics,
    scenarios,
    summary: {
      failures: failures.length,
      warnings: warnings.length,
      metrics: metrics.length,
      scenarios: scenarios.length,
    },
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  const metricRows = metrics
    .sort((a, b) => b.value - a.value)
    .slice(0, 30)
    .map(item => `| ${item.scope} | ${item.name} | ${item.value} ${item.unit} |`)
    .join('\n');

  const failureText = failures.length
    ? failures.map((item, i) =>
        `${i + 1}. **${item.scope}** — ${item.message}${item.detail ? `\n   - \`${JSON.stringify(item.detail).slice(0, 800)}\`` : ''}`
      ).join('\n')
    : 'None.';

  const warningText = warnings.length
    ? warnings.map((item, i) =>
        `${i + 1}. **${item.scope}** — ${item.message}${item.detail ? `\n   - \`${JSON.stringify(item.detail).slice(0, 800)}\`` : ''}`
      ).join('\n')
    : 'None.';

  const markdown = `# RC1 Browser UX Audit

Generated: ${report.generatedAt}

## Result

- Failures: **${failures.length}**
- Warnings: **${warnings.length}**
- Scenarios: **${scenarios.length}**
- Screenshots: **${fs.readdirSync(SCREEN_DIR).length}**

## Hard failures

${failureText}

## Warnings

${warningText}

## Slowest measured operations

| Scope | Operation | Time |
|---|---|---:|
${metricRows || '| — | — | — |'}

## Executed user simulations

- New user / empty data
- Returning learner / resume practice / answer feedback
- Learning Hub 4-tab navigation
- Statistics 4-tab navigation + 7/30 day + bank scope
- Running exam + settings lockout
- 7 viewport sizes
- Academy / Epic / Focus × Light / Dark representative profiles
- 36-bank / 360-question heavy local library
- Full backup export → fresh browser restore
- v3.3-style IndexedDB v2 → V5 structural DB v4 upgrade
- PWA offline reload

`;

  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), markdown, 'utf8');
  console.log(markdown);
}

const browser = await chromium.launch({
  headless: true,
});

const scenarioRuns = [
  ['new-user', runNewUser],
  ['returning-user', runReturningUser],
  ['viewport-matrix', runViewportMatrix],
  ['visual-profiles', runVisualProfiles],
  ['heavy-library', runHeavyLibrary],
  ['backup-roundtrip', runBackupRoundTrip],
  ['v3.3-to-v4-migration', runV2Migration],
  ['offline-pwa', runOfflinePwa],
];

try {
  for (const [name, runner] of scenarioRuns) {
    try {
      await runner(browser);
    } catch (error) {
      addFailure(name, `Scenario crashed: ${error.message}`, error.stack);
    }
  }
} finally {
  await browser.close();
  await writeReport();
}

if (failures.length) {
  console.error(`RC1 browser UX audit failed with ${failures.length} hard failure(s).`);
  process.exit(1);
}

console.log(`RC1 browser UX audit passed with ${warnings.length} warning(s).`);

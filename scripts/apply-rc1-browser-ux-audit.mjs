const BROWSER_TEST = "import fs from 'node:fs';\nimport path from 'node:path';\nimport assert from 'node:assert/strict';\nimport { chromium } from 'playwright';\nimport AxeBuilder from '@axe-core/playwright';\n\nconst BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/';\nconst OUT_DIR = path.resolve('artifacts/rc1-browser-ux');\nconst SCREEN_DIR = path.join(OUT_DIR, 'screenshots');\nfs.mkdirSync(SCREEN_DIR, { recursive: true });\n\nconst failures = [];\nconst warnings = [];\nconst metrics = [];\nconst scenarios = [];\n\nconst FAIL_A11Y_RULES = new Set([\n  'button-name',\n  'label',\n  'aria-valid-attr',\n  'aria-valid-attr-value',\n  'aria-required-attr',\n  'aria-hidden-focus',\n  'aria-prohibited-attr',\n  'color-contrast',\n]);\n\nconst viewports = [\n  { name: 'small-mobile', width: 320, height: 568 },\n  { name: 'mobile', width: 390, height: 844 },\n  { name: 'mobile-landscape', width: 844, height: 390 },\n  { name: 'tablet-portrait', width: 768, height: 1024 },\n  { name: 'tablet-landscape', width: 1024, height: 768 },\n  { name: 'laptop', width: 1366, height: 768 },\n  { name: 'desktop', width: 1920, height: 1080 },\n];\n\nconst visualProfiles = [\n  { name: 'academy-light-full', theme: 'light', learningStyle: 'academy', sceneIntensity: 'full' },\n  { name: 'academy-dark-reduced', theme: 'dark', learningStyle: 'academy', sceneIntensity: 'reduced' },\n  { name: 'epic-light-full', theme: 'light', learningStyle: 'epic', sceneIntensity: 'full' },\n  { name: 'epic-dark-full', theme: 'dark', learningStyle: 'epic', sceneIntensity: 'full' },\n  { name: 'focus-light-off', theme: 'light', learningStyle: 'focus', sceneIntensity: 'off' },\n  { name: 'focus-dark-off', theme: 'dark', learningStyle: 'focus', sceneIntensity: 'off' },\n];\n\nfunction addFailure(scope, message, detail = null) {\n  failures.push({ scope, message, detail });\n}\n\nfunction addWarning(scope, message, detail = null) {\n  warnings.push({ scope, message, detail });\n}\n\nfunction addMetric(scope, name, value, unit = 'ms') {\n  metrics.push({ scope, name, value, unit });\n}\n\nfunction sanitize(value) {\n  return String(value).replace(/[^A-Za-z0-9._-]+/g, '-');\n}\n\nasync function waitReady(page) {\n  await page.waitForSelector('#storageStatus', { timeout: 15000 });\n  await page.waitForFunction(() => {\n    const text = document.querySelector('#storageStatus')?.textContent || '';\n    return text.includes('IndexedDB 已就緒');\n  }, null, { timeout: 15000 });\n}\n\nfunction attachRuntimeObservers(page, scope) {\n  page.on('pageerror', error => {\n    addFailure(scope, `Page error: ${error.message}`);\n  });\n\n  page.on('console', message => {\n    const text = message.text();\n    if (message.type() === 'error') {\n      addFailure(scope, `Console error: ${text}`);\n    } else if (message.type() === 'warning' && !/Service Worker registration (failed|blocked by Playwright)/i.test(text)) {\n      addWarning(scope, `Console warning: ${text}`);\n    }\n  });\n\n  page.on('response', response => {\n    const url = response.url();\n    if (url.startsWith(BASE_URL) && response.status() >= 400) {\n      addFailure(scope, `HTTP ${response.status()} for ${url}`);\n    }\n  });\n\n  page.on('requestfailed', request => {\n    const url = request.url();\n    if (url.startsWith(BASE_URL)) {\n      addFailure(scope, `Request failed: ${url}`, request.failure()?.errorText || null);\n    }\n  });\n}\n\nasync function loadPage(page, scope, pathName = '') {\n  const started = Date.now();\n  await page.goto(new URL(pathName, BASE_URL).href, {\n    waitUntil: 'domcontentloaded',\n    timeout: 30000,\n  });\n  await waitReady(page);\n  const elapsed = Date.now() - started;\n  addMetric(scope, 'initial-load', elapsed);\n  if (elapsed > 8000) addFailure(scope, `Initial load took ${elapsed} ms`);\n  else if (elapsed > 3500) addWarning(scope, `Initial load took ${elapsed} ms`);\n}\n\nasync function seedStandard(page, { bankCount = 3, questionsPerBank = 12, longText = false } = {}) {\n  await page.evaluate(async ({ bankCount, questionsPerBank, longText }) => {\n    const { saveBankPackage } = await import('/src/storage/repositories/banks.js');\n    const { putRecord } = await import('/src/storage/db.js');\n    const { learningKey, questionKey } = await import('/src/utils/ids.js');\n\n    const now = new Date();\n    const iso = offsetMs => new Date(now.getTime() + offsetMs).toISOString();\n    const futureDate = days => {\n      const d = new Date(now);\n      d.setDate(d.getDate() + days);\n      return [\n        String(d.getFullYear()).padStart(4, '0'),\n        String(d.getMonth() + 1).padStart(2, '0'),\n        String(d.getDate()).padStart(2, '0'),\n      ].join('-');\n    };\n\n    const bankIds = [];\n    for (let b = 0; b < bankCount; b += 1) {\n      const bankId = `rc1-bank-${String(b + 1).padStart(2, '0')}`;\n      bankIds.push(bankId);\n      const longName = `超長題庫名稱-${'很長的文字'.repeat(14)}-${b + 1}`;\n      const name = longText && b === 0 ? longName : `RC1 測試題庫 ${b + 1}`;\n\n      const questions = Array.from({ length: questionsPerBank }, (_, index) => {\n        const id = `Q${String(index + 1).padStart(3, '0')}`;\n        const typeIndex = index % 4;\n        const chapter = longText && index === 0\n          ? `超長章節-${'章節名稱'.repeat(15)}`\n          : `第 ${Math.floor(index / 4) + 1} 章`;\n\n        if (typeIndex === 0) {\n          return {\n            id,\n            type: 'single-choice',\n            question: longText && index === 0\n              ? `這是一個用來測試超長文字與手機版面是否會水平溢出的題目：${'非常長的題目內容'.repeat(18)}`\n              : `單選測試題 ${index + 1}`,\n            options: [\n              { id: 'A', text: '正確答案 A' },\n              { id: 'B', text: longText && index === 0 ? '很長的選項 '.repeat(25) : '干擾答案 B' },\n            ],\n            answer: ['A'],\n            explanation: '這是測試詳解。',\n            chapter,\n            tags: ['RC1', '測試'],\n            difficulty: (index % 5) + 1,\n            images: [],\n            explanationImages: [],\n          };\n        }\n\n        if (typeIndex === 1) {\n          return {\n            id,\n            type: 'multiple-choice',\n            question: `複選測試題 ${index + 1}`,\n            options: [\n              { id: 'A', text: 'A' },\n              { id: 'B', text: 'B' },\n              { id: 'C', text: 'C' },\n            ],\n            answer: ['A', 'C'],\n            explanation: '複選題詳解。',\n            chapter,\n            tags: ['RC1'],\n            difficulty: (index % 5) + 1,\n            images: [],\n            explanationImages: [],\n          };\n        }\n\n        if (typeIndex === 2) {\n          return {\n            id,\n            type: 'true-false',\n            question: `是非測試題 ${index + 1}`,\n            options: [],\n            answer: [true],\n            explanation: '是非題詳解。',\n            chapter,\n            tags: ['RC1'],\n            difficulty: (index % 5) + 1,\n            images: [],\n            explanationImages: [],\n          };\n        }\n\n        return {\n          id,\n          type: 'fill-in',\n          question: `填空測試題 ${index + 1}`,\n          options: [],\n          answer: ['ERP'],\n          explanation: '填空題詳解。',\n          chapter,\n          tags: ['RC1'],\n          difficulty: (index % 5) + 1,\n          caseSensitive: false,\n          images: [],\n          explanationImages: [],\n        };\n      });\n\n      await saveBankPackage({\n        manifest: {\n          schemaVersion: '2.0',\n          id: bankId,\n          name,\n          version: '1.0.0',\n          author: 'RC1 Browser Audit',\n          category: '測試',\n          description: longText && b === 0 ? '題庫描述 '.repeat(40) : 'RC1 使用者情境測試題庫',\n          language: 'zh-Hant',\n          updatedAt: now.toISOString(),\n        },\n        questions,\n        assets: [],\n        sourceType: 'user',\n      });\n\n      // Seed representative learning records.\n      if (questions.length >= 4) {\n        await putRecord('progress', {\n          key: learningKey(bankId, questions[0].id),\n          bankId,\n          questionId: questions[0].id,\n          attempts: 3,\n          correctCount: 1,\n          wrongCount: 2,\n          lastResult: 'wrong',\n          lastAnsweredAt: iso(-3600000),\n          lastWrongAt: iso(-3600000),\n        });\n\n        await putRecord('reviewSchedule', {\n          key: learningKey(bankId, questions[1].id),\n          bankId,\n          questionId: questions[1].id,\n          level: 1,\n          dueAt: iso(-3600000),\n          lastReviewedAt: iso(-86400000),\n          updatedAt: iso(-3600000),\n        });\n\n        await putRecord('favorites', {\n          key: learningKey(bankId, questions[2].id),\n          bankId,\n          questionId: questions[2].id,\n          addedAt: iso(-7200000),\n        });\n\n        await putRecord('mastery', {\n          key: learningKey(bankId, questions[3].id),\n          bankId,\n          questionId: questions[3].id,\n          status: 'unfamiliar',\n          markedAt: iso(-7200000),\n          updatedAt: iso(-7200000),\n        });\n      }\n    }\n\n    // Attempts across today and previous days.\n    for (let i = 0; i < Math.min(bankIds.length, 8); i += 1) {\n      const bankId = bankIds[i];\n      for (let q = 1; q <= Math.min(questionsPerBank, 6); q += 1) {\n        const questionId = `Q${String(q).padStart(3, '0')}`;\n        await putRecord('attempts', {\n          bankId,\n          questionId,\n          questionKey: questionKey(bankId, questionId),\n          timestamp: iso(-(i % 5) * 86400000 - q * 120000),\n          selectedAnswer: ['A'],\n          correct: q % 3 !== 0,\n          responseTime: 1500 + q * 100,\n          mode: q % 4 === 0 ? 'wrong' : 'filtered',\n        });\n      }\n    }\n\n    await putRecord('learningGoals', {\n      id: 'global',\n      bankId: null,\n      enabled: true,\n      dailyPracticeTarget: 10,\n      dailyReviewTarget: 4,\n      examDate: null,\n      examLabel: '',\n      sprintEnabled: false,\n      sprintBankIds: [],\n      sprintDailyTarget: 0,\n      createdAt: iso(-86400000 * 10),\n      updatedAt: iso(-3600000),\n    });\n\n    await putRecord('learningGoals', {\n      id: 'exam-sprint',\n      bankId: null,\n      enabled: false,\n      dailyPracticeTarget: 0,\n      dailyReviewTarget: 0,\n      examDate: futureDate(14),\n      examLabel: 'RC1 期末模擬',\n      sprintEnabled: true,\n      sprintBankIds: bankIds.slice(0, Math.min(3, bankIds.length)),\n      sprintDailyTarget: 8,\n      createdAt: iso(-86400000 * 5),\n      updatedAt: iso(-1800000),\n    });\n\n    if (bankIds[0]) {\n      const sourceQuestionIds = Array.from(\n        { length: Math.min(questionsPerBank, 6) },\n        (_, i) => `Q${String(i + 1).padStart(3, '0')}`,\n      );\n      await putRecord('sessions', {\n        id: 'practice-rc1-resume',\n        bankId: bankIds[0],\n        bankName: `RC1 測試題庫 1`,\n        mode: 'filtered',\n        sourceQuestionIds,\n        queue: sourceQuestionIds.slice(2),\n        completedIds: sourceQuestionIds.slice(0, 2),\n        errorsByQuestion: {},\n        attemptCount: 2,\n        wrongCount: 0,\n        currentQuestionId: null,\n        answered: false,\n        startedAt: iso(-7200000),\n        updatedAt: iso(-600000),\n        finishedAt: null,\n      });\n    }\n\n    localStorage.setItem('moxin.v4.backup.meta', JSON.stringify({\n      lastFullBackupAt: iso(-86400000 * 9),\n    }));\n  }, { bankCount, questionsPerBank, longText });\n\n  await page.reload({ waitUntil: 'domcontentloaded' });\n  await waitReady(page);\n}\n\nasync function setVisualProfile(page, profile) {\n  await page.evaluate(profile => {\n    const raw = localStorage.getItem('moxin.v3.settings');\n    let current = {};\n    try { current = raw ? JSON.parse(raw) : {}; } catch {}\n    localStorage.setItem('moxin.v3.settings', JSON.stringify({\n      ...current,\n      theme: profile.theme,\n      fontScale: 'normal',\n      optionSpacing: 'normal',\n      reduceMotion: true,\n      learningStyle: profile.learningStyle,\n      sceneIntensity: profile.sceneIntensity,\n      studioTypeSwitchConfirm: true,\n    }));\n  }, profile);\n  await page.reload({ waitUntil: 'domcontentloaded' });\n  await waitReady(page);\n}\n\nasync function auditLayout(page, scope, { mobile = false } = {}) {\n  const result = await page.evaluate(() => {\n    const visible = el => {\n      const style = getComputedStyle(el);\n      const rect = el.getBoundingClientRect();\n      return style.display !== 'none' &&\n        style.visibility !== 'hidden' &&\n        rect.width > 0 &&\n        rect.height > 0;\n    };\n\n    const documentOverflow = Math.max(\n      document.documentElement.scrollWidth,\n      document.body.scrollWidth,\n    ) - window.innerWidth;\n\n    const keySelectors = [\n      '.app-header',\n      '.main-nav',\n      '[data-view]:not([hidden])',\n      '.learning-hero',\n      '.home-dashboard',\n      '.learning-hub-tabs',\n      '.stats-tabs',\n      '.studio-r1-layout',\n      '.practice-focus-shell',\n      '.exam-focus-shell',\n    ];\n\n    const outOfViewport = [];\n    for (const selector of keySelectors) {\n      document.querySelectorAll(selector).forEach(el => {\n        if (!visible(el)) return;\n        const rect = el.getBoundingClientRect();\n        if (rect.left < -4 || rect.right > window.innerWidth + 4) {\n          outOfViewport.push({\n            selector,\n            left: Math.round(rect.left),\n            right: Math.round(rect.right),\n            width: Math.round(rect.width),\n          });\n        }\n      });\n    }\n\n    const smallTargets = [];\n    for (const el of document.querySelectorAll(\n      'button, a.button, .nav-item, summary, select, input[type=\"text\"], input[type=\"search\"], input[type=\"number\"]'\n    )) {\n      if (!visible(el) || el.disabled) continue;\n      const rect = el.getBoundingClientRect();\n      if (rect.width < 32 || rect.height < 32) {\n        smallTargets.push({\n          text: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 80),\n          width: Math.round(rect.width),\n          height: Math.round(rect.height),\n        });\n      }\n    }\n\n    const activeView = document.querySelector('[data-view]:not([hidden])')?.id || null;\n\n    return {\n      width: window.innerWidth,\n      height: window.innerHeight,\n      docWidth: document.documentElement.scrollWidth,\n      bodyWidth: document.body.scrollWidth,\n      documentOverflow,\n      outOfViewport,\n      smallTargets: smallTargets.slice(0, 20),\n      activeView,\n    };\n  });\n\n  if (result.documentOverflow > 4) {\n    addFailure(scope, `Document horizontally overflows viewport by ${result.documentOverflow}px`, result);\n  }\n  if (result.outOfViewport.length) {\n    addFailure(scope, 'Key UI block extends outside viewport', result.outOfViewport);\n  }\n  if (mobile && result.smallTargets.length) {\n    addWarning(scope, `${result.smallTargets.length} visible targets are under 32px in one dimension`, result.smallTargets);\n  }\n  return result;\n}\n\nasync function auditA11y(page, scope) {\n  const report = await new AxeBuilder({ page })\n    .exclude('.learning-hero-art')\n    .analyze();\n\n  for (const violation of report.violations) {\n    const entry = {\n      id: violation.id,\n      impact: violation.impact,\n      description: violation.description,\n      nodes: violation.nodes.slice(0, 4).map(node => node.target),\n    };\n\n    if (\n      violation.impact === 'critical' ||\n      (violation.impact === 'serious' && FAIL_A11Y_RULES.has(violation.id))\n    ) {\n      addFailure(scope, `Accessibility ${violation.impact}: ${violation.id}`, entry);\n    } else if (['serious', 'moderate'].includes(violation.impact)) {\n      addWarning(scope, `Accessibility ${violation.impact}: ${violation.id}`, entry);\n    }\n  }\n}\n\nasync function snap(page, scope, name) {\n  const filename = `${sanitize(scope)}__${sanitize(name)}.png`;\n  await page.screenshot({\n    path: path.join(SCREEN_DIR, filename),\n    fullPage: true,\n    animations: 'disabled',\n  });\n}\n\nasync function navigateAndAudit(page, selector, targetSelector, scope, label, options = {}) {\n  const started = Date.now();\n  await page.locator(selector).first().click();\n  await page.waitForSelector(targetSelector, { state: 'visible', timeout: 15000 });\n  const elapsed = Date.now() - started;\n  addMetric(scope, `navigate-${label}`, elapsed);\n  if (elapsed > 5000) addFailure(scope, `${label} navigation took ${elapsed} ms`);\n  else if (elapsed > 1800) addWarning(scope, `${label} navigation took ${elapsed} ms`);\n  await page.waitForTimeout(80);\n  await auditLayout(page, `${scope}:${label}`, options);\n}\n\nasync function runNewUser(browser) {\n  const scope = 'new-user';\n  const context = await browser.newContext({\n    viewport: { width: 390, height: 844 },\n    colorScheme: 'light',\n    serviceWorkers: 'block',\n  });\n  const page = await context.newPage();\n  attachRuntimeObservers(page, scope);\n\n  await loadPage(page, scope);\n  await auditLayout(page, `${scope}:library`, { mobile: true });\n  assert.equal(await page.locator('#libraryView').isVisible(), true);\n  await snap(page, scope, 'library-empty');\n\n  await navigateAndAudit(page, '[data-nav-review]', '#reviewView:not([hidden])', scope, 'review', { mobile: true });\n  await snap(page, scope, 'review-empty');\n\n  await navigateAndAudit(page, '[data-nav-exam]', '#examCenterView:not([hidden])', scope, 'exam', { mobile: true });\n  await snap(page, scope, 'exam-empty');\n\n  await navigateAndAudit(page, '[data-nav-stats]', '#statsView:not([hidden])', scope, 'stats', { mobile: true });\n  await snap(page, scope, 'stats-empty');\n\n  await navigateAndAudit(page, '[data-nav-tools]', '#toolsView:not([hidden])', scope, 'studio', { mobile: true });\n  await snap(page, scope, 'studio');\n\n  await navigateAndAudit(page, '[data-nav-settings]', '#settingsView:not([hidden])', scope, 'settings', { mobile: true });\n  await auditA11y(page, `${scope}:settings`);\n  await snap(page, scope, 'settings');\n\n  scenarios.push({ scope, status: 'completed' });\n  await context.close();\n}\n\nasync function runReturningUser(browser) {\n  const scope = 'returning-user';\n  const context = await browser.newContext({\n    viewport: { width: 1366, height: 768 },\n    colorScheme: 'light',\n    serviceWorkers: 'block',\n    acceptDownloads: true,\n  });\n  const page = await context.newPage();\n  attachRuntimeObservers(page, scope);\n\n  await loadPage(page, scope);\n  await seedStandard(page, { bankCount: 3, questionsPerBank: 12 });\n\n  await page.locator('[data-nav-library]').first().click();\n  await page.waitForSelector('#libraryView:not([hidden])');\n  await page.waitForSelector('[data-home-resume-bank]');\n  await auditLayout(page, `${scope}:home`);\n  await auditA11y(page, `${scope}:home`);\n  await snap(page, scope, 'home');\n\n  // Resume a real unfinished practice session and submit one answer.\n  await page.locator('[data-home-resume-bank]').click();\n  await page.waitForSelector('#practiceView:not([hidden])');\n  await page.waitForSelector('[data-answer-form]');\n  await auditLayout(page, `${scope}:practice`);\n  await snap(page, scope, 'practice-resume');\n\n  const answerInput = page.locator('[data-answer-form] input[name=\"answer\"]').first();\n  if (await answerInput.count()) {\n    await answerInput.check();\n    await page.locator('[data-submit-answer]').click();\n    await page.waitForSelector('[data-feedback-area] .feedback-panel', { timeout: 10000 });\n    await auditLayout(page, `${scope}:practice-feedback`);\n    await snap(page, scope, 'practice-feedback');\n  } else {\n    addFailure(scope, 'Practice question did not render an answer input.');\n  }\n\n  // Learning Hub tabs.\n  page.once('dialog', dialog => dialog.accept());\n  await page.locator('[data-exit-practice]').click();\n  await page.waitForSelector('#bankDetailView:not([hidden])');\n  await navigateAndAudit(page, '[data-nav-review]', '#reviewView:not([hidden])', scope, 'learning-hub');\n  for (const tab of ['overview', 'review', 'goals', 'sprint']) {\n    await page.locator(`[data-learning-hub-tab=\"${tab}\"]`).first().click();\n    await page.waitForTimeout(100);\n    await auditLayout(page, `${scope}:hub-${tab}`);\n    await snap(page, scope, `hub-${tab}`);\n  }\n\n  // Statistics tabs and controls.\n  await navigateAndAudit(page, '[data-nav-stats]', '#statsView:not([hidden])', scope, 'statistics');\n  for (const tab of ['overview', 'trends', 'weakness', 'banks']) {\n    await page.locator(`[data-stats-tab=\"${tab}\"]`).first().click();\n    await page.waitForTimeout(100);\n    await auditLayout(page, `${scope}:stats-${tab}`);\n    if (tab === 'trends') {\n      const window30 = page.locator('[data-stats-window=\"30\"]');\n      if (await window30.count()) {\n        await window30.click();\n        await page.waitForTimeout(100);\n      }\n      const scopeSelect = page.locator('[data-stats-scope]');\n      if (await scopeSelect.count()) {\n        await scopeSelect.selectOption('rc1-bank-01');\n        await page.waitForTimeout(100);\n      }\n    }\n    await snap(page, scope, `stats-${tab}`);\n  }\n\n  await auditA11y(page, `${scope}:statistics`);\n\n  // Start a real exam and inspect the in-exam layout.\n  await navigateAndAudit(page, '[data-nav-exam]', '#examCenterView:not([hidden])', scope, 'exam-center');\n  const startExam = page.locator('[data-start-exam=\"rc1-bank-01\"]');\n  if (await startExam.count()) {\n    await startExam.click();\n    await page.waitForSelector('#examView:not([hidden])', { timeout: 10000 });\n    await auditLayout(page, `${scope}:exam-running`);\n    await snap(page, scope, 'exam-running');\n\n    // Settings should be blocked while exam is running.\n    await page.locator('[data-nav-settings]').first().click();\n    await page.waitForTimeout(120);\n    if (await page.locator('#settingsView:not([hidden])').count()) {\n      addFailure(scope, 'Settings opened while an exam was active.');\n    }\n  } else {\n    addFailure(scope, 'Could not find start exam action for seeded bank.');\n  }\n\n  scenarios.push({ scope, status: 'completed' });\n  await context.close();\n}\n\nasync function runViewportMatrix(browser) {\n  const scope = 'viewport-matrix';\n  for (const viewport of viewports) {\n    const mobile = viewport.width <= 620;\n    const context = await browser.newContext({\n      viewport: { width: viewport.width, height: viewport.height },\n      colorScheme: 'dark',\n      serviceWorkers: 'block',\n      hasTouch: mobile,\n      isMobile: mobile,\n    });\n    const page = await context.newPage();\n    attachRuntimeObservers(page, `${scope}:${viewport.name}`);\n    await loadPage(page, `${scope}:${viewport.name}`);\n    await seedStandard(page, { bankCount: 3, questionsPerBank: 12, longText: true });\n    await setVisualProfile(page, {\n      theme: 'dark',\n      learningStyle: 'epic',\n      sceneIntensity: 'full',\n    });\n\n    await auditLayout(page, `${scope}:${viewport.name}:home`, { mobile });\n    await snap(page, scope, `${viewport.name}-home`);\n\n    await navigateAndAudit(\n      page,\n      '[data-nav-review]',\n      '#reviewView:not([hidden])',\n      `${scope}:${viewport.name}`,\n      'review',\n      { mobile },\n    );\n    await snap(page, scope, `${viewport.name}-review`);\n\n    await navigateAndAudit(\n      page,\n      '[data-nav-stats]',\n      '#statsView:not([hidden])',\n      `${scope}:${viewport.name}`,\n      'stats',\n      { mobile },\n    );\n    await snap(page, scope, `${viewport.name}-stats`);\n\n    if (mobile || viewport.name === 'desktop') {\n      await auditA11y(page, `${scope}:${viewport.name}:stats`);\n    }\n\n    await context.close();\n  }\n\n  scenarios.push({ scope, status: 'completed', count: viewports.length });\n}\n\nasync function runVisualProfiles(browser) {\n  const scope = 'visual-profiles';\n\n  for (const viewport of [\n    { name: 'mobile', width: 390, height: 844 },\n    { name: 'desktop', width: 1366, height: 768 },\n  ]) {\n    for (const profile of visualProfiles) {\n      const mobile = viewport.width <= 620;\n      const caseScope = `${scope}:${viewport.name}:${profile.name}`;\n      const context = await browser.newContext({\n        viewport: { width: viewport.width, height: viewport.height },\n        colorScheme: profile.theme,\n        serviceWorkers: 'block',\n        hasTouch: mobile,\n        isMobile: mobile,\n      });\n      const page = await context.newPage();\n      attachRuntimeObservers(page, caseScope);\n      await loadPage(page, caseScope);\n      await seedStandard(page, { bankCount: 2, questionsPerBank: 8 });\n      await setVisualProfile(page, profile);\n\n      const dataset = await page.evaluate(() => ({\n        theme: document.documentElement.dataset.theme,\n        style: document.documentElement.dataset.learningStyle,\n        intensity: document.documentElement.dataset.sceneIntensity,\n      }));\n\n      if (\n        dataset.theme !== profile.theme ||\n        dataset.style !== profile.learningStyle ||\n        dataset.intensity !== profile.sceneIntensity\n      ) {\n        addFailure(caseScope, 'Visual profile dataset does not match saved settings.', { expected: profile, actual: dataset });\n      }\n\n      await auditLayout(page, `${caseScope}:home`, { mobile });\n      await snap(page, scope, `${viewport.name}-${profile.name}-home`);\n      await context.close();\n    }\n  }\n\n  scenarios.push({ scope, status: 'completed', count: visualProfiles.length * 2 });\n}\n\nasync function runHeavyLibrary(browser) {\n  const scope = 'heavy-library';\n  const context = await browser.newContext({\n    viewport: { width: 390, height: 844 },\n    colorScheme: 'light',\n    serviceWorkers: 'block',\n    hasTouch: true,\n    isMobile: true,\n  });\n  const page = await context.newPage();\n  attachRuntimeObservers(page, scope);\n\n  await loadPage(page, scope);\n  const seedStarted = Date.now();\n  await seedStandard(page, { bankCount: 36, questionsPerBank: 10 });\n  addMetric(scope, 'seed-36-banks-360-questions', Date.now() - seedStarted);\n\n  await auditLayout(page, `${scope}:home`, { mobile: true });\n  await snap(page, scope, 'home-36-banks');\n\n  const reviewStarted = Date.now();\n  await page.locator('[data-nav-review]').first().click();\n  await page.waitForSelector('#reviewView:not([hidden])', { timeout: 30000 });\n  const reviewMs = Date.now() - reviewStarted;\n  addMetric(scope, 'open-learning-hub-36-banks', reviewMs);\n  if (reviewMs > 7000) addFailure(scope, `Learning Hub with 36 banks took ${reviewMs} ms`);\n  else if (reviewMs > 3000) addWarning(scope, `Learning Hub with 36 banks took ${reviewMs} ms`);\n\n  await page.locator('[data-learning-hub-tab=\"sprint\"]').first().click();\n  await page.waitForTimeout(100);\n  const search = page.locator('[data-exam-sprint-bank-search]');\n  if (!(await search.count())) {\n    addFailure(scope, 'P4 bank search is missing with 36 local banks.');\n  } else {\n    await search.fill('36');\n    const visibleOptions = await page.locator('[data-exam-sprint-bank-option]:visible').count();\n    if (visibleOptions < 1) addFailure(scope, 'P4 large-bank search returned no visible result for \"36\".');\n  }\n\n  await auditLayout(page, `${scope}:sprint`, { mobile: true });\n  await snap(page, scope, 'sprint-36-banks');\n\n  const statsStarted = Date.now();\n  await page.locator('[data-nav-stats]').first().click();\n  await page.waitForSelector('#statsView:not([hidden])', { timeout: 30000 });\n  const statsMs = Date.now() - statsStarted;\n  addMetric(scope, 'open-statistics-36-banks', statsMs);\n  if (statsMs > 7000) addFailure(scope, `Statistics with 36 banks took ${statsMs} ms`);\n  else if (statsMs > 3000) addWarning(scope, `Statistics with 36 banks took ${statsMs} ms`);\n\n  await auditLayout(page, `${scope}:stats`, { mobile: true });\n  await snap(page, scope, 'stats-36-banks');\n\n  scenarios.push({ scope, status: 'completed' });\n  await context.close();\n}\n\nasync function runBackupRoundTrip(browser) {\n  const scope = 'backup-roundtrip';\n  let backupPath = null;\n\n  {\n    const context = await browser.newContext({\n      viewport: { width: 1024, height: 768 },\n      serviceWorkers: 'block',\n      acceptDownloads: true,\n    });\n    const page = await context.newPage();\n    attachRuntimeObservers(page, `${scope}:export`);\n    await loadPage(page, `${scope}:export`);\n    await seedStandard(page, { bankCount: 2, questionsPerBank: 8 });\n\n    await page.locator('[data-nav-settings]').first().click();\n    await page.waitForSelector('#settingsView:not([hidden])');\n\n    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });\n    await page.locator('[data-export-backup]').click();\n    const download = await downloadPromise;\n    backupPath = path.join(OUT_DIR, 'rc1-full-backup.json');\n    await download.saveAs(backupPath);\n\n    if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size < 200) {\n      addFailure(scope, 'Full backup download was not created or was unexpectedly small.');\n    }\n\n    const meta = await page.evaluate(() => localStorage.getItem('moxin.v4.backup.meta'));\n    if (!meta || !meta.includes('lastFullBackupAt')) {\n      addFailure(scope, 'Successful full backup did not update backup metadata.');\n    }\n\n    await context.close();\n  }\n\n  if (!backupPath || !fs.existsSync(backupPath)) {\n    scenarios.push({ scope, status: 'failed-before-restore' });\n    return;\n  }\n\n  {\n    const context = await browser.newContext({\n      viewport: { width: 1024, height: 768 },\n      serviceWorkers: 'block',\n    });\n    const page = await context.newPage();\n    attachRuntimeObservers(page, `${scope}:restore`);\n    page.on('dialog', async dialog => {\n      await dialog.accept();\n    });\n\n    await loadPage(page, `${scope}:restore`);\n    await page.locator('[data-nav-settings]').first().click();\n    await page.waitForSelector('#settingsView:not([hidden])');\n\n    await page.locator('[data-import-backup]').setInputFiles(backupPath);\n    await page.waitForTimeout(1200);\n    await waitReady(page);\n\n    await page.locator('[data-nav-library]').first().click();\n    await page.waitForSelector('#libraryView:not([hidden])');\n    await page.locator('[data-library-source-tab=\"user\"]').click();\n    await page.waitForTimeout(120);\n\n    const restoredBank = page.locator('[data-open-bank=\"rc1-bank-01\"]');\n    if (!(await restoredBank.count())) {\n      addFailure(scope, 'Restored backup does not contain the seeded user bank.');\n    }\n\n    await auditLayout(page, `${scope}:restored`);\n    await snap(page, scope, 'restored-library');\n    await context.close();\n  }\n\n  scenarios.push({ scope, status: 'completed' });\n}\n\nasync function runV2Migration(browser) {\n  const scope = 'v3.3-to-v4-migration';\n  const context = await browser.newContext({\n    viewport: { width: 1024, height: 768 },\n    serviceWorkers: 'block',\n  });\n  const page = await context.newPage();\n  attachRuntimeObservers(page, scope);\n\n  // Establish the same origin without booting the application.\n  await page.goto(new URL('docs/V4_0_PLAN.md', BASE_URL).href, { waitUntil: 'domcontentloaded' });\n\n  await page.evaluate(async () => {\n    await new Promise((resolve, reject) => {\n      const deleteRequest = indexedDB.deleteDatabase('moxin-quiz-v3');\n      deleteRequest.onsuccess = () => resolve();\n      deleteRequest.onerror = () => reject(deleteRequest.error);\n      deleteRequest.onblocked = () => reject(new Error('v2 seed database delete blocked'));\n    });\n\n    const db = await new Promise((resolve, reject) => {\n      const request = indexedDB.open('moxin-quiz-v3', 2);\n      request.onupgradeneeded = () => {\n        const db = request.result;\n        const defs = {\n          banks: { keyPath: 'id', indexes: [['updatedAt', 'updatedAt'], ['name', 'name']] },\n          questions: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['questionId', 'questionId'], ['chapter', 'chapter']] },\n          assets: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['path', 'path']] },\n          attempts: { keyPath: 'id', autoIncrement: true, indexes: [['bankId', 'bankId'], ['questionKey', 'questionKey'], ['timestamp', 'timestamp']] },\n          progress: { keyPath: 'key', indexes: [['bankId', 'bankId']] },\n          favorites: { keyPath: 'key', indexes: [['bankId', 'bankId']] },\n          notes: { keyPath: 'key', indexes: [['bankId', 'bankId']] },\n          mastery: { keyPath: 'key', indexes: [['bankId', 'bankId']] },\n          reviewSchedule: { keyPath: 'key', indexes: [['bankId', 'bankId'], ['dueAt', 'dueAt']] },\n          sessions: { keyPath: 'id', indexes: [['bankId', 'bankId'], ['updatedAt', 'updatedAt']] },\n        };\n\n        for (const [name, def] of Object.entries(defs)) {\n          const store = db.createObjectStore(name, {\n            keyPath: def.keyPath,\n            autoIncrement: def.autoIncrement === true,\n          });\n          for (const [indexName, keyPath] of def.indexes) {\n            store.createIndex(indexName, keyPath);\n          }\n        }\n      };\n      request.onsuccess = () => resolve(request.result);\n      request.onerror = () => reject(request.error);\n    });\n\n    const now = new Date().toISOString();\n    const tx = db.transaction(\n      ['banks', 'questions', 'attempts', 'progress', 'favorites', 'notes', 'mastery', 'reviewSchedule', 'sessions'],\n      'readwrite',\n    );\n\n    tx.objectStore('banks').put({\n      id: 'legacy-bank',\n      schemaVersion: '2.0',\n      name: 'v3.3 舊題庫',\n      version: '3.3.0',\n      questionCount: 1,\n      sourceType: 'user',\n      storedAt: now,\n      updatedAt: now,\n    });\n\n    tx.objectStore('questions').put({\n      key: 'legacy-bank::Q001',\n      bankId: 'legacy-bank',\n      questionId: 'Q001',\n      id: 'Q001',\n      type: 'single-choice',\n      question: '舊版題目',\n      options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],\n      answer: ['A'],\n      explanation: '舊版詳解',\n      chapter: '舊章節',\n      tags: ['legacy'],\n      difficulty: 2,\n      images: [],\n      explanationImages: [],\n    });\n\n    tx.objectStore('attempts').add({\n      bankId: 'legacy-bank',\n      questionId: 'Q001',\n      questionKey: 'legacy-bank::Q001',\n      timestamp: now,\n      selectedAnswer: ['A'],\n      correct: true,\n      responseTime: 1200,\n      mode: 'filtered',\n    });\n\n    tx.objectStore('progress').put({\n      key: 'legacy-bank::Q001',\n      bankId: 'legacy-bank',\n      questionId: 'Q001',\n      attempts: 1,\n      correctCount: 1,\n      wrongCount: 0,\n      lastResult: 'correct',\n      lastAnsweredAt: now,\n    });\n\n    tx.objectStore('favorites').put({\n      key: 'legacy-bank::Q001',\n      bankId: 'legacy-bank',\n      questionId: 'Q001',\n      addedAt: now,\n    });\n\n    tx.objectStore('notes').put({\n      key: 'legacy-bank::Q001',\n      bankId: 'legacy-bank',\n      questionId: 'Q001',\n      text: '舊版筆記',\n      updatedAt: now,\n    });\n\n    tx.objectStore('mastery').put({\n      key: 'legacy-bank::Q001',\n      bankId: 'legacy-bank',\n      questionId: 'Q001',\n      status: 'unfamiliar',\n      markedAt: now,\n      updatedAt: now,\n    });\n\n    tx.objectStore('reviewSchedule').put({\n      key: 'legacy-bank::Q001',\n      bankId: 'legacy-bank',\n      questionId: 'Q001',\n      level: 1,\n      dueAt: now,\n      updatedAt: now,\n    });\n\n    tx.objectStore('sessions').put({\n      id: 'legacy-session',\n      bankId: 'legacy-bank',\n      bankName: 'v3.3 舊題庫',\n      mode: 'filtered',\n      sourceQuestionIds: ['Q001'],\n      queue: ['Q001'],\n      completedIds: [],\n      errorsByQuestion: {},\n      attemptCount: 0,\n      wrongCount: 0,\n      currentQuestionId: null,\n      answered: false,\n      startedAt: now,\n      updatedAt: now,\n      finishedAt: null,\n    });\n\n    await new Promise((resolve, reject) => {\n      tx.oncomplete = () => resolve();\n      tx.onerror = () => reject(tx.error);\n      tx.onabort = () => reject(tx.error);\n    });\n    db.close();\n\n    localStorage.setItem('moxin.v3.settings', JSON.stringify({\n      theme: 'dark',\n      fontScale: 'large',\n      optionSpacing: 'comfortable',\n      reduceMotion: true,\n      learningStyle: 'academy',\n      sceneIntensity: 'reduced',\n      studioTypeSwitchConfirm: true,\n    }));\n  });\n\n  await loadPage(page, scope);\n\n  const migrationState = await page.evaluate(async () => {\n    const { openDatabase, getRecord } = await import('/src/storage/db.js');\n    const { getBank, getQuestion } = await import('/src/storage/repositories/banks.js');\n    const { getFavorite, getNote, getUnfamiliar } = await import('/src/storage/repositories/learning.js');\n    const db = await openDatabase();\n\n    return {\n      version: db.version,\n      hasStudioDrafts: db.objectStoreNames.contains('studioDrafts'),\n      hasLearningGoals: db.objectStoreNames.contains('learningGoals'),\n      bank: await getBank('legacy-bank'),\n      question: await getQuestion('legacy-bank', 'Q001'),\n      favorite: await getFavorite('legacy-bank', 'Q001'),\n      note: await getNote('legacy-bank', 'Q001'),\n      unfamiliar: await getUnfamiliar('legacy-bank', 'Q001'),\n      session: await getRecord('sessions', 'legacy-session'),\n      settings: JSON.parse(localStorage.getItem('moxin.v3.settings') || '{}'),\n    };\n  });\n\n  if (migrationState.version !== 3) addFailure(scope, `Expected DB version 3 after upgrade, got ${migrationState.version}`);\n  if (!migrationState.hasStudioDrafts || !migrationState.hasLearningGoals) {\n    addFailure(scope, 'DB upgrade did not add v4 stores.', migrationState);\n  }\n  for (const key of ['bank', 'question', 'favorite', 'note', 'unfamiliar', 'session']) {\n    if (!migrationState[key]) addFailure(scope, `Legacy record missing after v2 → v3 upgrade: ${key}`);\n  }\n  if (migrationState.settings.theme !== 'dark' || migrationState.settings.fontScale !== 'large') {\n    addFailure(scope, 'Legacy UI settings were not preserved.', migrationState.settings);\n  }\n\n  await page.locator('[data-library-source-tab=\"user\"]').click();\n  await page.waitForTimeout(120);\n  if (!(await page.locator('[data-open-bank=\"legacy-bank\"]').count())) {\n    addFailure(scope, 'Legacy bank is not visible in the v4 user library after upgrade.');\n  }\n\n  await auditLayout(page, `${scope}:library`);\n  await snap(page, scope, 'migration-library');\n  scenarios.push({ scope, status: 'completed' });\n  await context.close();\n}\n\nasync function runOfflinePwa(browser) {\n  const scope = 'offline-pwa';\n  const context = await browser.newContext({\n    viewport: { width: 390, height: 844 },\n    colorScheme: 'dark',\n    serviceWorkers: 'allow',\n  });\n  const page = await context.newPage();\n  attachRuntimeObservers(page, scope);\n\n  await loadPage(page, scope);\n  await seedStandard(page, { bankCount: 2, questionsPerBank: 8 });\n\n  await page.evaluate(async () => {\n    if ('serviceWorker' in navigator) {\n      await navigator.serviceWorker.ready;\n    }\n  });\n  await page.reload({ waitUntil: 'networkidle' }).catch(() => {});\n  await waitReady(page);\n\n  await context.setOffline(true);\n  try {\n    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });\n    await waitReady(page);\n    await auditLayout(page, `${scope}:offline`, { mobile: true });\n    await snap(page, scope, 'offline-library');\n  } catch (error) {\n    addFailure(scope, `Offline reload failed: ${error.message}`);\n  } finally {\n    await context.setOffline(false);\n  }\n\n  scenarios.push({ scope, status: 'completed' });\n  await context.close();\n}\n\nasync function writeReport() {\n  const report = {\n    generatedAt: new Date().toISOString(),\n    baseUrl: BASE_URL,\n    failures,\n    warnings,\n    metrics,\n    scenarios,\n    summary: {\n      failures: failures.length,\n      warnings: warnings.length,\n      metrics: metrics.length,\n      scenarios: scenarios.length,\n    },\n  };\n\n  fs.writeFileSync(\n    path.join(OUT_DIR, 'report.json'),\n    JSON.stringify(report, null, 2),\n    'utf8',\n  );\n\n  const metricRows = metrics\n    .sort((a, b) => b.value - a.value)\n    .slice(0, 30)\n    .map(item => `| ${item.scope} | ${item.name} | ${item.value} ${item.unit} |`)\n    .join('\\n');\n\n  const failureText = failures.length\n    ? failures.map((item, i) =>\n        `${i + 1}. **${item.scope}** — ${item.message}${item.detail ? `\\n   - \\`${JSON.stringify(item.detail).slice(0, 800)}\\`` : ''}`\n      ).join('\\n')\n    : 'None.';\n\n  const warningText = warnings.length\n    ? warnings.map((item, i) =>\n        `${i + 1}. **${item.scope}** — ${item.message}${item.detail ? `\\n   - \\`${JSON.stringify(item.detail).slice(0, 800)}\\`` : ''}`\n      ).join('\\n')\n    : 'None.';\n\n  const markdown = `# RC1 Browser UX Audit\n\nGenerated: ${report.generatedAt}\n\n## Result\n\n- Failures: **${failures.length}**\n- Warnings: **${warnings.length}**\n- Scenarios: **${scenarios.length}**\n- Screenshots: **${fs.readdirSync(SCREEN_DIR).length}**\n\n## Hard failures\n\n${failureText}\n\n## Warnings\n\n${warningText}\n\n## Slowest measured operations\n\n| Scope | Operation | Time |\n|---|---|---:|\n${metricRows || '| — | — | — |'}\n\n## Executed user simulations\n\n- New user / empty data\n- Returning learner / resume practice / answer feedback\n- Learning Hub 4-tab navigation\n- Statistics 4-tab navigation + 7/30 day + bank scope\n- Running exam + settings lockout\n- 7 viewport sizes\n- Academy / Epic / Focus × Light / Dark representative profiles\n- 36-bank / 360-question heavy local library\n- Full backup export → fresh browser restore\n- v3.3-style IndexedDB v2 → v4 DB v3 upgrade\n- PWA offline reload\n\n`;\n\n  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), markdown, 'utf8');\n  console.log(markdown);\n}\n\nconst browser = await chromium.launch({\n  headless: true,\n});\n\nconst scenarioRuns = [\n  ['new-user', runNewUser],\n  ['returning-user', runReturningUser],\n  ['viewport-matrix', runViewportMatrix],\n  ['visual-profiles', runVisualProfiles],\n  ['heavy-library', runHeavyLibrary],\n  ['backup-roundtrip', runBackupRoundTrip],\n  ['v3.3-to-v4-migration', runV2Migration],\n  ['offline-pwa', runOfflinePwa],\n];\n\ntry {\n  for (const [name, runner] of scenarioRuns) {\n    try {\n      await runner(browser);\n    } catch (error) {\n      addFailure(name, `Scenario crashed: ${error.message}`, error.stack);\n    }\n  }\n} finally {\n  await browser.close();\n  await writeReport();\n}\n\nif (failures.length) {\n  console.error(`RC1 browser UX audit failed with ${failures.length} hard failure(s).`);\n  process.exit(1);\n}\n\nconsole.log(`RC1 browser UX audit passed with ${warnings.length} warning(s).`);\n";
const DOC = "# 墨忻刷題網 v4.0 — RC1 Browser UX Audit\n\n## 目的\n\nRC1 不再只依賴 unit / structural regression。\n\n此階段會用真正的 Chromium + Playwright，以使用者操作方式啟動本機網站、點擊導覽、切換分頁、作答、開始模擬考、備份、還原與離線重載。\n\n每次 workflow 都由 GitHub Actions checkout 真正的 `v4.0-learning-studio`，再啟動本機 HTTP server，因此測試的是完整 repository，而不是 mock UI。\n\n## 使用者情境\n\n### 1. 新使用者\n\n模擬完全沒有本機資料：\n\n```text\n我的題庫\n→ 今日學習\n→ 模擬考\n→ 學習統計\n→ 題庫工作室\n→ 設定\n```\n\n檢查 Empty State、導覽、Console / Page Error、水平溢位與 Accessibility。\n\n### 2. 回訪學習者\n\n建立代表性本機資料：\n\n- 3 個題庫\n- 四種題型\n- attempts\n- wrong / due / favorite / unfamiliar\n- Global learning goal\n- Exam sprint\n- unfinished Practice Session\n- 舊的 backup timestamp\n\n實際操作：\n\n```text\n首頁\n→ 繼續上次練習\n→ 作答\n→ Feedback\n→ 今日學習四個 Tab\n→ 學習統計四個 Tab\n→ 7 / 30 日\n→ Global / Bank scope\n→ 模擬考\n```\n\n### 3. 畫面尺寸矩陣\n\n固定測：\n\n- 320 × 568\n- 390 × 844\n- 844 × 390\n- 768 × 1024\n- 1024 × 768\n- 1366 × 768\n- 1920 × 1080\n\n每種尺寸至少檢查：\n\n- 我的題庫\n- 今日學習\n- 學習統計\n\nHard gate：\n\n```text\ndocument 不得產生水平 overflow\n主要 UI block 不得跑出 viewport\n```\n\n手機另外記錄小於 32px 的可操作目標，列為 warning。\n\n## 視覺設定矩陣\n\n在 Mobile 與 Desktop 分別實際載入：\n\n- Academy / Light / Full\n- Academy / Dark / Reduced\n- Epic / Light / Full\n- Epic / Dark / Full\n- Focus / Light / Off\n- Focus / Dark / Off\n\n每組都保存 full-page screenshot artifact。\n\n## 大量資料\n\n建立：\n\n```text\n36 題庫\n360 題\n```\n\n實際測：\n\n- 首頁\n- Learning Hub\n- 考前衝刺題庫搜尋\n- Statistics\n\n並記錄導覽時間。\n\n超過 3 秒列 warning；超過 7 秒 hard fail。\n\n## v3.3 → v4.0 Migration\n\nBrowser test 會先手動建立 IndexedDB version 2，寫入：\n\n- banks\n- questions\n- attempts\n- progress\n- favorites\n- notes\n- mastery\n- reviewSchedule\n- unfinished session\n- UI settings\n\n之後才打開 v4.0。\n\n必須自動升成 DB version 3，且：\n\n- 舊資料仍存在\n- `studioDrafts`\n- `learningGoals`\n\n新 store 成功加入。\n\n## Backup Round Trip\n\n實際按：\n\n```text\n下載完整備份\n```\n\n取得 JSON 檔。\n\n再開一個全新 Browser Context：\n\n```text\n設定\n→ 從備份還原\n→ Confirm\n→ Reload\n```\n\n還原後原題庫必須重新出現。\n\n## Offline PWA\n\n允許 Service Worker：\n\n```text\nOnline load\n→ SW ready\n→ Reload\n→ Browser offline\n→ Reload\n```\n\n離線狀態仍必須開啟首頁並正常讀取 IndexedDB。\n\n## Accessibility\n\n使用 axe-core 實際掃描代表頁面。\n\nHard fail：\n\n- Critical\n- Serious button-name\n- Serious label\n- Serious ARIA contract\n- Serious color-contrast\n\n其他 serious / moderate 會留下 warning，等人工判斷是否需要阻擋正式版。\n\n## Artifact\n\n每次 workflow 都會上傳：\n\n```text\nrc1-browser-ux-audit\n├─ report.md\n├─ report.json\n├─ rc1-full-backup.json\n└─ screenshots/\n```\n\n即使 audit 失敗，也會保留 artifact 供後續分析。\n\n## RC1 原則\n\nBrowser UX Audit 全綠不代表立刻合併 `main`。\n\n它只是 RC1 的其中一個 gate；之後仍需：\n\n1. 整理 audit warnings\n2. 修復真正問題\n3. Release metadata cleanup\n4. Main cutover rehearsal\n";

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
}
function replaceOne(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error('Missing RC1 hardening anchor: ' + label);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error('RC1 hardening anchor is not unique: ' + label);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

write('tests/v40-rc1-browser-ux-run.mjs', BROWSER_TEST);
write('docs/V4_0_RC1_BROWSER_UX_AUDIT.md', DOC);

// First RC1 browser pass found genuine UX/accessibility issues.
// Fix the product, not just the audit.
{
  const path = 'styles/v4-design.css';
  let css = read(path);

  css = replaceOne(
    css,
    `  background: var(--accent-soft);
  color: var(--accent);
  font-size: .62rem;`,
    `  background: var(--accent-soft);
  color: color-mix(in srgb, var(--accent) 75%, var(--text));
  font-size: .62rem;`,
    'preview badge contrast',
  );

  css = replaceOne(
    css,
    `.nav-item.is-active {
  background: var(--primary-soft);
  color: var(--primary);
}

.nav-item.is-active::before {
  color: var(--primary);
}`,
    `.nav-item.is-active {
  background: var(--primary-soft);
  color: color-mix(in srgb, var(--primary) 75%, var(--text));
}

.nav-item.is-active::before {
  color: color-mix(in srgb, var(--primary) 75%, var(--text));
}`,
    'active nav contrast',
  );

  write(path, css);
}

{
  const path = 'src/ui/home-dashboard.js';
  let source = read(path);
  source = replaceOne(
    source,
    "<div class=\"home-goal-progress\" aria-label=\"今日目標進度 ${percent}%\">\n        <i style=\"width:${goal.configured ? percent : 0}%\"></i>\n      </div>",
    "<div\n        class=\"home-goal-progress\"\n        role=\"progressbar\"\n        aria-label=\"今日目標進度\"\n        aria-valuemin=\"0\"\n        aria-valuemax=\"100\"\n        aria-valuenow=\"${goal.configured ? percent : 0}\"\n      >\n        <i style=\"width:${goal.configured ? percent : 0}%\"></i>\n      </div>",
    'home progressbar ARIA contract',
  );
  write(path, source);
}

// Touch-target hardening from the first mobile pass.
{
  const path = 'styles/v4-learning.css';
  let css = read(path);
  css = replaceOne(
    css,
    `.learning-hero-quick-links button {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  padding: .42rem .62rem;`,
    `.learning-hero-quick-links button {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  min-height: 36px;
  padding: .42rem .62rem;`,
    'hero quick-link target size',
  );
  write(path, css);
}

{
  const path = 'styles/v4-home.css';
  let css = read(path);
  css = replaceOne(
    css,
    `.home-card-head button {
  border: 0;
  background: transparent;
  color: var(--learn-primary);
  font: inherit;
  font-size: .7rem;
  font-weight: 850;
  cursor: pointer;
}`,
    `.home-card-head button {
  min-height: 32px;
  padding: .32rem .28rem;
  border: 0;
  background: transparent;
  color: var(--learn-primary);
  font: inherit;
  font-size: .7rem;
  font-weight: 850;
  cursor: pointer;
}`,
    'home card header target size',
  );
  write(path, css);
}

{
  const path = 'styles/v4-learning-hub.css';
  let css = read(path);
  css = replaceOne(
    css,
    `.learning-hub-card-head button { border: 0; background: transparent; color: var(--learn-primary); font: inherit; font-size: .72rem; font-weight: 800; cursor: pointer; }`,
    `.learning-hub-card-head button { min-height: 32px; padding: .32rem .28rem; border: 0; background: transparent; color: var(--learn-primary); font: inherit; font-size: .72rem; font-weight: 800; cursor: pointer; }`,
    'learning hub card action target size',
  );
  write(path, css);
}

{
  const path = 'styles/v4-stats.css';
  let css = read(path);
  css = replaceOne(
    css,
    `.stats-inline-action {
  border: 0;
  background: transparent;
  color: var(--learn-primary);
  font: inherit;
  font-size: .74rem;
  font-weight: 800;
  cursor: pointer;
}`,
    `.stats-inline-action {
  min-height: 32px;
  padding: .32rem .28rem;
  border: 0;
  background: transparent;
  color: var(--learn-primary);
  font: inherit;
  font-size: .74rem;
  font-weight: 800;
  cursor: pointer;
}`,
    'statistics inline action target size',
  );
  write(path, css);
}

{
  const path = 'styles/v3-v33.css';
  let css = read(path);
  css = replaceOne(
    css,
    `.tools-prompt-details summary {
  cursor: pointer;
  font-weight: 800;
}`,
    `.tools-prompt-details summary {
  min-height: 32px;
  padding: .35rem 0;
  cursor: pointer;
  font-weight: 800;
}`,
    'tools prompt summary target size',
  );
  write(path, css);
}

// Runtime CSS / UI changed, so invalidate the App Shell.
{
  const path = 'service-worker.js';
  let sw = read(path);
  sw = replaceOne(
    sw,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-18';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-19';",
    'RC1 accessibility hardening cache revision',
  );
  write(path, sw);
}

// Long-term roadmap: RC1 starts after P5 Stable.
{
  const path = 'docs/V4_0_PLAN.md';
  let plan = read(path);

  if (!plan.includes('## RC1 — v4.0 Release Readiness')) {
    const anchor = '## 相容性要求';
    const section =
      '## RC1 — v4.0 Release Readiness\n\n' +
      '**狀態：In Progress**\n\n' +
      '- v3.3 → v4.0 IndexedDB upgrade simulation\n' +
      '- 完整備份 export / restore round trip\n' +
      '- 真實 Chromium 使用者流程\n' +
      '- Desktop / Tablet / Mobile viewport matrix\n' +
      '- Light / Dark × Academy / Epic / Focus visual matrix\n' +
      '- 大量題庫 / 長文字 / Empty State\n' +
      '- Accessibility / horizontal overflow / runtime error audit\n' +
      '- Offline PWA reload\n' +
      '- Release metadata cleanup\n' +
      '- Main cutover rehearsal\n\n';

    if (!plan.includes(anchor)) {
      throw new Error('RC1 roadmap insertion anchor missing');
    }
    plan = plan.replace(anchor, section + anchor);
  }

  write(path, plan);
}

// Add a reusable npm command. It is intentionally NOT part of npm test because
// Playwright is installed only by the RC1 browser-audit workflow.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  pkg.scripts['audit:browser'] = 'node tests/v40-rc1-browser-ux-run.mjs';
  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

// Changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);

  if (!changelog.includes('## RC1 — Browser UX Audit')) {
    const anchor = '## P5 Final Audit — Stable';
    const section =
      '## RC1 — Browser UX Audit\n' +
      '- 正式進入 v4.0 Release Readiness，不再新增功能主線。\n' +
      '- 新增真實 Chromium + Playwright 使用者流程 audit。\n' +
      '- 覆蓋 Empty / Returning / Heavy Library / Backup / Migration / Offline PWA。\n' +
      '- 建立 320×568 到 1920×1080 的 7 組 viewport matrix。\n' +
      '- 建立 Academy / Epic / Focus 與 Light / Dark / scene intensity 代表組合。\n' +
      '- 加入水平 overflow、主要區塊 viewport、runtime error、network error 與 axe-core accessibility gates。\n' +
      '- Browser audit screenshots / JSON / Markdown report 由 GitHub Actions artifact 保留。\n' +
      '- 第一輪 Browser Audit 修正 preview badge / active nav 對比、Home progressbar ARIA 與多個行動目標尺寸。\n' +
      '- Audit runner 改為單一 scenario 失敗不阻斷其餘 viewport / visual / migration / offline 測試。\n' +
      '- APP cache 更新至 r2k.5-19。\n\n';

    if (!changelog.includes(anchor)) {
      throw new Error('RC1 changelog insertion anchor missing');
    }
    changelog = changelog.replace(anchor, section + anchor);
  }

  write(path, changelog);
}

// Self-check.
{
  const test = read('tests/v40-rc1-browser-ux-run.mjs');
  const pkg = JSON.parse(read('package.json'));
  const plan = read('docs/V4_0_PLAN.md');

  for (const marker of [
    'runNewUser',
    'runReturningUser',
    'runViewportMatrix',
    'runVisualProfiles',
    'runHeavyLibrary',
    'runBackupRoundTrip',
    'runV2Migration',
    'runOfflinePwa',
    'AxeBuilder',
    '36, questionsPerBank: 10',
  ]) {
    if (!test.includes(marker)) {
      throw new Error('RC1 browser audit self-check failed: ' + marker);
    }
  }

  if (pkg.scripts['audit:browser'] !== 'node tests/v40-rc1-browser-ux-run.mjs') {
    throw new Error('RC1 browser audit npm script missing');
  }

  if (!plan.includes('## RC1 — v4.0 Release Readiness')) {
    throw new Error('RC1 roadmap section missing');
  }

  if (!read('styles/v4-design.css').includes('color-mix(in srgb, var(--accent) 75%, var(--text))')) {
    throw new Error('RC1 preview-badge contrast hardening missing');
  }
  if (!read('src/ui/home-dashboard.js').includes('role="progressbar"')) {
    throw new Error('RC1 home progressbar ARIA hardening missing');
  }
  if (!read('service-worker.js').includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-19'")) {
    throw new Error('RC1 cache revision missing');
  }

  if (read('index.html') !== read('v3.html')) {
    throw new Error('RC1 must not break index.html === v3.html');
  }
}

console.log('RC1 Browser UX Audit package applied successfully.');

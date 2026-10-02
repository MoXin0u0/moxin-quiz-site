import fs from 'node:fs';

const MODULE = "import { validatePackage } from '../question-bank/validator.js';\nimport { createDraftFromBankPackage } from '../storage/repositories/studio.js';\nimport {\n  makeUniqueBankId,\n  sanitizeBankId,\n  syncManifestQuestionCount,\n} from './editor-model.js';\nimport { normalizeQuestionDraft } from './question-draft.js';\n\nexport const STUDIO_PACKAGE_OPEN_MODE = Object.freeze({\n  DIRECT: 'direct',\n  RENAMED_COPY: 'renamed-copy',\n});\n\nexport function inspectStudioPackagePlan(pkg, {\n  existingBankIds = [],\n} = {}) {\n  const assetPaths = resolveAssetPaths(pkg);\n  const report = validatePackage({\n    manifest: pkg?.manifest,\n    questions: pkg?.questions,\n    assetPaths,\n  });\n\n  const originalBankId = String(pkg?.manifest?.id || '');\n  const existing = new Set((existingBankIds || []).map(value => String(value)));\n  const hasCollision = Boolean(originalBankId && existing.has(originalBankId));\n\n  let targetBankId = '';\n  if (report.valid && originalBankId) {\n    targetBankId = hasCollision\n      ? makeUniqueBankId(\n          `${sanitizeBankId(originalBankId) || 'question-bank'}-copy`,\n          existing,\n        )\n      : originalBankId;\n  }\n\n  return {\n    valid: report.valid,\n    report,\n    mode: hasCollision\n      ? STUDIO_PACKAGE_OPEN_MODE.RENAMED_COPY\n      : STUDIO_PACKAGE_OPEN_MODE.DIRECT,\n    hasCollision,\n    originalBankId,\n    targetBankId,\n    sourceKind: String(pkg?.source?.kind || 'unknown'),\n    sourceName: String(pkg?.source?.name || ''),\n    questionCount: Array.isArray(pkg?.questions) ? pkg.questions.length : 0,\n    assetCount: Array.isArray(pkg?.assets) ? pkg.assets.length : 0,\n    warningCount: report.summary?.warnings || 0,\n    errorCount: report.summary?.errors || 0,\n  };\n}\n\nexport function createStudioDraftFromInspectedPackage(pkg, {\n  existingBankIds = [],\n  draftId = null,\n  now = new Date(),\n} = {}) {\n  const plan = inspectStudioPackagePlan(pkg, { existingBankIds });\n\n  if (!plan.valid) {\n    throw new Error(\n      `題庫驗證未通過，仍有 ${plan.errorCount} 個錯誤，不能開啟為工作室草稿。`,\n    );\n  }\n\n  const questions = pkg.questions.map(question => normalizeQuestionDraft(question));\n  const manifest = buildStudioManifest(pkg.manifest, plan, now);\n  const assets = cloneDraftAssets(pkg.assets || []);\n\n  const prepared = {\n    manifest: syncManifestQuestionCount(manifest, questions),\n    questions,\n    assets,\n  };\n\n  let draft = createDraftFromBankPackage(prepared, { id: draftId });\n\n  // External ZIP / JSON is never considered linked to an installed local bank.\n  // Even when the ID is unchanged, saving from Studio creates/claims a user bank\n  // instead of silently overwriting an existing source.\n  draft = {\n    ...draft,\n    bankId: null,\n    sourceBankVersion: String(pkg.manifest.version || '') || null,\n  };\n\n  return {\n    draft,\n    plan,\n  };\n}\n\nfunction buildStudioManifest(manifest, plan, now) {\n  const source = cloneJson(manifest);\n  const timestamp = normalizeNow(now);\n  const metadata = {\n    ...(source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata)\n      ? cloneJson(source.metadata)\n      : {}),\n    studioImport: {\n      sourceKind: plan.sourceKind,\n      sourceName: plan.sourceName,\n      originalBankId: plan.originalBankId,\n      openMode: plan.mode,\n    },\n  };\n\n  const next = {\n    ...source,\n    id: plan.targetBankId,\n    metadata,\n  };\n\n  if (plan.hasCollision) {\n    next.name = `${source.name || source.title || source.id || '題庫'} 副本`;\n    next.version = '1.0.0';\n    next.createdAt = timestamp;\n    next.updatedAt = timestamp;\n    next.metadata = {\n      ...metadata,\n      copiedFrom: plan.originalBankId,\n    };\n  }\n\n  for (const field of ['sourceType', 'sourceMetadata', 'importedAt', 'storedAt']) {\n    delete next[field];\n  }\n\n  return next;\n}\n\nfunction resolveAssetPaths(pkg) {\n  if (Array.isArray(pkg?.assetPaths)) {\n    return [...pkg.assetPaths];\n  }\n\n  return Array.isArray(pkg?.assets)\n    ? pkg.assets\n        .map(asset => String(asset?.path || ''))\n        .filter(Boolean)\n    : [];\n}\n\nfunction cloneDraftAssets(assets) {\n  return (assets || []).map(asset => {\n    const blob = typeof Blob !== 'undefined' && asset?.blob instanceof Blob\n      ? asset.blob\n      : null;\n\n    return {\n      path: String(asset?.path || ''),\n      mimeType: String(asset?.mimeType || blob?.type || 'application/octet-stream'),\n      size: Number(asset?.size ?? blob?.size ?? 0) || 0,\n      blob,\n    };\n  });\n}\n\nfunction normalizeNow(value) {\n  const date = value instanceof Date ? value : new Date(value);\n  return Number.isNaN(date.getTime())\n    ? new Date().toISOString()\n    : date.toISOString();\n}\n\nfunction cloneJson(value) {\n  if (!value || typeof value !== 'object') return {};\n  if (globalThis.structuredClone) return structuredClone(value);\n  return JSON.parse(JSON.stringify(value));\n}\n";
const TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nimport {\n  STUDIO_PACKAGE_OPEN_MODE,\n  createStudioDraftFromInspectedPackage,\n  inspectStudioPackagePlan,\n} from '../src/studio/package-to-draft.js';\n\nfunction makePackage(overrides = {}) {\n  const imageBlob = new Blob(['image-bytes'], { type: 'image/png' });\n\n  const pkg = {\n    manifest: {\n      schemaVersion: '2.0',\n      id: 'erp-demo',\n      name: 'ERP 示範題庫',\n      description: 'P2C 測試',\n      version: '2.3.0',\n      author: 'Tester',\n      language: 'zh-TW',\n      questionCount: 2,\n      createdAt: '2026-01-01T00:00:00.000Z',\n      updatedAt: '2026-01-02T00:00:00.000Z',\n      metadata: { category: 'ERP' },\n    },\n    questions: [\n      {\n        id: 'Q001',\n        type: 'single-choice',\n        question: 'ERP 的核心目的？',\n        options: [\n          { id: 'A', text: '整合企業流程與資訊' },\n          { id: 'B', text: '只處理圖片' },\n        ],\n        answer: ['A'],\n        explanation: 'ERP 強調跨部門整合。',\n        images: ['assets/images/Q001/question/diagram.png'],\n        explanationImages: [],\n        chapter: 'ERP 基礎',\n        tags: ['ERP'],\n        difficulty: 2,\n      },\n      {\n        id: 'Q002',\n        type: 'true-false',\n        question: 'HTML 是資料庫管理系統。',\n        options: [],\n        answer: [false],\n        explanation: 'HTML 是標記語言。',\n        images: [],\n        explanationImages: [],\n        chapter: 'Web',\n        tags: ['HTML'],\n        difficulty: 1,\n      },\n    ],\n    assetPaths: ['assets/images/Q001/question/diagram.png'],\n    assets: [{\n      path: 'assets/images/Q001/question/diagram.png',\n      mimeType: 'image/png',\n      size: imageBlob.size,\n      blob: imageBlob,\n    }],\n    report: {\n      valid: true,\n      summary: { errors: 0, warnings: 0, questionCount: 2, assetCount: 1 },\n      issues: [],\n    },\n    source: {\n      kind: 'zip',\n      name: 'erp-demo.zip',\n    },\n  };\n\n  return {\n    ...pkg,\n    ...overrides,\n    manifest: {\n      ...pkg.manifest,\n      ...(overrides.manifest || {}),\n    },\n    questions: overrides.questions || pkg.questions,\n    assets: overrides.assets || pkg.assets,\n    assetPaths: overrides.assetPaths || pkg.assetPaths,\n    source: {\n      ...pkg.source,\n      ...(overrides.source || {}),\n    },\n  };\n}\n\n// 1. Valid external package can open directly when its bank ID is free.\n{\n  const pkg = makePackage();\n  const plan = inspectStudioPackagePlan(pkg, {\n    existingBankIds: ['another-bank'],\n  });\n\n  assert.equal(plan.valid, true);\n  assert.equal(plan.mode, STUDIO_PACKAGE_OPEN_MODE.DIRECT);\n  assert.equal(plan.hasCollision, false);\n  assert.equal(plan.originalBankId, 'erp-demo');\n  assert.equal(plan.targetBankId, 'erp-demo');\n  assert.equal(plan.questionCount, 2);\n  assert.equal(plan.assetCount, 1);\n}\n\n// 2. External package is never linked to an installed bank.\n{\n  const { draft } = createStudioDraftFromInspectedPackage(makePackage(), {\n    existingBankIds: [],\n    draftId: 'draft-p2c-direct',\n  });\n\n  assert.equal(draft.id, 'draft-p2c-direct');\n  assert.equal(draft.bankId, null);\n  assert.equal(draft.manifest.id, 'erp-demo');\n  assert.equal(draft.sourceBankVersion, '2.3.0');\n}\n\n// 3. Questions preserve permanent IDs and are normalized for Studio.\n{\n  const { draft } = createStudioDraftFromInspectedPackage(makePackage());\n\n  assert.deepEqual(draft.questions.map(question => question.id), ['Q001', 'Q002']);\n  assert.equal(draft.questions[0].type, 'single-choice');\n  assert.deepEqual(draft.questions[0].answer, ['A']);\n  assert.equal(draft.questions[1].type, 'true-false');\n  assert.deepEqual(draft.questions[1].answer, [false]);\n}\n\n// 4. Assets and image references survive ZIP -> Draft conversion.\n{\n  const pkg = makePackage();\n  const { draft } = createStudioDraftFromInspectedPackage(pkg);\n\n  assert.equal(draft.assets.length, 1);\n  assert.equal(\n    draft.assets[0].path,\n    'assets/images/Q001/question/diagram.png',\n  );\n  assert.equal(draft.assets[0].blob, pkg.assets[0].blob);\n  assert.deepEqual(\n    draft.questions[0].images,\n    ['assets/images/Q001/question/diagram.png'],\n  );\n}\n\n// 5. Collision creates a separate editable copy ID instead of overwriting.\n{\n  const plan = inspectStudioPackagePlan(makePackage(), {\n    existingBankIds: ['erp-demo'],\n  });\n\n  assert.equal(plan.mode, STUDIO_PACKAGE_OPEN_MODE.RENAMED_COPY);\n  assert.equal(plan.hasCollision, true);\n  assert.equal(plan.targetBankId, 'erp-demo-copy');\n}\n\n// 6. Repeated collisions get a deterministic unique suffix.\n{\n  const plan = inspectStudioPackagePlan(makePackage(), {\n    existingBankIds: [\n      'erp-demo',\n      'erp-demo-copy',\n      'erp-demo-copy-2',\n    ],\n  });\n\n  assert.equal(plan.targetBankId, 'erp-demo-copy-3');\n}\n\n// 7. Collision copy gets a new title/version/timestamps and provenance.\n{\n  const { draft, plan } = createStudioDraftFromInspectedPackage(makePackage(), {\n    existingBankIds: ['erp-demo'],\n    now: new Date('2026-10-02T12:00:00.000Z'),\n  });\n\n  assert.equal(plan.mode, STUDIO_PACKAGE_OPEN_MODE.RENAMED_COPY);\n  assert.equal(draft.manifest.id, 'erp-demo-copy');\n  assert.equal(draft.manifest.name, 'ERP 示範題庫 副本');\n  assert.equal(draft.manifest.version, '1.0.0');\n  assert.equal(draft.manifest.createdAt, '2026-10-02T12:00:00.000Z');\n  assert.equal(draft.manifest.updatedAt, '2026-10-02T12:00:00.000Z');\n  assert.equal(draft.manifest.metadata.copiedFrom, 'erp-demo');\n}\n\n// 8. Direct-open package retains its source version and name.\n{\n  const { draft } = createStudioDraftFromInspectedPackage(makePackage(), {\n    existingBankIds: [],\n  });\n\n  assert.equal(draft.manifest.id, 'erp-demo');\n  assert.equal(draft.manifest.name, 'ERP 示範題庫');\n  assert.equal(draft.manifest.version, '2.3.0');\n}\n\n// 9. Studio provenance records ZIP / JSON source without linking the bank.\n{\n  const { draft } = createStudioDraftFromInspectedPackage(makePackage({\n    source: { kind: 'v2-json', name: 'erp-demo.json' },\n  }));\n\n  assert.deepEqual(draft.manifest.metadata.studioImport, {\n    sourceKind: 'v2-json',\n    sourceName: 'erp-demo.json',\n    originalBankId: 'erp-demo',\n    openMode: 'direct',\n  });\n  assert.equal(draft.bankId, null);\n}\n\n// 10. Stored-bank metadata is stripped from external packages.\n{\n  const pkg = makePackage({\n    manifest: {\n      sourceType: 'author',\n      sourceMetadata: { catalogId: 'catalog-1' },\n      importedAt: '2026-01-03T00:00:00.000Z',\n      storedAt: '2026-01-04T00:00:00.000Z',\n    },\n  });\n\n  const { draft } = createStudioDraftFromInspectedPackage(pkg);\n\n  assert.equal('sourceType' in draft.manifest, false);\n  assert.equal('sourceMetadata' in draft.manifest, false);\n  assert.equal('importedAt' in draft.manifest, false);\n  assert.equal('storedAt' in draft.manifest, false);\n}\n\n// 11. questionCount is synchronized from actual questions.\n{\n  const pkg = makePackage({\n    manifest: { questionCount: 999 },\n  });\n\n  const { draft } = createStudioDraftFromInspectedPackage(pkg);\n  assert.equal(draft.manifest.questionCount, 2);\n}\n\n// 12. Package warnings do not block Studio open.\n{\n  const pkg = makePackage({\n    questions: [{\n      ...makePackage().questions[0],\n      images: ['assets/images/missing.png'],\n    }],\n    assets: [],\n    assetPaths: [],\n    manifest: { questionCount: 1 },\n  });\n\n  const plan = inspectStudioPackagePlan(pkg);\n  assert.equal(plan.valid, true);\n  assert.ok(plan.warningCount >= 1);\n\n  const { draft } = createStudioDraftFromInspectedPackage(pkg);\n  assert.equal(draft.questions.length, 1);\n}\n\n// 13. Invalid schema is blocked by canonical validator even if pkg.report says valid.\n{\n  const pkg = makePackage({\n    manifest: { schemaVersion: '9.9' },\n  });\n\n  pkg.report = {\n    valid: true,\n    summary: { errors: 0, warnings: 0 },\n    issues: [],\n  };\n\n  const plan = inspectStudioPackagePlan(pkg);\n  assert.equal(plan.valid, false);\n  assert.ok(plan.errorCount >= 1);\n\n  assert.throws(\n    () => createStudioDraftFromInspectedPackage(pkg),\n    /題庫驗證未通過/,\n  );\n}\n\n// 14. Invalid answer is blocked before Studio draft creation.\n{\n  const badQuestion = {\n    ...makePackage().questions[0],\n    answer: [],\n  };\n  const pkg = makePackage({\n    questions: [badQuestion],\n    manifest: { questionCount: 1 },\n  });\n\n  assert.equal(inspectStudioPackagePlan(pkg).valid, false);\n  assert.throws(\n    () => createStudioDraftFromInspectedPackage(pkg),\n    /不能開啟為工作室草稿/,\n  );\n}\n\n// 15. Input package is not mutated.\n{\n  const pkg = makePackage();\n  const beforeManifest = structuredClone(pkg.manifest);\n  const beforeQuestions = structuredClone(pkg.questions);\n\n  createStudioDraftFromInspectedPackage(pkg, {\n    existingBankIds: ['erp-demo'],\n  });\n\n  assert.deepEqual(pkg.manifest, beforeManifest);\n  assert.deepEqual(pkg.questions, beforeQuestions);\n}\n\n// 16. Service Worker keeps the P2C core available offline.\n{\n  const sw = fs.readFileSync('service-worker.js', 'utf8');\n  assert.match(sw, /\\.\\/src\\/studio\\/package-to-draft\\.js/);\n  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-\\d+'/);\n}\n\nconsole.log('MoXin Quiz v4.0 P2C package-to-Studio core: 16 regression cases passed.');\n";
const DOC = "# 墨忻刷題網 v4.0 — P2C Package → Studio Draft Core\n\n## 目的\n\nP2C Core 把既有的 ZIP / JSON 題庫讀取與驗證流程，接到題庫工作室 Draft Model。\n\n本階段不新增 UI。資料流程為：\n\n```text\nZIP / JSON\n→ package-reader\n→ validator\n→ P2C plan\n→ Studio Draft\n→ 後續 P2C.1 UI 開啟\n```\n\n## 核心 API\n\n### `inspectStudioPackagePlan(pkg, options)`\n\n重新使用正式 `validatePackage()` 做 canonical validation，不直接相信匯入物件上舊的 `pkg.report`。\n\n回傳：\n\n- `valid`\n- `report`\n- `mode`\n- `hasCollision`\n- `originalBankId`\n- `targetBankId`\n- `sourceKind`\n- `sourceName`\n- `questionCount`\n- `assetCount`\n- `warningCount`\n- `errorCount`\n\n### `createStudioDraftFromInspectedPackage(pkg, options)`\n\n建立可以交給 Studio 儲存 / 編輯的 Draft。\n\n## ID 安全規則\n\n### 來源 ID 沒有碰撞\n\n例如：\n\n```text\n來源 ID：erp-demo\n本機不存在 erp-demo\n```\n\n工作室保留：\n\n```text\nerp-demo\n```\n\n但 `draft.bankId = null`，因為 ZIP / JSON 是外部來源，不會被視為已安裝本機題庫的直接編輯連結。\n\n### 來源 ID 已存在\n\n例如本機已經有：\n\n```text\nerp-demo\n```\n\nP2C 會建立：\n\n```text\nerp-demo-copy\n```\n\n如果也存在：\n\n```text\nerp-demo-copy\nerp-demo-copy-2\n```\n\n則建立：\n\n```text\nerp-demo-copy-3\n```\n\n避免外部檔案靜默覆蓋既有題庫。\n\n## 作者題庫安全\n\n從檔案開啟的 package 永遠是「外部工作草稿」，不直接連結到本機已安裝的作者題庫。\n\n因此：\n\n- 不覆寫作者題庫。\n- 不覆寫同 ID 的本機題庫。\n- 發生 ID collision 時一定改成 copy ID。\n- 最終仍由現有 `saveDraftToLibrary()` 的保護再次驗證。\n\n## Questions\n\n題目會經過：\n\n```text\nnormalizeQuestionDraft()\n```\n\n保留永久 Question ID，不任意重新編號。\n\n這樣可以保留題庫內部引用語義，也避免匯入後產生不必要的 ID 漂移。\n\n## Assets\n\nZIP 中已讀出的 Blob 會帶入 Draft：\n\n```text\npath\nmimeType\nsize\nblob\n```\n\nQuestion 的：\n\n```text\nimages\nexplanationImages\n```\n\n路徑保持不變。\n\n## Validation\n\nP2C Core 重新執行正式 `validatePackage()`：\n\n- Error → 禁止建立 Draft。\n- Warning → 允許開啟，在 P2C.1 UI 顯示警告。\n- 不信任舊的 `pkg.report.valid`。\n\n這可避免 package 在 inspect 後被修改，卻仍使用過期驗證結果。\n\n## JSON 與圖片\n\nJSON 本身不攜帶圖片 Blob。\n\n若 JSON 題目引用了找不到的圖片，現行 validator 會產生 warning；P2C 仍可開啟 Draft，讓使用者在 Studio 裡補圖或修正。\n\n完整含圖片交換仍建議 ZIP。\n\n## 下一階段\n\nP2C.1 UI Integration：\n\n```text\n選擇 ZIP / JSON\n→ 題庫檢查摘要\n→ 錯誤 / 警告預覽\n→ 「加入我的題庫」\n   或\n   「在題庫工作室中開啟」\n→ Studio Draft\n```\n";

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOne(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Patch anchor is not unique: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

write('src/studio/package-to-draft.js', MODULE);
write('tests/v40-p2c-package-to-draft-run.mjs', TEST);
write('docs/V4_0_P2C_PACKAGE_TO_STUDIO_CORE.md', DOC);

// package.json
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const anchor =
    'node tests/v40-p2b1-studio-batch-ui-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const replacement =
    'node tests/v40-p2b1-studio-batch-ui-run.mjs && node tests/v40-p2c-package-to-draft-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';

  if (!pkg.scripts.test.includes('v40-p2c-package-to-draft-run.mjs')) {
    if (!pkg.scripts.test.includes(anchor)) {
      throw new Error('package.json P2C insertion anchor not found');
    }
    pkg.scripts.test = pkg.scripts.test.replace(anchor, replacement);
  }

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

// Service Worker: include P2C core offline and bump app cache.
{
  const path = 'service-worker.js';
  let sw = read(path);

  if (!sw.includes("'./src/studio/package-to-draft.js'")) {
    sw = replaceOne(
      sw,
      "  './src/studio/editor-model.js',",
      "  './src/studio/editor-model.js',\n  './src/studio/package-to-draft.js',",
      'service worker P2C module',
    );
  }

  sw = replaceOne(
    sw,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-5';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-6';",
    'service worker cache revision',
  );

  write(path, sw);
}

// Changelog
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);

  if (!changelog.includes('## P2C — Package → Studio Draft Core')) {
    const section = `## P2C — Package → Studio Draft Core
- 新增 ZIP / JSON inspected package → Studio Draft 的正式轉換層。
- 重新執行 canonical validator，不信任過期 pkg.report。
- 外部 package 永遠建立未連結的工作草稿，不直接覆寫已安裝題庫。
- 題庫 ID 衝突時自動建立 -copy / -copy-2… 安全 ID。
- 保留 Question ID、圖片引用與 ZIP Blob assets。
- 新增 16 組 regression；P2C Core 加入 APP_SHELL。

`;

    const anchor = '## P2B.1.1 — Batch Preview Scroll Fix';
    if (!changelog.includes(anchor)) throw new Error('Changelog insertion anchor missing');
    changelog = changelog.replace(anchor, section + anchor);
  }

  write(path, changelog);
}

// Self-check before CI.
{
  const sw = read('service-worker.js');
  const pkg = JSON.parse(read('package.json'));

  if (!read('src/studio/package-to-draft.js').includes('createStudioDraftFromInspectedPackage')) {
    throw new Error('P2C core module missing public API');
  }
  if (!pkg.scripts.test.includes('v40-p2c-package-to-draft-run.mjs')) {
    throw new Error('P2C regression missing from package.json');
  }
  if (!sw.includes("'./src/studio/package-to-draft.js'")) {
    throw new Error('P2C core missing from APP_SHELL');
  }
  if (!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-6'")) {
    throw new Error('APP cache revision not bumped');
  }
}

console.log('P2C package-to-Studio core patch applied successfully.');

import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  STUDIO_PACKAGE_OPEN_MODE,
  createStudioDraftFromInspectedPackage,
  inspectStudioPackagePlan,
} from '../src/studio/package-to-draft.js';

function makePackage(overrides = {}) {
  const imageBlob = new Blob(['image-bytes'], { type: 'image/png' });

  const pkg = {
    manifest: {
      schemaVersion: '2.0',
      id: 'erp-demo',
      name: 'ERP 示範題庫',
      description: 'P2C 測試',
      version: '2.3.0',
      author: 'Tester',
      language: 'zh-TW',
      questionCount: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      metadata: { category: 'ERP' },
    },
    questions: [
      {
        id: 'Q001',
        type: 'single-choice',
        question: 'ERP 的核心目的？',
        options: [
          { id: 'A', text: '整合企業流程與資訊' },
          { id: 'B', text: '只處理圖片' },
        ],
        answer: ['A'],
        explanation: 'ERP 強調跨部門整合。',
        images: ['assets/images/Q001/question/diagram.png'],
        explanationImages: [],
        chapter: 'ERP 基礎',
        tags: ['ERP'],
        difficulty: 2,
      },
      {
        id: 'Q002',
        type: 'true-false',
        question: 'HTML 是資料庫管理系統。',
        options: [],
        answer: [false],
        explanation: 'HTML 是標記語言。',
        images: [],
        explanationImages: [],
        chapter: 'Web',
        tags: ['HTML'],
        difficulty: 1,
      },
    ],
    assetPaths: ['assets/images/Q001/question/diagram.png'],
    assets: [{
      path: 'assets/images/Q001/question/diagram.png',
      mimeType: 'image/png',
      size: imageBlob.size,
      blob: imageBlob,
    }],
    report: {
      valid: true,
      summary: { errors: 0, warnings: 0, questionCount: 2, assetCount: 1 },
      issues: [],
    },
    source: {
      kind: 'zip',
      name: 'erp-demo.zip',
    },
  };

  return {
    ...pkg,
    ...overrides,
    manifest: {
      ...pkg.manifest,
      ...(overrides.manifest || {}),
    },
    questions: overrides.questions || pkg.questions,
    assets: overrides.assets || pkg.assets,
    assetPaths: overrides.assetPaths || pkg.assetPaths,
    source: {
      ...pkg.source,
      ...(overrides.source || {}),
    },
  };
}

// 1. Valid external package can open directly when its bank ID is free.
{
  const pkg = makePackage();
  const plan = inspectStudioPackagePlan(pkg, {
    existingBankIds: ['another-bank'],
  });

  assert.equal(plan.valid, true);
  assert.equal(plan.mode, STUDIO_PACKAGE_OPEN_MODE.DIRECT);
  assert.equal(plan.hasCollision, false);
  assert.equal(plan.originalBankId, 'erp-demo');
  assert.equal(plan.targetBankId, 'erp-demo');
  assert.equal(plan.questionCount, 2);
  assert.equal(plan.assetCount, 1);
}

// 2. External package is never linked to an installed bank.
{
  const { draft } = createStudioDraftFromInspectedPackage(makePackage(), {
    existingBankIds: [],
    draftId: 'draft-p2c-direct',
  });

  assert.equal(draft.id, 'draft-p2c-direct');
  assert.equal(draft.bankId, null);
  assert.equal(draft.manifest.id, 'erp-demo');
  assert.equal(draft.sourceBankVersion, '2.3.0');
}

// 3. Questions preserve permanent IDs and are normalized for Studio.
{
  const { draft } = createStudioDraftFromInspectedPackage(makePackage());

  assert.deepEqual(draft.questions.map(question => question.id), ['Q001', 'Q002']);
  assert.equal(draft.questions[0].type, 'single-choice');
  assert.deepEqual(draft.questions[0].answer, ['A']);
  assert.equal(draft.questions[1].type, 'true-false');
  assert.deepEqual(draft.questions[1].answer, [false]);
}

// 4. Assets and image references survive ZIP -> Draft conversion.
{
  const pkg = makePackage();
  const { draft } = createStudioDraftFromInspectedPackage(pkg);

  assert.equal(draft.assets.length, 1);
  assert.equal(
    draft.assets[0].path,
    'assets/images/Q001/question/diagram.png',
  );
  assert.equal(draft.assets[0].blob, pkg.assets[0].blob);
  assert.deepEqual(
    draft.questions[0].images,
    ['assets/images/Q001/question/diagram.png'],
  );
}

// 5. Collision creates a separate editable copy ID instead of overwriting.
{
  const plan = inspectStudioPackagePlan(makePackage(), {
    existingBankIds: ['erp-demo'],
  });

  assert.equal(plan.mode, STUDIO_PACKAGE_OPEN_MODE.RENAMED_COPY);
  assert.equal(plan.hasCollision, true);
  assert.equal(plan.targetBankId, 'erp-demo-copy');
}

// 6. Repeated collisions get a deterministic unique suffix.
{
  const plan = inspectStudioPackagePlan(makePackage(), {
    existingBankIds: [
      'erp-demo',
      'erp-demo-copy',
      'erp-demo-copy-2',
    ],
  });

  assert.equal(plan.targetBankId, 'erp-demo-copy-3');
}

// 7. Collision copy gets a new title/version/timestamps and provenance.
{
  const { draft, plan } = createStudioDraftFromInspectedPackage(makePackage(), {
    existingBankIds: ['erp-demo'],
    now: new Date('2026-10-02T12:00:00.000Z'),
  });

  assert.equal(plan.mode, STUDIO_PACKAGE_OPEN_MODE.RENAMED_COPY);
  assert.equal(draft.manifest.id, 'erp-demo-copy');
  assert.equal(draft.manifest.name, 'ERP 示範題庫 副本');
  assert.equal(draft.manifest.version, '1.0.0');
  assert.equal(draft.manifest.createdAt, '2026-10-02T12:00:00.000Z');
  assert.equal(draft.manifest.updatedAt, '2026-10-02T12:00:00.000Z');
  assert.equal(draft.manifest.metadata.copiedFrom, 'erp-demo');
}

// 8. Direct-open package retains its source version and name.
{
  const { draft } = createStudioDraftFromInspectedPackage(makePackage(), {
    existingBankIds: [],
  });

  assert.equal(draft.manifest.id, 'erp-demo');
  assert.equal(draft.manifest.name, 'ERP 示範題庫');
  assert.equal(draft.manifest.version, '2.3.0');
}

// 9. Studio provenance records ZIP / JSON source without linking the bank.
{
  const { draft } = createStudioDraftFromInspectedPackage(makePackage({
    source: { kind: 'v2-json', name: 'erp-demo.json' },
  }));

  assert.deepEqual(draft.manifest.metadata.studioImport, {
    sourceKind: 'v2-json',
    sourceName: 'erp-demo.json',
    originalBankId: 'erp-demo',
    openMode: 'direct',
  });
  assert.equal(draft.bankId, null);
}

// 10. Stored-bank metadata is stripped from external packages.
{
  const pkg = makePackage({
    manifest: {
      sourceType: 'author',
      sourceMetadata: { catalogId: 'catalog-1' },
      importedAt: '2026-01-03T00:00:00.000Z',
      storedAt: '2026-01-04T00:00:00.000Z',
    },
  });

  const { draft } = createStudioDraftFromInspectedPackage(pkg);

  assert.equal('sourceType' in draft.manifest, false);
  assert.equal('sourceMetadata' in draft.manifest, false);
  assert.equal('importedAt' in draft.manifest, false);
  assert.equal('storedAt' in draft.manifest, false);
}

// 11. questionCount is synchronized from actual questions.
{
  const pkg = makePackage({
    manifest: { questionCount: 999 },
  });

  const { draft } = createStudioDraftFromInspectedPackage(pkg);
  assert.equal(draft.manifest.questionCount, 2);
}

// 12. Package warnings do not block Studio open.
{
  const pkg = makePackage({
    questions: [{
      ...makePackage().questions[0],
      images: ['assets/images/missing.png'],
    }],
    assets: [],
    assetPaths: [],
    manifest: { questionCount: 1 },
  });

  const plan = inspectStudioPackagePlan(pkg);
  assert.equal(plan.valid, true);
  assert.ok(plan.warningCount >= 1);

  const { draft } = createStudioDraftFromInspectedPackage(pkg);
  assert.equal(draft.questions.length, 1);
}

// 13. Invalid schema is blocked by canonical validator even if pkg.report says valid.
{
  const pkg = makePackage({
    manifest: { schemaVersion: '9.9' },
  });

  pkg.report = {
    valid: true,
    summary: { errors: 0, warnings: 0 },
    issues: [],
  };

  const plan = inspectStudioPackagePlan(pkg);
  assert.equal(plan.valid, false);
  assert.ok(plan.errorCount >= 1);

  assert.throws(
    () => createStudioDraftFromInspectedPackage(pkg),
    /題庫驗證未通過/,
  );
}

// 14. Invalid answer is blocked before Studio draft creation.
{
  const badQuestion = {
    ...makePackage().questions[0],
    answer: [],
  };
  const pkg = makePackage({
    questions: [badQuestion],
    manifest: { questionCount: 1 },
  });

  assert.equal(inspectStudioPackagePlan(pkg).valid, false);
  assert.throws(
    () => createStudioDraftFromInspectedPackage(pkg),
    /不能開啟為工作室草稿/,
  );
}

// 15. Input package is not mutated.
{
  const pkg = makePackage();
  const beforeManifest = structuredClone(pkg.manifest);
  const beforeQuestions = structuredClone(pkg.questions);

  createStudioDraftFromInspectedPackage(pkg, {
    existingBankIds: ['erp-demo'],
  });

  assert.deepEqual(pkg.manifest, beforeManifest);
  assert.deepEqual(pkg.questions, beforeQuestions);
}

// 16. Service Worker keeps the P2C core available offline.
{
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(sw, /\.\/src\/studio\/package-to-draft\.js/);
  assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);
}

console.log('MoXin Quiz v4.0 P2C package-to-Studio core: 16 regression cases passed.');

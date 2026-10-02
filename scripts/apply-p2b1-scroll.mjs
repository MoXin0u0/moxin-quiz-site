import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceExact(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) {
    throw new Error(`Missing patch anchor: ${label}`);
  }
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Patch anchor is not unique: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

// 1. Make the modal a constrained four-row grid and let the preview row shrink/scroll.
{
  const path = 'styles/v4-studio-batch.css';
  let css = read(path);

  css = replaceExact(
    css,
`.studio-r1-batch-dialog {
  width: min(1080px, calc(100vw - 2rem));
  max-height: min(90vh, 920px);
}`,
`.studio-r1-batch-dialog {
  width: min(1080px, calc(100vw - 2rem));
  height: min(90vh, 920px);
  height: min(90dvh, 920px);
  max-height: min(90vh, 920px);
  max-height: min(90dvh, 920px);
  overflow: hidden;
}`,
    'batch dialog viewport height',
  );

  css = replaceExact(
    css,
`.studio-r1-batch-card {
  display: grid;
  gap: 1rem;
  max-height: min(90vh, 920px);
  overflow: hidden;`,
`.studio-r1-batch-card {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 1rem;
  height: 100%;
  max-height: none;
  overflow: hidden;`,
    'batch card grid rows',
  );

  css = replaceExact(
    css,
`.studio-r1-batch-results {
  min-height: 120px;
  overflow: auto;
  padding-right: .15rem;
}`,
`.studio-r1-batch-results {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding-right: .35rem;
}`,
    'batch results scroll region',
  );

  if (!css.includes('@media (max-height: 760px)')) {
    css += `

@media (max-height: 760px) {
  .studio-r1-batch-dialog {
    height: min(94vh, 920px);
    height: min(94dvh, 920px);
    max-height: min(94vh, 920px);
    max-height: min(94dvh, 920px);
  }

  .studio-r1-batch-source textarea {
    min-height: 110px;
    max-height: 24vh;
    max-height: 24dvh;
  }
}
`;
  }

  write(path, css);
}

// 2. Add regression checks for the independently scrollable preview.
{
  const path = 'tests/v40-p2b1-studio-batch-ui-run.mjs';
  let test = read(path);

  test = replaceExact(
    test,
`assert.match(batchCss, /\\.studio-r1-batch-dialog/);`,
`assert.match(batchCss, /\\.studio-r1-batch-dialog/);
assert.match(batchCss, /grid-template-rows: auto auto minmax\\(0, 1fr\\) auto/);
assert.match(batchCss, /\\.studio-r1-batch-results[\\s\\S]*min-height: 0/);
assert.match(batchCss, /\\.studio-r1-batch-results[\\s\\S]*overflow-y: auto/);
assert.match(batchCss, /overscroll-behavior: contain/);
assert.match(batchCss, /scrollbar-gutter: stable/);`,
    'P2B.1 scroll regression',
  );

  write(path, test);
}

// 3. Bump APP cache so existing GitHub Pages users do not remain on stale batch CSS.
{
  const path = 'service-worker.js';
  let sw = read(path);
  sw = replaceExact(
    sw,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-4';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-5';",
    'app cache revision',
  );
  write(path, sw);
}

// 4. Keep R2K.5.4 focused on scene behavior rather than pinning one APP cache revision.
{
  const path = 'tests/v40-r2k54-true-epic-world-separation-run.mjs';
  let test = read(path);
  test = replaceExact(
    test,
    "assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-4'/);",
    "assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-\\d+'/);",
    'R2K.5.4 cache assertion',
  );
  write(path, test);
}

// 5. Record the fix in the consolidated changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);

  if (!changelog.includes('## P2B.1.1 — Batch Preview Scroll Fix')) {
    changelog = replaceExact(
      changelog,
      '## P2B.1 — Studio Batch Import UI',
`## P2B.1.1 — Batch Preview Scroll Fix
- 批次貼題視窗改為固定可用高度的四列 Grid：標題、輸入區、可捲動預覽、底部操作列。
- 題目預覽區加入獨立垂直捲動，不再因多題內容超出視窗而看不到後續題目。
- 小高度螢幕會自動縮短原始文字輸入區，優先保留預覽空間。
- APP cache revision 更新，避免舊 CSS 持續被 Service Worker 使用。
- 加入 scrollbar / overscroll regression，避免後續樣式調整再次破壞捲動。

## P2B.1 — Studio Batch Import UI`,
      'changelog P2B.1 section',
    );
  }

  write(path, changelog);
}

// Final self-check.
{
  const css = read('styles/v4-studio-batch.css');
  const sw = read('service-worker.js');
  const p2bTest = read('tests/v40-p2b1-studio-batch-ui-run.mjs');

  const required = [
    'grid-template-rows: auto auto minmax(0, 1fr) auto',
    'min-height: 0',
    'overflow-y: auto',
    'overscroll-behavior: contain',
    'scrollbar-gutter: stable',
  ];

  for (const marker of required) {
    if (!css.includes(marker)) {
      throw new Error(`Post-patch CSS verification failed: ${marker}`);
    }
  }

  if (!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-5'")) {
    throw new Error('Service Worker cache revision was not updated.');
  }

  if (!p2bTest.includes('scrollbar-gutter: stable')) {
    throw new Error('P2B.1 scroll regression was not installed.');
  }
}

console.log('P2B.1.1 batch preview scroll hotfix applied successfully.');

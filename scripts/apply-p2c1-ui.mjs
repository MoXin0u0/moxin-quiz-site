import fs from 'node:fs';

const LIB_A1 = "  const sourceName = pkg.source?.name || pkg.source?.kind || '題庫';\n\n  container.innerHTML = `";
const LIB_R1 = "  const sourceName = pkg.source?.name || pkg.source?.kind || '題庫';\n  const studioPlan = options.studioPlan || null;\n  const studioValid = studioPlan?.valid === true;\n  const studioCollision = studioPlan?.hasCollision === true;\n  const studioTargetId = studioPlan?.targetBankId || manifest.id || '';\n\n  container.innerHTML = `";
const LIB_A2 = "            ${existing ? '<span class=\"status-badge warning\">將更新既有題庫</span>' : ''}";
const LIB_R2 = "            ${existing ? '<span class=\"status-badge warning\">本機已有同 ID 題庫</span>' : ''}";
const LIB_A3 = "      ${issues.length ? `\n        <details class=\"issue-details\" ${errors ? 'open' : ''}>\n          <summary>查看 ${issues.length} 項檢查結果</summary>\n          <div class=\"issue-list\">\n            ${issues.map(issue => `\n              <div class=\"issue-row ${escapeAttr(issue.severity)}\">\n                <span class=\"issue-severity\">${issue.severity === 'error' ? '錯誤' : '警告'}</span>\n                <div>\n                  <code>${escapeHtml(issue.location || 'package')}</code>\n                  <p>${escapeHtml(issue.message)}</p>\n                </div>\n              </div>\n            `).join('')}\n          </div>\n        </details>\n      ` : '<p class=\"inspection-clean\">沒有發現格式問題。</p>'}\n\n      <div class=\"inspection-actions\">";
const LIB_R3 = "      ${issues.length ? `\n        <details class=\"issue-details\" ${errors ? 'open' : ''}>\n          <summary>查看 ${issues.length} 項檢查結果</summary>\n          <div class=\"issue-list\">\n            ${issues.map(issue => `\n              <div class=\"issue-row ${escapeAttr(issue.severity)}\">\n                <span class=\"issue-severity\">${issue.severity === 'error' ? '錯誤' : '警告'}</span>\n                <div>\n                  <code>${escapeHtml(issue.location || 'package')}</code>\n                  <p>${escapeHtml(issue.message)}</p>\n                </div>\n              </div>\n            `).join('')}\n          </div>\n        </details>\n      ` : '<p class=\"inspection-clean\">沒有發現格式問題。</p>'}\n\n      ${studioPlan ? `\n        <div class=\"inspection-studio-note ${studioCollision ? 'warning' : ''}\">\n          <strong>${studioCollision ? '工作室會建立可編輯副本' : '可直接開進題庫工作室'}</strong>\n          <p>\n            ${studioCollision\n              ? `本機已有 ID「${escapeHtml(studioPlan.originalBankId)}」，工作室會改用「${escapeHtml(studioTargetId)}」，不會覆蓋目前本機題庫。`\n              : `工作室草稿會使用 ID「${escapeHtml(studioTargetId)}」，原始匯入檔不會被修改。`}\n            ${warnings ? '目前有警告項目，可進入工作室後再檢查與修正。' : ''}\n          </p>\n        </div>\n      ` : ''}\n\n      <div class=\"inspection-actions\">";
const LIB_A4 = "        <button class=\"button primary\" type=\"button\" data-import-inspected ${valid ? '' : 'disabled'}>\n          ${existing ? '更新這個題庫' : '匯入到我的題庫'}\n        </button>\n        <button class=\"button secondary\" type=\"button\" data-dismiss-inspection>取消</button>";
const LIB_R4 = "        <button class=\"button primary\" type=\"button\" data-import-inspected ${valid ? '' : 'disabled'}>\n          ${existing ? '更新這個題庫' : '匯入到我的題庫'}\n        </button>\n        <button class=\"button secondary\" type=\"button\" data-open-inspected-studio ${studioValid ? '' : 'disabled'}>\n          在題庫工作室中開啟\n        </button>\n        <button class=\"button secondary\" type=\"button\" data-dismiss-inspection>取消</button>";
const MAIN_IA = "import {\n  importAuthorPackage,\n  importInspectedPackage,\n  inspectQuestionBankFile,\n  inspectQuestionBankFolder,\n} from '../question-bank/importer.js';";
const MAIN_IR = "import {\n  importAuthorPackage,\n  importInspectedPackage,\n  inspectQuestionBankFile,\n  inspectQuestionBankFolder,\n} from '../question-bank/importer.js';\nimport { saveStudioDraft } from '../storage/repositories/studio.js';\nimport {\n  createStudioDraftFromInspectedPackage,\n  inspectStudioPackagePlan,\n} from '../studio/package-to-draft.js';";
const MAIN_CA = "  elements.inspectionArea.addEventListener('click', async event => {\n    const importButton = event.target.closest('[data-import-inspected]');\n    if (importButton) await importCurrentPackage();\n\n    const dismissButton = event.target.closest('[data-dismiss-inspection]');";
const MAIN_CR = "  elements.inspectionArea.addEventListener('click', async event => {\n    const studioButton = event.target.closest('[data-open-inspected-studio]');\n    if (studioButton) {\n      await openCurrentPackageInStudio();\n      return;\n    }\n\n    const importButton = event.target.closest('[data-import-inspected]');\n    if (importButton) {\n      await importCurrentPackage();\n      return;\n    }\n\n    const dismissButton = event.target.closest('[data-dismiss-inspection]');";
const MAIN_RA = "    renderInspection(elements.inspectionArea, pkg, {\n      existingBankIds: new Set(state.banks.map(bank => bank.id)),\n    });";
const MAIN_RR = "    const existingBankIds = new Set(state.banks.map(bank => bank.id));\n    const studioPlan = inspectStudioPackagePlan(pkg, { existingBankIds });\n    renderInspection(elements.inspectionArea, pkg, {\n      existingBankIds,\n      studioPlan,\n    });";
const MAIN_FA = "async function importCurrentPackage() {\n  const pkg = state.inspectedPackage;";
const MAIN_FR = "async function openCurrentPackageInStudio() {\n  const pkg = state.inspectedPackage;\n  if (!pkg) return;\n\n  setBusy(true, '正在建立題庫工作室草稿…');\n\n  try {\n    const existingBankIds = state.banks.map(bank => bank.id);\n    const { draft, plan } = createStudioDraftFromInspectedPackage(pkg, {\n      existingBankIds,\n    });\n\n    const saved = await saveStudioDraft(draft);\n\n    state.inspectedPackage = null;\n    renderInspection(elements.inspectionArea, null);\n\n    renderQuestionBankTools(elements.toolsArea, {\n      draftId: saved.id,\n    });\n    showView('tools');\n\n    showToast(\n      elements.toastRegion,\n      plan.hasCollision\n        ? `已建立工作室副本「${saved.manifest.name}」，ID：${saved.manifest.id}`\n        : `已在題庫工作室開啟「${saved.manifest.name}」。`,\n      'success',\n    );\n  } catch (error) {\n    console.error(error);\n    showToast(elements.toastRegion, `無法開啟題庫工作室：${error.message}`, 'error');\n  } finally {\n    setBusy(false);\n  }\n}\n\nasync function importCurrentPackage() {\n  const pkg = state.inspectedPackage;";
const TOOLS_A1 = "export function renderQuestionBankTools(container) {";
const TOOLS_R1 = "export function renderQuestionBankTools(container, options = {}) {";
const TOOLS_A2 = "  mountStudioWorkspace(\n    container.querySelector('#studioWorkspaceMount'),\n  ).catch(error => {";
const TOOLS_R2 = "  mountStudioWorkspace(\n    container.querySelector('#studioWorkspaceMount'),\n    { draftId: options.draftId || null },\n  ).catch(error => {";
const STUDIO_A = "export async function mountStudioWorkspace(mount) {\n  if (!mount) return;\n  ensureStudioStyles();\n  state.mount = mount;\n  bindWorkspace(mount);\n\n  if (state.mode === 'editor' && state.draft) {";
const STUDIO_R = "export async function mountStudioWorkspace(mount, options = {}) {\n  if (!mount) return;\n  ensureStudioStyles();\n  state.mount = mount;\n  bindWorkspace(mount);\n\n  const requestedDraftId = String(options.draftId || '').trim();\n  if (requestedDraftId) {\n    await openDraftById(requestedDraftId);\n    return;\n  }\n\n  if (state.mode === 'editor' && state.draft) {";
const CSS_A = ".inspection-clean { color: var(--success); font-weight: 700; }\n.inspection-actions, .card-actions { display: flex; flex-wrap: wrap; gap: .55rem; margin-top: 1rem; }";
const CSS_R = ".inspection-clean { color: var(--success); font-weight: 700; }\n.inspection-studio-note {\n  margin-top: .9rem;\n  padding: .75rem .85rem;\n  border: 1px solid color-mix(in srgb, var(--primary) 26%, var(--line));\n  border-radius: var(--radius-sm);\n  background: var(--primary-soft);\n}\n.inspection-studio-note.warning {\n  border-color: color-mix(in srgb, var(--warning) 38%, var(--line));\n  background: var(--warning-soft);\n}\n.inspection-studio-note strong {\n  display: block;\n  color: var(--text);\n}\n.inspection-studio-note p {\n  margin: .3rem 0 0;\n  color: var(--muted);\n  line-height: 1.55;\n}\n.inspection-studio-note.warning p {\n  color: var(--warning);\n}\n.inspection-actions, .card-actions { display: flex; flex-wrap: wrap; gap: .55rem; margin-top: 1rem; }";
const TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst main = fs.readFileSync('src/app/main.js', 'utf8');\nconst library = fs.readFileSync('src/ui/library.js', 'utf8');\nconst tools = fs.readFileSync('src/ui/tools.js', 'utf8');\nconst studio = fs.readFileSync('src/ui/studio-r1.js', 'utf8');\nconst css = fs.readFileSync('styles/v3.css', 'utf8');\nconst sw = fs.readFileSync('service-worker.js', 'utf8');\n\nassert.match(main, /createStudioDraftFromInspectedPackage/);\nassert.match(main, /inspectStudioPackagePlan/);\nassert.match(main, /saveStudioDraft/);\nassert.match(main, /data-open-inspected-studio/);\nassert.match(main, /openCurrentPackageInStudio/);\nassert.match(main, /renderQuestionBankTools\\(elements\\.toolsArea,\\s*\\{\\s*draftId:/);\nassert.match(main, /showView\\('tools'\\)/);\n\nassert.match(library, /data-open-inspected-studio/);\nassert.match(library, /在題庫工作室中開啟/);\nassert.match(library, /inspection-studio-note/);\nassert.match(library, /工作室會建立可編輯副本/);\nassert.match(library, /不會覆蓋目前本機題庫/);\n\nassert.match(tools, /renderQuestionBankTools\\(container, options = \\{\\}\\)/);\nassert.match(tools, /draftId: options\\.draftId \\|\\| null/);\n\nassert.match(studio, /mountStudioWorkspace\\(mount, options = \\{\\}\\)/);\nassert.match(studio, /requestedDraftId/);\nassert.match(studio, /await openDraftById\\(requestedDraftId\\)/);\n\nassert.match(css, /\\.inspection-studio-note/);\nassert.match(css, /\\.inspection-studio-note\\.warning/);\n\nassert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-\\d+'/);\n\nconsole.log('MoXin Quiz v4.0 P2C.1 import-to-Studio UI integration tests passed.');\n";
const DOC = "# 墨忻刷題網 v4.0 — P2C.1 Import → Studio UI Integration\n\n## 目的\n\n把 P2C Core 接到目前「我的題庫」匯入檢查畫面，讓 ZIP、JSON 或題庫資料夾完成驗證後，可以選擇：\n\n- 匯入到我的題庫\n- 在題庫工作室中開啟\n\n## 工作室流程\n\n```text\n選擇 ZIP / JSON / 資料夾\n→ Schema 驗證\n→ 題庫檢查摘要\n→ 在題庫工作室中開啟\n→ P2C canonical validation\n→ 建立並儲存 Studio Draft\n→ 自動切換到題庫工作室\n→ 直接開啟剛建立的草稿\n```\n\n## ID 衝突\n\n外部題庫 ID 尚未存在時保留原 ID。\n\n若本機已有同 ID，工作室路徑不會覆蓋現有題庫，而是使用 P2C Core 產生的安全 copy ID，例如：\n\n```text\nerp-demo\n→ erp-demo-copy\n→ erp-demo-copy-2\n```\n\n檢查畫面會在使用者點擊前顯示預計使用的 Studio ID。\n\n原本「匯入到我的題庫」的更新行為保持不變，因此兩條路徑用途明確分開。\n\n## Warning / Error\n\n- Warning：允許開進 Studio，再由 Inspector 修正。\n- Error：禁止匯入，也禁止建立 Studio Draft。\n\n## 導航\n\n`renderQuestionBankTools(container, { draftId })` 會把指定 draft 傳給 Studio。\n\n`mountStudioWorkspace(mount, { draftId })` 收到 draftId 時，優先直接打開該草稿，不停留在工作室首頁。\n";

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

write('tests/v40-p2c1-package-studio-ui-run.mjs', TEST);
write('docs/V4_0_P2C_1_IMPORT_TO_STUDIO_UI.md', DOC);

{
  let s = read('src/ui/library.js');
  s = replaceOne(s, LIB_A1, LIB_R1, 'library studio plan vars');
  s = replaceOne(s, LIB_A2, LIB_R2, 'library existing id badge');
  s = replaceOne(s, LIB_A3, LIB_R3, 'library studio note');
  s = replaceOne(s, LIB_A4, LIB_R4, 'library studio action');
  write('src/ui/library.js', s);
}

{
  let s = read('src/app/main.js');
  s = replaceOne(s, MAIN_IA, MAIN_IR, 'main P2C imports');
  s = replaceOne(s, MAIN_CA, MAIN_CR, 'main inspection click');

  // Same render block exists once in inspectFile and once in inspectFolder.
  const first = s.indexOf(MAIN_RA);
  if (first < 0) throw new Error('Missing main file inspection render anchor');
  s = s.slice(0, first) + MAIN_RR + s.slice(first + MAIN_RA.length);

  const second = s.indexOf(MAIN_RA);
  if (second < 0) throw new Error('Missing main folder inspection render anchor');
  s = s.slice(0, second) + MAIN_RR + s.slice(second + MAIN_RA.length);

  if (s.indexOf(MAIN_RA) >= 0) {
    throw new Error('Unexpected extra inspection render anchor');
  }

  s = replaceOne(s, MAIN_FA, MAIN_FR, 'main open in Studio function');
  write('src/app/main.js', s);
}

{
  let s = read('src/ui/tools.js');
  s = replaceOne(s, TOOLS_A1, TOOLS_R1, 'tools options');
  s = replaceOne(s, TOOLS_A2, TOOLS_R2, 'tools draft routing');
  write('src/ui/tools.js', s);
}

{
  let s = read('src/ui/studio-r1.js');
  s = replaceOne(s, STUDIO_A, STUDIO_R, 'Studio requested draft');
  write('src/ui/studio-r1.js', s);
}

{
  let s = read('styles/v3.css');
  s = replaceOne(s, CSS_A, CSS_R, 'inspection Studio styles');
  write('styles/v3.css', s);
}

{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const anchor =
    'node tests/v40-p2c-package-to-draft-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const replacement =
    'node tests/v40-p2c-package-to-draft-run.mjs && node tests/v40-p2c1-package-studio-ui-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';

  if (!pkg.scripts.test.includes('v40-p2c1-package-studio-ui-run.mjs')) {
    if (!pkg.scripts.test.includes(anchor)) {
      throw new Error('package.json P2C.1 insertion anchor not found');
    }
    pkg.scripts.test = pkg.scripts.test.replace(anchor, replacement);
  }
  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

{
  let sw = read('service-worker.js');
  sw = replaceOne(
    sw,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-6';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-7';",
    'P2C.1 APP cache revision',
  );
  write('service-worker.js', sw);
}

{
  const path = 'docs/V4_0_CHANGELOG.md';
  let s = read(path);
  if (!s.includes('## P2C.1 — Import → Studio UI Integration')) {
    const anchor = '## P2C — Package → Studio Draft Core';
    const section =
`## P2C.1 — Import → Studio UI Integration
- ZIP / JSON / 資料夾檢查結果新增「在題庫工作室中開啟」。
- 檢查畫面顯示 P2C 的目標題庫 ID；同 ID 已存在時明確顯示安全 copy ID。
- 外部 package 建立 Studio Draft 後，自動導航並直接開啟該草稿。
- Schema warning 可進 Studio 修正；Schema error 仍阻止開啟。
- 原本「匯入到我的題庫 / 更新題庫」流程保持不變。
- 新增 P2C.1 UI regression，並更新 APP cache。

`;
    if (!s.includes(anchor)) throw new Error('P2C changelog anchor missing');
    s = s.replace(anchor, section + anchor);
  }
  write(path, s);
}

// Self-check.
{
  const checks = [
    [read('src/app/main.js'), 'openCurrentPackageInStudio', 'main open handler'],
    [read('src/app/main.js'), 'createStudioDraftFromInspectedPackage', 'main core call'],
    [read('src/ui/library.js'), 'data-open-inspected-studio', 'library action'],
    [read('src/ui/library.js'), 'inspection-studio-note', 'library note'],
    [read('src/ui/tools.js'), 'draftId: options.draftId || null', 'tools routing'],
    [read('src/ui/studio-r1.js'), 'requestedDraftId', 'Studio routing'],
  ];
  for (const [source, marker, label] of checks) {
    if (!source.includes(marker)) throw new Error(`P2C.1 self-check failed: ${label}`);
  }

  const pkg = JSON.parse(read('package.json'));
  if (!pkg.scripts.test.includes('v40-p2c1-package-studio-ui-run.mjs')) {
    throw new Error('P2C.1 regression missing from package.json');
  }
  if (!read('service-worker.js').includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-7'")) {
    throw new Error('P2C.1 cache bump missing');
  }
}

console.log('P2C.1 import-to-Studio UI patch applied successfully.');

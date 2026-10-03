const METADATA_TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { APP_CONFIG } from '../src/app/config.js';\n\nconst index = fs.readFileSync('index.html', 'utf8');\nconst v3 = fs.readFileSync('v3.html', 'utf8');\nconst manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));\nconst readme = fs.readFileSync('README.md', 'utf8');\nconst pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\nconst sw = fs.readFileSync('service-worker.js', 'utf8');\n\nassert.equal(index, v3, 'index.html and v3.html must remain byte-identical.');\n\nassert.match(index, /<title>墨忻刷題網 v4\\.0 RC1<\\/title>/);\nassert.match(index, /<span class=\"version-badge\">v4\\.0 RC1<\\/span>/);\nassert.doesNotMatch(index, /v4 preview/i);\nassert.doesNotMatch(index, /v3\\.3/i);\nassert.match(index, /meta name=\"description\" content=\"墨忻刷題網 v4\\.0/);\n\nassert.equal(manifest.name, '墨忻刷題網');\nassert.equal(manifest.short_name, '墨忻刷題');\nassert.match(manifest.description, /題庫工作室/);\nassert.match(manifest.description, /本機優先/);\n\nassert.match(readme, /墨忻刷題網 v4\\.0 RC1/);\nassert.match(readme, /題庫工作室/);\nassert.match(readme, /學習目標/);\nassert.match(readme, /考前衝刺/);\nassert.match(readme, /內部相容性名稱/);\nassert.match(readme, /moxin-quiz-v3/);\nassert.match(readme, /moxin\\.v3\\.settings/);\n\nassert.equal(APP_CONFIG.appVersion, '4.0.0-rc.1');\nassert.equal(APP_CONFIG.releaseChannel, 'rc1');\nassert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');\nassert.equal(APP_CONFIG.dbVersion, 3);\n\nassert.equal(pkg.name, 'moxin-quiz-site-v4-rc1');\nassert.equal(pkg.scripts.preflight, 'node scripts/v4-release-preflight.mjs');\nassert.match(pkg.scripts.test, /v40-rc1-release-metadata-run\\.mjs/);\n\nassert.equal(fs.existsSync('scripts/v4-release-preflight.mjs'), true);\nassert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-20'/);\nassert.match(sw, /key\\.startsWith\\('moxin-quiz-v3-'\\)/);\n\nconsole.log('MoXin Quiz v4.0 RC1 release metadata tests passed.');\n";
const METADATA_DOC = "# 墨忻刷題網 v4.0 — RC1 Release Metadata Cleanup\n\n## 目的\n\nRC1 Browser UX Audit 已通過後，將網站從開發期的：\n\n```text\nv3.3\nv4 preview\n```\n\n整理成正式的：\n\n```text\nv4.0 RC1\n```\n\n這個階段仍然不是 `main` cutover，也不是最終 Production 標記。\n\n## 使用者可見版本\n\n更新：\n\n- HTML `<title>`\n- Header version badge\n- HTML meta description\n- PWA manifest description\n- README\n\nHeader 不再同時顯示：\n\n```text\nv3.3 + v4 preview\n```\n\n而只保留：\n\n```text\nv4.0 RC1\n```\n\n## Runtime Release Metadata\n\n`APP_CONFIG` 新增：\n\n```text\nappVersion: 4.0.0-rc.1\nreleaseChannel: rc1\n```\n\n供後續 cutover / diagnostics 使用。\n\n## 相容性名稱不改\n\n下列名稱雖然包含 `v3`，但它們是資料相容性 namespace，不是畫面版本：\n\n```text\nIndexedDB:\nmoxin-quiz-v3\n\nlocalStorage:\nmoxin.v3.settings\n```\n\nRC1 不重新命名。\n\n原因是正式升級最重要的要求是：\n\n```text\n既有 v3.3 使用者直接開 v4.0\n→ 原本資料與設定仍然被同一套程式讀取\n```\n\n若只是為了版本字樣漂亮而改 DB / localStorage key，反而會製造資料遷移風險。\n\n`v3.html` 也繼續保留，作為既有相容入口；它與 `index.html` 必須 byte-for-byte 相同。\n\n## Service Worker\n\n本輪 HTML / manifest metadata 有變動，因此 App Shell revision：\n\n```text\nr2k.5-19\n→ r2k.5-20\n```\n\nCache namespace 暫時仍保留 `moxin-quiz-v3-`，因為目前 activation cleanup 已以此 namespace 管理既有 client cache。\n\n正式 Main Cutover Rehearsal 再決定是否需要改為 v4 cache namespace；如果改，必須同時驗證舊 cache 清理。\n\n## Preflight\n\n新增：\n\n```text\nscripts/v4-release-preflight.mjs\n```\n\n`npm run preflight` 正式改用 v4 preflight。\n\n舊 `scripts/v3-release-preflight.mjs` 暫時保留作歷史相容檔，不作為 RC1 release gate。\n\n## README\n\nREADME 改為 v4.0 RC1 功能面：\n\n- 題庫工作室\n- 圖片與批次建題\n- 學習目標\n- 考前衝刺\n- Learning Hub\n- 7 / 30 日統計\n- 弱點分析\n- 首頁快捷行動\n- 完整備份\n- PWA / Offline\n- RWD / Light / Dark / Academy / Epic / Focus\n\n並明確記錄內部 v3 namespace 的相容性理由。\n\n## 下一步\n\n完成後 RC1 剩下：\n\n```text\nMain Cutover Rehearsal\n```\n\nRehearsal 必須驗證：\n\n- branch → main 的差異\n- main cutover 後 GitHub Pages\n- manifest / SW 更新\n- 舊 cache 清理\n- v3.html 相容入口\n- IndexedDB v2 → v3\n- Backup restore\n- rollback 路徑\n";
const NEW_README = "# 墨忻刷題網\n\n墨忻刷題網 **v4.0 RC1** 是一個部署於 GitHub Pages 的 **Local-first 個人學習與刷題平台**。網站不需要後端、登入系統或付費伺服器；題庫、學習紀錄、目標、工作室草稿與大部分設定保存在目前瀏覽器，並支援 PWA 離線使用。\n\n> RC1 代表 v4.0 已完成主要功能與真實瀏覽器 Release Readiness 測試，但尚未進行正式 `main` cutover。\n\n## v4.0 主要功能\n\n### 題庫與練習\n\n- 作者題庫與使用者自行新增題庫分流\n- ZIP / JSON / 題庫資料夾匯入，匯入前 Schema 2.0 驗證\n- 題庫 ZIP 匯出，連同題庫內 assets 圖片一起打包\n- 單選、複選、是非、填空四種題型\n- 題庫內搜尋、題型／難度／章節篩選\n- 錯題、收藏、不熟題、筆記\n- 未完成練習與模擬考恢復\n- 間隔複習與今日到期題\n- 限時模擬考、題號導覽、交卷分析\n\n### 題庫工作室\n\n- 建立新題庫\n- 編輯自行新增題庫\n- 作者題庫另存副本後編輯\n- 題目新增、刪除、複製、排序\n- 永久題目 ID\n- 章節、標籤、難度\n- 題目圖片與詳解圖片\n- 批次貼題與人工確認\n- 外部 Package → Studio Draft\n- Schema 2.0 即時驗證\n- 草稿保存\n- JSON / ZIP 匯出\n\n### 今日學習\n\n「今日學習」使用第二層 Learning Hub：\n\n```text\n總覽\n複習\n學習目標\n考前衝刺\n```\n\n支援：\n\n- 每日刷題目標\n- 每日複習目標\n- 全域或指定題庫目標\n- 今日目標達成率\n- 最近 7 日達成狀況\n- 連續學習天數\n- 指定多個考試題庫的考前衝刺\n- 錯題 → 不熟 → 到期 → 低熟練 → 未作答的衝刺優先序\n\n### 學習統計\n\n「學習統計」拆成：\n\n```text\n總覽\n趨勢\n弱點分析\n題庫分析\n```\n\n包含：\n\n- 7 / 30 日作答趨勢\n- 7 / 30 日正確率\n- 題型正確率\n- 章節正確率\n- 弱點章節\n- Global / 單題庫分析\n- 題庫熟練度\n\n### 首頁\n\n首頁提供：\n\n- 今日目標\n- 全站連續學習\n- 繼續上次練習\n- 今日複習\n- 快速錯題\n- 考前衝刺\n- 完整備份提醒\n\n### 顯示與離線\n\n- PWA App Shell\n- 離線刷題與本機紀錄\n- Light / Dark\n- Academy / Epic / Focus\n- Full / Reduced / Off 場景效果\n- 手機、平板、桌面 RWD\n- 減少動畫、字體大小、選項間距\n\n## 題庫來源\n\n### 作者題庫\n\n作者題庫由網站維護者透過 `author-banks.json` 發布。使用者按下「加入我的題庫」後才會下載並寫入 IndexedDB。\n\n目前作者題庫：\n\n- ERP 規劃師題庫 2025.09 V06\n- Schema 2.0\n- 443 題\n- 題庫版本 1.2.0\n\n作者題庫有新版時，網站會顯示更新提示；使用者自行決定是否更新。\n\n### 自行新增\n\n使用者可以匯入：\n\n- 正式 ZIP 題庫包\n- 單一 JSON\n- 完整題庫資料夾\n\n自行新增的題庫只存在目前瀏覽器，不會自動上傳 GitHub。\n\n## 正式題庫 Package\n\n建議交換格式：\n\n```text\nbank/\n├── manifest.json\n├── questions.json\n└── assets/\n    └── images/\n```\n\nSchema 版本目前為 `2.0`。\n\n支援題型：\n\n- `single-choice`\n- `multiple-choice`\n- `true-false`\n- `fill-in`\n\n題庫匯入前會檢查永久題目 ID、題型、答案、選項、圖片路徑與其他結構問題。\n\n## 題庫分享\n\n進入已加入的題庫後可使用「匯出題庫 ZIP」。\n\n匯出的 ZIP 包含：\n\n- `manifest.json`\n- `questions.json`\n- 題庫內 `assets/`\n\n不包含個人的：\n\n- 錯題狀態\n- 收藏\n- 不熟題\n- 筆記\n- 熟練度\n- 作答歷史\n- 模擬考紀錄\n\n因此題庫內容與個人學習資料維持分離。\n\n## AI 題庫製作流程\n\n網站不串接 AI API，也不儲存 API Key。\n\n可在「題庫工作室」使用 Schema 2.0 題庫結構與提示詞，將外部 AI 整理的結果帶回網站驗證、批次建題與人工修正。AI 產出的題目與答案仍應人工核對。\n\n## 本機資料\n\n主要資料儲存在 IndexedDB，包括：\n\n- banks\n- questions\n- assets\n- attempts\n- progress\n- favorites\n- notes\n- mastery\n- reviewSchedule\n- sessions\n- studioDrafts\n- learningGoals\n\n少量 UI / release metadata 使用 localStorage。\n\n如果清除網站資料、更換瀏覽器或更換裝置，本機資料不會自動同步。請定期到「設定」下載完整備份。\n\n### 內部相容性名稱\n\nv4.0 **刻意保留**下列歷史 namespace：\n\n```text\nIndexedDB: moxin-quiz-v3\nSettings:  moxin.v3.settings\n```\n\n這不是網站仍停留在 v3，而是為了讓既有 v3.3 使用者直接升級後仍讀得到原本資料與設定。\n\n同樣地，`v3.html` 目前保留為既有網址的相容入口，內容與 `index.html` 相同。\n\n## 完整備份\n\n完整備份涵蓋題庫、assets、學習紀錄、Session、工作室草稿與學習目標。\n\nv4.0 RC1 已以真實 Chromium 做過：\n\n```text\n下載完整備份\n→ 全新 Browser Context\n→ 從備份還原\n→ 確認題庫與資料重新出現\n```\n\n## PWA / Offline\n\nService Worker 快取 App Shell。已加入 IndexedDB 的題庫在離線狀態仍可練習並保存本機進度。\n\nRC1 已驗證：\n\n```text\nOnline\n→ Service Worker ready\n→ Offline\n→ Reload\n→ 網站與本機題庫仍可開啟\n```\n\n作者題庫本體不會全部預先塞入 App Shell；只有使用者實際加入後才保存到 IndexedDB。\n\n## Legacy v2\n\n舊版網站封存於：\n\n```text\nlegacy-v2/\n```\n\n舊網址 `legacy-v2.html` 只保留相容轉址。\n\n舊版包含當時的 Legacy JSON 題庫與機車題庫歷史資料。機車題庫未確認是否為最新版本，因此沒有升級成目前作者題庫，也不應視為推薦題庫。\n\n## 開發與測試\n\n本專案維持零前端框架與零執行期第三方 CDN 依賴。\n\n完整 repository regression：\n\n```bash\nnpm run ci\n```\n\nRC1 真實瀏覽器測試：\n\n```bash\nnpm run audit:browser\n```\n\nBrowser Audit 覆蓋：\n\n- 新使用者與 Empty State\n- 回訪使用者\n- 真實作答與 Feedback\n- 模擬考\n- 7 種 Viewport\n- Light / Dark\n- Academy / Epic / Focus\n- 大量題庫\n- 長文字\n- Accessibility\n- Backup Round Trip\n- v3.3 → v4.0 IndexedDB migration\n- Offline PWA\n\n主要結構：\n\n```text\n/\n├── index.html\n├── v3.html\n├── manifest.webmanifest\n├── service-worker.js\n├── author-banks.json\n├── author-banks/\n├── src/\n├── styles/\n├── tests/\n├── docs/\n├── examples/\n└── legacy-v2/\n```\n\n## 部署\n\nGitHub Pages 正式設定：\n\n```text\nBranch: main\nFolder: / (root)\n```\n\nRC1 開發與驗收仍在：\n\n```text\nv4.0-learning-studio\n```\n\n正式入口為 repository Pages 根網址；`v3.html` 保留相容入口。\n\n下一階段為 **Main Cutover Rehearsal**，通過後才會進行正式 v4.0 Production cutover。\n";
const REPLACEMENTS = [{"path": "v3.html", "search": "<meta name=\"description\" content=\"墨忻刷題網 v3 題庫、複習、模擬考、統計與本機學習介面\" />", "replacement": "<meta name=\"description\" content=\"墨忻刷題網 v4.0 本機優先個人學習平台：題庫工作室、練習、複習、學習目標、考前衝刺、模擬考與統計\" />", "label": "v3 compatibility metadata description"}, {"path": "v3.html", "search": "<title>墨忻刷題網 v3.3</title>", "replacement": "<title>墨忻刷題網 v4.0 RC1</title>", "label": "v3 compatibility title"}, {"path": "v3.html", "search": "<h1>墨忻刷題網 <span class=\"version-badge\">v3.3</span><span class=\"preview-badge\">v4 preview</span></h1>", "replacement": "<h1>墨忻刷題網 <span class=\"version-badge\">v4.0 RC1</span></h1>", "label": "v3 compatibility header version"}, {"path": "index.html", "search": "<meta name=\"description\" content=\"墨忻刷題網 v3 題庫、複習、模擬考、統計與本機學習介面\" />", "replacement": "<meta name=\"description\" content=\"墨忻刷題網 v4.0 本機優先個人學習平台：題庫工作室、練習、複習、學習目標、考前衝刺、模擬考與統計\" />", "label": "production metadata description"}, {"path": "index.html", "search": "<title>墨忻刷題網 v3.3</title>", "replacement": "<title>墨忻刷題網 v4.0 RC1</title>", "label": "production title"}, {"path": "index.html", "search": "<h1>墨忻刷題網 <span class=\"version-badge\">v3.3</span><span class=\"preview-badge\">v4 preview</span></h1>", "replacement": "<h1>墨忻刷題網 <span class=\"version-badge\">v4.0 RC1</span></h1>", "label": "production header version"}, {"path": "src/app/config.js", "search": "  appName: 'MoXin Quiz',\n  schemaVersion: '2.0',", "replacement": "  appName: 'MoXin Quiz',\n  appVersion: '4.0.0-rc.1',\n  releaseChannel: 'rc1',\n  schemaVersion: '2.0',", "label": "APP_CONFIG release metadata"}, {"path": "service-worker.js", "search": "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-19';", "replacement": "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-20';", "label": "RC1 metadata App Shell revision"}];

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
  if (first < 0) throw new Error('Missing RC1 metadata anchor: ' + label);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error('RC1 metadata anchor is not unique: ' + label);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

write('README.md', NEW_README);
write('tests/v40-rc1-release-metadata-run.mjs', METADATA_TEST);
write('docs/V4_0_RC1_RELEASE_METADATA.md', METADATA_DOC);

// Legacy v3.3 milestone regression must not freeze the public version badge.
// Its purpose is tools/export/legacy compatibility; RC1 now owns release-version assertions.
{
  const path = 'tests/v33-run.mjs';
  let source = read(path);

  const frozen = 'assert.match(index, /v3\\\\.3/);';
  const flexible =
    'assert.match(index, /<span class="version-badge">v[0-9][^<]*<\\\\/span>/);';

  if (source.includes(frozen)) {
    source = replaceOne(
      source,
      frozen,
      flexible,
      'v3.3 milestone release-version assertion',
    );
  } else if (!source.includes(flexible)) {
    throw new Error(
      'tests/v33-run.mjs version assertion is neither expected frozen nor flexible form',
    );
  }

  write(path, source);
}

for (const item of REPLACEMENTS) {
  const source = read(item.path);
  write(item.path, replaceOne(source, item.search, item.replacement, item.label));
}

if (read('index.html') !== read('v3.html')) {
  throw new Error('RC1 metadata cleanup must preserve index.html === v3.html');
}

// Manifest release-facing copy.
{
  const path = 'manifest.webmanifest';
  const manifest = JSON.parse(read(path));
  manifest.description =
    '墨忻刷題網 v4.0：本機優先的題庫工作室、練習、複習、學習目標、考前衝刺與學習統計平台。';
  write(path, JSON.stringify(manifest, null, 2) + '\n');
}

// Promote the release preflight name from v3 to v4 while preserving the tested logic.
{
  const oldPath = 'scripts/v3-release-preflight.mjs';
  let source = read(oldPath);
  source = source
    .replaceAll('V3 release preflight', 'V4 RC1 release preflight')
    .replaceAll('tested v3.html release entry', 'tested v3.html compatibility entry');
  write('scripts/v4-release-preflight.mjs', source);
}

// package metadata + regression chain.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));

  pkg.name = 'moxin-quiz-site-v4-rc1';
  pkg.scripts.preflight = 'node scripts/v4-release-preflight.mjs';

  const anchor =
    'node tests/v40-p5-final-audit-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const replacement =
    'node tests/v40-p5-final-audit-run.mjs && node tests/v40-rc1-release-metadata-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';

  if (!pkg.scripts.test.includes('v40-rc1-release-metadata-run.mjs')) {
    if (!pkg.scripts.test.includes(anchor)) {
      throw new Error('package.json RC1 metadata regression insertion anchor missing');
    }
    pkg.scripts.test = pkg.scripts.test.replace(anchor, replacement);
  }

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

// Roadmap: everything except the cutover rehearsal is now complete.
{
  const path = 'docs/V4_0_PLAN.md';
  let plan = read(path);

  const oldSection =
`## RC1 — v4.0 Release Readiness

**狀態：In Progress**

- v3.3 → v4.0 IndexedDB upgrade simulation
- 完整備份 export / restore round trip
- 真實 Chromium 使用者流程
- Desktop / Tablet / Mobile viewport matrix
- Light / Dark × Academy / Epic / Focus visual matrix
- 大量題庫 / 長文字 / Empty State
- Accessibility / horizontal overflow / runtime error audit
- Offline PWA reload
- Release metadata cleanup
- Main cutover rehearsal
`;

  const newSection =
`## RC1 — v4.0 Release Readiness

**狀態：In Progress（僅剩 Main Cutover Rehearsal）**

- ✅ v3.3 → v4.0 IndexedDB upgrade simulation
- ✅ 完整備份 export / restore round trip
- ✅ 真實 Chromium 使用者流程
- ✅ Desktop / Tablet / Mobile viewport matrix
- ✅ Light / Dark × Academy / Epic / Focus visual matrix
- ✅ 大量題庫 / 長文字 / Empty State
- ✅ Accessibility / horizontal overflow / runtime error audit
- ✅ Offline PWA reload
- ✅ Release metadata cleanup
- ⏳ Main cutover rehearsal
`;

  if (!plan.includes(oldSection)) {
    throw new Error('RC1 roadmap block does not match expected pre-cleanup state');
  }

  write(path, plan.replace(oldSection, newSection));
}

// Changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);

  if (!changelog.includes('## RC1 — Release Metadata Cleanup')) {
    const anchor = '## RC1 — Browser UX Audit';
    const section =
      '## RC1 — Release Metadata Cleanup\n' +
      '- 使用者可見版本由 v3.3 + v4 preview 整理為 v4.0 RC1。\n' +
      '- 更新 title、meta description、PWA manifest 與 README。\n' +
      '- APP_CONFIG 新增 appVersion=4.0.0-rc.1 / releaseChannel=rc1。\n' +
      '- package metadata 升級為 moxin-quiz-site-v4-rc1；npm preflight 改用 v4 release preflight。\n' +
      '- 保留 moxin-quiz-v3 IndexedDB、moxin.v3.settings 與 v3.html 作相容 namespace / entry，不做高風險重新命名。\n' +
      '- 新增 RC1 release metadata regression。\n' +
      '- APP cache 更新至 r2k.5-20。\n' +
      '- RC1 僅剩 Main Cutover Rehearsal。\n\n';

    if (!changelog.includes(anchor)) {
      throw new Error('RC1 Browser UX changelog anchor missing');
    }

    changelog = changelog.replace(anchor, section + anchor);
  }

  write(path, changelog);
}

// Strong self-check.
{
  const index = read('index.html');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const config = read('src/app/config.js');
  const readme = read('README.md');
  const pkg = JSON.parse(read('package.json'));
  const sw = read('service-worker.js');

  if (!index.includes('<title>墨忻刷題網 v4.0 RC1</title>')) {
    throw new Error('RC1 title missing');
  }
  if (!index.includes('<span class="version-badge">v4.0 RC1</span>')) {
    throw new Error('RC1 version badge missing');
  }
  if (/v4 preview|v3\.3/i.test(index)) {
    throw new Error('Old visible version metadata remains in production HTML');
  }
  if (!manifest.description.includes('題庫工作室')) {
    throw new Error('RC1 manifest description missing v4 product scope');
  }
  if (!config.includes("appVersion: '4.0.0-rc.1'")) {
    throw new Error('APP_CONFIG appVersion missing');
  }
  if (!config.includes("releaseChannel: 'rc1'")) {
    throw new Error('APP_CONFIG releaseChannel missing');
  }
  if (!readme.includes('內部相容性名稱')) {
    throw new Error('README compatibility namespace explanation missing');
  }
  if (pkg.name !== 'moxin-quiz-site-v4-rc1') {
    throw new Error('package metadata was not promoted to v4 RC1');
  }
  if (pkg.scripts.preflight !== 'node scripts/v4-release-preflight.mjs') {
    throw new Error('v4 release preflight is not active');
  }
  if (!pkg.scripts.test.includes('v40-rc1-release-metadata-run.mjs')) {
    throw new Error('RC1 metadata regression missing from npm test');
  }
  if (!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-20'")) {
    throw new Error('RC1 metadata cache revision missing');
  }
  if (read('index.html') !== read('v3.html')) {
    throw new Error('RC1 release entries diverged');
  }
}

console.log('RC1 Release Metadata Cleanup applied successfully.');

const PRODUCTION_TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { APP_CONFIG } from '../src/app/config.js';\n\nconst index = fs.readFileSync('index.html', 'utf8');\nconst v3 = fs.readFileSync('v3.html', 'utf8');\nconst manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));\nconst readme = fs.readFileSync('README.md', 'utf8');\nconst pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\nconst sw = fs.readFileSync('service-worker.js', 'utf8');\nconst plan = fs.readFileSync('docs/V4_0_PLAN.md', 'utf8');\n\nassert.equal(index, v3);\nassert.match(index, /<title>墨忻刷題網 v4\\.0<\\/title>/);\nassert.match(index, /<span class=\"version-badge\">v4\\.0<\\/span>/);\nassert.doesNotMatch(index, /v4 preview|v3\\.3|v4\\.0 RC1/i);\n\nassert.equal(APP_CONFIG.appVersion, '4.0.0');\nassert.equal(APP_CONFIG.releaseChannel, 'production');\nassert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');\nassert.equal(APP_CONFIG.dbVersion, 3);\n\nassert.equal(manifest.start_url, './');\nassert.equal(manifest.scope, './');\n\nassert.match(readme, /\\*\\*v4\\.0\\*\\*/);\nassert.match(readme, /Branch: main/);\nassert.match(readme, /Release tag: v4\\.0\\.0/);\n\nassert.equal(pkg.name, 'moxin-quiz-site-v4');\nassert.match(pkg.scripts.test, /v40-production-release-run\\.mjs/);\nassert.doesNotMatch(pkg.scripts.test, /v40-rc1-release-metadata-run\\.mjs|v40-rc1-cutover-contract-run\\.mjs/);\n\nassert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-21'/);\nassert.match(plan, /## v4\\.0 Production/);\nassert.match(plan, /\\*\\*狀態：Released\\*\\*/);\n\nfor (const file of [\n  '.github/workflows/v4-production-cutover.yml',\n  'scripts/finalize-v4-production.mjs',\n]) {\n  assert.equal(fs.existsSync(file), false);\n}\n\nconsole.log('MoXin Quiz v4.0 production release contract passed.');\n";
const PRODUCTION_DOC = "# 墨忻刷題網 v4.0 — Production Release\n\nVersion: **v4.0**  \nTag: **v4.0.0**  \nChannel: **production**\n\n正式發布前已完成 RC1 Release Readiness、Main Cutover Rehearsal、真實 Chromium 使用者流程、RWD／主題矩陣、Backup/Restore、v3.3 → v4.0 migration、Offline PWA、完整 regression、synthetic merge 與 rollback rehearsal。\n\nProduction 使用：\n\n```text\nBranch: main\nPath: /\n```\n\n相容 namespace 刻意保留：\n\n```text\nIndexedDB: moxin-quiz-v3\nSettings: moxin.v3.settings\nCompatibility entry: v3.html\n```\n\n正式 PR 使用 Merge Commit；release notes 保留 merge SHA 作 rollback anchor。\n";

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
}
function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error('Missing production cutover anchor: ' + label);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error('Production cutover anchor is not unique: ' + label);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}
function replaceOrVerify(source, search, replacement, verify, label) {
  if (source.includes(search)) return replaceOnce(source, search, replacement, label);
  if (source.includes(verify)) return source;
  throw new Error('Unexpected production cutover state: ' + label);
}

for (const path of ['index.html', 'v3.html']) {
  let html = read(path);
  html = replaceOrVerify(
    html,
    '<title>墨忻刷題網 v4.0 RC1</title>',
    '<title>墨忻刷題網 v4.0</title>',
    '<title>墨忻刷題網 v4.0</title>',
    path + ' title',
  );
  html = replaceOrVerify(
    html,
    '<span class="version-badge">v4.0 RC1</span>',
    '<span class="version-badge">v4.0</span>',
    '<span class="version-badge">v4.0</span>',
    path + ' badge',
  );
  write(path, html);
}
if (read('index.html') !== read('v3.html')) throw new Error('index/v3 diverged');

{
  const path = 'src/app/config.js';
  let source = read(path);
  source = replaceOrVerify(source, "  appVersion: '4.0.0-rc.1',", "  appVersion: '4.0.0',", "  appVersion: '4.0.0',", 'appVersion');
  source = replaceOrVerify(source, "  releaseChannel: 'rc1',", "  releaseChannel: 'production',", "  releaseChannel: 'production',", 'releaseChannel');
  write(path, source);
}

{
  const path = 'service-worker.js';
  let source = read(path);
  source = replaceOrVerify(
    source,
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-20';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-21';",
    "const CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-21';",
    'service worker cache',
  );
  write(path, source);
}

{
  const path = 'README.md';
  let source = read(path);
  source = replaceOrVerify(
    source,
    '墨忻刷題網 **v4.0 RC1** 是一個部署於 GitHub Pages 的 **Local-first 個人學習與刷題平台**。',
    '墨忻刷題網 **v4.0** 是一個部署於 GitHub Pages 的 **Local-first 個人學習與刷題平台**。',
    '墨忻刷題網 **v4.0** 是一個部署於 GitHub Pages 的 **Local-first 個人學習與刷題平台**。',
    'README label',
  );
  source = replaceOrVerify(
    source,
    '> RC1 代表 v4.0 已完成主要功能與真實瀏覽器 Release Readiness 測試，但尚未進行正式 `main` cutover。',
    '> v4.0 已完成 Release Readiness 與 Main Cutover Rehearsal，正式版由 `main` 部署。',
    '> v4.0 已完成 Release Readiness 與 Main Cutover Rehearsal，正式版由 `main` 部署。',
    'README state',
  );
  source = source
    .replaceAll('v4.0 RC1 已以真實 Chromium 做過：', 'v4.0 發布前已以真實 Chromium 做過：')
    .replaceAll('RC1 已驗證：', 'v4.0 發布前已驗證：');

  const oldDeploy = `RC1 開發與驗收仍在：

\`\`\`text
v4.0-learning-studio
\`\`\`

正式入口為 repository Pages 根網址；\`v3.html\` 保留相容入口。

下一階段為 **Main Cutover Rehearsal**，通過後才會進行正式 v4.0 Production cutover。`;

  const newDeploy = `正式版部署：

\`\`\`text
Branch: main
Folder: / (root)
Release tag: v4.0.0
\`\`\`

正式入口為 repository Pages 根網址；\`v3.html\` 保留相容入口。`;

  source = replaceOrVerify(source, oldDeploy, newDeploy, newDeploy, 'README deploy');
  write(path, source);
}

write('tests/v40-production-release-run.mjs', PRODUCTION_TEST);
write('docs/V4_0_PRODUCTION_RELEASE.md', PRODUCTION_DOC);

{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  pkg.name = 'moxin-quiz-site-v4';

  const commands = String(pkg.scripts.test || '')
    .split(/\s*&&\s*/)
    .map(x => x.trim())
    .filter(Boolean)
    .filter(x =>
      !x.includes('v40-rc1-release-metadata-run.mjs') &&
      !x.includes('v40-rc1-cutover-contract-run.mjs') &&
      !x.includes('v40-production-release-run.mjs')
    );

  const i = commands.findIndex(x => x.includes('v40-p5-final-audit-run.mjs'));
  if (i < 0) throw new Error('P5 final audit missing from test chain');
  commands.splice(i + 1, 0, 'node tests/v40-production-release-run.mjs');
  pkg.scripts.test = commands.join(' && ');

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

{
  const path = 'docs/V4_0_PLAN.md';
  let plan = read(path);
  if (!plan.includes('## v4.0 Production')) {
    const anchor = '## 相容性要求';
    const section = `## v4.0 Production

**狀態：Released**

- ✅ RC1 Release Readiness
- ✅ Main Cutover Rehearsal
- ✅ Production metadata
- ✅ Production regression contract
- ✅ GitHub Pages main/root cutover
- ✅ Public production smoke
- ✅ v4.0.0 release tag

`;
    if (!plan.includes(anchor)) throw new Error('Production roadmap anchor missing');
    plan = plan.replace(anchor, section + anchor);
  }
  write(path, plan);
}

{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);
  if (!changelog.includes('## v4.0 Production Cutover')) {
    const anchor = '## RC1 — Main Cutover Rehearsal';
    const section =
      '## v4.0 Production Cutover\n' +
      '- 公開版本由 v4.0 RC1 升為 v4.0 / appVersion 4.0.0 / production channel。\n' +
      '- APP cache 更新至 r2k.5-21。\n' +
      '- Production regression 取代 RC1-only release gates。\n' +
      '- 正式 PR 使用 Merge Commit，保留 merge SHA 作 rollback anchor。\n' +
      '- GitHub Pages source 切換／確認為 main + root。\n' +
      '- 公開網址完成 production smoke 並建立 v4.0.0 GitHub Release。\n\n';
    if (!changelog.includes(anchor)) throw new Error('Production changelog anchor missing');
    changelog = changelog.replace(anchor, section + anchor);
  }
  write(path, changelog);
}

for (const path of [
  '.github/workflows/v4-production-cutover.yml',
  'scripts/finalize-v4-production.mjs',
]) {
  if (fs.existsSync(path)) fs.rmSync(path);
}

{
  const index = read('index.html');
  const config = read('src/app/config.js');
  const sw = read('service-worker.js');
  const pkg = JSON.parse(read('package.json'));

  if (!index.includes('<title>墨忻刷題網 v4.0</title>')) throw new Error('Production title missing');
  if (!index.includes('<span class="version-badge">v4.0</span>')) throw new Error('Production badge missing');
  if (/v4\.0 RC1|v4 preview|v3\.3/i.test(index)) throw new Error('Pre-production marker remains');
  if (!config.includes("appVersion: '4.0.0'")) throw new Error('Production appVersion missing');
  if (!config.includes("releaseChannel: 'production'")) throw new Error('Production channel missing');
  if (!sw.includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-21'")) throw new Error('Production cache missing');
  if (pkg.name !== 'moxin-quiz-site-v4') throw new Error('Production package name missing');
  if (!pkg.scripts.test.includes('v40-production-release-run.mjs')) throw new Error('Production test missing');
  if (read('index.html') !== read('v3.html')) throw new Error('Production entries diverged');
}

console.log('v4.0 production metadata finalized successfully.');

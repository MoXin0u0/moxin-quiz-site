const CONTRACT_TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { APP_CONFIG } from '../src/app/config.js';\n\nconst index = fs.readFileSync('index.html', 'utf8');\nconst v3 = fs.readFileSync('v3.html', 'utf8');\nconst manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));\nconst sw = fs.readFileSync('service-worker.js', 'utf8');\nconst pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\nconst plan = fs.readFileSync('docs/V4_0_PLAN.md', 'utf8');\n\nassert.equal(index, v3, 'index.html and v3.html must remain byte-identical.');\nassert.match(index, /<title>墨忻刷題網 v4\\.0 RC1<\\/title>/);\nassert.match(index, /<span class=\"version-badge\">v4\\.0 RC1<\\/span>/);\n\nassert.equal(APP_CONFIG.appVersion, '4.0.0-rc.1');\nassert.equal(APP_CONFIG.releaseChannel, 'rc1');\nassert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');\nassert.equal(APP_CONFIG.dbVersion, 3);\n\nassert.equal(manifest.start_url, './');\nassert.equal(manifest.scope, './');\n\nassert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\\.0\\.0-r2k\\.5-20'/);\nassert.match(sw, /key\\.startsWith\\('moxin-quiz-v3-'\\)/);\nassert.match(sw, /key\\.startsWith\\('moxin-quiz-scenes-'\\)/);\nassert.match(sw, /cache\\.match\\('\\.\\/index\\.html'\\)/);\nassert.match(sw, /cache\\.match\\('\\.\\/v3\\.html'\\)/);\n\nassert.equal(pkg.scripts.preflight, 'node scripts/v4-release-preflight.mjs');\nassert.equal(fs.existsSync('scripts/v4-cutover-rehearsal.mjs'), true);\nassert.match(pkg.scripts.test, /v40-rc1-cutover-contract-run\\.mjs/);\n\nassert.match(plan, /RC1 — v4\\.0 Release Readiness/);\nassert.match(plan, /狀態：Stable（Main Cutover Rehearsal）/);\nassert.match(plan, /✅ Main cutover rehearsal/);\n\nfor (const forbidden of [\n  '.github/workflows/apply-rc1-main-cutover-rehearsal.yml',\n  'scripts/apply-rc1-main-cutover-rehearsal.mjs',\n]) {\n  assert.equal(fs.existsSync(forbidden), false, `One-time installer must not enter release candidate: ${forbidden}`);\n}\n\nconsole.log('MoXin Quiz v4.0 RC1 cutover contract tests passed.');\n";
const REHEARSAL_SCRIPT = "import fs from 'node:fs';\nimport path from 'node:path';\nimport { spawnSync } from 'node:child_process';\n\nconst root = process.cwd();\nconst outDir = path.resolve(process.env.CUTOVER_REPORT_DIR || 'artifacts/rc1-main-cutover-rehearsal');\nfs.mkdirSync(outDir, { recursive: true });\n\nconst mainRef = process.env.CUTOVER_MAIN_REF || 'origin/main';\nconst candidateRef = process.env.CUTOVER_CANDIDATE_REF || 'HEAD';\n\nfunction git(args, { allowFailure = false } = {}) {\n  const result = spawnSync('git', args, {\n    cwd: root,\n    encoding: 'utf8',\n  });\n  if (!allowFailure && result.status !== 0) {\n    throw new Error(`git ${args.join(' ')} failed:\\n${result.stderr || result.stdout}`);\n  }\n  return result;\n}\n\nfunction value(args) {\n  return git(args).stdout.trim();\n}\n\nconst mainSha = value(['rev-parse', mainRef]);\nconst candidateSha = value(['rev-parse', candidateRef]);\nconst mergeBase = value(['merge-base', mainRef, candidateRef]);\n\nconst ancestor = git(['merge-base', '--is-ancestor', mainRef, candidateRef], { allowFailure: true });\nconst mainIsAncestor = ancestor.status === 0;\n\nconst ahead = Number(value(['rev-list', '--count', `${mainRef}..${candidateRef}`]));\nconst behind = Number(value(['rev-list', '--count', `${candidateRef}..${mainRef}`]));\nconst changedFiles = value(['diff', '--name-only', `${mainRef}...${candidateRef}`])\n  .split('\\n')\n  .map(item => item.trim())\n  .filter(Boolean);\n\nconst candidateFiles = value(['ls-tree', '-r', '--name-only', candidateRef])\n  .split('\\n')\n  .filter(Boolean);\n\nconst forbiddenInstallerFiles = candidateFiles.filter(file =>\n  /^\\.github\\/workflows\\/apply-.*\\.ya?ml$/.test(file) ||\n  /^scripts\\/apply-.*\\.mjs$/.test(file)\n);\n\nconst checks = {\n  mainIsAncestor,\n  aheadGreaterThanZero: ahead > 0,\n  behindIsZero: behind === 0,\n  mergeBaseIsMain: mergeBase === mainSha,\n  noOneTimeInstallers: forbiddenInstallerFiles.length === 0,\n};\n\nconst failures = Object.entries(checks)\n  .filter(([, ok]) => !ok)\n  .map(([name]) => name);\n\nconst report = {\n  generatedAt: new Date().toISOString(),\n  repository: process.env.GITHUB_REPOSITORY || null,\n  mainRef,\n  candidateRef,\n  mainSha,\n  candidateSha,\n  mergeBase,\n  ahead,\n  behind,\n  changedFileCount: changedFiles.length,\n  forbiddenInstallerFiles,\n  checks,\n  failures,\n};\n\nfs.writeFileSync(\n  path.join(outDir, 'git-state.json'),\n  JSON.stringify(report, null, 2),\n  'utf8',\n);\n\nconst markdown = `# RC1 Main Cutover Rehearsal — Git State\n\n- Generated: ${report.generatedAt}\n- Main: \\`${mainSha}\\`\n- Candidate: \\`${candidateSha}\\`\n- Merge base: \\`${mergeBase}\\`\n- Ahead: **${ahead}**\n- Behind: **${behind}**\n- Changed files: **${changedFiles.length}**\n- Main is ancestor: **${mainIsAncestor ? 'YES' : 'NO'}**\n- One-time installer files in candidate: **${forbiddenInstallerFiles.length}**\n\n## Contract\n\n- main must be an ancestor of the release candidate\n- candidate must be ahead of main\n- candidate must not be behind main\n- merge base must equal current main\n- one-time apply workflows / scripts must not enter production\n\n${failures.length ? `## Failures\\n\\n${failures.map(item => `- ${item}`).join('\\n')}\\n` : '## Result\\n\\nPASS\\n'}\n`;\n\nfs.writeFileSync(path.join(outDir, 'git-state.md'), markdown, 'utf8');\nconsole.log(markdown);\n\nif (failures.length) process.exit(1);\n";
const DOC = "# 墨忻刷題網 v4.0 — RC1 Main Cutover Rehearsal\n\n## 定位\n\n此階段只做「正式合併的完整演練」，不會修改遠端 `main`。\n\n目前 `v4.0-learning-studio` 與 `main` 的關係必須滿足：\n\n```text\nmain 是 release candidate 的祖先\ncandidate ahead > 0\ncandidate behind = 0\n```\n\n因此正式 cutover 不需要處理 main-side divergence。\n\n## 演練方式\n\nGitHub Actions 會：\n\n```text\ncheckout v4.0-learning-studio\n→ 套用 rehearsal contract\n→ npm run ci\n→ 在本機建立 candidate commit\n→ 建立 temporary worktree 指向 origin/main\n→ 使用 --no-ff 模擬正式 merge commit\n→ 在「合併後的 tree」重新跑 npm run ci\n→ 啟動 HTTP server 做 production-root smoke\n→ 模擬 git revert -m 1 rollback\n→ 驗證 rollback tree 完全回到 origin/main\n→ 全綠後才把 rehearsal contract commit push 回 v4 branch\n```\n\n遠端 `main` 在整個 workflow 中不會被 push。\n\n## 為什麼模擬 Merge Commit\n\n正式發布建議透過 Pull Request：\n\n```text\nv4.0-learning-studio\n→ main\n→ Create a merge commit\n```\n\n而不是直接 force push 或手動重設 `main`。\n\n原因是若正式發布後發現嚴重問題，可用：\n\n```bash\ngit revert -m 1 <release-merge-commit>\n```\n\n建立正常的 rollback commit，不需要改寫 `main` 歷史。\n\nRehearsal 會真的在 temporary worktree 做一次這種 revert，並要求 revert 後的 tree 與目前 `origin/main` 完全相同。\n\n## Production-root Smoke\n\nSynthetic merge 完成後會啟動本機 HTTP server，驗證：\n\n- `/` 可以開啟\n- `/` 顯示 `v4.0 RC1`\n- `/v3.html` 可以開啟\n- `/` 與 `/v3.html` byte-identical\n- `manifest.webmanifest` 可讀\n- `service-worker.js` 可讀\n- Service Worker cache revision 為 `r2k.5-20`\n- `legacy-v2.html` 相容入口仍存在\n\n## GitHub Pages 注意事項\n\nRepository 的 Pages deployment history 顯示近期部署的 `head_branch` 是：\n\n```text\nv4.0-learning-studio\n```\n\n因此目前實際 Pages source 與 README 所寫的「正式 Branch: main」並不一致。\n\n這不是程式碼 regression，但它是正式 cutover 前必須處理的 deployment setting。\n\nRehearsal workflow 會嘗試透過 GitHub REST API 讀取 Pages source：\n\n- 若能取得：寫入 artifact report\n- 若權限不足：留下 `unavailable`，不因此誤判程式碼失敗\n\n正式 Production cutover 時必須確認 Pages source 最終為：\n\n```text\nBranch: main\nPath: /\n```\n\n## 已經不重跑的高成本項目\n\n以下已在 RC1 Browser UX Audit 全綠，不需要在 cutover rehearsal 重複 56 張 screenshot：\n\n- 7 viewport\n- Light / Dark\n- Academy / Epic / Focus\n- Heavy library\n- Backup round trip\n- v3.3 → v4 migration\n- Offline PWA\n- Accessibility\n\nCutover rehearsal 專注在「合併之後是否還是同一個可發布產品」。\n\n## RC1 完成條件\n\n本 workflow 全綠後，RC1 可標：\n\n```text\nStable（Main Cutover Rehearsal）\n```\n\n接著才進入真正 Production Cutover。\n\nProduction Cutover 本身應另外處理：\n\n1. 將 RC1 metadata 升為正式 v4.0\n2. 建立 `v4.0-learning-studio → main` Pull Request\n3. 使用 Merge Commit\n4. 將 GitHub Pages source 確認／切換為 `main / root`\n5. 等 Pages deployment 綠燈\n6. 對公開網址做 production smoke\n7. 保留 release merge SHA，作 rollback anchor\n";

import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
}
function replaceOne(source, search, replacement, label) {
  const i = source.indexOf(search);
  if (i < 0) throw new Error('Missing cutover rehearsal anchor: ' + label);
  if (source.indexOf(search, i + search.length) >= 0) {
    throw new Error('Cutover rehearsal anchor is not unique: ' + label);
  }
  return source.slice(0, i) + replacement + source.slice(i + search.length);
}

write('tests/v40-rc1-cutover-contract-run.mjs', CONTRACT_TEST);
write('scripts/v4-cutover-rehearsal.mjs', REHEARSAL_SCRIPT);
write('docs/V4_0_RC1_MAIN_CUTOVER_REHEARSAL.md', DOC);

// Add durable cutover contract to the normal regression chain.
{
  const path = 'package.json';
  const pkg = JSON.parse(read(path));

  if (!pkg.scripts.test.includes('v40-rc1-cutover-contract-run.mjs')) {
    const anchor =
      'node tests/v40-rc1-release-metadata-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
    const replacement =
      'node tests/v40-rc1-release-metadata-run.mjs && node tests/v40-rc1-cutover-contract-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';

    if (!pkg.scripts.test.includes(anchor)) {
      throw new Error('package.json cutover contract insertion anchor missing');
    }
    pkg.scripts.test = pkg.scripts.test.replace(anchor, replacement);
  }

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

// RC1 becomes Stable only if this local candidate later passes the full rehearsal
// and the workflow reaches its final push step.
{
  const path = 'docs/V4_0_PLAN.md';
  let plan = read(path);

  const oldSection =
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

  const newSection =
`## RC1 — v4.0 Release Readiness

**狀態：Stable（Main Cutover Rehearsal）**

- ✅ v3.3 → v4.0 IndexedDB upgrade simulation
- ✅ 完整備份 export / restore round trip
- ✅ 真實 Chromium 使用者流程
- ✅ Desktop / Tablet / Mobile viewport matrix
- ✅ Light / Dark × Academy / Epic / Focus visual matrix
- ✅ 大量題庫 / 長文字 / Empty State
- ✅ Accessibility / horizontal overflow / runtime error audit
- ✅ Offline PWA reload
- ✅ Release metadata cleanup
- ✅ Main cutover rehearsal
`;

  if (!plan.includes(oldSection)) {
    throw new Error('RC1 roadmap does not match expected pre-rehearsal state');
  }

  write(path, plan.replace(oldSection, newSection));
}

// Changelog.
{
  const path = 'docs/V4_0_CHANGELOG.md';
  let changelog = read(path);

  if (!changelog.includes('## RC1 — Main Cutover Rehearsal')) {
    const anchor = '## RC1 — Release Metadata Cleanup';
    const section =
      '## RC1 — Main Cutover Rehearsal\n' +
      '- 驗證 main 為 release candidate 祖先，candidate 不得 behind main。\n' +
      '- 使用 temporary worktree + --no-ff merge 模擬正式 PR merge commit。\n' +
      '- 在 synthetic post-merge tree 重跑完整 npm run ci / v4 preflight。\n' +
      '- 對合併後 root、v3.html、manifest、service worker、legacy-v2.html 做 HTTP smoke。\n' +
      '- 使用 git revert -m 1 模擬非破壞性 rollback，並要求 rollback tree 等同 origin/main。\n' +
      '- 新增 durable cutover contract regression 與 git-state artifact。\n' +
      '- 記錄 Pages deployment source 與 main/root 正式部署要求。\n' +
      '- RC1 標記 Stable；下一步為 Production Cutover。\n\n';

    if (!changelog.includes(anchor)) {
      throw new Error('Release Metadata changelog anchor missing');
    }

    changelog = changelog.replace(anchor, section + anchor);
  }

  write(path, changelog);
}

// Structural self-check.
{
  const pkg = JSON.parse(read('package.json'));
  const plan = read('docs/V4_0_PLAN.md');

  if (!pkg.scripts.test.includes('v40-rc1-cutover-contract-run.mjs')) {
    throw new Error('Cutover contract missing from npm test');
  }
  if (!plan.includes('**狀態：Stable（Main Cutover Rehearsal）**')) {
    throw new Error('RC1 Stable rehearsal marker missing');
  }
  if (read('index.html') !== read('v3.html')) {
    throw new Error('index.html and v3.html diverged');
  }
  if (!read('service-worker.js').includes("CACHE_VERSION = 'moxin-quiz-v3-4.0.0-r2k.5-20'")) {
    throw new Error('Unexpected Service Worker cache revision');
  }
}

console.log('RC1 Main Cutover Rehearsal package applied successfully.');

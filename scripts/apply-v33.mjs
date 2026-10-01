import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const p = value => path.join(root, value);
const exists = value => fs.existsSync(p(value));
const read = value => fs.readFileSync(p(value), 'utf8');
const write = (value, content) => {
  fs.mkdirSync(path.dirname(p(value)), { recursive: true });
  fs.writeFileSync(p(value), content);
};

function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) {
    throw new Error(`找不到 v3.3 更新定位點：${label}`);
  }
  return content.replace(before, after);
}

function move(source, target) {
  if (!exists(source)) {
    if (exists(target)) return;
    throw new Error(`Legacy 封存來源不存在：${source}`);
  }
  if (exists(target)) throw new Error(`Legacy 封存目標已存在：${target}`);
  fs.mkdirSync(path.dirname(p(target)), { recursive: true });
  fs.renameSync(p(source), p(target));
}

function removeIfExists(value) {
  if (exists(value)) fs.rmSync(p(value), { recursive: true, force: true });
}

function updateHtml(filename) {
  let html = read(filename);

  html = html
    .replace('<title>墨忻刷題網 v3.2</title>', '<title>墨忻刷題網 v3.3</title>')
    .replace(
      '<span class="version-badge">v3.2</span>',
      '<span class="version-badge">v3.3</span>',
    );

  if (!html.includes('styles/v3-v33.css')) {
    html = replaceOnce(
      html,
      '  <link rel="stylesheet" href="styles/v3-v31.css" />\n',
      '  <link rel="stylesheet" href="styles/v3-v31.css" />\n' +
      '  <link rel="stylesheet" href="styles/v3-v33.css" />\n',
      `${filename}: v3.3 stylesheet`,
    );
  }

  if (!html.includes('data-nav-tools')) {
    html = replaceOnce(
      html,
      '      <button class="nav-item" type="button" data-nav-stats>學習統計</button>\n' +
      '      <button class="nav-item" type="button" data-nav-settings>設定</button>',
      '      <button class="nav-item" type="button" data-nav-stats>學習統計</button>\n' +
      '      <button class="nav-item" type="button" data-nav-tools>題庫工具</button>\n' +
      '      <button class="nav-item" type="button" data-nav-settings>設定</button>',
      `${filename}: tools navigation`,
    );
  }

  if (!html.includes('id="toolsView"')) {
    html = replaceOnce(
      html,
      '    <section id="settingsView" data-view="settings" hidden>\n' +
      '      <div id="settingsArea"></div>\n' +
      '    </section>',
      '    <section id="toolsView" data-view="tools" hidden>\n' +
      '      <div id="toolsArea"></div>\n' +
      '    </section>\n\n' +
      '    <section id="settingsView" data-view="settings" hidden>\n' +
      '      <div id="settingsArea"></div>\n' +
      '    </section>',
      `${filename}: tools view`,
    );
  }

  return html;
}

function updateMainJs() {
  let js = read('src/app/main.js');

  js = replaceOnce(
    js,
    "  getBank,\n  getQuestionsByBank,",
    "  getBank,\n  getBankPackage,\n  getQuestionsByBank,",
    'main.js: getBankPackage import',
  );

  if (!js.includes("from '../question-bank/zip-writer.js'")) {
    js = replaceOnce(
      js,
      "} from '../question-bank/author-catalog.js';\n",
      "} from '../question-bank/author-catalog.js';\n" +
      "import { downloadQuestionBankZip } from '../question-bank/zip-writer.js';\n" +
      "import {\n" +
      "  QUESTION_BANK_AI_PROMPT,\n" +
      "  renderQuestionBankTools,\n" +
      "} from '../ui/tools.js';\n",
      'main.js: v3.3 imports',
    );
  }

  js = replaceOnce(
    js,
    "  statsView: document.querySelector('#statsView'),\n  bankDetailView:",
    "  statsView: document.querySelector('#statsView'),\n" +
    "  toolsView: document.querySelector('#toolsView'),\n" +
    "  settingsView: document.querySelector('#settingsView'),\n" +
    "  bankDetailView:",
    'main.js: tools/settings views',
  );

  js = replaceOnce(
    js,
    "  statsArea: document.querySelector('#statsArea'),\n  bankDetailArea:",
    "  statsArea: document.querySelector('#statsArea'),\n" +
    "  toolsArea: document.querySelector('#toolsArea'),\n" +
    "  bankDetailArea:",
    'main.js: tools area',
  );

  if (!js.includes('renderQuestionBankTools(elements.toolsArea);')) {
    js = replaceOnce(
      js,
      "  bindEvents();\n  await openDatabase();",
      "  bindEvents();\n" +
      "  renderQuestionBankTools(elements.toolsArea);\n" +
      "  await openDatabase();",
      'main.js: render tools on bootstrap',
    );
  }

  js = replaceOnce(
    js,
    "    if (event.target.closest('[data-nav-stats]')) {\n" +
    "      stopExamTimer();\n" +
    "      await openStats();\n" +
    "    }\n",
    "    if (event.target.closest('[data-nav-stats]')) {\n" +
    "      stopExamTimer();\n" +
    "      await openStats();\n" +
    "      return;\n" +
    "    }\n" +
    "    if (event.target.closest('[data-nav-tools]')) {\n" +
    "      stopExamTimer();\n" +
    "      renderQuestionBankTools(elements.toolsArea);\n" +
    "      showView('tools');\n" +
    "    }\n",
    'main.js: tools navigation',
  );

  if (!js.includes("elements.toolsArea.addEventListener('click'")) {
    js = replaceOnce(
      js,
      "  elements.reviewArea.addEventListener('click', async event => {",
      "  elements.toolsArea.addEventListener('click', async event => {\n" +
      "    if (event.target.closest('[data-copy-ai-prompt]')) {\n" +
      "      try {\n" +
      "        await copyText(QUESTION_BANK_AI_PROMPT);\n" +
      "        showToast(elements.toastRegion, 'Schema v2 AI 題庫提示詞已複製。', 'success');\n" +
      "      } catch (error) {\n" +
      "        showToast(elements.toastRegion, `複製失敗：${error.message}`, 'error');\n" +
      "      }\n" +
      "      return;\n" +
      "    }\n\n" +
      "    if (event.target.closest('[data-download-ai-prompt]')) {\n" +
      "      downloadTextFile('moxin-quiz-schema-v2-ai-prompt.txt', QUESTION_BANK_AI_PROMPT);\n" +
      "      showToast(elements.toastRegion, '提示詞已下載。', 'success');\n" +
      "    }\n" +
      "  });\n\n" +
      "  elements.reviewArea.addEventListener('click', async event => {",
      'main.js: tools actions',
    );
  }

  if (!js.includes("event.target.closest('[data-export-bank]')")) {
    js = replaceOnce(
      js,
      "    const learningButton = event.target.closest('[data-learning-filter]');",
      "    if (event.target.closest('[data-export-bank]')) {\n" +
      "      await exportCurrentBank();\n" +
      "      return;\n" +
      "    }\n\n" +
      "    const learningButton = event.target.closest('[data-learning-filter]');",
      'main.js: export button handler',
    );
  }

  if (!js.includes('async function exportCurrentBank()')) {
    js = replaceOnce(
      js,
      "async function openBankDetail(bankId) {",
      "async function exportCurrentBank() {\n" +
      "  const bankId = state.currentBank?.id;\n" +
      "  if (!bankId) {\n" +
      "    showToast(elements.toastRegion, '目前沒有可匯出的題庫。', 'error');\n" +
      "    return;\n" +
      "  }\n\n" +
      "  showToast(elements.toastRegion, '正在建立題庫 ZIP…', 'info', { sticky: true });\n" +
      "  try {\n" +
      "    const pkg = await getBankPackage(bankId, { includeAssets: true });\n" +
      "    if (!pkg) throw new Error('找不到題庫資料。');\n" +
      "    const filename = await downloadQuestionBankZip(pkg);\n" +
      "    showToast(elements.toastRegion, `題庫已匯出：${filename}`, 'success');\n" +
      "  } catch (error) {\n" +
      "    console.error(error);\n" +
      "    showToast(elements.toastRegion, `題庫匯出失敗：${error.message}`, 'error');\n" +
      "  } finally {\n" +
      "    elements.toastRegion.querySelectorAll('[data-sticky-toast]').forEach(node => node.remove());\n" +
      "  }\n" +
      "}\n\n" +
      "async function copyText(text) {\n" +
      "  if (navigator.clipboard?.writeText) {\n" +
      "    try {\n" +
      "      await navigator.clipboard.writeText(text);\n" +
      "      return;\n" +
      "    } catch { /* fall through */ }\n" +
      "  }\n" +
      "  const textarea = document.createElement('textarea');\n" +
      "  textarea.value = text;\n" +
      "  textarea.setAttribute('readonly', '');\n" +
      "  textarea.style.position = 'fixed';\n" +
      "  textarea.style.opacity = '0';\n" +
      "  document.body.appendChild(textarea);\n" +
      "  textarea.select();\n" +
      "  const copied = document.execCommand('copy');\n" +
      "  textarea.remove();\n" +
      "  if (!copied) throw new Error('瀏覽器拒絕複製到剪貼簿。');\n" +
      "}\n\n" +
      "function downloadTextFile(filename, text) {\n" +
      "  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });\n" +
      "  const url = URL.createObjectURL(blob);\n" +
      "  const anchor = document.createElement('a');\n" +
      "  anchor.href = url;\n" +
      "  anchor.download = filename;\n" +
      "  anchor.hidden = true;\n" +
      "  document.body.appendChild(anchor);\n" +
      "  anchor.click();\n" +
      "  anchor.remove();\n" +
      "  window.setTimeout(() => URL.revokeObjectURL(url), 1500);\n" +
      "}\n\n" +
      "async function openBankDetail(bankId) {",
      'main.js: export/prompt helpers',
    );
  }

  js = replaceOnce(
    js,
    "    stats: elements.statsView,\n    'bank-detail':",
    "    stats: elements.statsView,\n" +
    "    tools: elements.toolsView,\n" +
    "    settings: elements.settingsView,\n" +
    "    'bank-detail':",
    'main.js: showView tools/settings',
  );

  if (!js.includes("data-nav-tools]')?.classList.toggle")) {
    js = replaceOnce(
      js,
      "  document.querySelector('[data-nav-stats]')?.classList.toggle('is-active', name === 'stats');\n",
      "  document.querySelector('[data-nav-stats]')?.classList.toggle('is-active', name === 'stats');\n" +
      "  document.querySelector('[data-nav-tools]')?.classList.toggle('is-active', name === 'tools');\n" +
      "  document.querySelector('[data-nav-settings]')?.classList.toggle('is-active', name === 'settings');\n",
      'main.js: tools nav state',
    );
  }

  return js;
}

function updateP7() {
  let js = read('src/app/p7.js');
  js = replaceOnce(
    js,
    "[data-nav-library], [data-nav-review], [data-nav-exam], [data-nav-stats]",
    "[data-nav-library], [data-nav-review], [data-nav-exam], [data-nav-stats], [data-nav-tools]",
    'p7.js: tools navigation compatibility',
  );
  return js;
}

function updateBankDetail() {
  let js = read('src/ui/bank-detail.js');
  if (js.includes('data-export-bank')) return js;

  js = replaceOnce(
    js,
    "      <div class=\"detail-meta\">\n" +
    "        ${meta('題目', questions.length)}\n" +
    "        ${meta('版本', bank.version || '—')}\n" +
    "        ${meta('今日到期', summary.due || 0)}\n" +
    "        ${meta('目前錯題', summary.wrong || 0)}\n" +
    "      </div>\n" +
    "    </section>",
    "      <div class=\"detail-meta\">\n" +
    "        ${meta('題目', questions.length)}\n" +
    "        ${meta('版本', bank.version || '—')}\n" +
    "        ${meta('今日到期', summary.due || 0)}\n" +
    "        ${meta('目前錯題', summary.wrong || 0)}\n" +
    "      </div>\n" +
    "      <div class=\"detail-actions\">\n" +
    "        <button class=\"button secondary\" type=\"button\" data-export-bank>匯出題庫 ZIP</button>\n" +
    "      </div>\n" +
    "    </section>",
    'bank-detail.js: export action',
  );
  return js;
}

const zipWriter = `import { normalizePackagePath } from '../utils/path.js';

const UTF8 = new TextEncoder();
const MANIFEST_FIELDS = [
  'schemaVersion',
  'id',
  'name',
  'description',
  'version',
  'author',
  'language',
  'questionCount',
  'createdAt',
  'updatedAt',
  'metadata',
  'source',
  'license',
];

export async function createQuestionBankZip(pkg) {
  if (!pkg?.manifest || !Array.isArray(pkg.questions)) {
    throw new Error('題庫資料不完整，無法匯出。');
  }

  const manifest = cleanExportManifest(pkg.manifest, pkg.questions.length);
  const entries = [
    textEntry('manifest.json', JSON.stringify(manifest, null, 2) + '\\n'),
    textEntry('questions.json', JSON.stringify(pkg.questions, null, 2) + '\\n'),
  ];

  for (const asset of pkg.assets || []) {
    const assetPath = normalizePackagePath(asset.path);
    if (!assetPath.startsWith('assets/')) {
      throw new Error(\`題庫圖片必須位於 assets/：\${assetPath}\`);
    }
    if (!asset.blob) {
      throw new Error(\`題庫圖片缺少 Blob：\${assetPath}\`);
    }
    const bytes = new Uint8Array(await asset.blob.arrayBuffer());
    entries.push({ path: assetPath, bytes });
  }

  return buildStoredZip(entries);
}

export async function downloadQuestionBankZip(pkg) {
  const blob = await createQuestionBankZip(pkg);
  const id = safeFilename(pkg.manifest?.id || 'question-bank');
  const version = safeFilename(pkg.manifest?.version || '1.0.0');
  const filename = \`\${id}-\${version}.zip\`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);

  return filename;
}

export function cleanExportManifest(manifest, questionCount) {
  const result = {};
  for (const field of MANIFEST_FIELDS) {
    if (manifest[field] !== undefined) result[field] = manifest[field];
  }
  result.questionCount = questionCount;
  return result;
}

function textEntry(path, text) {
  return { path, bytes: UTF8.encode(text) };
}

function buildStoredZip(entries) {
  if (!entries.length) throw new Error('ZIP 至少需要一個檔案。');
  if (entries.length > 0xffff) throw new Error('ZIP 檔案數超過傳統格式上限。');

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  const { time, date } = dosDateTime(new Date());

  for (const entry of entries) {
    const path = normalizePackagePath(entry.path);
    const name = UTF8.encode(path);
    const data = entry.bytes instanceof Uint8Array
      ? entry.bytes
      : new Uint8Array(entry.bytes);
    const crc = crc32(data);

    if (data.byteLength > 0xffffffff) {
      throw new Error(\`單一檔案過大，無法使用傳統 ZIP：\${path}\`);
    }

    const local = new Uint8Array(30);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.byteLength, true);
    lv.setUint32(22, data.byteLength, true);
    lv.setUint16(26, name.byteLength, true);
    lv.setUint16(28, 0, true);

    localParts.push(local, name, data);

    const central = new Uint8Array(46);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.byteLength, true);
    cv.setUint32(24, data.byteLength, true);
    cv.setUint16(28, name.byteLength, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);

    centralParts.push(central, name);
    offset += local.byteLength + name.byteLength + data.byteLength;
    if (offset > 0xffffffff) throw new Error('ZIP 總大小超過傳統格式上限。');
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd], {
    type: 'application/zip',
  });
}

function dosDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

let crcTable;

function crc32(bytes) {
  if (!crcTable) crcTable = buildCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
}

function safeFilename(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'question-bank';
}
`;

const toolsJs = `export const QUESTION_BANK_AI_PROMPT = \`
你是一位題庫資料整理與 JSON 結構化助手。

目標：把我提供的題目來源整理成「墨忻刷題網 Schema 2.0」題庫。只能根據我提供的內容整理，不要自行猜題、補題或改變原始題意；若答案不明確，請明確標記需要人工確認。

【正式題庫結構】
題庫資料夾/
├── manifest.json
├── questions.json
└── assets/
    └── images/
        └── 圖片檔案

若完全沒有圖片，也可以輸出單一 JSON：
{
  "manifest": { ... },
  "questions": [ ... ]
}

【manifest.json 最低必要欄位】
{
  "schemaVersion": "2.0",
  "id": "只能使用英文、數字、底線、連字號",
  "name": "題庫名稱",
  "description": "題庫說明",
  "version": "1.0.0",
  "author": "",
  "language": "zh-TW",
  "questionCount": 0,
  "metadata": {
    "category": ""
  }
}

【支援題型】
single-choice
multiple-choice
true-false
fill-in

【選擇題範例】
{
  "id": "Q001",
  "type": "single-choice",
  "question": "題目文字",
  "options": [
    { "id": "A", "text": "選項 A" },
    { "id": "B", "text": "選項 B" }
  ],
  "answer": ["A"],
  "explanation": "詳解",
  "images": [],
  "explanationImages": [],
  "chapter": "章節",
  "tags": ["標籤"],
  "difficulty": 2
}

【複選題】
answer 必須是陣列，例如 ["A", "C"]，必須完全選對才算正確。

【是非題】
answer 必須是只含一個 boolean 的陣列，例如 [true] 或 [false]。

【填空題】
answer 是可接受答案字串陣列，例如 ["ERP", "Enterprise Resource Planning"]。
若大小寫需完全一致，可加入 "caseSensitive": true。

【圖片規則】
questions.json 的 images 與 explanationImages 只放相對路徑字串，例如：
"assets/images/Q001.png"
不要放 base64、網路網址或電腦本機絕對路徑。

【品質要求】
1. 每一題 id 必須永久且不可重複。
2. difficulty 使用 1～5 整數。
3. tags 使用字串陣列。
4. 選擇題 answer 必須對應存在的 option id。
5. explanation 若原始資料沒有提供，不要捏造；可寫「原始資料未提供詳解」。
6. manifest.questionCount 必須等於 questions 實際題數。
7. 不要把頁碼、頁首頁尾、目錄或 OCR 雜訊當成題目。
8. 不要輸出 JavaScript 註解或 JSON 註解。

【輸出方式】
如果我要求「可直接匯入的單一 JSON」，只輸出合法的：
{ "manifest": ..., "questions": [...] }

如果我要求「正式題庫 package」，請分別提供 manifest.json 與 questions.json 的完整內容，並列出需要放入 assets/ 的圖片檔名與對應題號。

輸出後，再另外列出「人工核對清單」，只指出需要人工確認的題號、原因與欄位，不要擅自修正來源沒有證據支持的內容。
\`.trim();

export function renderQuestionBankTools(container) {
  if (!container) return;

  container.innerHTML = \`
    <section class="hero-card">
      <div>
        <p class="eyebrow">Question Bank Tools</p>
        <h2>題庫工具</h2>
        <p>製作、檢查與分享題庫的輔助中心。網站不會把你的題目上傳到伺服器，也不內建任何 AI API Key。</p>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">AI Workflow</p>
          <h2>用外部 AI 整理 Schema v2 題庫</h2>
        </div>
      </div>

      <ol class="tools-workflow">
        <li>複製下方提示詞。</li>
        <li>貼到你使用的 AI 工具，再提供 PDF、Word、圖片辨識文字或題庫原文。</li>
        <li>讓 AI 依 Schema 2.0 輸出題庫，但答案與官方內容仍需人工核對。</li>
        <li>文字題庫可輸出單一 JSON；含圖片題庫建議整理成正式 package 資料夾。</li>
        <li>回到「我的題庫 → 自行新增」匯入，網站會先驗證再寫入 IndexedDB。</li>
      </ol>

      <div class="tools-actions">
        <button class="button primary" type="button" data-copy-ai-prompt>複製 Schema v2 提示詞</button>
        <button class="button secondary" type="button" data-download-ai-prompt>下載提示詞 .txt</button>
      </div>

      <details class="tools-prompt-details">
        <summary>查看完整提示詞</summary>
        <pre class="tools-prompt-box">\${escapeHtml(QUESTION_BANK_AI_PROMPT)}</pre>
      </details>
    </section>

    <section class="tools-grid">
      <article class="panel tool-card">
        <p class="eyebrow">Package</p>
        <h2>正式題庫結構</h2>
        <pre class="tools-code-tree">題庫資料夾/
├── manifest.json
├── questions.json
└── assets/
    └── images/</pre>
        <p>ZIP、JSON、資料夾匯入都會經過 Schema 驗證。含圖片的題庫以 ZIP 或資料夾最完整。</p>
      </article>

      <article class="panel tool-card">
        <p class="eyebrow">Share</p>
        <h2>分享自己的題庫</h2>
        <p>進入任一已加入的題庫，使用「匯出題庫 ZIP」即可把題目與題庫內圖片打包。匯出的 ZIP 不包含錯題、收藏、筆記、熟練度或其他個人學習資料。</p>
      </article>

      <article class="panel tool-card">
        <p class="eyebrow">Privacy</p>
        <h2>本機優先</h2>
        <p>自行新增的題庫、學習紀錄與筆記都保存在瀏覽器 IndexedDB。完整備份仍請使用「設定 → 匯出完整備份」。</p>
      </article>
    </section>
  \`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
`;

const v33Css = `
.detail-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: .65rem;
  margin-top: .15rem;
}

.tools-workflow {
  display: grid;
  gap: .7rem;
  margin: 1rem 0;
  padding-left: 1.4rem;
  color: var(--text);
}

.tools-workflow li {
  padding-left: .2rem;
}

.tools-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .65rem;
  margin: 1rem 0;
}

.tools-prompt-details {
  margin-top: 1rem;
  border-top: 1px solid var(--line);
  padding-top: 1rem;
}

.tools-prompt-details summary {
  cursor: pointer;
  font-weight: 800;
}

.tools-prompt-box,
.tools-code-tree {
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: .85rem 0 0;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-soft);
  color: var(--text);
  font: inherit;
  line-height: 1.65;
}

.tools-code-tree {
  white-space: pre;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.tool-card h2 {
  margin-top: .25rem;
}

@media (max-width: 900px) {
  .tools-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .detail-actions,
  .tools-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .detail-actions .button,
  .tools-actions .button {
    width: 100%;
  }
}
`.trim() + '\n';

const v33Test = `import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createQuestionBankZip, cleanExportManifest } from '../src/question-bank/zip-writer.js';
import { readZip } from '../src/question-bank/zip-reader.js';
import { QUESTION_BANK_AI_PROMPT } from '../src/ui/tools.js';

const manifest = {
  schemaVersion: '2.0',
  id: 'v33_test',
  name: 'v3.3 test',
  version: '1.0.0',
  author: 'test',
  questionCount: 99,
  sourceType: 'user',
  sourceMetadata: { ignored: true },
  importedAt: '2026-10-01T00:00:00Z',
};

const questions = [{
  id: 'Q001',
  type: 'single-choice',
  question: '測試題',
  options: [
    { id: 'A', text: '甲' },
    { id: 'B', text: '乙' },
  ],
  answer: ['A'],
  explanation: '測試',
  images: ['assets/images/Q001.txt.png'],
  explanationImages: [],
  chapter: '測試',
  tags: [],
  difficulty: 1,
}];

const assetBytes = new TextEncoder().encode('asset');
const zip = await createQuestionBankZip({
  manifest,
  questions,
  assets: [{
    path: 'assets/images/Q001.txt.png',
    blob: new Blob([assetBytes], { type: 'image/png' }),
  }],
});

assert.equal(zip.type, 'application/zip');

const entries = await readZip(zip);
assert.equal(entries.has('manifest.json'), true);
assert.equal(entries.has('questions.json'), true);
assert.equal(entries.has('assets/images/Q001.txt.png'), true);

const exportedManifest = JSON.parse(new TextDecoder().decode(entries.get('manifest.json')));
const exportedQuestions = JSON.parse(new TextDecoder().decode(entries.get('questions.json')));

assert.equal(exportedManifest.id, 'v33_test');
assert.equal(exportedManifest.questionCount, 1);
assert.equal('sourceType' in exportedManifest, false);
assert.equal('sourceMetadata' in exportedManifest, false);
assert.equal('importedAt' in exportedManifest, false);
assert.equal(exportedQuestions.length, 1);

const cleaned = cleanExportManifest(manifest, 1);
assert.equal(cleaned.questionCount, 1);
assert.equal(cleaned.sourceType, undefined);

assert.match(QUESTION_BANK_AI_PROMPT, /Schema 2\\.0/);
assert.match(QUESTION_BANK_AI_PROMPT, /manifest\\.json/);
assert.match(QUESTION_BANK_AI_PROMPT, /questions\\.json/);
assert.match(QUESTION_BANK_AI_PROMPT, /不要自行猜題/);

const index = fs.readFileSync('index.html', 'utf8');
const v3 = fs.readFileSync('v3.html', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const redirect = fs.readFileSync('legacy-v2.html', 'utf8');

assert.equal(index, v3);
assert.match(index, /v3\\.3/);
assert.match(index, /data-nav-tools/);
assert.match(index, /id="toolsView"/);

assert.match(sw, /moxin-quiz-v3-3\\.3\\.0-1/);
assert.match(sw, /src\\/question-bank\\/zip-writer\\.js/);
assert.match(sw, /src\\/ui\\/tools\\.js/);
assert.match(sw, /styles\\/v3-v33\\.css/);

assert.equal(fs.existsSync('script.js'), false);
assert.equal(fs.existsSync('style.css'), false);
assert.equal(fs.existsSync('question-banks.json'), false);
assert.equal(fs.existsSync('questions'), false);
assert.equal(fs.existsSync('assets/images'), false);

for (const file of [
  'legacy-v2/index.html',
  'legacy-v2/script.js',
  'legacy-v2/style.css',
  'legacy-v2/question-banks.json',
  'legacy-v2/questions/ERP_Planner_202509_V06_improved_explanations.json',
  'legacy-v2/questions/Motorcycle_License_1150218.json',
  'legacy-v2/questions/sample.json',
  'legacy-v2/README.md',
]) {
  assert.equal(fs.existsSync(file), true, \`Missing legacy archive file: \${file}\`);
}

assert.match(redirect, /\\.\\/legacy-v2\\//);

console.log('MoXin Quiz v3.3 tools/export/legacy cleanup tests passed.');
`;

const newReadme = `# 墨忻刷題網

墨忻刷題網 v3.3 是一個部署於 GitHub Pages 的 **Local-first 個人刷題平台**。網站不需要後端、登入系統或付費伺服器；題庫與學習紀錄主要保存在瀏覽器 IndexedDB，並支援 PWA 離線使用。

## 目前功能

- 作者題庫與使用者自行新增題庫分流
- ZIP / JSON / 資料夾匯入，匯入前 Schema 驗證
- 題庫 ZIP 匯出，連同題庫內 assets 圖片一起打包
- 單選、複選、是非、填空四種題型
- 題庫內搜尋、題型／難度／章節篩選
- 錯題、收藏、不熟題、筆記
- 未完成練習與模擬考恢復
- 今日複習與間隔複習排程
- 學習統計與熟練度
- 限時模擬考、題號導覽、交卷分析
- 完整本機資料備份與還原
- 深色模式、字體大小、選項間距、減少動畫
- PWA App Shell 與離線刷題
- 題庫工具：Schema v2 AI 提示詞、正式題庫結構說明
- 手機、平板、桌面 RWD

## 題庫來源

### 作者題庫

作者題庫由網站維護者透過 \`author-banks.json\` 發布。使用者按下「加入我的題庫」後才會下載並寫入 IndexedDB。

目前作者題庫：

- ERP 規劃師題庫 2025.09 V06
- Schema 2.0
- 443 題
- 題庫版本 1.2.0

作者題庫有新版時，網站會顯示更新提示；使用者自行決定是否更新。

### 自行新增

使用者可以匯入：

- 正式 ZIP 題庫包
- 單一 JSON
- 完整題庫資料夾

自行新增的題庫只存在目前瀏覽器，不會自動上傳 GitHub。

## 正式題庫 Package

建議交換格式：

\`\`\`text
bank/
├── manifest.json
├── questions.json
└── assets/
    └── images/
\`\`\`

Schema 版本目前為 \`2.0\`。

支援題型：

- \`single-choice\`
- \`multiple-choice\`
- \`true-false\`
- \`fill-in\`

題庫匯入前會檢查永久題目 ID、題型、答案、選項、圖片路徑與其他結構問題。

## 題庫分享

進入已加入的題庫後可使用「匯出題庫 ZIP」。

匯出的 ZIP 包含：

- \`manifest.json\`
- \`questions.json\`
- 題庫內 \`assets/\`

不包含：

- 錯題狀態
- 收藏
- 不熟題
- 筆記
- 熟練度
- 作答歷史
- 模擬考紀錄

因此題庫內容與個人學習資料維持分離。

## AI 題庫製作流程

網站不串接 AI API，也不儲存 API Key。

到「題庫工具」可複製 Schema v2 專用提示詞，再到外部 AI 工具處理自己的來源資料。AI 產出的題目與答案仍應人工核對，完成後再回網站匯入驗證。

## 本機資料

主要資料儲存在 IndexedDB：

- banks
- questions
- assets
- attempts
- progress
- favorites
- notes
- mastery / review schedules
- sessions

少量 UI 偏好使用 localStorage。

如果清除網站資料、更換瀏覽器或更換裝置，本機資料不會自動同步。請定期到「設定」下載完整備份。

## PWA / Offline

Service Worker 快取 App Shell。已加入 IndexedDB 的題庫在離線狀態仍可練習、收藏、寫筆記與記錄進度。

作者題庫本體不會全部預先塞入 App Shell；只有使用者實際加入後才保存到 IndexedDB。

## Legacy v2

舊版網站已封存到：

\`\`\`text
legacy-v2/
\`\`\`

舊網址 \`legacy-v2.html\` 只保留相容轉址。

舊版包含當時的 Legacy JSON 題庫與機車題庫歷史資料。機車題庫未確認是否為最新版本，因此沒有升級成 v3 作者題庫，也不應視為目前推薦題庫。

## 開發與測試

本專案維持零前端框架與零執行期第三方 CDN 依賴。

執行完整測試：

\`\`\`bash
npm run ci
\`\`\`

其中包含單元測試與 release preflight。

主要開發結構：

\`\`\`text
/
├── index.html
├── v3.html
├── manifest.webmanifest
├── service-worker.js
├── author-banks.json
├── author-banks/
├── src/
├── styles/
├── tests/
├── docs/
├── examples/
└── legacy-v2/
\`\`\`

## 部署

GitHub Pages：

\`\`\`text
Branch: main
Folder: / (root)
\`\`\`

正式入口為 repository Pages 根網址；\`v3.html\` 保留相容入口。
`;

const v33Doc = `# v3.3：題庫工具、ZIP 匯出與 Legacy 封存

## 本版目標

1. 將舊版 v2 完整移入 \`legacy-v2/\`，正式根目錄不再混用舊架構檔案。
2. 新增已安裝題庫的正式 ZIP 匯出。
3. 把 AI 題庫製作提示詞補回新版，並全面改為 Schema 2.0 / Package 規格。
4. 重寫 README，使文件與現在的 IndexedDB / PWA / 作者題庫架構一致。

## Legacy 封存

根目錄下列舊檔移入 \`legacy-v2/\`：

- \`script.js\`
- \`style.css\`
- \`question-banks.json\`
- \`questions/\`
- \`assets/images/\`
- Legacy 題庫 index builder
- 舊 README

\`legacy-v2.html\` 保留為相容轉址。

既有機車題庫只作歷史封存，不升級成作者題庫。

## 題庫 ZIP 匯出

匯出內容只包含題庫本體：

- manifest
- questions
- assets

不包含個人學習資料。

## 題庫工具

新版「題庫工具」提供：

- Schema 2.0 AI 提示詞
- 複製與下載提示詞
- 正式 Package 結構說明
- 題庫分享與本機資料邊界說明
`;

const redirectHtml = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0; url=./legacy-v2/" />
  <meta name="robots" content="noindex" />
  <title>墨忻刷題網 Legacy v2</title>
  <link rel="canonical" href="./legacy-v2/" />
</head>
<body>
  <p>舊版網站已移至 <a href="./legacy-v2/">legacy-v2/</a>。</p>
</body>
</html>
`;

function updateServiceWorker() {
  let sw = read('service-worker.js');
  sw = sw.replace(
    /const CACHE_VERSION = '[^']+';/,
    "const CACHE_VERSION = 'moxin-quiz-v3-3.3.0-1';",
  );

  if (!sw.includes("'./styles/v3-v33.css'")) {
    sw = replaceOnce(
      sw,
      "  './styles/v3-v31.css',\n",
      "  './styles/v3-v31.css',\n  './styles/v3-v33.css',\n",
      'service-worker: v3.3 css',
    );
  }

  if (!sw.includes("'./src/question-bank/zip-writer.js'")) {
    sw = replaceOnce(
      sw,
      "  './src/question-bank/zip-reader.js',\n",
      "  './src/question-bank/zip-reader.js',\n" +
      "  './src/question-bank/zip-writer.js',\n",
      'service-worker: zip writer',
    );
  }

  if (!sw.includes("'./src/ui/tools.js'")) {
    sw = replaceOnce(
      sw,
      "  './src/ui/stats.js',\n",
      "  './src/ui/stats.js',\n  './src/ui/tools.js',\n",
      'service-worker: tools UI',
    );
  }

  return sw;
}

function updatePackage() {
  const pkg = JSON.parse(read('package.json'));
  if (!pkg.scripts.test.includes('node tests/v33-run.mjs')) {
    pkg.scripts.test += ' && node tests/v33-run.mjs';
  }
  return JSON.stringify(pkg, null, 2) + '\n';
}

function updateRegressionWorkflow() {
  let wf = read('.github/workflows/v3-regression.yml');

  if (!wf.includes('      - "README.md"\n')) {
    wf = wf.replaceAll(
      '      - "index.html"\n',
      '      - "index.html"\n      - "README.md"\n',
    );
  }

  if (!wf.includes('      - "legacy-v2/**"\n')) {
    wf = wf.replaceAll(
      '      - "legacy-v2.html"\n',
      '      - "legacy-v2.html"\n      - "legacy-v2/**"\n',
    );
  }

  return wf;
}

function updateReleasePreflight() {
  let js = read('scripts/v3-release-preflight.mjs');

  js = replaceOnce(
    js,
    "  'legacy-v2.html',\n  'manifest.webmanifest',",
    "  'legacy-v2.html',\n" +
    "  'legacy-v2/index.html',\n" +
    "  'manifest.webmanifest',",
    'preflight: legacy archive entry',
  );

  const oldLegacyCheck =
`if (legacyHtml) {
  if (!legacyHtml.includes('style.css')) {
    warn('legacy-v2.html does not reference legacy style.css.');
  }
  if (!legacyHtml.includes('script.js')) {
    warn('legacy-v2.html does not reference legacy script.js.');
  }
}`;

  const newLegacyCheck =
`if (legacyHtml && !legacyHtml.includes('./legacy-v2/')) {
  fail('legacy-v2.html must redirect to ./legacy-v2/.');
}

for (const file of [
  'legacy-v2/index.html',
  'legacy-v2/script.js',
  'legacy-v2/style.css',
  'legacy-v2/question-banks.json',
]) {
  checkFile(file, 'legacy archive file');
}

for (const legacyRootFile of ['script.js', 'style.css', 'question-banks.json']) {
  if (exists(legacyRootFile)) {
    fail(\`Legacy root file should be archived: \${legacyRootFile}\`);
  }
}`;

  js = replaceOnce(
    js,
    oldLegacyCheck,
    newLegacyCheck,
    'preflight: legacy archive rules',
  );

  js = replaceOnce(
    js,
    "  'data-nav-stats',\n  'data-nav-settings',",
    "  'data-nav-stats',\n  'data-nav-tools',\n  'data-nav-settings',",
    'preflight: tools nav',
  );

  return js;
}

function updateV32RegressionTest() {
  let js = read('tests/v32-run.mjs');

  js = replaceOnce(
    js,
    "assert.match(sw, /moxin-quiz-v3-3\\.2\\.0-1/);",
    "assert.match(sw, /const CACHE_VERSION = 'moxin-quiz-v3-[^']+';/);",
    'v3.2 regression: future-proof Service Worker cache version',
  );

  return js;
}

function updateReleaseCutoverTest() {
  let js = read('tests/release-cutover-run.mjs');

  js = replaceOnce(
    js,
    "assert.ok(legacy.length > 0, 'legacy-v2.html must exist as rollback entry.');",
    "assert.ok(legacy.length > 0, 'legacy-v2.html must exist as compatibility entry.');\n" +
    "assert.match(legacy, /\\.\\/legacy-v2\\//);",
    'release test: redirect',
  );

  js = replaceOnce(
    js,
    "assert.match(legacy, /style\\.css/);\nassert.match(legacy, /script\\.js/);",
    "assert.equal(fs.existsSync('legacy-v2/index.html'), true);\n" +
    "assert.equal(fs.existsSync('legacy-v2/style.css'), true);\n" +
    "assert.equal(fs.existsSync('legacy-v2/script.js'), true);\n" +
    "assert.equal(fs.existsSync('script.js'), false);\n" +
    "assert.equal(fs.existsSync('style.css'), false);",
    'release test: archived legacy files',
  );

  return js;
}

// ------------------------------------------------------------------
// Apply v3.3 application changes first.
// ------------------------------------------------------------------
const index = updateHtml('index.html');
const v3 = updateHtml('v3.html');
if (index !== v3) {
  throw new Error('v3.3 更新後 index.html 與 v3.html 不一致。');
}

write('index.html', index);
write('v3.html', v3);
write('src/app/main.js', updateMainJs());
write('src/app/p7.js', updateP7());
write('src/ui/bank-detail.js', updateBankDetail());
write('src/question-bank/zip-writer.js', zipWriter);
write('src/ui/tools.js', toolsJs);
write('styles/v3-v33.css', v33Css);
write('tests/v33-run.mjs', v33Test);
write('package.json', updatePackage());
write('service-worker.js', updateServiceWorker());
write('scripts/v3-release-preflight.mjs', updateReleasePreflight());
write('tests/release-cutover-run.mjs', updateReleaseCutoverTest());
write('tests/v32-run.mjs', updateV32RegressionTest());
write('docs/V3_3_TOOLS_AND_LEGACY_CLEANUP.md', v33Doc);

// ------------------------------------------------------------------
// Archive the complete old v2 site without promoting its question data.
// ------------------------------------------------------------------
move('legacy-v2.html', 'legacy-v2/index.html');
move('script.js', 'legacy-v2/script.js');
move('style.css', 'legacy-v2/style.css');
move('question-banks.json', 'legacy-v2/question-banks.json');
move('questions', 'legacy-v2/questions');
move('assets/images', 'legacy-v2/assets/images');
move('README.md', 'legacy-v2/README.md');

if (exists('scripts/build-question-index.js')) {
  move('scripts/build-question-index.js', 'legacy-v2/scripts/build-question-index.js');
}

if (exists('scripts/migrate-erp-author-to-v2.mjs')) {
  move('scripts/migrate-erp-author-to-v2.mjs', 'legacy-v2/archive/migrate-erp-author-to-v2.mjs');
}

write('legacy-v2.html', redirectHtml);
write('README.md', newReadme);

console.log('v3.3 transformation completed.');
console.log('Next: npm run ci');

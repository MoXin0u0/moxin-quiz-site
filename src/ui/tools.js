import { mountStudioWorkspace } from './studio.js';

export const QUESTION_BANK_AI_PROMPT = `
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
`.trim();

export function renderQuestionBankTools(container, options = {}) {
  if (!container) return;

  container.innerHTML = `
    <section class="hero-card">
      <div>
        <p class="eyebrow">Question Bank Tools</p>
        <h2>題庫工具</h2>
        <p>現在除了 AI Schema v2 工作流，也可以直接在瀏覽器內建立與編輯題庫。</p>
      </div>
    </section>

    <div id="studioWorkspaceMount"></div>

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
        <li>匯入網站後，可以再到上方「題庫工作室」編輯與驗證。</li>
      </ol>

      <div class="tools-actions">
        <button class="button primary" type="button" data-copy-ai-prompt>複製 Schema v2 提示詞</button>
        <button class="button secondary" type="button" data-download-ai-prompt>下載提示詞 .txt</button>
      </div>

      <details class="tools-prompt-details">
        <summary>查看完整提示詞</summary>
        <pre class="tools-prompt-box">${escapeHtml(QUESTION_BANK_AI_PROMPT)}</pre>
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
        <p>工作室與題庫詳情都可以匯出題庫。ZIP 會保留 assets；單一 JSON 不包含圖片檔。</p>
      </article>

      <article class="panel tool-card">
        <p class="eyebrow">Privacy</p>
        <h2>本機優先</h2>
        <p>題庫、工作室草稿與學習資料都保存在瀏覽器 IndexedDB。完整備份仍請使用「設定 → 匯出完整備份」。</p>
      </article>
    </section>
  `;

  mountStudioWorkspace(
    container.querySelector('#studioWorkspaceMount'),
    { draftId: options.draftId || null },
  ).catch(error => {
    console.error('Question Bank Studio failed to mount.', error);
    const mount = container.querySelector('#studioWorkspaceMount');
    if (mount) {
      mount.innerHTML = `
        <section class="panel">
          <div class="empty-state">
            <strong>題庫工作室載入失敗</strong>
            <p>${escapeHtml(error.message)}</p>
          </div>
        </section>
      `;
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

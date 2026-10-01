/* 墨忻刷題網：純前端題庫刷題平台 */

const STORAGE_KEYS = {
  selectedBank: 'moxin.selectedBank',
  progress: 'moxin.progress',
  wrongBook: 'moxin.wrongBook',
  favorites: 'moxin.favorites',
  unfamiliar: 'moxin.unfamiliar',
  importedBanks: 'moxin.importedBanks',
  answerRecords: 'moxin.answerRecords',
  examRecords: 'moxin.examRecords',
  uiPrefs: 'moxin.uiPrefs'
};

const TYPE_LABELS = {
  single_choice: '單選題',
  multiple_choice: '複選題',
  true_false: '是非題',
  fill_blank: '填空題'
};

const ALLOWED_TYPES = Object.keys(TYPE_LABELS);
const ALLOWED_DIFFICULTY = ['easy', 'medium', 'hard'];
const ALLOWED_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

const AI_PROMPT = `你是一位題庫工程師、考試題庫整理專家、教育內容編輯與 JSON 資料清理專家。

請依照【墨忻刷題網】標準格式，根據我接下來提供的資料建立題庫 JSON。

==================================================
一、任務目標
==================================================

請將我提供的官方題庫、教材、PDF 文字、Word 文字、PPT 文字、圖片辨識文字、表格資料或考試資料，整理成符合墨忻刷題網格式的 JSON 題庫。

本題庫主要用於官方題庫反覆練習與考前複習，因此請遵守資料保真原則：

1. 只能根據我提供的內容整理題目。
2. 不要自行新增相似題。
3. 不要自行延伸出題。
4. 不要猜題。
5. 不要改寫官方題目的核心題意。
6. 不要把章節標題、頁首頁尾、頁碼、浮水印、目錄、參考文字誤判成題目。
7. 若原始資料答案不明確，請保留題目，並在 explanation 中註明「原始資料未明確提供答案，需人工確認」。

==================================================
二、輸出規則
==================================================

請只輸出合法 JSON。

不要輸出 Markdown。
不要輸出說明文字。
不要使用 Markdown 程式碼區塊。
不要在 JSON 前後加入任何解釋。
不要輸出註解，因為 JSON 不支援註解。

輸出的 JSON 必須可以直接儲存成 .json 檔案，並放入 questions/ 資料夾或匯入墨忻刷題網使用。

==================================================
三、題庫主格式
==================================================

請使用以下格式：

{
  "bankId": "",
  "title": "",
  "description": "",
  "version": "1.0",
  "createdDate": "",
  "category": "",
  "questions": []
}

==================================================
四、題庫欄位規則
==================================================

bankId：
題庫唯一代號。只能使用英文、數字、底線或連字號，不要使用空白與特殊符號。
例如：
ERP_2026
IPAS_AI_BASIC
HumanFactors
QualityManagement

圖片題必須使用題庫專屬圖片資料夾。資料夾名稱建議與 bankId 完全相同，例如：
assets/images/ERP_2026/Q001.png
assets/images/ERP_2026/Q001_explanation.png

不要把所有圖片直接放在 assets/images/ 根目錄，避免不同題庫或不同題目使用相同檔名時互相衝突。

title：
題庫名稱，請使用清楚可辨識的名稱。

description：
題庫簡短說明，說明來源或用途。

version：
題庫版本，預設為 1.0。

createdDate：
建立日期，格式為 YYYY-MM-DD。

category：
題庫分類，例如：證照、ERP、品質管理、人因工程、範例。

questions：
題目陣列。

==================================================
五、題目基本格式
==================================================

每一題請使用以下格式：

{
  "id": "",
  "type": "",
  "question": "",
  "images": [],
  "options": {},
  "answer": "",
  "caseSensitive": false,
  "explanation": "",
  "explanationImages": [],
  "tags": [],
  "difficulty": "",
  "chapter": ""
}

欄位省略規則：

1. 若題目沒有圖片，可以省略 images。
2. 若詳解沒有圖片，可以省略 explanationImages。
3. 是非題可以省略 options。
4. 填空題可以省略 options。
5. caseSensitive 只用於 fill_blank 題型；其他題型可省略。

==================================================
六、支援題型
==================================================

type 只能使用以下四種：

1. single_choice
2. multiple_choice
3. true_false
4. fill_blank

不得輸出其他題型名稱。
不得把複選題改成單選題。
不得把選擇題改成填空題。

==================================================
七、單選題格式
==================================================

{
  "id": "Q001",
  "type": "single_choice",
  "question": "題目內容",
  "images": [
    {
      "src": "assets/images/題庫ID/Q001.png",
      "alt": "題目圖片替代文字",
      "caption": "圖1：題目圖片說明"
    }
  ],
  "options": {
    "A": "選項A",
    "B": "選項B",
    "C": "選項C",
    "D": "選項D"
  },
  "answer": "B",
  "explanation": "本題答案為 B。請說明 B 正確的原因，並說明 A、C、D 錯在哪裡。",
  "explanationImages": [],
  "tags": ["標籤1"],
  "difficulty": "easy",
  "chapter": "章節名稱"
}

規則：

1. answer 必須是選項代號，例如 A、B、C、D。
2. answer 必須真的存在於 options。
3. options 至少要有 A、B 兩個選項。
4. 若原始題目有 A、B、C、D 或更多選項，請完整保留。
5. 不要任意更改選項文字。

==================================================
八、複選題格式
==================================================

{
  "id": "Q002",
  "type": "multiple_choice",
  "question": "題目內容",
  "options": {
    "A": "選項A",
    "B": "選項B",
    "C": "選項C",
    "D": "選項D"
  },
  "answer": ["A", "C"],
  "explanation": "本題答案為 A、C。請逐一說明 A、C 為何正確，以及 B、D 為何錯誤。",
  "tags": ["標籤1"],
  "difficulty": "medium",
  "chapter": "章節名稱"
}

規則：

1. answer 必須是陣列。
2. 正確選項請依英文字母排序。
3. 每個 answer 都必須存在於 options。
4. 少選、多選、選錯在網站中都會判定為錯。
5. 詳解需說明每個正確與錯誤選項。

==================================================
九、是非題格式
==================================================

{
  "id": "Q003",
  "type": "true_false",
  "question": "題目內容",
  "answer": true,
  "explanation": "本題答案為 true。請說明判斷依據。",
  "tags": ["標籤1"],
  "difficulty": "easy",
  "chapter": "章節名稱"
}

規則：

1. 正確請使用 true。
2. 錯誤請使用 false。
3. 不需要 options 欄位。
4. 若原始資料使用 O、○、是、對、正確，請轉換成 true。
5. 若原始資料使用 X、×、否、錯、錯誤，請轉換成 false。

==================================================
十、填空題格式
==================================================

{
  "id": "Q004",
  "type": "fill_blank",
  "question": "題目內容 ____。",
  "answer": [
    "Enterprise Resource Planning",
    "enterprise resource planning",
    "ERP"
  ],
  "caseSensitive": false,
  "explanation": "本題答案可為 Enterprise Resource Planning 或 ERP。",
  "tags": ["標籤1"],
  "difficulty": "medium",
  "chapter": "章節名稱"
}

規則：

1. answer 必須是陣列。
2. 可以提供多個可接受答案。
3. caseSensitive 預設 false。
4. 題目文字中可使用 ____ 表示填空處。
5. 不要把需要長篇申論的題目轉成填空題。

==================================================
十一、圖片題格式與圖片路徑規則
==================================================

如果題目需要圖片，請加入 images 欄位。

格式：

"images": [
  {
    "src": "assets/images/題庫ID/Q001.png",
    "alt": "圖片替代文字",
    "caption": "圖1：圖片說明"
  }
]

如果詳解需要圖片，請加入 explanationImages 欄位。

格式：

"explanationImages": [
  {
    "src": "assets/images/題庫ID/Q001_explanation.png",
    "alt": "詳解圖片替代文字",
    "caption": "解析圖：詳解圖片說明"
  }
]

圖片規則：

1. 原始題目有圖片、表格、流程圖、架構圖、截圖時，不要忽略。
2. 若圖片檔名已知，請使用正確路徑。
3. 若圖片檔名未知，請使用可辨識的暫定檔名。
4. 圖片必須放在題庫專屬資料夾中，資料夾名稱建議與 bankId 相同或高度相近。
5. 建議路徑格式為 assets/images/題庫ID/題號.png。
6. 詳解圖片建議命名為 assets/images/題庫ID/題號_explanation.png。
7. 不要使用 assets/images/Q001.png 這種根目錄路徑，因為不同題庫都可能有 Q001.png，容易撞名。
8. 若同一題有多張圖片，請使用 Q001_1.png、Q001_2.png、Q001_table.png、Q001_flow.png 等可辨識檔名。
9. alt 要簡短描述圖片內容。
10. caption 要說明圖片用途。
11. 圖片路徑一律使用相對路徑。
12. 不要使用 C:/、D:/、桌面路徑、Google Drive 私人路徑或網址型圖片路徑。
13. 支援副檔名 png、jpg、jpeg、webp、gif、svg。
14. 圖片題請在 tags 中加入「圖片題」。

==================================================
十二、詳解要求
==================================================

每一題都必須有 explanation。

詳解不能只是重複答案，也不能只寫「因為 A 符合題意，所以選 A」這類空泛說明。

詳解必須真正分析題目所要求的知識點，並將題目條件與各選項逐一連結，讓使用者能透過詳解理解為什麼該選項正確、其他選項錯誤。

詳解請包含：

1. 先說明本題在考什麼概念、定義、流程、分類、公式或應用情境。
2. 說明正確答案為什麼符合題目的要求。
3. 若是單選題，必須逐一說明 A、B、C、D 各選項為何正確或錯誤。
4. 若是複選題，必須逐一分析每一個選項，說明哪些選項應選、哪些選項不應選。
5. 若是「組合題」，例如選項為 123、124、1234、2345 等形式，必須先逐一分析題目中的每一個編號項目，例如 (1)(2)(3)(4)(5)，說明每一項是否正確，再回頭判斷 A、B、C、D 哪一個組合完整且正確。
6. 若某個編號項目不應被選入，必須明確說明它錯在哪裡，不能只說「不符合題意」。
7. 若某個編號項目是正確的，除了說它正確，也要簡要介紹該概念的意義、功能或應用情境。
8. 若是計算題，必須列出公式、代入數值、計算過程與答案，並說明其他選項為什麼不是正確結果。
9. 若是名詞定義題，必須說明該名詞的核心意義、用途，以及容易混淆的相近概念。
10. 若是流程順序題，必須說明每個流程步驟的先後邏輯，不可只列出正確順序。
11. 若是圖片題，詳解必須呼應圖片中的資訊、圖表、流程或標示內容。
12. 文字要清楚、簡單、適合考前複習，但不可過度簡略。
13. 不要自行新增原始題庫沒有的題目、答案或未提供的背景資料。
14. 如果原始資料未明確提供答案，請在 explanation 中標記「原始資料未明確提供答案，需人工確認」。
15. 如果疑似官方答案有誤，不要擅自更改 answer，請在 explanation 中提醒「此題答案可能需人工確認」。

詳解撰寫深度要求：

1. 單選題詳解至少應包含「考點說明、正確選項理由、其他選項錯誤原因」。
2. 複選題詳解必須逐項分析，不可只列出正確選項代號。
3. 組合題詳解必須先分析編號項目，再分析選項組合。
4. 計算題詳解必須讓使用者看得出計算邏輯，而不是只給答案。
5. 如果原始資料資訊不足，請明確標示需人工確認，不要自行腦補。

詳解風格範例：

本題答案為 B。MRP 是 Material Requirements Planning，主要用來依據主生產排程與物料清單計算未來所需物料的數量與時間。因此 B 正確。A 只描述庫存查詢，範圍過窄；C 偏向財務管理；D 則與人事管理有關，皆不是 MRP 的主要目的。

==================================================
十三、標籤、章節與難度
==================================================

tags：

1. 每題至少 1 個 tag。
2. tags 要簡潔，不要放整句話。
3. 圖片題請加入「圖片題」。

chapter：

1. 請依題目主題歸類。
2. 若原始資料已有章節，請優先使用原始章節。
3. 若無法判斷章節，填入「未分類」。

difficulty 只能使用：

easy
medium
hard

判斷方式：

easy：基本定義、名詞解釋、直接記憶題。
medium：需要理解概念差異、流程或應用。
hard：需要計算、情境判斷、跨章節整合。

==================================================
十四、題號規則
==================================================

1. 如果原始資料有題號，請盡量保留。
2. 題號不得重複。
3. 如果原始資料沒有題號，請自動產生 Q001、Q002、Q003。
4. 不要把頁碼、章節編號或項目符號誤當成題號。

==================================================
十五、OCR 與文字清理規則
==================================================

若來源是 PDF 擷取文字或圖片 OCR，請特別注意：

1. 修正明顯的 OCR 斷行，但不要改變題意。
2. 移除中文字之間不正常的空格，例如「企 業 資 源 規 劃」應整理為「企業資源規劃」。
3. 保留必要英文空格，例如 Enterprise Resource Planning。
4. 保留選項代號與選項內容。
5. 保留重要標點、公式、英文縮寫、括號與專有名詞。
6. 不要把詳解、答案表、頁首頁尾混進題目文字。
7. 不要把連續兩題合併成一題。
8. 不要把同一題拆成多題。

==================================================
十六、資料保真要求
==================================================

因為本網站用於官方題庫反覆練習，請遵守：

1. 不要任意改寫題目核心內容。
2. 不要自行新增官方資料沒有的題目。
3. 不要自行生成相似題。
4. 不要猜測答案。
5. 若答案不明確，請在 explanation 中標記「原始資料未明確提供答案，需人工確認」。
6. 若原始題目有明顯錯字，可以在不改變題意下修正。
7. 若有疑似答案錯誤，不要擅自更改，請在 explanation 中提醒需人工確認。
8. 若原題包含圖片、表格、流程圖、架構圖，請保留圖片欄位，不要只用文字取代。

==================================================
十七、輸出前自我檢查
==================================================

輸出前請自行確認：

1. JSON 格式合法。
2. 沒有多餘逗號。
3. 沒有註解。
4. 沒有 Markdown。
5. 每題都有 id。
6. 每題都有 type。
7. 每題都有 question。
8. 每題都有 answer。
9. 每題都有 explanation。
10. 每題都有 tags。
11. 每題都有 difficulty。
12. 每題都有 chapter。
13. 題型只使用 single_choice、multiple_choice、true_false、fill_blank。
14. 單選題 answer 是字串，且存在於 options。
15. 複選題 answer 是陣列，且每個答案都存在於 options。
16. 是非題 answer 是 true 或 false。
17. 填空題 answer 是陣列。
18. images 若存在，必須是陣列。
19. explanationImages 若存在，必須是陣列。
20. 圖片物件必須包含 src、alt、caption。
21. 圖片路徑是相對路徑。
22. 沒有把章節標題、頁碼、頁首頁尾誤當成題目。
23. 沒有異常中文字空格。
24. 題號沒有重複。

==================================================
十八、現在請開始
==================================================

請根據我接下來提供的資料，產生符合墨忻刷題網格式的 JSON 題庫。

請只輸出 JSON。`;

const state = {
  banks: [],
  importedBanks: {},
  currentBankMeta: null,
  currentBankData: null,
  filteredQuestions: [],
  practice: null,
  exam: null,
  examTimerId: null,
  validatorReport: null,
  uiPrefs: null,
  lastExamResult: null
};

function $(id) {
  return document.getElementById(id);
}

function initApp() {
  bindGlobalEvents();
  $('aiPromptText').textContent = AI_PROMPT;
  state.importedBanks = loadFromLocalStorage(STORAGE_KEYS.importedBanks, {});
  state.uiPrefs = loadUiPrefs();
  applyUiPrefs();
  syncUiPrefControls();
  loadQuestionBanks();
  renderLocalDataSummary();
  populateValidatorBankSelect();
}

async function loadQuestionBanks() {
  try {
    const response = await fetch('question-banks.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const banks = await response.json();
    if (!Array.isArray(banks)) throw new Error('question-banks.json 必須是陣列');
    state.banks = banks.filter(bank => bank.enabled !== false);
  } catch (error) {
    showMessage(`question-banks.json 無法讀取，已嘗試使用 sample.json。錯誤：${error.message}`, 'warning');
    state.banks = [{
      id: 'sample',
      title: '範例題庫',
      description: '備援範例題庫',
      file: 'questions/sample.json',
      category: '範例',
      version: '1.0',
      questionCount: 0,
      createdDate: '2026-06-06',
      enabled: true
    }];
  }
  renderQuestionBankList();
  populateExamBankSelect();
  populateValidatorBankSelect();
  const lastBankId = loadFromLocalStorage(STORAGE_KEYS.selectedBank, null);
  if (lastBankId && findBankMeta(lastBankId)) {
    // 保留選擇紀錄，但不自動跳頁，避免重新整理後打斷首頁。
  }
}

function renderQuestionBankList() {
  const list = $('bankList');
  const keyword = normalizeText($('bankSearchInput').value || '');
  const allBanks = getAllBankMetas();
  const filtered = allBanks.filter(bank => {
    const haystack = normalizeText(`${bank.title} ${bank.description} ${bank.category}`);
    return !keyword || haystack.includes(keyword);
  });

  list.innerHTML = '';
  if (filtered.length === 0) {
    list.innerHTML = `<div class="panel"><p>找不到符合條件的題庫。</p></div>`;
    return;
  }

  filtered.forEach(bank => {
    const card = document.createElement('article');
    card.className = 'bank-card';
    card.innerHTML = `
      <h3>${escapeHtml(bank.title)}</h3>
      <p>${escapeHtml(bank.description || '')}</p>
      <div class="meta-row">
        <span class="badge">ID：${escapeHtml(bank.id)}</span>
        <span class="badge">分類：${escapeHtml(bank.category || '未分類')}</span>
        <span class="badge">題數：${bank.questionCount ?? '未知'}</span>
        <span class="badge">版本：${escapeHtml(bank.version || '')}</span>
        ${bank.imported ? '<span class="badge warning">本機匯入</span>' : ''}
      </div>
      <div class="toolbar">
        <button type="button" data-bank-action="detail" data-bank-id="${escapeAttr(bank.id)}">進入題庫</button>
        <button type="button" class="secondary" data-bank-action="wrong" data-bank-id="${escapeAttr(bank.id)}">只練錯題</button>
        <button type="button" class="secondary" data-bank-action="favorite" data-bank-id="${escapeAttr(bank.id)}">收藏練習</button>
        ${bank.imported ? `<button type="button" class="danger" data-bank-action="deleteImported" data-bank-id="${escapeAttr(bank.id)}">刪除匯入題庫</button>` : ''}
      </div>
    `;
    list.appendChild(card);
  });
}

async function loadQuestionBank(bankId) {
  const meta = findBankMeta(bankId);
  if (!meta) {
    showMessage('找不到指定題庫。', 'error');
    return null;
  }

  try {
    let bankData;
    if (meta.imported) {
      bankData = state.importedBanks[bankId];
    } else {
      const response = await fetch(meta.file, { cache: 'no-store' });
      if (!response.ok) throw new Error(`題庫 JSON 檔案不存在或無法讀取：${meta.file}`);
      bankData = await response.json();
    }

    const errors = validateQuestionBank(bankData);
    if (errors.length > 0) throw new Error(errors.join('；'));

    state.currentBankMeta = meta;
    state.currentBankData = bankData;
    saveToLocalStorage(STORAGE_KEYS.selectedBank, bankId);
    renderBankDetail();
    showPage('bankDetailPage');
    return bankData;
  } catch (error) {
    showMessage(`題庫載入失敗：${error.message}`, 'error');
    return null;
  }
}

function validateQuestionBank(bank) {
  const errors = [];
  if (!bank || typeof bank !== 'object') return ['題庫格式錯誤，根節點必須是物件'];
  ['bankId', 'title', 'description', 'version', 'createdDate', 'category'].forEach(field => {
    if (!bank[field] || typeof bank[field] !== 'string') errors.push(`題庫缺少 ${field}`);
  });
  if (!Array.isArray(bank.questions)) errors.push('questions 必須是陣列');
  if (Array.isArray(bank.questions) && bank.questions.length === 0) errors.push('題庫沒有任何題目');

  const ids = new Set();
  if (Array.isArray(bank.questions)) {
    bank.questions.forEach((question, index) => {
      validateQuestion(question, index).forEach(error => errors.push(error));
      if (question && question.id) {
        if (ids.has(question.id)) errors.push(`題目 id 重複：${question.id}`);
        ids.add(question.id);
      }
    });
  }
  return errors;
}

function validateQuestion(question, index = 0) {
  const label = `第 ${index + 1} 題`;
  const errors = [];
  if (!question || typeof question !== 'object') return [`${label} 格式錯誤`];
  if (!question.id) errors.push(`${label} 沒有 id`);
  if (!question.type) errors.push(`${label} 沒有 type`);
  if (!ALLOWED_TYPES.includes(question.type)) errors.push(`${label} type 不支援：${question.type}`);
  if (!question.question || typeof question.question !== 'string') errors.push(`${label} 沒有 question`);
  if (!Object.prototype.hasOwnProperty.call(question, 'answer')) errors.push(`${label} 沒有 answer`);
  if (!question.explanation || typeof question.explanation !== 'string') errors.push(`${label} 沒有 explanation`);

  if (question.type === 'single_choice') {
    if (!isPlainObject(question.options) || Object.keys(question.options).length < 2) errors.push(`${label} 單選題沒有有效 options`);
    if (typeof question.answer !== 'string') errors.push(`${label} 單選題 answer 必須是字串`);
  }
  if (question.type === 'multiple_choice') {
    if (!isPlainObject(question.options) || Object.keys(question.options).length < 2) errors.push(`${label} 複選題沒有有效 options`);
    if (!Array.isArray(question.answer)) errors.push(`${label} 複選題 answer 必須是陣列`);
  }
  if (question.type === 'true_false') {
    if (typeof question.answer !== 'boolean') errors.push(`${label} 是非題 answer 必須是 true 或 false`);
  }
  if (question.type === 'fill_blank') {
    if (!Array.isArray(question.answer) || question.answer.length === 0) errors.push(`${label} 填空題 answer 必須是非空陣列`);
  }

  validateImageFields(question.images, `${label} images`).forEach(error => errors.push(error));
  validateImageFields(question.explanationImages, `${label} explanationImages`).forEach(error => errors.push(error));

  if (question.tags && !Array.isArray(question.tags)) errors.push(`${label} tags 必須是陣列`);
  if (question.difficulty && !ALLOWED_DIFFICULTY.includes(question.difficulty)) errors.push(`${label} difficulty 只能是 easy、medium、hard`);
  return errors;
}

function validateImageFields(images, fieldName = 'images') {
  const errors = [];
  if (images === undefined) return errors;
  if (!Array.isArray(images)) return [`${fieldName} 欄位格式錯誤，必須是陣列`];
  images.forEach((image, index) => {
    if (!image || typeof image !== 'object') {
      errors.push(`${fieldName}[${index}] 必須是物件`);
      return;
    }
    ['src', 'alt', 'caption'].forEach(field => {
      if (!image[field] || typeof image[field] !== 'string') errors.push(`${fieldName}[${index}] 缺少 ${field}`);
    });
    if (image.src && !isAllowedImagePath(image.src)) errors.push(`${fieldName}[${index}] 圖片副檔名不支援：${image.src}`);
  });
  return errors;
}

function renderBankDetail() {
  const bank = state.currentBankData;
  $('bankDetailTitle').textContent = bank.title;
  $('bankDetailDescription').textContent = bank.description;
  $('bankDetailMeta').innerHTML = `
    <span class="badge">ID：${escapeHtml(bank.bankId)}</span>
    <span class="badge">分類：${escapeHtml(bank.category)}</span>
    <span class="badge">版本：${escapeHtml(bank.version)}</span>
    <span class="badge">建立日期：${escapeHtml(bank.createdDate)}</span>
    <span class="badge">題數：${bank.questions.length}</span>
  `;
  populateQuestionFilters(bank.questions);
  applyQuestionFilters();
}

function populateQuestionFilters(questions) {
  const tagSet = new Set();
  const chapterSet = new Set();
  questions.forEach(q => {
    (q.tags || []).forEach(tag => tagSet.add(tag));
    if (q.chapter) chapterSet.add(q.chapter);
  });
  setSelectOptions($('tagFilter'), ['all', ...Array.from(tagSet).sort()], '全部');
  setSelectOptions($('chapterFilter'), ['all', ...Array.from(chapterSet).sort()], '全部');
}

function applyQuestionFilters() {
  if (!state.currentBankData) return;
  const keyword = normalizeText($('questionSearchInput').value || '');
  const type = $('typeFilter').value;
  const difficulty = $('difficultyFilter').value;
  const tag = $('tagFilter').value;
  const chapter = $('chapterFilter').value;
  const imageFilter = $('imageFilter').value;

  state.filteredQuestions = state.currentBankData.questions.filter(q => {
    const hasImages = (q.images && q.images.length > 0) || (q.explanationImages && q.explanationImages.length > 0);
    const imgText = [...(q.images || []), ...(q.explanationImages || [])].map(img => `${img.src} ${img.alt} ${img.caption}`).join(' ');
    const optionsText = isPlainObject(q.options) ? Object.values(q.options).join(' ') : '';
    const haystack = normalizeText(`${q.id} ${q.question} ${optionsText} ${q.explanation} ${imgText}`);
    return (!keyword || haystack.includes(keyword)) &&
      (type === 'all' || q.type === type) &&
      (difficulty === 'all' || q.difficulty === difficulty) &&
      (tag === 'all' || (q.tags || []).includes(tag)) &&
      (chapter === 'all' || q.chapter === chapter) &&
      (imageFilter === 'all' || (imageFilter === 'with' ? hasImages : !hasImages));
  });

  $('filteredCountText').textContent = `目前篩選結果：${state.filteredQuestions.length} / ${state.currentBankData.questions.length} 題`;
}

function startPractice(questions = null, mode = 'all') {
  const sourceQuestions = questions || state.filteredQuestions;
  if (!state.currentBankData) {
    showMessage('請先選擇題庫。', 'warning');
    return;
  }
  if (!sourceQuestions || sourceQuestions.length === 0) {
    showMessage('篩選後沒有題目，無法開始練習。', 'warning');
    return;
  }

  state.practice = {
    mode,
    bankId: state.currentBankData.bankId,
    bankTitle: state.currentBankData.title,
    sourceQuestionIds: sourceQuestions.map(q => q.id),
    queue: createQuestionQueue(sourceQuestions),
    completedIds: [],
    roundErrors: {},
    totalAttempts: 0,
    totalWrong: 0,
    records: [],
    currentQuestion: null,
    answered: false,
    startTime: new Date().toISOString(),
    finishTime: null
  };
  saveProgress();
  showPage('practicePage');
  renderQuestion();
  syncMobilePracticeBar();
  requestAnimationFrame(() => scrollToElement('practicePage', 'auto'));
}

async function startWrongBookPractice(bankId = null) {
  const targetBankId = bankId || state.currentBankData?.bankId;
  if (!targetBankId) {
    showMessage('請先選擇題庫。', 'warning');
    return;
  }
  const bank = state.currentBankData?.bankId === targetBankId ? state.currentBankData : await loadQuestionBank(targetBankId);
  if (!bank) return;
  const wrongBook = loadFromLocalStorage(STORAGE_KEYS.wrongBook, {});
  const ids = Object.keys(wrongBook[targetBankId] || {});
  const questions = bank.questions.filter(q => ids.includes(q.id));
  if (questions.length === 0) {
    showMessage('這個題庫目前沒有錯題。', 'warning');
    return;
  }
  startPractice(questions, 'wrongBook');
}

async function startFavoritePractice(bankId = null) {
  const targetBankId = bankId || state.currentBankData?.bankId;
  if (!targetBankId) {
    showMessage('請先選擇題庫。', 'warning');
    return;
  }
  const bank = state.currentBankData?.bankId === targetBankId ? state.currentBankData : await loadQuestionBank(targetBankId);
  if (!bank) return;
  const favorites = loadFromLocalStorage(STORAGE_KEYS.favorites, {});
  const ids = Object.keys(favorites[targetBankId] || {});
  const questions = bank.questions.filter(q => ids.includes(q.id));
  if (questions.length === 0) {
    showMessage('這個題庫目前沒有收藏題目。', 'warning');
    return;
  }
  startPractice(questions, 'favorites');
}


async function startUnfamiliarPractice(bankId = null) {
  const targetBankId = bankId || state.currentBankData?.bankId;
  if (!targetBankId) {
    showMessage('請先選擇題庫。', 'warning');
    return;
  }
  const bank = state.currentBankData?.bankId === targetBankId ? state.currentBankData : await loadQuestionBankForExam(targetBankId);
  if (!bank) return;
  state.currentBankData = bank;
  state.currentBankMeta = findBankMeta(targetBankId);
  state.filteredQuestions = Array.isArray(bank.questions) ? bank.questions : [];
  const unfamiliar = loadFromLocalStorage(STORAGE_KEYS.unfamiliar, {});
  const ids = Object.keys(unfamiliar[targetBankId] || {});
  const questions = bank.questions.filter(q => ids.includes(q.id));
  if (questions.length === 0) {
    showMessage('這個題庫目前沒有不熟題。', 'warning');
    return;
  }
  startPractice(questions, 'unfamiliar');
}

function startExamMode() {
  const bankId = $('examBankSelect').value;
  const count = Math.max(1, Number($('examCountInput').value || 1));
  const minutes = Math.max(1, Number($('examMinutesInput').value || 1));
  loadQuestionBankForExam(bankId).then(bank => {
    if (!bank) return;
    const selected = shuffleArray([...bank.questions]).slice(0, Math.min(count, bank.questions.length));
    state.exam = {
      bankId: bank.bankId,
      bankTitle: bank.title,
      questions: selected,
      startTime: Date.now(),
      endTime: Date.now() + minutes * 60 * 1000,
      submitted: false
    };
    renderExamActive();
    if (state.examTimerId) clearInterval(state.examTimerId);
    state.examTimerId = setInterval(updateExamTimer, 1000);
    showMessage('模擬考已開始。', 'success');
  });
}

function createQuestionQueue(questions) {
  return shuffleArray(questions.map(q => q.id));
}

function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function renderQuestion(useCurrent = false) {
  const practice = state.practice;
  if (!practice) return;
  let question = null;

  if (useCurrent && practice.currentQuestion && !practice.answered) {
    question = findQuestionById(practice.currentQuestion.id) || practice.currentQuestion;
  } else {
    if (practice.queue.length === 0) {
      finishRound();
      return;
    }
    const questionId = practice.queue.shift();
    question = findQuestionById(questionId);
    if (!question) {
      showMessage(`題目不存在：${questionId}`, 'error');
      renderQuestion();
      return;
    }
    practice.currentQuestion = question;
    practice.answered = false;
  }
  $('submitAnswerButton').disabled = false;
  $('submitAnswerButton').textContent = '提交答案';
  $('submitAnswerButton').classList.remove('secondary');
  $('nextQuestionButton').disabled = true;
  $('nextQuestionButton').classList.add('hidden');
  $('explanationArea').className = 'explanation-area hidden';
  $('explanationArea').innerHTML = '';

  const errorCount = practice.roundErrors[question.id] || 0;
  $('questionMeta').innerHTML = `
    <span class="badge">題庫：${escapeHtml(practice.bankTitle)}</span>
    <span class="badge">題號：${escapeHtml(question.id)}</span>
    <span class="badge">題型：${TYPE_LABELS[question.type]}</span>
    <span class="badge">章節：${escapeHtml(question.chapter || '未分類')}</span>
    <span class="badge">難度：${escapeHtml(question.difficulty || '未設定')}</span>
    ${(question.tags || []).map(tag => `<span class="badge">#${escapeHtml(tag)}</span>`).join('')}
    ${errorCount > 0 ? `<span class="badge danger">本題本輪已答錯 ${errorCount} 次</span>` : ''}
  `;
  $('questionTitle').textContent = question.question;
  renderQuestionImages(question);
  renderAnswerForm(question);
  updateProgress();
  saveProgress();
  updateFavoriteButton();
  updateUnfamiliarButton();
  syncMobilePracticeBar();
}

function renderQuestionImages(question) {
  const container = $('questionImages');
  container.innerHTML = '';
  renderImages(question.images || [], container);
}

function renderExplanationImages(question) {
  const wrapper = document.createElement('div');
  wrapper.className = 'image-list';
  renderImages(question.explanationImages || [], wrapper);
  return wrapper;
}

function renderImages(images, container) {
  if (!Array.isArray(images) || images.length === 0) return;
  images.forEach(image => {
    const template = $('imageFigureTemplate').content.cloneNode(true);
    const figure = template.querySelector('figure');
    const img = template.querySelector('img');
    const caption = template.querySelector('figcaption');
    img.src = image.src;
    img.alt = image.alt;
    img.onerror = () => handleImageError(img, image.src);
    caption.textContent = image.caption;
    figure.dataset.src = image.src;
    container.appendChild(template);
  });
}

function handleImageError(img, src) {
  const figure = img.closest('figure');
  if (!figure) return;
  figure.innerHTML = `<div class="image-error">圖片無法載入：${escapeHtml(src)}</div>`;
}

function renderAnswerForm(question, prefix = 'answer') {
  const form = $('answerForm');
  form.innerHTML = buildAnswerInputs(question, prefix);
}

function buildAnswerInputs(question, prefix) {
  if (question.type === 'single_choice') {
    return Object.entries(question.options || {}).map(([key, text]) => `
      <label class="option-row" data-option="${escapeAttr(key)}">
        <input type="radio" name="${prefix}" value="${escapeAttr(key)}" />
        <span class="answer-text"><strong>${escapeHtml(key)}.</strong> ${escapeHtml(text)}</span>
      </label>
    `).join('');
  }
  if (question.type === 'multiple_choice') {
    return Object.entries(question.options || {}).map(([key, text]) => `
      <label class="option-row" data-option="${escapeAttr(key)}">
        <input type="checkbox" name="${prefix}" value="${escapeAttr(key)}" />
        <span class="answer-text"><strong>${escapeHtml(key)}.</strong> ${escapeHtml(text)}</span>
      </label>
    `).join('');
  }
  if (question.type === 'true_false') {
    return `
      <label class="option-row" data-option="true"><input type="radio" name="${prefix}" value="true" /> <span>O / 是 / 正確</span></label>
      <label class="option-row" data-option="false"><input type="radio" name="${prefix}" value="false" /> <span>X / 否 / 錯誤</span></label>
    `;
  }
  if (question.type === 'fill_blank') {
    return `<label>請輸入答案<input type="text" name="${prefix}" autocomplete="off" placeholder="請輸入填空答案" /></label>`;
  }
  return '<p>不支援的題型。</p>';
}

function handlePracticeActionButton() {
  const practice = state.practice;
  if (!practice || !practice.currentQuestion) return;
  if (practice.answered) {
    nextQuestion();
  } else {
    submitAnswer();
  }
}


function syncMobilePracticeBar() {
  const p = state.practice;
  const mainButton = $('submitAnswerButton');
  const mobileAction = $('mobilePracticeActionButton');
  if (mainButton && mobileAction) {
    mobileAction.textContent = mainButton.textContent || '提交答案';
    mobileAction.disabled = mainButton.disabled;
    mobileAction.className = mainButton.className;
  }
  const favoriteButton = $('favoriteButton');
  const mobileFavoriteButton = $('mobileFavoriteButton');
  if (favoriteButton && mobileFavoriteButton) mobileFavoriteButton.textContent = favoriteButton.textContent.includes('取消') ? '已收藏' : '收藏';
  const unfamiliarButton = $('unfamiliarButton');
  const mobileUnfamiliarButton = $('mobileUnfamiliarButton');
  if (unfamiliarButton && mobileUnfamiliarButton) mobileUnfamiliarButton.textContent = unfamiliarButton.textContent.includes('取消') ? '已不熟' : '不熟';
  const bar = $('mobilePracticeBar');
  if (bar) bar.hidden = !p || state.uiPrefs?.mobileBar === 'off';
}

function scrollToElement(id, behavior = 'smooth') {
  const el = typeof id === 'string' ? $(id) : id;
  if (!el) return;
  const headerOffset = 92;
  const rect = el.getBoundingClientRect();
  const top = Math.max(0, window.pageYOffset + rect.top - headerOffset);
  window.scrollTo({ top, behavior });
}

function submitAnswer() {
  const practice = state.practice;
  if (!practice || !practice.currentQuestion) return;
  if (practice.answered) {
    nextQuestion();
    return;
  }
  const question = practice.currentQuestion;
  const userAnswer = getUserAnswer(question);
  if (isEmptyAnswer(userAnswer, question.type)) {
    showMessage('請先作答再提交。', 'warning');
    return;
  }

  const isCorrect = checkAnswer(question, userAnswer);
  practice.answered = true;
  practice.totalAttempts += 1;
  if (!isCorrect) {
    practice.totalWrong += 1;
    practice.roundErrors[question.id] = (practice.roundErrors[question.id] || 0) + 1;
    updateWrongBook(question, userAnswer);
    addWrongQuestionBackToQueue(question);
  } else if (!practice.completedIds.includes(question.id)) {
    practice.completedIds.push(question.id);
  }

  const record = createAnswerRecord(question, userAnswer, isCorrect);
  practice.records.push(record);
  appendAnswerRecord(record);
  showExplanation(question, userAnswer, isCorrect);
  markAnswerFeedback(question, userAnswer);
  $('submitAnswerButton').disabled = false;
  $('submitAnswerButton').textContent = practice.queue.length === 0 ? '查看本輪結果' : '下一題';
  $('submitAnswerButton').classList.add('secondary');
  $('nextQuestionButton').disabled = true;
  $('nextQuestionButton').classList.add('hidden');
  updateProgress();
  saveProgress();
  syncMobilePracticeBar();
  requestAnimationFrame(() => scrollToElement('explanationArea'));
}

function getUserAnswer(question, root = document) {
  if (question.type === 'single_choice') {
    const selected = root.querySelector('input[name="answer"]:checked');
    return selected ? selected.value : '';
  }
  if (question.type === 'multiple_choice') {
    return Array.from(root.querySelectorAll('input[name="answer"]:checked')).map(input => input.value).sort();
  }
  if (question.type === 'true_false') {
    const selected = root.querySelector('input[name="answer"]:checked');
    return selected ? selected.value === 'true' : null;
  }
  if (question.type === 'fill_blank') {
    const input = root.querySelector('input[name="answer"]');
    return input ? input.value : '';
  }
  return null;
}

function checkAnswer(question, userAnswer) {
  if (question.type === 'single_choice') return normalizeAnswer(userAnswer) === normalizeAnswer(question.answer);
  if (question.type === 'multiple_choice') {
    const a = normalizeAnswer(userAnswer);
    const b = normalizeAnswer(question.answer);
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => item === b[index]);
  }
  if (question.type === 'true_false') return userAnswer === question.answer;
  if (question.type === 'fill_blank') {
    const answer = String(userAnswer || '').trim();
    return (question.answer || []).some(item => {
      const accepted = String(item).trim();
      return question.caseSensitive === true ? answer === accepted : answer.toLowerCase() === accepted.toLowerCase();
    });
  }
  return false;
}

function normalizeAnswer(answer) {
  if (Array.isArray(answer)) return answer.map(item => String(item).trim()).sort();
  if (typeof answer === 'string') return answer.trim();
  return answer;
}

function showExplanation(question, userAnswer, isCorrect) {
  const area = $('explanationArea');
  const user = formatAnswerWithOptionText(question, userAnswer);
  const correct = formatAnswerWithOptionText(question, question.answer);
  const errorCount = state.practice.roundErrors[question.id] || 0;
  area.className = `explanation-area ${isCorrect ? 'correct' : 'wrong'}`;
  area.innerHTML = `
    <h3>${isCorrect ? '答對了' : '答錯了'}</h3>
    <p>使用者答案：<span class="${isCorrect ? 'correct-text' : 'wrong-text'}">${escapeHtml(user)}</span></p>
    <p>正確答案：<span class="correct-text">${escapeHtml(correct)}</span></p>
    ${!isCorrect ? `<p>本題本輪錯誤次數：<span class="wrong-text">${errorCount}</span></p>` : ''}
    <h4>詳解</h4>
    <p>${escapeHtml(question.explanation)}</p>
  `;
  const explanationImages = renderExplanationImages(question);
  if (explanationImages.children.length > 0) area.appendChild(explanationImages);
}

function markCorrectAnswer(question) {
  getCorrectAnswerValues(question).forEach(ans => {
    const row = document.querySelector(`.option-row[data-option="${cssEscape(ans)}"]`);
    if (row) row.classList.add('correct');
  });
}

function markWrongAnswer(question, userAnswer) {
  const correctValues = new Set(getCorrectAnswerValues(question));
  getUserAnswerValues(question, userAnswer).forEach(ans => {
    if (!correctValues.has(ans)) {
      const row = document.querySelector(`.option-row[data-option="${cssEscape(ans)}"]`);
      if (row) row.classList.add('wrong');
    }
  });
}

function markAnswerFeedback(question, userAnswer) {
  if (!['single_choice', 'multiple_choice', 'true_false'].includes(question.type)) return;

  const correctValues = new Set(getCorrectAnswerValues(question));
  const userValues = new Set(getUserAnswerValues(question, userAnswer));

  document.querySelectorAll('#answerForm input').forEach(input => {
    input.disabled = true;
  });

  document.querySelectorAll('#answerForm .option-row').forEach(row => {
    const value = String(row.dataset.option);
    const isCorrectOption = correctValues.has(value);
    const isUserOption = userValues.has(value);

    row.classList.remove('correct', 'wrong', 'selected-answer');
    row.querySelectorAll('.answer-feedback-tags').forEach(el => el.remove());

    if (isCorrectOption) row.classList.add('correct');
    if (isUserOption && !isCorrectOption) row.classList.add('wrong');
    if (isUserOption) row.classList.add('selected-answer');

    if (isCorrectOption || isUserOption) {
      const tags = document.createElement('span');
      tags.className = 'answer-feedback-tags';
      if (isUserOption) {
        const userTag = document.createElement('span');
        userTag.className = `answer-feedback-tag ${isCorrectOption ? 'user-correct' : 'user-wrong'}`;
        userTag.textContent = '你的答案';
        tags.appendChild(userTag);
      }
      if (isCorrectOption) {
        const correctTag = document.createElement('span');
        correctTag.className = 'answer-feedback-tag correct-answer';
        correctTag.textContent = '正確答案';
        tags.appendChild(correctTag);
      }
      row.appendChild(tags);
    }
  });
}

function getCorrectAnswerValues(question) {
  if (question.type === 'multiple_choice') return (question.answer || []).map(item => String(item));
  if (question.type === 'true_false') return [String(question.answer)];
  if (question.type === 'single_choice') return [String(question.answer)];
  return [];
}

function getUserAnswerValues(question, userAnswer) {
  if (question.type === 'multiple_choice') return (userAnswer || []).map(item => String(item));
  if (question.type === 'true_false') return userAnswer === null || userAnswer === undefined ? [] : [String(userAnswer)];
  if (question.type === 'single_choice') return userAnswer ? [String(userAnswer)] : [];
  return [];
}

function addWrongQuestionBackToQueue(question) {
  if (!state.practice.queue.includes(question.id)) state.practice.queue.push(question.id);
}

function updateWrongBook(question, userAnswer = null) {
  const bankId = state.currentBankData.bankId;
  const wrongBook = loadFromLocalStorage(STORAGE_KEYS.wrongBook, {});
  if (!wrongBook[bankId]) wrongBook[bankId] = {};
  const existing = wrongBook[bankId][question.id] || { count: 0 };
  wrongBook[bankId][question.id] = {
    bankId,
    bankTitle: state.currentBankData.title,
    questionId: question.id,
    count: existing.count + 1,
    lastWrongAt: new Date().toISOString(),
    lastUserAnswer: userAnswer,
    snapshot: question
  };
  saveToLocalStorage(STORAGE_KEYS.wrongBook, wrongBook);
}

function removeFromWrongBook(bankId, questionId) {
  const wrongBook = loadFromLocalStorage(STORAGE_KEYS.wrongBook, {});
  if (wrongBook[bankId]) {
    delete wrongBook[bankId][questionId];
    if (Object.keys(wrongBook[bankId]).length === 0) delete wrongBook[bankId];
  }
  saveToLocalStorage(STORAGE_KEYS.wrongBook, wrongBook);
  renderWrongBookPage();
  renderLocalDataSummary();
}

function toggleFavoriteQuestion() {
  if (!state.practice?.currentQuestion || !state.currentBankData) return;
  const question = state.practice.currentQuestion;
  const bankId = state.currentBankData.bankId;
  const favorites = loadFromLocalStorage(STORAGE_KEYS.favorites, {});
  if (!favorites[bankId]) favorites[bankId] = {};
  if (favorites[bankId][question.id]) {
    delete favorites[bankId][question.id];
    showMessage('已從收藏移除。', 'success');
  } else {
    favorites[bankId][question.id] = {
      bankId,
      bankTitle: state.currentBankData.title,
      questionId: question.id,
      addedAt: new Date().toISOString(),
      snapshot: question
    };
    showMessage('已加入收藏。', 'success');
  }
  if (Object.keys(favorites[bankId]).length === 0) delete favorites[bankId];
  saveToLocalStorage(STORAGE_KEYS.favorites, favorites);
  updateFavoriteButton();
}


function toggleUnfamiliarQuestion() {
  if (!state.practice?.currentQuestion || !state.currentBankData) return;
  const question = state.practice.currentQuestion;
  const bankId = state.currentBankData.bankId;
  const unfamiliar = loadFromLocalStorage(STORAGE_KEYS.unfamiliar, {});
  if (!unfamiliar[bankId]) unfamiliar[bankId] = {};
  if (unfamiliar[bankId][question.id]) {
    delete unfamiliar[bankId][question.id];
    showMessage('已取消不熟標記。', 'success');
  } else {
    unfamiliar[bankId][question.id] = {
      bankId,
      bankTitle: state.currentBankData.title,
      questionId: question.id,
      markedAt: new Date().toISOString(),
      snapshot: question
    };
    showMessage('已標記為不熟題。', 'success');
  }
  if (Object.keys(unfamiliar[bankId]).length === 0) delete unfamiliar[bankId];
  saveToLocalStorage(STORAGE_KEYS.unfamiliar, unfamiliar);
  updateUnfamiliarButton();
}

function updateUnfamiliarButton() {
  const q = state.practice?.currentQuestion;
  const bankId = state.currentBankData?.bankId;
  const btn = $('unfamiliarButton');
  if (!btn) return;
  if (!q || !bankId) {
    btn.textContent = '標記不熟';
    syncMobilePracticeBar();
    return;
  }
  const unfamiliar = loadFromLocalStorage(STORAGE_KEYS.unfamiliar, {});
  btn.textContent = unfamiliar[bankId]?.[q.id] ? '取消不熟標記' : '標記不熟';
  syncMobilePracticeBar();
}

function removeFromFavorite(bankId, questionId) {
  const favorites = loadFromLocalStorage(STORAGE_KEYS.favorites, {});
  if (favorites[bankId]) {
    delete favorites[bankId][questionId];
    if (Object.keys(favorites[bankId]).length === 0) delete favorites[bankId];
  }
  saveToLocalStorage(STORAGE_KEYS.favorites, favorites);
  renderFavoritesPage();
  renderLocalDataSummary();
}

function nextQuestion() {
  if (!state.practice?.answered) {
    showMessage('請先提交答案。', 'warning');
    return;
  }
  renderQuestion();
  requestAnimationFrame(() => scrollToElement('practicePage'));
  syncMobilePracticeBar();
}

function updateProgress() {
  const p = state.practice;
  if (!p) return;
  const total = p.sourceQuestionIds.length;
  const completed = p.completedIds.length;
  const remaining = total - completed;
  const accuracy = p.totalAttempts === 0 ? 0 : Math.round(((p.totalAttempts - p.totalWrong) / p.totalAttempts) * 100);
  const currentError = p.currentQuestion ? (p.roundErrors[p.currentQuestion.id] || 0) : 0;
  $('progressStats').innerHTML = `
    ${statItem('目前題庫名稱', p.bankTitle)}
    ${statItem('本輪總題數', total)}
    ${statItem('已完成題數', completed)}
    ${statItem('剩餘題數', remaining)}
    ${statItem('本輪總答題次數', p.totalAttempts)}
    ${statItem('本輪總答錯次數', p.totalWrong)}
    ${statItem('目前正確率', `${accuracy}%`)}
    ${statItem('目前題目的本輪錯誤次數', currentError)}
  `;
}

function finishRound() {
  const p = state.practice;
  if (!p) return;
  p.finishTime = new Date().toISOString();
  clearProgress();
  const accuracy = p.totalAttempts === 0 ? 0 : Math.round(((p.totalAttempts - p.totalWrong) / p.totalAttempts) * 100);
  $('finishStats').innerHTML = `
    ${statItem('題庫名稱', p.bankTitle)}
    ${statItem('本輪完成時間', formatDateTime(p.finishTime))}
    ${statItem('總題數', p.sourceQuestionIds.length)}
    ${statItem('總答題次數', p.totalAttempts)}
    ${statItem('總答錯次數', p.totalWrong)}
    ${statItem('正確率', `${accuracy}%`)}
  `;

  const list = $('finishWrongList');
  list.innerHTML = '';
  const wrongIds = Object.keys(p.roundErrors).filter(id => p.roundErrors[id] > 0);
  if (wrongIds.length === 0) {
    list.innerHTML = '<div class="panel"><p>本輪沒有錯題。</p></div>';
  } else {
    wrongIds.forEach(id => {
      const q = findQuestionById(id);
      if (q) list.appendChild(buildQuestionRecordCard({
        bankId: p.bankId,
        bankTitle: p.bankTitle,
        questionId: q.id,
        count: p.roundErrors[id],
        lastWrongAt: p.finishTime,
        snapshot: q
      }, { showRemoveWrong: false }));
    });
  }
  showPage('finishPage');
  requestAnimationFrame(() => scrollToElement('finishPage'));
}

function saveProgress() {
  if (!state.practice) return;
  saveToLocalStorage(STORAGE_KEYS.progress, state.practice);
}

function loadProgress() {
  const progress = loadFromLocalStorage(STORAGE_KEYS.progress, null);
  if (!progress || !progress.bankId) {
    showMessage('沒有可載入的練習進度。', 'warning');
    return;
  }
  loadQuestionBank(progress.bankId).then(bank => {
    if (!bank) return;
    state.practice = progress;
    showPage('practicePage');
    renderQuestion(true);
  });
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEYS.progress);
}


function loadUiPrefs() {
  const defaults = {
    fontSize: 'standard',
    optionSpacing: 'standard',
    darkMode: 'off',
    mobileBar: 'on'
  };
  const stored = loadFromLocalStorage(STORAGE_KEYS.uiPrefs, {});
  return { ...defaults, ...(isPlainObject(stored) ? stored : {}) };
}

function saveUiPrefs() {
  saveToLocalStorage(STORAGE_KEYS.uiPrefs, state.uiPrefs || loadUiPrefs());
}

function applyUiPrefs() {
  const prefs = state.uiPrefs || loadUiPrefs();
  document.body.classList.toggle('font-large', prefs.fontSize === 'large');
  document.body.classList.toggle('font-xlarge', prefs.fontSize === 'xlarge');
  document.body.classList.toggle('option-comfortable', prefs.optionSpacing === 'comfortable');
  document.body.classList.toggle('dark-mode', prefs.darkMode === 'on');
  document.body.classList.toggle('mobile-bar-off', prefs.mobileBar === 'off');
  syncMobilePracticeBar();
}

function syncUiPrefControls() {
  const prefs = state.uiPrefs || loadUiPrefs();
  const mapping = {
    prefFontSize: prefs.fontSize,
    prefOptionSpacing: prefs.optionSpacing,
    prefDarkMode: prefs.darkMode,
    prefMobileBar: prefs.mobileBar
  };
  Object.entries(mapping).forEach(([id, value]) => {
    const el = $(id);
    if (el) el.value = value;
  });
}

function updateUiPref(name, value) {
  state.uiPrefs = { ...(state.uiPrefs || loadUiPrefs()), [name]: value };
  saveUiPrefs();
  applyUiPrefs();
}

function collectUnfamiliarRecords() {
  const unfamiliar = loadFromLocalStorage(STORAGE_KEYS.unfamiliar, {});
  return Object.values(unfamiliar).flatMap(bank => Object.values(bank));
}

function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    showMessage(`localStorage 儲存失敗：${error.message}`, 'error');
  }
}

function loadFromLocalStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`localStorage 資料損壞：${key}`, error);
    localStorage.removeItem(key);
    showMessage(`偵測到 ${key} 資料損壞，已清除該項資料。`, 'warning');
    return fallback;
  }
}

function importQuestionBank(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const bank = JSON.parse(reader.result);
      const errors = validateQuestionBank(bank);
      if (errors.length > 0) throw new Error(errors.join('；'));
      if (state.importedBanks[bank.bankId] && !confirm(`bankId「${bank.bankId}」已存在，是否覆蓋？`)) return;
      state.importedBanks[bank.bankId] = bank;
      saveToLocalStorage(STORAGE_KEYS.importedBanks, state.importedBanks);
      showMessage('題庫匯入完成。', 'success');
      renderQuestionBankList();
      populateExamBankSelect();
      populateValidatorBankSelect();
      renderImportedBankList();
    } catch (error) {
      showMessage(`匯入錯誤格式 JSON：${error.message}`, 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function deleteImportedQuestionBank(bankId) {
  if (!state.importedBanks[bankId]) return;
  if (!confirm(`確定刪除匯入題庫「${bankId}」？`)) return;
  delete state.importedBanks[bankId];
  saveToLocalStorage(STORAGE_KEYS.importedBanks, state.importedBanks);
  renderQuestionBankList();
  populateExamBankSelect();
  populateValidatorBankSelect();
  renderImportedBankList();
  showMessage('匯入題庫已刪除。', 'success');
}

function exportWrongBookToJSON() {
  exportData('moxin-wrong-book.json', collectWrongBookRecords(), 'json');
}

function exportWrongBookToCSV() {
  exportData('moxin-wrong-book.csv', recordsToCsv(collectWrongBookRecords()), 'csv');
}

function exportFavoritesToJSON() {
  exportData('moxin-favorites.json', collectFavoriteRecords(), 'json');
}

function exportRoundRecordToJSON() {
  exportData('moxin-round-record.json', state.practice?.records || loadFromLocalStorage(STORAGE_KEYS.answerRecords, []), 'json');
}

function exportRoundRecordToCSV() {
  const records = state.practice?.records || loadFromLocalStorage(STORAGE_KEYS.answerRecords, []);
  exportData('moxin-round-record.csv', recordsToCsv(records), 'csv');
}

function exportAllLocalData() {
  const data = {
    selectedBank: loadFromLocalStorage(STORAGE_KEYS.selectedBank, null),
    progress: loadFromLocalStorage(STORAGE_KEYS.progress, null),
    wrongBook: loadFromLocalStorage(STORAGE_KEYS.wrongBook, {}),
    favorites: loadFromLocalStorage(STORAGE_KEYS.favorites, {}),
    unfamiliar: loadFromLocalStorage(STORAGE_KEYS.unfamiliar, {}),
    importedBanks: loadFromLocalStorage(STORAGE_KEYS.importedBanks, {}),
    answerRecords: loadFromLocalStorage(STORAGE_KEYS.answerRecords, []),
    examRecords: loadFromLocalStorage(STORAGE_KEYS.examRecords, []),
    uiPrefs: loadFromLocalStorage(STORAGE_KEYS.uiPrefs, {})
  };
  exportData('moxin-local-data-backup.json', data, 'json');
}

function importAllLocalData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object') throw new Error('備份檔根節點必須是物件');
      Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
        if (Object.prototype.hasOwnProperty.call(data, name)) saveToLocalStorage(key, data[name]);
      });
      state.importedBanks = loadFromLocalStorage(STORAGE_KEYS.importedBanks, {});
      state.uiPrefs = loadUiPrefs();
      applyUiPrefs();
      syncUiPrefControls();
      renderQuestionBankList();
      populateExamBankSelect();
      populateValidatorBankSelect();
      renderLocalDataSummary();
      showMessage('本機資料已還原。', 'success');
    } catch (error) {
      showMessage(`匯入本機資料備份失敗：${error.message}`, 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function renderWrongBookPage() {
  const list = $('wrongBookList');
  const records = collectWrongBookRecords();
  list.innerHTML = '';
  if (records.length === 0) {
    list.innerHTML = '<div class="panel"><p>目前沒有錯題。</p></div>';
  } else {
    records.forEach(record => list.appendChild(buildQuestionRecordCard(record, { showRemoveWrong: true, showPractice: true })));
  }
  showPage('wrongBookPage');
}

function renderFavoritesPage() {
  const list = $('favoriteList');
  const records = collectFavoriteRecords();
  list.innerHTML = '';
  if (records.length === 0) {
    list.innerHTML = '<div class="panel"><p>目前沒有收藏題目。</p></div>';
  } else {
    records.forEach(record => list.appendChild(buildQuestionRecordCard(record, { showRemoveFavorite: true, showPracticeFavorite: true })));
  }
  showPage('favoritesPage');
}

function renderLocalDataSummary() {
  const wrongCount = collectWrongBookRecords().length;
  const favoriteCount = collectFavoriteRecords().length;
  const unfamiliarCount = collectUnfamiliarRecords().length;
  const importedCount = Object.keys(loadFromLocalStorage(STORAGE_KEYS.importedBanks, {})).length;
  const answerCount = loadFromLocalStorage(STORAGE_KEYS.answerRecords, []).length;
  const examCount = loadFromLocalStorage(STORAGE_KEYS.examRecords, []).length;
  const box = $('localDataSummary');
  if (!box) return;
  box.innerHTML = `
    ${statItem('錯題本題數', wrongCount)}
    ${statItem('收藏題數', favoriteCount)}
    ${statItem('不熟題數', unfamiliarCount)}
    ${statItem('匯入題庫數', importedCount)}
    ${statItem('答題紀錄數', answerCount)}
    ${statItem('模擬考紀錄數', examCount)}
  `;
  renderImportedBankList();
}

function renderImportedBankList() {
  const list = $('importedBankList');
  if (!list) return;
  const imported = loadFromLocalStorage(STORAGE_KEYS.importedBanks, {});
  const banks = Object.values(imported);
  list.innerHTML = '';
  if (banks.length === 0) {
    list.innerHTML = '<p class="muted">目前沒有匯入題庫。</p>';
    return;
  }
  banks.forEach(bank => {
    const div = document.createElement('div');
    div.className = 'record-card';
    div.innerHTML = `
      <h3>${escapeHtml(bank.title)}</h3>
      <p>${escapeHtml(bank.description || '')}</p>
      <div class="meta-row"><span class="badge">${escapeHtml(bank.bankId)}</span><span class="badge">${bank.questions.length} 題</span></div>
      <button type="button" class="danger" data-delete-imported="${escapeAttr(bank.bankId)}">刪除</button>
    `;
    list.appendChild(div);
  });
}

function buildQuestionRecordCard(record, options = {}) {
  const q = record.snapshot;
  const card = document.createElement('article');
  card.className = 'record-card';
  const imageWrapperId = `img-${record.bankId}-${record.questionId}-${Math.random().toString(36).slice(2)}`;
  const expImageWrapperId = `exp-img-${record.bankId}-${record.questionId}-${Math.random().toString(36).slice(2)}`;
  card.innerHTML = `
    <h3>${escapeHtml(record.questionId)}｜${escapeHtml(q.question)}</h3>
    <div class="meta-row">
      <span class="badge">題庫：${escapeHtml(record.bankTitle || record.bankId)}</span>
      <span class="badge">題型：${TYPE_LABELS[q.type] || q.type}</span>
      <span class="badge">章節：${escapeHtml(q.chapter || '未分類')}</span>
      <span class="badge">難度：${escapeHtml(q.difficulty || '未設定')}</span>
      ${record.count !== undefined ? `<span class="badge danger">答錯次數：${record.count}</span>` : ''}
      ${record.lastWrongAt ? `<span class="badge">最近錯誤：${formatDateTime(record.lastWrongAt)}</span>` : ''}
    </div>
    <div id="${imageWrapperId}" class="image-list"></div>
    <p>正確答案：<span class="correct-text">${escapeHtml(formatAnswer(q, q.answer))}</span></p>
    <p>詳解：${escapeHtml(q.explanation)}</p>
    <div id="${expImageWrapperId}" class="image-list"></div>
    <div class="toolbar">
      ${options.showRemoveWrong ? `<button type="button" class="danger" data-remove-wrong="${escapeAttr(record.bankId)}|${escapeAttr(record.questionId)}">從錯題本移除</button>` : ''}
      ${options.showRemoveFavorite ? `<button type="button" class="danger" data-remove-favorite="${escapeAttr(record.bankId)}|${escapeAttr(record.questionId)}">從收藏移除</button>` : ''}
      ${options.showPractice ? `<button type="button" class="secondary" data-practice-wrong-bank="${escapeAttr(record.bankId)}">只練習此題庫錯題</button>` : ''}
      ${options.showPracticeFavorite ? `<button type="button" class="secondary" data-practice-favorite-bank="${escapeAttr(record.bankId)}">只練習此題庫收藏</button>` : ''}
    </div>
  `;
  setTimeout(() => {
    const imgBox = document.getElementById(imageWrapperId);
    const expBox = document.getElementById(expImageWrapperId);
    if (imgBox) renderImages(q.images || [], imgBox);
    if (expBox) renderImages(q.explanationImages || [], expBox);
  }, 0);
  return card;
}

function renderExamActive() {
  const area = $('examActiveArea');
  const setup = $('examSetupPanel');
  if (setup) setup.classList.add('hidden');
  $('examResultArea').innerHTML = '';
  $('examNavFloatingButton')?.classList.remove('hidden');
  area.className = '';
  area.innerHTML = `
    <div class="exam-timer" id="examTimerText"></div>
    <div class="panel exam-active-header exam-compact-header">
      <div>
        <h3>${escapeHtml(state.exam.bankTitle)}</h3>
        <p>請完成所有題目後交卷。未作答題目會以錯誤計算。</p>
        <p id="examNavSummaryText" class="exam-inline-summary">尚未作答</p>
      </div>
      <div class="toolbar exam-header-actions">
        <button type="button" id="openExamNavButton" class="secondary">開啟題號面板</button>
        <button type="button" id="jumpFirstUnansweredButton" class="secondary">跳到第一題未作答</button>
      </div>
    </div>
    <form id="examForm"></form>
    <div class="panel exam-submit-panel"><button type="button" id="submitExamButton">交卷並批改</button></div>
  `;
  const form = $('examForm');
  state.exam.questions.forEach((q, index) => {
    const div = document.createElement('section');
    div.className = 'exam-question';
    div.id = `exam-question-${index}`;
    div.dataset.examIndex = String(index);
    const imgId = `exam-img-${q.id}-${index}`;
    div.innerHTML = `
      <div class="meta-row"><span class="badge">${index + 1}</span><span class="badge">${escapeHtml(q.id)}</span><span class="badge">${TYPE_LABELS[q.type]}</span></div>
      <h3>${escapeHtml(q.question)}</h3>
      <div id="${imgId}" class="image-list"></div>
      ${buildExamAnswerInputs(q, index)}
    `;
    form.appendChild(div);
    renderImages(q.images || [], div.querySelector(`#${CSS.escape(imgId)}`));
  });
  $('submitExamButton').addEventListener('click', () => submitExam(false));
  $('openExamNavButton')?.addEventListener('click', openExamQuestionDrawer);
  $('jumpFirstUnansweredButton')?.addEventListener('click', jumpFirstUnansweredExamQuestion);
  form.addEventListener('change', updateExamQuestionNavigation);
  form.addEventListener('input', updateExamQuestionNavigation);
  renderExamQuestionNavigation();
  updateExamTimer();
  requestAnimationFrame(() => scrollToElement('examActiveArea'));
}

function buildExamAnswerInputs(question, index) {
  const name = `exam_${index}`;
  if (question.type === 'single_choice') {
    return Object.entries(question.options || {}).map(([key, text]) => `<label class="option-row"><input type="radio" name="${name}" value="${escapeAttr(key)}" /> <span><strong>${escapeHtml(key)}.</strong> ${escapeHtml(text)}</span></label>`).join('');
  }
  if (question.type === 'multiple_choice') {
    return Object.entries(question.options || {}).map(([key, text]) => `<label class="option-row"><input type="checkbox" name="${name}" value="${escapeAttr(key)}" /> <span><strong>${escapeHtml(key)}.</strong> ${escapeHtml(text)}</span></label>`).join('');
  }
  if (question.type === 'true_false') {
    return `<label class="option-row"><input type="radio" name="${name}" value="true" /> O / 是</label><label class="option-row"><input type="radio" name="${name}" value="false" /> X / 否</label>`;
  }
  if (question.type === 'fill_blank') {
    return `<label>請輸入答案<input type="text" name="${name}" autocomplete="off" /></label>`;
  }
  return '';
}

function getExamAnswer(question, index) {
  const name = `exam_${index}`;
  if (question.type === 'single_choice') {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : '';
  }
  if (question.type === 'multiple_choice') {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(input => input.value).sort();
  }
  if (question.type === 'true_false') {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value === 'true' : null;
  }
  if (question.type === 'fill_blank') {
    const input = document.querySelector(`input[name="${name}"]`);
    return input ? input.value : '';
  }
  return null;
}

function updateExamTimer() {
  if (!state.exam || state.exam.submitted) return;
  const remain = Math.max(0, state.exam.endTime - Date.now());
  const min = Math.floor(remain / 60000);
  const sec = Math.floor((remain % 60000) / 1000);
  const text = $('examTimerText');
  if (text) text.textContent = `剩餘時間：${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (remain <= 0) submitExam(true);
}


function countUnansweredExamQuestions() {
  if (!state.exam) return 0;
  return state.exam.questions.reduce((count, question, index) => {
    const answer = getExamAnswer(question, index);
    return count + (isEmptyAnswer(answer, question.type) ? 1 : 0);
  }, 0);
}

function renderExamQuestionNavigation() {
  if (!state.exam) return;
  const html = state.exam.questions.map((q, index) => `
    <button type="button" class="exam-question-nav-button" data-exam-jump="${index}">
      <span>${index + 1}</span>
      <small>${escapeHtml(q.id)}</small>
    </button>
  `).join('');
  const drawer = $('examQuestionDrawerContent');
  if (drawer) drawer.innerHTML = html;
  document.querySelectorAll('[data-exam-jump]').forEach(button => {
    button.addEventListener('click', () => {
      closeExamQuestionDrawer();
      jumpToExamQuestion(Number(button.dataset.examJump));
    });
  });
  updateExamQuestionNavigation();
}

function updateExamQuestionNavigation() {
  if (!state.exam) return;
  let answeredCount = 0;
  document.querySelectorAll('[data-exam-jump]').forEach(button => {
    const index = Number(button.dataset.examJump);
    const q = state.exam.questions[index];
    const answered = q && !isEmptyAnswer(getExamAnswer(q, index), q.type);
    if (answered) answeredCount += 1;
    button.classList.toggle('answered', Boolean(answered));
    button.classList.toggle('unanswered', !answered);
    button.title = answered ? `第 ${index + 1} 題：已作答` : `第 ${index + 1} 題：未作答`;
  });
  const total = state.exam.questions.length;
  const unanswered = Math.max(0, total - answeredCount);
  const summaryText = `已作答 ${answeredCount} / ${total} 題，未作答 ${unanswered} 題`;
  const summary = $('examNavSummaryText');
  if (summary) summary.textContent = summaryText;
  const drawerSummary = $('examDrawerSummaryText');
  if (drawerSummary) drawerSummary.textContent = summaryText;
  const floatingButton = $('examNavFloatingButton');
  if (floatingButton) floatingButton.innerHTML = `<span>題號</span><strong>${answeredCount}/${total}</strong>`;
}

function jumpToExamQuestion(index) {
  const el = document.getElementById(`exam-question-${index}`);
  if (!el) return;
  scrollToElement(el);
}

function jumpFirstUnansweredExamQuestion() {
  if (!state.exam) return;
  const index = state.exam.questions.findIndex((question, questionIndex) => isEmptyAnswer(getExamAnswer(question, questionIndex), question.type));
  if (index < 0) {
    showMessage('所有題目都已作答。', 'success');
    return;
  }
  closeExamQuestionDrawer();
  jumpToExamQuestion(index);
}

function openExamQuestionDrawer() {
  const drawer = $('examQuestionDrawer');
  if (!drawer) return;
  drawer.classList.remove('hidden');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeExamQuestionDrawer() {
  const drawer = $('examQuestionDrawer');
  if (!drawer) return;
  drawer.classList.add('hidden');
  drawer.setAttribute('aria-hidden', 'true');
}

function submitExam(force = false) {
  if (!state.exam || state.exam.submitted) return;
  const unanswered = countUnansweredExamQuestions();
  if (!force && unanswered > 0) {
    const ok = confirm(`尚有 ${unanswered} 題未作答，是否仍要交卷？`);
    if (!ok) return;
  }
  state.exam.submitted = true;
  if (state.examTimerId) clearInterval(state.examTimerId);
  const records = state.exam.questions.map((q, index) => {
    const userAnswer = getExamAnswer(q, index);
    const isCorrect = checkAnswer(q, userAnswer);
    if (!isCorrect) updateWrongBookForBank(state.exam.bankId, state.exam.bankTitle, q, userAnswer);
    return {
      bankId: state.exam.bankId,
      bankTitle: state.exam.bankTitle,
      questionId: q.id,
      type: q.type,
      question: q.question,
      imagePaths: (q.images || []).map(img => img.src).join('; '),
      userAnswer,
      correctAnswer: q.answer,
      isCorrect,
      answeredAt: new Date().toISOString(),
      wrongCount: isCorrect ? 0 : 1,
      explanation: q.explanation,
      explanationImagePaths: (q.explanationImages || []).map(img => img.src).join('; '),
      snapshot: q
    };
  });
  const correct = records.filter(r => r.isCorrect).length;
  const total = records.length;
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
  const examRecord = {
    bankId: state.exam.bankId,
    bankTitle: state.exam.bankTitle,
    submittedAt: new Date().toISOString(),
    total,
    correct,
    wrong: total - correct,
    score: accuracy,
    records
  };
  const all = loadFromLocalStorage(STORAGE_KEYS.examRecords, []);
  all.push(examRecord);
  saveToLocalStorage(STORAGE_KEYS.examRecords, all);
  renderExamResult(examRecord);
}

function renderExamResult(result, filter = 'all', shouldScrollTop = true) {
  state.lastExamResult = result;
  $('examActiveArea').className = 'hidden';
  $('examNavFloatingButton')?.classList.add('hidden');
  closeExamQuestionDrawer();
  const area = $('examResultArea');
  const visibleRecords = filter === 'wrong' ? result.records.filter(record => !record.isCorrect) : result.records;
  area.innerHTML = `
    <div class="panel exam-result-summary">
      <h2>模擬考結果</h2>
      <div class="stats-list">
        ${statItem('得分', result.score)}
        ${statItem('正確率', `${result.score}%`)}
        ${statItem('答對題數', result.correct)}
        ${statItem('答錯題數', result.wrong)}
      </div>
      <div class="toolbar exam-result-filter" aria-label="模擬考結果顯示篩選">
        <button type="button" id="examResultShowAllButton" class="${filter === 'all' ? '' : 'secondary'}">查看全部題目</button>
        <button type="button" id="examResultShowWrongButton" class="${filter === 'wrong' ? '' : 'secondary'}">只看錯題</button>
        <button type="button" id="examRetakeWrongButton" class="secondary" ${result.wrong === 0 ? 'disabled' : ''}>重練本次錯題</button>
        <button type="button" id="examRestartButton" class="secondary">重新模擬考</button>
      </div>
      <p class="muted">目前顯示：${filter === 'wrong' ? `錯題 ${visibleRecords.length} 題` : `全部 ${visibleRecords.length} 題`}</p>
    </div>
  `;

  $('examResultShowAllButton').addEventListener('click', () => renderExamResult(result, 'all', false));
  $('examResultShowWrongButton').addEventListener('click', () => renderExamResult(result, 'wrong', false));
  $('examRetakeWrongButton').addEventListener('click', () => startExamWrongPractice(result));
  $('examRestartButton').addEventListener('click', () => { $('examSetupPanel')?.classList.remove('hidden'); $('examResultArea').innerHTML = ''; showPage('examPage'); });

  if (visibleRecords.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'panel notice';
    empty.textContent = filter === 'wrong' ? '本次模擬考沒有錯題。' : '本次模擬考沒有可顯示的題目。';
    area.appendChild(empty);
  } else {
    visibleRecords.forEach(record => {
      area.appendChild(buildExamResultCard(record));
    });
  }

  renderLocalDataSummary();
  if (shouldScrollTop) {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const resultPanel = area.querySelector('.exam-result-summary');
      if (resultPanel) resultPanel.focus?.({ preventScroll: true });
    });
  }
}

function buildExamResultCard(record) {
  const q = record.snapshot;
  const card = document.createElement('article');
  card.className = `record-card ${record.isCorrect ? 'exam-result-correct' : 'exam-result-wrong'}`;
  const imgId = `exam-result-img-${q.id}-${Math.random().toString(36).slice(2)}`;
  const expImgId = `exam-result-exp-${q.id}-${Math.random().toString(36).slice(2)}`;
  card.innerHTML = `
    <h3>${escapeHtml(q.id)}｜${escapeHtml(q.question)}</h3>
    <div class="meta-row"><span class="badge ${record.isCorrect ? 'success' : 'danger'}">${record.isCorrect ? '答對' : '答錯'}</span><span class="badge">${TYPE_LABELS[q.type]}</span></div>
    <div id="${imgId}" class="image-list"></div>
    <p>使用者答案：<span class="${record.isCorrect ? 'correct-text' : 'wrong-text'}">${escapeHtml(formatAnswerWithOptionText(q, record.userAnswer))}</span></p>
    <p>正確答案：<span class="correct-text">${escapeHtml(formatAnswerWithOptionText(q, q.answer))}</span></p>
    ${buildExamResultOptionReview(q, record.userAnswer)}
    <p>詳解：${escapeHtml(q.explanation)}</p>
    <div id="${expImgId}" class="image-list"></div>
  `;
  setTimeout(() => {
    renderImages(q.images || [], document.getElementById(imgId));
    renderImages(q.explanationImages || [], document.getElementById(expImgId));
  }, 0);
  return card;
}

function formatAnswerWithOptionText(question, answer) {
  if (question.type === 'single_choice') {
    return formatOptionAnswer(question, answer);
  }
  if (question.type === 'multiple_choice') {
    if (!Array.isArray(answer) || answer.length === 0) return '未作答';
    return answer.map(item => formatOptionAnswer(question, item)).join('；');
  }
  return formatAnswer(question, answer);
}

function formatOptionAnswer(question, answerKey) {
  if (answerKey === null || answerKey === undefined || answerKey === '') return '未作答';
  const key = String(answerKey);
  const optionText = question.options?.[key];
  return optionText ? `${key}. ${optionText}` : key;
}

function buildExamResultOptionReview(question, userAnswer) {
  if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    const correctSet = new Set((Array.isArray(question.answer) ? question.answer : [question.answer]).map(item => String(item)));
    const userSet = new Set((Array.isArray(userAnswer) ? userAnswer : (userAnswer ? [userAnswer] : [])).map(item => String(item)));
    const rows = Object.entries(question.options || {}).map(([key, text]) => {
      const isCorrectOption = correctSet.has(String(key));
      const isSelectedOption = userSet.has(String(key));
      const classes = ['answer-option-item'];
      if (isCorrectOption) classes.push('correct');
      if (isSelectedOption && !isCorrectOption) classes.push('wrong');
      if (isSelectedOption) classes.push('selected');
      const flags = [
        isSelectedOption ? '<span class="mini-badge selected">你的答案</span>' : '',
        isCorrectOption ? '<span class="mini-badge correct">正確答案</span>' : ''
      ].join('');
      return `
        <div class="${classes.join(' ')}">
          <span class="option-code">${escapeHtml(key)}</span>
          <span class="option-text">${escapeHtml(text)}</span>
          <span class="option-flags">${flags}</span>
        </div>
      `;
    }).join('');
    return `<div class="answer-option-review"><h4>選項內容</h4>${rows}</div>`;
  }

  if (question.type === 'true_false') {
    const choices = [
      { value: true, label: 'O / 是 / 正確' },
      { value: false, label: 'X / 否 / 錯誤' }
    ];
    const rows = choices.map(choice => {
      const isCorrectOption = question.answer === choice.value;
      const isSelectedOption = userAnswer === choice.value;
      const classes = ['answer-option-item'];
      if (isCorrectOption) classes.push('correct');
      if (isSelectedOption && !isCorrectOption) classes.push('wrong');
      if (isSelectedOption) classes.push('selected');
      const flags = [
        isSelectedOption ? '<span class="mini-badge selected">你的答案</span>' : '',
        isCorrectOption ? '<span class="mini-badge correct">正確答案</span>' : ''
      ].join('');
      return `
        <div class="${classes.join(' ')}">
          <span class="option-code">${choice.value ? 'O' : 'X'}</span>
          <span class="option-text">${escapeHtml(choice.label)}</span>
          <span class="option-flags">${flags}</span>
        </div>
      `;
    }).join('');
    return `<div class="answer-option-review"><h4>選項內容</h4>${rows}</div>`;
  }

  if (question.type === 'fill_blank' && Array.isArray(question.answer)) {
    return `<div class="answer-option-review"><h4>可接受答案</h4><p>${escapeHtml(question.answer.join('；'))}</p></div>`;
  }

  return '';
}


async function startExamWrongPractice(result) {
  const wrongRecords = (result.records || []).filter(record => !record.isCorrect);
  if (wrongRecords.length === 0) {
    showMessage('本次模擬考沒有錯題。', 'success');
    return;
  }
  const bank = await loadQuestionBankForExam(result.bankId);
  if (!bank) return;
  state.currentBankData = bank;
  state.currentBankMeta = findBankMeta(result.bankId);
  state.filteredQuestions = bank.questions;
  const ids = new Set(wrongRecords.map(record => record.questionId));
  const questions = bank.questions.filter(q => ids.has(q.id));
  if (questions.length === 0) {
    const snapshots = wrongRecords.map(record => record.snapshot).filter(Boolean);
    state.currentBankData = {
      ...bank,
      questions: snapshots
    };
    startPractice(snapshots, 'examWrong');
    return;
  }
  startPractice(questions, 'examWrong');
}

function updateWrongBookForBank(bankId, bankTitle, question, userAnswer) {
  const wrongBook = loadFromLocalStorage(STORAGE_KEYS.wrongBook, {});
  if (!wrongBook[bankId]) wrongBook[bankId] = {};
  const existing = wrongBook[bankId][question.id] || { count: 0 };
  wrongBook[bankId][question.id] = {
    bankId,
    bankTitle,
    questionId: question.id,
    count: existing.count + 1,
    lastWrongAt: new Date().toISOString(),
    lastUserAnswer: userAnswer,
    snapshot: question
  };
  saveToLocalStorage(STORAGE_KEYS.wrongBook, wrongBook);
}

function updateFavoriteButton() {
  const q = state.practice?.currentQuestion;
  const bankId = state.currentBankData?.bankId;
  const btn = $('favoriteButton');
  if (!btn) return;
  if (!q || !bankId) {
    btn.textContent = '加入收藏';
    syncMobilePracticeBar();
    return;
  }
  const favorites = loadFromLocalStorage(STORAGE_KEYS.favorites, {});
  btn.textContent = favorites[bankId]?.[q.id] ? '取消收藏' : '加入收藏';
  syncMobilePracticeBar();
}

function appendAnswerRecord(record) {
  const all = loadFromLocalStorage(STORAGE_KEYS.answerRecords, []);
  all.push(record);
  saveToLocalStorage(STORAGE_KEYS.answerRecords, all.slice(-1000));
}

function createAnswerRecord(question, userAnswer, isCorrect) {
  return {
    bankTitle: state.currentBankData.title,
    bankId: state.currentBankData.bankId,
    questionId: question.id,
    type: question.type,
    question: question.question,
    imagePaths: (question.images || []).map(img => img.src).join('; '),
    userAnswer,
    correctAnswer: question.answer,
    isCorrect,
    answeredAt: new Date().toISOString(),
    wrongCount: state.practice.roundErrors[question.id] || 0,
    explanation: question.explanation,
    explanationImagePaths: (question.explanationImages || []).map(img => img.src).join('; '),
    snapshot: question
  };
}

function collectWrongBookRecords() {
  const wrongBook = loadFromLocalStorage(STORAGE_KEYS.wrongBook, {});
  return Object.values(wrongBook).flatMap(bank => Object.values(bank));
}

function collectFavoriteRecords() {
  const favorites = loadFromLocalStorage(STORAGE_KEYS.favorites, {});
  return Object.values(favorites).flatMap(bank => Object.values(bank));
}


function populateValidatorBankSelect() {
  const select = $('validatorBankSelect');
  if (!select) return;
  const banks = getAllBankMetas();
  if (banks.length === 0) {
    select.innerHTML = '<option value="">目前沒有可檢查的題庫</option>';
    return;
  }
  select.innerHTML = banks.map(bank => `<option value="${escapeAttr(bank.id)}">${escapeHtml(bank.title)}（${escapeHtml(bank.id)}）</option>`).join('');
}

async function inspectSelectedQuestionBank() {
  const bankId = $('validatorBankSelect').value;
  if (!bankId) {
    showMessage('請先選擇要檢查的題庫。', 'warning');
    return;
  }
  const meta = findBankMeta(bankId);
  if (!meta) {
    showMessage('找不到指定題庫。', 'error');
    return;
  }
  try {
    let bank;
    if (meta.imported) {
      bank = state.importedBanks[bankId];
    } else {
      const response = await fetch(meta.file, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}：${meta.file}`);
      bank = await response.json();
    }
    runQuestionBankInspection(bank, meta.imported ? `本機匯入：${meta.title}` : meta.file);
  } catch (error) {
    renderValidatorReport({
      source: meta.file || meta.title,
      summary: { totalQuestions: 0, errorCount: 1, warningCount: 0, infoCount: 0, imageQuestionCount: 0 },
      issues: [{ severity: 'error', location: '題庫載入', message: error.message, suggestion: '請確認檔案路徑、JSON 格式與 GitHub Pages 部署狀態。' }],
      typeCounts: {},
      chapterCounts: {}
    });
  }
}

function inspectUploadedQuestionBank(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const bank = JSON.parse(reader.result);
      runQuestionBankInspection(bank, file.name);
    } catch (error) {
      renderValidatorReport({
        source: file.name,
        summary: { totalQuestions: 0, errorCount: 1, warningCount: 0, infoCount: 0, imageQuestionCount: 0 },
        issues: [{ severity: 'error', location: 'JSON 解析', message: `JSON 格式錯誤：${error.message}`, suggestion: '請檢查是否有多餘逗號、漏掉引號、使用註解或輸出 Markdown。' }],
        typeCounts: {},
        chapterCounts: {}
      });
    } finally {
      $('validatorFileInput').value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
}

function runQuestionBankInspection(bank, sourceLabel) {
  const report = analyzeQuestionBankQuality(bank, sourceLabel);
  state.validatorReport = report;
  renderValidatorReport(report);
}

function analyzeQuestionBankQuality(bank, sourceLabel = '') {
  const issues = [];
  const typeCounts = {};
  const chapterCounts = {};
  let imageQuestionCount = 0;

  const addIssue = (severity, location, message, suggestion = '') => {
    issues.push({ severity, location, message, suggestion });
  };

  if (!bank || typeof bank !== 'object' || Array.isArray(bank)) {
    addIssue('error', '題庫根節點', '題庫根節點必須是物件。', '請確認 JSON 最外層是 { ... }，不是陣列或純文字。');
    return buildQualityReport(sourceLabel, bank, issues, typeCounts, chapterCounts, imageQuestionCount);
  }

  ['bankId', 'title', 'description', 'version', 'createdDate', 'category'].forEach(field => {
    if (!bank[field] || typeof bank[field] !== 'string') addIssue('error', `題庫.${field}`, `缺少必要欄位 ${field} 或格式不是字串。`, '請補齊題庫基本資料。');
  });

  if (bank.bankId && !/^[A-Za-z0-9_-]+$/.test(bank.bankId)) {
    addIssue('warning', '題庫.bankId', 'bankId 建議只使用英文、數字、底線或連字號。', '避免使用空白、中文或特殊符號，方便作為檔名與圖片資料夾名稱。');
  }
  if (bank.createdDate && !/^\d{4}-\d{2}-\d{2}$/.test(bank.createdDate)) {
    addIssue('warning', '題庫.createdDate', 'createdDate 建議使用 YYYY-MM-DD 格式。', '例如 2026-06-07。');
  }
  if (!Array.isArray(bank.questions)) {
    addIssue('error', '題庫.questions', 'questions 必須是陣列。', '請使用 "questions": [] 存放題目。');
    return buildQualityReport(sourceLabel, bank, issues, typeCounts, chapterCounts, imageQuestionCount);
  }
  if (bank.questions.length === 0) {
    addIssue('error', '題庫.questions', '題庫沒有任何題目。', '請至少放入一題。');
  }

  const ids = new Map();
  bank.questions.forEach((question, index) => {
    const qLabel = question?.id ? `題目 ${question.id}` : `第 ${index + 1} 題`;
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      addIssue('error', qLabel, '題目必須是物件。', '請確認每一題都是 { ... } 格式。');
      return;
    }

    if (!question.id || typeof question.id !== 'string') {
      addIssue('error', qLabel, '缺少 id 或 id 不是字串。', '請保留原始題號，若沒有題號則使用 Q001、Q002。');
    } else if (ids.has(question.id)) {
      addIssue('error', qLabel, `題號重複，已在第 ${ids.get(question.id) + 1} 題出現。`, '請確認題號唯一。');
    } else {
      ids.set(question.id, index);
    }

    if (!question.type || !ALLOWED_TYPES.includes(question.type)) {
      addIssue('error', qLabel, `不支援的題型：${question.type || '空白'}。`, 'type 只能是 single_choice、multiple_choice、true_false、fill_blank。');
    } else {
      typeCounts[question.type] = (typeCounts[question.type] || 0) + 1;
    }

    if (!question.question || typeof question.question !== 'string') {
      addIssue('error', qLabel, '缺少 question 或 question 不是字串。', '請填入題目文字。');
    } else {
      inspectTextQuality(question.question, `${qLabel}.question`, addIssue);
      if (question.question.trim().length < 6) addIssue('warning', `${qLabel}.question`, '題目文字過短，可能不是完整題目。', '請檢查是否把章節標題、題號或殘缺 OCR 文字誤當題目。');
      if (/^第[一二三四五六七八九十0-9]+章/.test(question.question.trim()) && question.question.trim().length < 30) {
        addIssue('warning', `${qLabel}.question`, '題目看起來像章節標題。', '請確認這不是章節名稱、目錄或頁首。');
      }
    }

    const hasQuestionImages = Array.isArray(question.images) && question.images.length > 0;
    const hasExplanationImages = Array.isArray(question.explanationImages) && question.explanationImages.length > 0;
    if (hasQuestionImages || hasExplanationImages) imageQuestionCount += 1;

    inspectImageArray(question.images, `${qLabel}.images`, addIssue, bank.bankId);
    inspectImageArray(question.explanationImages, `${qLabel}.explanationImages`, addIssue, bank.bankId);

    if (!Object.prototype.hasOwnProperty.call(question, 'answer')) {
      addIssue('error', `${qLabel}.answer`, '缺少 answer。', '請填入正確答案。');
    }

    if (question.type === 'single_choice' || question.type === 'multiple_choice') {
      inspectOptions(question, qLabel, addIssue);
    }

    if (question.type === 'single_choice') {
      if (typeof question.answer !== 'string') {
        addIssue('error', `${qLabel}.answer`, '單選題 answer 必須是字串。', '例如 "answer": "B"。');
      } else if (isPlainObject(question.options) && !Object.prototype.hasOwnProperty.call(question.options, question.answer)) {
        addIssue('error', `${qLabel}.answer`, `答案 ${question.answer} 不存在於 options。`, '請確認答案代號與選項代號一致。');
      }
    }

    if (question.type === 'multiple_choice') {
      if (!Array.isArray(question.answer)) {
        addIssue('error', `${qLabel}.answer`, '複選題 answer 必須是陣列。', '例如 "answer": ["A", "C"]。');
      } else {
        const sorted = [...question.answer].map(String).sort();
        if (JSON.stringify(question.answer.map(String)) !== JSON.stringify(sorted)) {
          addIssue('info', `${qLabel}.answer`, '複選題答案建議依英文字母排序。', '例如 ["A", "C"]。');
        }
        const duplicated = question.answer.filter((item, idx, arr) => arr.indexOf(item) !== idx);
        if (duplicated.length > 0) addIssue('error', `${qLabel}.answer`, `複選題答案有重複代號：${duplicated.join(', ')}。`, '請移除重複答案。');
        if (isPlainObject(question.options)) {
          question.answer.forEach(ans => {
            if (!Object.prototype.hasOwnProperty.call(question.options, ans)) {
              addIssue('error', `${qLabel}.answer`, `答案 ${ans} 不存在於 options。`, '請確認答案代號與選項代號一致。');
            }
          });
        }
      }
    }

    if (question.type === 'true_false' && typeof question.answer !== 'boolean') {
      addIssue('error', `${qLabel}.answer`, '是非題 answer 必須是 true 或 false。', '請不要使用 "O"、"X"、"是"、"否" 字串。');
    }

    if (question.type === 'fill_blank') {
      if (!Array.isArray(question.answer) || question.answer.length === 0) {
        addIssue('error', `${qLabel}.answer`, '填空題 answer 必須是非空陣列。', '例如 "answer": ["ERP", "Enterprise Resource Planning"]。');
      } else {
        question.answer.forEach((ans, ansIndex) => {
          if (typeof ans !== 'string' || ans.trim() === '') addIssue('error', `${qLabel}.answer[${ansIndex}]`, '填空題可接受答案必須是非空字串。', '請移除空白答案。');
        });
      }
      if (question.caseSensitive !== undefined && typeof question.caseSensitive !== 'boolean') {
        addIssue('warning', `${qLabel}.caseSensitive`, 'caseSensitive 建議使用布林值。', '請使用 true 或 false。');
      }
    }

    if (!question.explanation || typeof question.explanation !== 'string') {
      addIssue('error', `${qLabel}.explanation`, '缺少 explanation 或 explanation 不是字串。', '每題都需要詳解。');
    } else {
      inspectTextQuality(question.explanation, `${qLabel}.explanation`, addIssue);
      if (question.explanation.trim().length < 25) addIssue('warning', `${qLabel}.explanation`, '詳解偏短，可能不足以考前複習。', '建議說明正確答案原因與錯誤選項錯在哪裡。');
      if (/需人工確認|疑似答案/.test(question.explanation)) addIssue('info', `${qLabel}.explanation`, '本題標記為需人工確認。', '正式使用前請人工核對答案與詳解。');
    }

    if (!Array.isArray(question.tags) || question.tags.length === 0) {
      addIssue('warning', `${qLabel}.tags`, 'tags 應為非空陣列。', '每題至少加入一個簡短標籤。');
    }
    if (!question.chapter || typeof question.chapter !== 'string') {
      addIssue('warning', `${qLabel}.chapter`, '缺少 chapter。', '若無法判斷請填入「未分類」。');
    } else {
      chapterCounts[question.chapter] = (chapterCounts[question.chapter] || 0) + 1;
    }
    if (!ALLOWED_DIFFICULTY.includes(question.difficulty)) {
      addIssue('warning', `${qLabel}.difficulty`, 'difficulty 應為 easy、medium 或 hard。', '請依題目難度填寫。');
    }
    if ((hasQuestionImages || hasExplanationImages) && Array.isArray(question.tags) && !question.tags.includes('圖片題')) {
      addIssue('info', `${qLabel}.tags`, '含圖片的題目建議加入「圖片題」標籤。', '方便使用圖片題篩選功能。');
    }
  });

  return buildQualityReport(sourceLabel, bank, issues, typeCounts, chapterCounts, imageQuestionCount);
}

function buildQualityReport(sourceLabel, bank, issues, typeCounts, chapterCounts, imageQuestionCount) {
  const errorCount = issues.filter(issue => issue.severity === 'error').length;
  const warningCount = issues.filter(issue => issue.severity === 'warning').length;
  const infoCount = issues.filter(issue => issue.severity === 'info').length;
  return {
    source: sourceLabel,
    bankId: bank?.bankId || '',
    title: bank?.title || '',
    inspectedAt: new Date().toISOString(),
    summary: {
      totalQuestions: Array.isArray(bank?.questions) ? bank.questions.length : 0,
      errorCount,
      warningCount,
      infoCount,
      imageQuestionCount
    },
    issues,
    typeCounts,
    chapterCounts
  };
}

function inspectOptions(question, qLabel, addIssue) {
  if (!isPlainObject(question.options)) {
    addIssue('error', `${qLabel}.options`, '選擇題 options 必須是物件。', '請使用 { "A": "選項A", "B": "選項B" }。');
    return;
  }
  const entries = Object.entries(question.options);
  if (entries.length < 2) addIssue('error', `${qLabel}.options`, '選擇題至少需要兩個選項。', '請確認選項是否擷取完整。');
  entries.forEach(([key, text]) => {
    if (!/^[A-Z]$/.test(key)) addIssue('warning', `${qLabel}.options.${key}`, '選項代號建議使用單一大寫英文字母。', '例如 A、B、C、D。');
    if (typeof text !== 'string' || text.trim() === '') {
      addIssue('error', `${qLabel}.options.${key}`, '選項內容空白或不是字串。', '請補齊選項文字。');
    } else {
      inspectTextQuality(text, `${qLabel}.options.${key}`, addIssue);
    }
  });
}

function inspectImageArray(images, fieldName, addIssue, bankId = '') {
  if (images === undefined) return;
  if (!Array.isArray(images)) {
    addIssue('error', fieldName, '圖片欄位必須是陣列。', '請使用 images: [{ src, alt, caption }]。');
    return;
  }
  images.forEach((image, index) => {
    const location = `${fieldName}[${index}]`;
    if (!image || typeof image !== 'object' || Array.isArray(image)) {
      addIssue('error', location, '圖片項目必須是物件。', '請使用 { "src": "...", "alt": "...", "caption": "..." }。');
      return;
    }
    ['src', 'alt', 'caption'].forEach(field => {
      if (!image[field] || typeof image[field] !== 'string') addIssue('error', `${location}.${field}`, `圖片缺少 ${field} 或格式不是字串。`, '每個圖片物件都需要 src、alt、caption。');
    });
    if (image.src) {
      if (/^[a-zA-Z]:[\\/]/.test(image.src) || image.src.startsWith('file:')) {
        addIssue('error', `${location}.src`, '圖片路徑不可使用本機磁碟路徑。', '請改成 assets/images/題庫ID/檔名.png。');
      }
      if (/^https?:\/\//.test(image.src)) {
        addIssue('warning', `${location}.src`, '不建議使用外部網址圖片。', 'GitHub Pages 題庫建議使用 assets/images/ 下的相對路徑。');
      }
      if (!isAllowedImagePath(image.src)) {
        addIssue('warning', `${location}.src`, '圖片副檔名不在支援清單。', '支援 png、jpg、jpeg、webp、gif、svg。');
      }
      if (!image.src.startsWith('assets/images/')) {
        addIssue('info', `${location}.src`, '圖片路徑建議放在 assets/images/ 底下。', '這樣 GitHub Pages 部署與題庫管理較穩定。');
      } else {
        const parts = image.src.split('/').filter(Boolean);
        const folderName = parts[2] || '';
        if (parts.length < 4) {
          addIssue('warning', `${location}.src`, '圖片路徑缺少題庫專屬資料夾，容易與其他題庫圖片撞名。', `建議使用 assets/images/${bankId || '題庫ID'}/檔名.png。`);
        } else if (bankId && folderName && folderName !== bankId) {
          addIssue('info', `${location}.src`, '圖片資料夾名稱建議與 bankId 相同或明確對應。', `目前資料夾為 ${folderName}，bankId 為 ${bankId}；若這是刻意命名可忽略。`);
        }
      }
    }
  });
}

function inspectTextQuality(text, location, addIssue) {
  const value = String(text || '');
  if (/[\u4e00-\u9fff]\s+[\u4e00-\u9fff]/.test(value)) {
    addIssue('warning', location, '偵測到中文字之間可能有 OCR 異常空格。', '例如「企 業 資 源」應整理為「企業資源」。');
  }
  if (/頁\s*碼|Page\s+\d+|copyright|版權所有|浮水印/i.test(value)) {
    addIssue('info', location, '文字中可能含頁首頁尾、頁碼或版權資訊。', '請確認是否需要移除。');
  }
}

function renderValidatorReport(report) {
  state.validatorReport = report;
  const summary = $('validatorSummary');
  const container = $('validatorReport');
  $('downloadValidatorReportButton').disabled = !report;

  const qualityClass = report.summary.errorCount > 0 ? 'danger' : report.summary.warningCount > 0 ? 'warning' : 'success';
  summary.innerHTML = `
    <div class="panel validator-summary ${qualityClass}">
      <h3>檢查結果：${escapeHtml(report.title || report.bankId || report.source || '未命名題庫')}</h3>
      <p class="muted">來源：${escapeHtml(report.source || '')}｜檢查時間：${escapeHtml(formatDateTime(report.inspectedAt))}</p>
      <div class="stats-list">
        ${statItem('題目總數', report.summary.totalQuestions)}
        ${statItem('錯誤', report.summary.errorCount)}
        ${statItem('警告', report.summary.warningCount)}
        ${statItem('提醒', report.summary.infoCount)}
        ${statItem('含圖片題', report.summary.imageQuestionCount)}
      </div>
      <p>${report.summary.errorCount > 0 ? '此題庫含必要格式錯誤，建議修正後再正式使用。' : report.summary.warningCount > 0 ? '此題庫可進一步人工檢查警告項目。' : '未發現明顯格式問題。'}</p>
    </div>
  `;

  const typeRows = Object.entries(report.typeCounts || {}).map(([type, count]) => `<span class="badge">${escapeHtml(TYPE_LABELS[type] || type)}：${count}</span>`).join('');
  const chapterRows = Object.entries(report.chapterCounts || {}).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([chapter, count]) => `<span class="badge">${escapeHtml(chapter)}：${count}</span>`).join('');

  const issueRows = report.issues.map(issue => `
    <article class="validator-issue ${escapeAttr(issue.severity)}">
      <div class="validator-issue-head">
        <span class="badge ${issue.severity === 'error' ? 'danger' : issue.severity === 'warning' ? 'warning' : ''}">${escapeHtml(severityLabel(issue.severity))}</span>
        <strong>${escapeHtml(issue.location)}</strong>
      </div>
      <p>${escapeHtml(issue.message)}</p>
      ${issue.suggestion ? `<p class="muted">建議：${escapeHtml(issue.suggestion)}</p>` : ''}
    </article>
  `).join('');

  container.innerHTML = `
    <div class="panel">
      <h3>題型與章節摘要</h3>
      <div class="meta-row">${typeRows || '<span class="muted">尚無題型統計</span>'}</div>
      <div class="meta-row">${chapterRows || '<span class="muted">尚無章節統計</span>'}</div>
    </div>
    <div class="panel">
      <h3>問題清單</h3>
      ${report.issues.length ? issueRows : '<p>未發現明顯問題。</p>'}
    </div>
  `;
  showPage('validatorPage');
}

function severityLabel(severity) {
  if (severity === 'error') return '錯誤';
  if (severity === 'warning') return '警告';
  return '提醒';
}

function downloadValidatorReport() {
  if (!state.validatorReport) {
    showMessage('目前沒有可下載的檢查報告。', 'warning');
    return;
  }
  const name = state.validatorReport.bankId || 'question-bank';
  exportData(`moxin-validator-report-${name}.json`, state.validatorReport, 'json');
}

function exportData(filename, data, type) {
  const content = type === 'json' ? JSON.stringify(data, null, 2) : data;
  const mime = type === 'json' ? 'application/json;charset=utf-8' : type === 'txt' ? 'text/plain;charset=utf-8' : 'text/csv;charset=utf-8';
  const payload = type === 'csv' ? '\ufeff' + content : content;
  const blob = new Blob([payload], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function recordsToCsv(records) {
  const header = ['題庫名稱', '題庫 ID', '題目 ID', '題型', '題目內容', '圖片路徑', '使用者答案', '正確答案', '是否答對', '答題時間', '錯誤次數', '詳解', '詳解圖片路徑'];
  const rows = records.map(r => [
    r.bankTitle || r.snapshot?.bankTitle || '',
    r.bankId || '',
    r.questionId || r.snapshot?.id || '',
    TYPE_LABELS[r.type || r.snapshot?.type] || r.type || r.snapshot?.type || '',
    r.question || r.snapshot?.question || '',
    r.imagePaths || (r.snapshot?.images || []).map(img => img.src).join('; '),
    formatRawAnswer(r.userAnswer || r.lastUserAnswer || ''),
    formatRawAnswer(r.correctAnswer || r.snapshot?.answer || ''),
    typeof r.isCorrect === 'boolean' ? (r.isCorrect ? '是' : '否') : '',
    r.answeredAt || r.lastWrongAt || '',
    r.wrongCount ?? r.count ?? '',
    r.explanation || r.snapshot?.explanation || '',
    r.explanationImagePaths || (r.snapshot?.explanationImages || []).map(img => img.src).join('; ')
  ]);
  return [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
}

async function loadQuestionBankForExam(bankId) {
  const meta = findBankMeta(bankId);
  if (!meta) {
    showMessage('請先選擇題庫。', 'warning');
    return null;
  }
  if (meta.imported) return state.importedBanks[bankId];
  try {
    const response = await fetch(meta.file, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bank = await response.json();
    const errors = validateQuestionBank(bank);
    if (errors.length) throw new Error(errors.join('；'));
    return bank;
  } catch (error) {
    showMessage(`模擬考題庫載入失敗：${error.message}`, 'error');
    return null;
  }
}

function getAllBankMetas() {
  const imported = Object.values(state.importedBanks || {}).map(bank => ({
    id: bank.bankId,
    title: bank.title,
    description: bank.description,
    file: null,
    category: bank.category,
    version: bank.version,
    questionCount: Array.isArray(bank.questions) ? bank.questions.length : 0,
    createdDate: bank.createdDate,
    enabled: true,
    imported: true
  }));
  const staticBanks = (state.banks || []).map(bank => ({ ...bank, imported: false }));
  const importedIds = new Set(imported.map(bank => bank.id));
  return [...imported, ...staticBanks.filter(bank => !importedIds.has(bank.id))];
}

function findBankMeta(bankId) {
  return getAllBankMetas().find(bank => bank.id === bankId) || null;
}

function findQuestionById(id) {
  return state.currentBankData?.questions.find(q => q.id === id) || null;
}

function formatAnswer(question, answer) {
  if (question.type === 'true_false') return answer === true ? 'O / 是 / 正確' : answer === false ? 'X / 否 / 錯誤' : '未作答';
  if (Array.isArray(answer)) return answer.join(', ');
  if (answer === null || answer === undefined || answer === '') return '未作答';
  return String(answer);
}

function formatRawAnswer(answer) {
  if (Array.isArray(answer)) return answer.join('; ');
  if (typeof answer === 'object' && answer !== null) return JSON.stringify(answer);
  return String(answer ?? '');
}

function isEmptyAnswer(answer, type) {
  if (type === 'multiple_choice') return !Array.isArray(answer) || answer.length === 0;
  if (type === 'true_false') return answer === null;
  return answer === '' || answer === null || answer === undefined;
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active-page'));
  $(pageId).classList.add('active-page');
  renderLocalDataSummary();
  if (pageId === 'examPage') { populateExamBankSelect(); $('examSetupPanel')?.classList.remove('hidden'); $('examNavFloatingButton')?.classList.add('hidden'); closeExamQuestionDrawer(); }
  if (pageId === 'validatorPage') populateValidatorBankSelect();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMessage(text, type = 'success') {
  const area = $('messageArea');
  area.innerHTML = `<div class="message ${type}">${escapeHtml(text)}</div>`;
  setTimeout(() => {
    if (area.textContent === text) area.innerHTML = '';
  }, 5000);
}

function populateExamBankSelect() {
  const select = $('examBankSelect');
  if (!select) return;
  select.innerHTML = getAllBankMetas().map(bank => `<option value="${escapeAttr(bank.id)}">${escapeHtml(bank.title)}（${escapeHtml(bank.category || '未分類')}）</option>`).join('');
}

function setSelectOptions(select, values, allLabel) {
  select.innerHTML = values.map(value => {
    const label = value === 'all' ? allLabel : value;
    return `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`;
  }).join('');
}

function statItem(label, value) {
  return `<div class="stat-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function clearAllLocalData() {
  if (!confirm('確定清除所有本機資料？此動作無法復原。')) return;
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  state.importedBanks = {};
  state.practice = null;
  state.uiPrefs = loadUiPrefs();
  applyUiPrefs();
  syncUiPrefControls();
  renderQuestionBankList();
  populateExamBankSelect();
  populateValidatorBankSelect();
  renderLocalDataSummary();
  showMessage('所有本機資料已清除。', 'success');
}

function bindGlobalEvents() {
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-nav]');
    if (nav) {
      const target = nav.dataset.nav;
      if (target === 'home') showPage('homePage');
      if (target === 'wrongBook') renderWrongBookPage();
      if (target === 'favorites') renderFavoritesPage();
      if (target === 'exam') showPage('examPage');
      if (target === 'validator') showPage('validatorPage');
      if (target === 'aiPrompt') showPage('aiPromptPage');
      if (target === 'settings') showPage('settingsPage');
    }

    const bankAction = event.target.closest('[data-bank-action]');
    if (bankAction) {
      const action = bankAction.dataset.bankAction;
      const bankId = bankAction.dataset.bankId;
      if (action === 'detail') loadQuestionBank(bankId);
      if (action === 'wrong') startWrongBookPractice(bankId);
      if (action === 'favorite') startFavoritePractice(bankId);
      if (action === 'deleteImported') deleteImportedQuestionBank(bankId);
    }

    const removeWrong = event.target.closest('[data-remove-wrong]');
    if (removeWrong) {
      const [bankId, questionId] = removeWrong.dataset.removeWrong.split('|');
      removeFromWrongBook(bankId, questionId);
    }

    const removeFavorite = event.target.closest('[data-remove-favorite]');
    if (removeFavorite) {
      const [bankId, questionId] = removeFavorite.dataset.removeFavorite.split('|');
      removeFromFavorite(bankId, questionId);
    }

    const practiceWrong = event.target.closest('[data-practice-wrong-bank]');
    if (practiceWrong) startWrongBookPractice(practiceWrong.dataset.practiceWrongBank);

    const practiceFavorite = event.target.closest('[data-practice-favorite-bank]');
    if (practiceFavorite) startFavoritePractice(practiceFavorite.dataset.practiceFavoriteBank);

    const deleteImported = event.target.closest('[data-delete-imported]');
    if (deleteImported) deleteImportedQuestionBank(deleteImported.dataset.deleteImported);
  });

  $('bankSearchInput').addEventListener('input', renderQuestionBankList);
  $('importBankInput').addEventListener('change', event => importQuestionBank(event.target.files[0]));
  ['questionSearchInput', 'typeFilter', 'difficultyFilter', 'tagFilter', 'chapterFilter', 'imageFilter'].forEach(id => {
    $(id).addEventListener('input', applyQuestionFilters);
    $(id).addEventListener('change', applyQuestionFilters);
  });
  $('startPracticeButton').addEventListener('click', () => startPractice());
  $('startWrongPracticeButton').addEventListener('click', () => startWrongBookPractice());
  $('startFavoritePracticeButton').addEventListener('click', () => startFavoritePractice());
  $('startUnfamiliarPracticeButton').addEventListener('click', () => startUnfamiliarPractice());
  $('resumePracticeButton').addEventListener('click', loadProgress);
  $('clearCurrentProgressButton').addEventListener('click', () => { clearProgress(); showMessage('目前題庫進度已清除。', 'success'); });
  $('submitAnswerButton').addEventListener('click', handlePracticeActionButton);
  $('mobilePracticeActionButton').addEventListener('click', handlePracticeActionButton);
  $('mobileTopButton').addEventListener('click', () => scrollToElement('practicePage'));
  $('nextQuestionButton').addEventListener('click', nextQuestion);
  $('favoriteButton').addEventListener('click', toggleFavoriteQuestion);
  $('mobileFavoriteButton').addEventListener('click', toggleFavoriteQuestion);
  $('unfamiliarButton').addEventListener('click', toggleUnfamiliarQuestion);
  $('mobileUnfamiliarButton').addEventListener('click', toggleUnfamiliarQuestion);
  $('backToBankButton').addEventListener('click', () => showPage('bankDetailPage'));
  $('restartPracticeButton').addEventListener('click', () => startPractice(state.filteredQuestions.length ? state.filteredQuestions : state.currentBankData.questions));
  $('finishWrongPracticeButton').addEventListener('click', () => startWrongBookPractice(state.currentBankData?.bankId));
  $('exportRoundJsonButton').addEventListener('click', exportRoundRecordToJSON);
  $('exportRoundCsvButton').addEventListener('click', exportRoundRecordToCSV);
  $('exportWrongJsonButton').addEventListener('click', exportWrongBookToJSON);
  $('exportWrongCsvButton').addEventListener('click', exportWrongBookToCSV);
  $('clearWrongBookButton').addEventListener('click', () => { if (confirm('確定清除錯題本？')) { saveToLocalStorage(STORAGE_KEYS.wrongBook, {}); renderWrongBookPage(); } });
  $('exportFavoritesJsonButton').addEventListener('click', exportFavoritesToJSON);
  $('clearFavoritesButton').addEventListener('click', () => { if (confirm('確定清除收藏題目？')) { saveToLocalStorage(STORAGE_KEYS.favorites, {}); renderFavoritesPage(); } });
  $('startExamButton').addEventListener('click', startExamMode);
  $('examNavFloatingButton').addEventListener('click', openExamQuestionDrawer);
  $('closeExamDrawerButton').addEventListener('click', closeExamQuestionDrawer);
  $('jumpFirstUnansweredDrawerButton')?.addEventListener('click', jumpFirstUnansweredExamQuestion);
  document.querySelectorAll('[data-close-exam-drawer]').forEach(el => el.addEventListener('click', closeExamQuestionDrawer));
  $('validatorFileInput').addEventListener('change', event => inspectUploadedQuestionBank(event.target.files[0]));
  $('validatorLoadSelectedButton').addEventListener('click', inspectSelectedQuestionBank);
  $('downloadValidatorReportButton').addEventListener('click', downloadValidatorReport);
  $('copyAiPromptButton').addEventListener('click', copyAiPrompt);
  $('downloadAiPromptButton').addEventListener('click', () => exportData('moxin-ai-question-bank-prompt.txt', AI_PROMPT, 'txt'));
  $('exportAllDataButton').addEventListener('click', exportAllLocalData);
  $('importAllDataInput').addEventListener('change', event => importAllLocalData(event.target.files[0]));
  $('clearAllLocalDataButton').addEventListener('click', clearAllLocalData);
  const prefBindings = {
    prefFontSize: 'fontSize',
    prefOptionSpacing: 'optionSpacing',
    prefDarkMode: 'darkMode',
    prefMobileBar: 'mobileBar'
  };
  Object.entries(prefBindings).forEach(([id, name]) => {
    const el = $(id);
    if (el) el.addEventListener('change', event => updateUiPref(name, event.target.value));
  });
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(event) {
  if (event.isComposing) return;
  const target = event.target;
  const tag = target?.tagName?.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag)) return;

  const practicePage = $('practicePage');
  if (!practicePage || !practicePage.classList.contains('active-page') || !state.practice?.currentQuestion) return;

  const key = event.key.toLowerCase();
  const q = state.practice.currentQuestion;
  if (key === 'enter') {
    event.preventDefault();
    handlePracticeActionButton();
    return;
  }
  if (key === 'f') {
    event.preventDefault();
    toggleFavoriteQuestion();
    return;
  }
  if (key === 'u') {
    event.preventDefault();
    toggleUnfamiliarQuestion();
    return;
  }
  if (state.practice.answered) return;
  if (/^[a-z]$/.test(key) && ['single_choice', 'multiple_choice'].includes(q.type)) {
    const optionKey = key.toUpperCase();
    const input = document.querySelector(`#answerForm input[value="${cssEscape(optionKey)}"]`);
    if (!input) return;
    event.preventDefault();
    if (q.type === 'single_choice') input.checked = true;
    else input.checked = !input.checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}


function copyAiPrompt() {
  navigator.clipboard.writeText(AI_PROMPT).then(() => {
    showMessage('提示詞已複製。', 'success');
  }).catch(() => {
    showMessage('複製失敗，請手動選取提示詞內容。', 'error');
  });
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isAllowedImagePath(src) {
  const clean = src.split('?')[0].split('#')[0];
  const ext = clean.includes('.') ? clean.split('.').pop().toLowerCase() : '';
  return ALLOWED_IMAGE_EXT.includes(ext);
}

function cssEscape(value) {
  return window.CSS && CSS.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('zh-TW', { hour12: false });
  } catch {
    return value;
  }
}

// ==================================================
// 未來 AI 擴充預留區
// ==================================================
// function generateQuestionBankWithAI(sourceFile) {}
// function generateExplanationWithAI(question) {}
// function analyzeWrongQuestionsWithAI(records) {}
// function summarizeExamPointsWithAI(bankData) {}
// 注意：目前版本不串接 AI API，不放置 API Key，不提供 AI 猜題或自由出題。

window.addEventListener('DOMContentLoaded', initApp);

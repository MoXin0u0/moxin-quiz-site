# 墨忻刷題網

墨忻刷題網是一個可部署到 GitHub Pages 的純前端刷題系統。

網站副標題：

> 支援多題庫的隨機刷題與錯題複習系統

本專案不需要登入、不需要後端、不需要資料庫、不需要 Node.js、不需要 Firebase 或 Supabase。所有資料都儲存在使用者瀏覽器的 localStorage。

## 功能特色

- 支援多題庫。
- 支援 JSON 題庫格式。
- 支援單選題、複選題、是非題、填空題。
- 每輪題目隨機排序。
- 同一輪答對後不再出現。
- 答錯題會回到同一輪稍後重做。
- 每題答完才顯示正確答案與詳解。
- 答錯時標示使用者錯誤答案與正確答案。
- 記錄每題本輪錯誤次數。
- 錯題本依題庫分類。
- 可只練習錯題。
- 可匯入自訂 JSON 題庫。
- 可匯出錯題本 JSON / CSV。
- 可匯出本輪答題紀錄 JSON / CSV。
- 可匯出與匯入全部本機資料備份。
- 支援手機與電腦版響應式畫面。

## 檔案結構

```text
moxin-quiz-site/
├── index.html
├── style.css
├── script.js
├── question-banks.json
├── questions/
│   ├── sample.json
│   ├── erp.json
│   └── english.json
└── README.md
```

## 如何使用

1. 開啟 `index.html`。
2. 選擇題庫。
3. 可使用題型、難度、標籤篩選。
4. 按「開始練習」。
5. 每題作答後按「提交答案」。
6. 看完解析後按「下一題」。
7. 所有題目都答對後完成一輪。

## 如何新增預設題庫

第一步，在 `questions/` 資料夾新增一個 JSON 檔案，例如：

```text
questions/quality.json
```

第二步，在 `question-banks.json` 加入題庫清單資料：

```json
{
  "id": "quality",
  "title": "品質管理",
  "description": "品質管理與統計製程管制練習題",
  "file": "questions/quality.json",
  "category": "管理類",
  "enabled": true
}
```

第三步，確認 `questions/quality.json` 符合題庫格式。

## 題庫 JSON 格式

每個題庫 JSON 檔案必須使用以下基本格式：

```json
{
  "bankId": "erp",
  "title": "ERP 企業資源規劃",
  "description": "ERP 基礎觀念與證照考試練習題",
  "version": "1.0",
  "questions": [
    {
      "id": "ERP001",
      "type": "single_choice",
      "question": "ERP 的主要目的為何？",
      "options": {
        "A": "只管理人事資料",
        "B": "整合企業內部資源與流程",
        "C": "只用來製作財務報表",
        "D": "只管理倉庫庫存"
      },
      "answer": "B",
      "explanation": "ERP 主要目的在於整合企業內部資源、資訊與流程，提高管理效率。",
      "tags": ["ERP", "基本觀念"],
      "difficulty": "easy"
    }
  ]
}
```

必要欄位：

- `bankId`：題庫 ID，建議使用英文、數字、底線或短橫線。
- `title`：題庫名稱。
- `description`：題庫描述。
- `questions`：題目陣列。
- 每題至少需要 `id`、`type`、`question`、`answer`。

建議欄位：

- `explanation`：詳解。
- `tags`：標籤陣列。
- `difficulty`：難度，可使用 `easy`、`medium`、`hard`。

## 單選題寫法

```json
{
  "id": "Q001",
  "type": "single_choice",
  "question": "下列何者為正確答案？",
  "options": {
    "A": "選項 A",
    "B": "選項 B",
    "C": "選項 C",
    "D": "選項 D"
  },
  "answer": "B",
  "explanation": "正確答案為 B。",
  "tags": ["範例"],
  "difficulty": "easy"
}
```

單選題的 `answer` 必須是字串，例如 `"B"`。

## 複選題寫法

```json
{
  "id": "Q002",
  "type": "multiple_choice",
  "question": "下列哪些是正確答案？",
  "options": {
    "A": "選項 A",
    "B": "選項 B",
    "C": "選項 C",
    "D": "選項 D"
  },
  "answer": ["A", "C"],
  "explanation": "A 與 C 正確。",
  "tags": ["範例"],
  "difficulty": "medium"
}
```

複選題必須完全選對才算答對。少選、多選、選錯都算錯。

## 是非題寫法

```json
{
  "id": "Q003",
  "type": "true_false",
  "question": "ERP 可以整合企業內部流程。",
  "answer": true,
  "explanation": "ERP 的核心價值之一就是流程與資訊整合。",
  "tags": ["ERP"],
  "difficulty": "easy"
}
```

是非題的 `answer` 必須是布林值：

```json
true
```

或：

```json
false
```

## 填空題寫法

```json
{
  "id": "Q004",
  "type": "fill_blank",
  "question": "ERP 的英文全名是 ______。",
  "answer": [
    "Enterprise Resource Planning",
    "enterprise resource planning"
  ],
  "caseSensitive": false,
  "explanation": "ERP 是 Enterprise Resource Planning。",
  "tags": ["ERP"],
  "difficulty": "easy"
}
```

填空題的 `answer` 可以是字串或字串陣列。

`caseSensitive` 設為 `false` 時，不區分大小寫。

## 如何匯入自訂題庫

1. 開啟網站首頁。
2. 按「匯入題庫」。
3. 選擇符合格式的 JSON 題庫檔案。
4. 系統會檢查格式。
5. 格式正確後會加入可練習題庫。
6. 匯入題庫會儲存在 localStorage，重新整理網頁後仍可使用。

如果 `bankId` 與既有題庫重複，系統會詢問是否覆蓋為匯入題庫。

## 如何匯出錯題紀錄

1. 進入「錯題本」。
2. 按「匯出錯題 JSON」或「匯出錯題 CSV」。
3. 下載檔案後可自行保存或用 Excel 開啟 CSV。

## 如何匯出本輪答題紀錄

完成一輪後，在完成頁按：

- 「匯出本輪 JSON」
- 「匯出本輪 CSV」

CSV 欄位包含：

- 題庫名稱
- 題庫 ID
- 題目 ID
- 題型
- 題目內容
- 使用者答案
- 正確答案
- 是否答對
- 答題時間
- 錯誤次數
- 詳解

## 如何備份與還原本機資料

在「資料管理」頁面可以：

- 匯出所有本機資料。
- 匯入本機資料備份。
- 清除所有本機資料。

備份內容包含：

- 目前選擇題庫。
- 本輪答題進度。
- 錯題本。
- 匯入的自訂題庫。
- 答題統計紀錄。
- 本輪答題紀錄。
- 使用者介面偏好。

## localStorage 限制說明

本網站使用 localStorage 保存資料，因此有以下限制：

1. 資料只存在同一台裝置與同一個瀏覽器。
2. 換手機、換電腦或換瀏覽器不會自動同步。
3. 清除瀏覽器資料可能會刪除刷題紀錄與錯題本。
4. 無痕模式或隱私模式可能不會長期保存資料。
5. 如需搬移資料，請使用「匯出所有本機資料」與「匯入本機資料備份」。

## 如何部署到 GitHub Pages

1. 建立 GitHub repository。
2. 將本專案所有檔案上傳到 repository。
3. 到 repository 的 `Settings`。
4. 進入 `Pages`。
5. `Source` 選擇 `Deploy from a branch`。
6. `Branch` 選擇 `main`。
7. `Folder` 選擇 `/root`。
8. 儲存設定。
9. 等待 GitHub Pages 產生網站網址。
10. 開啟網站網址即可使用。

檔案路徑已使用相對路徑，適合 GitHub Pages 子路徑部署。

## 如何在本機測試

因為網站會用 `fetch()` 讀取 JSON 檔案，直接用滑鼠雙擊 `index.html` 時，部分瀏覽器可能因安全限制無法讀取本機 JSON。

建議使用任一簡易靜態伺服器測試。

例如使用 Python：

```bash
python -m http.server 8000
```

然後開啟：

```text
http://localhost:8000
```

如果已部署到 GitHub Pages，則不需要本機伺服器。

## 常見錯誤排除

### 1. 題庫清單沒有出現

請檢查：

- `question-banks.json` 是否放在根目錄。
- JSON 格式是否正確。
- `enabled` 是否為 `true`。
- 是否使用伺服器方式開啟，而不是直接雙擊 `index.html`。

### 2. 題庫檔案讀取失敗

請檢查：

- `file` 路徑是否正確，例如 `questions/erp.json`。
- 題庫檔案是否真的存在。
- GitHub 檔名大小寫是否一致。

### 3. 匯入題庫失敗

請檢查：

- 是否缺少 `bankId`。
- 是否缺少 `title`。
- 是否缺少 `questions`。
- `questions` 是否為陣列。
- 題目是否缺少 `id`、`type`、`question`、`answer`。
- 題型是否為支援的四種：`single_choice`、`multiple_choice`、`true_false`、`fill_blank`。
- 單選題與複選題是否有 `options`。
- 複選題 `answer` 是否為陣列。
- 是非題 `answer` 是否為 `true` 或 `false`。
- 填空題 `answer` 是否為字串或字串陣列。

### 4. localStorage 資料異常

如果瀏覽器儲存資料損壞，系統會自動重置對應資料並提示。也可以到「資料管理」清除所有本機資料後重新開始。

## 開發限制

本專案刻意不使用：

- 後端
- 資料庫
- Node.js
- React
- Vue
- Angular
- Firebase
- Supabase
- 登入系統

因此可以直接部署為 GitHub Pages 靜態網站。

# v3.3：題庫工具、ZIP 匯出與 Legacy 封存

## 本版目標

1. 將舊版 v2 完整移入 `legacy-v2/`，正式根目錄不再混用舊架構檔案。
2. 新增已安裝題庫的正式 ZIP 匯出。
3. 把 AI 題庫製作提示詞補回新版，並全面改為 Schema 2.0 / Package 規格。
4. 重寫 README，使文件與現在的 IndexedDB / PWA / 作者題庫架構一致。

## Legacy 封存

根目錄下列舊檔移入 `legacy-v2/`：

- `script.js`
- `style.css`
- `question-banks.json`
- `questions/`
- `assets/images/`
- Legacy 題庫 index builder
- 舊 README

`legacy-v2.html` 保留為相容轉址。

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

# MoXin Quiz v3 — P0 implementation notes

這一批檔案只建立新版基礎架構，不會修改舊版 `index.html`、`style.css` 或 `script.js`，因此上傳後目前網站仍維持原本行為。

## 已建立

- `src/app/config.js`
- `src/data/schema/question-bank.js`
- `src/data/migration/legacy-v1-to-v2.js`
- `src/storage/db.js`
- `src/storage/settings.js`
- `src/question-bank/validator.js`
- `src/quiz/scoring.js`
- `src/quiz/shuffle.js`
- `src/utils/ids.js`

## P0 架構決策

- GitHub Pages 直接部署，不需要 npm build。
- 新版使用 ES Modules。
- IndexedDB 儲存題庫、圖片、作答紀錄、Session 與學習資料。
- localStorage 只保留小型 UI 設定。
- 舊版題庫透過 Migration 轉為 Schema v2。
- 題庫與使用者學習資料分離。

## 下一批

1. IndexedDB repository layer。
2. 題庫 Schema v2 package importer。
3. ZIP 安全解壓與 asset 驗證。
4. 將現有 sample 題庫轉成 v2 範例。
5. 建立新版 App Shell 並開始接線。

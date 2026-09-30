# 這一批請用 github.dev 上傳

上一批透過 GitHub 一般 Upload files 後，資料夾層級被攤平，所以本批請改用 GitHub 的網頁版 VS Code。

1. 在 GitHub Repository 切換到 `next-v3`。
2. 按鍵盤 `.`（句點）開啟 github.dev。
3. 確認左下角 Branch 是 `next-v3`。
4. 先刪除上一批誤放在 Repository 根目錄的：
   - `config.js`
   - `db.js`
   - `ids.js`
   - `legacy-v1-to-v2.js`
   - `question-bank.js`
   - `scoring.js`
   - `settings.js`
   - `shuffle.js`
   - `validator.js`
   - `V3_IMPLEMENTATION.md`
5. 在本機解壓本 ZIP。
6. 將解壓後的 `src/`、`docs/`、`examples/`、`tests/` 資料夾與 `package.json` 拖到 github.dev 左側 Explorer 的 Repository 根目錄。
7. Source Control 檢查變更後 Commit：
   `feat(v3): add P0 P1 storage and package foundation`
8. Push / Sync Changes。

請不要刪除舊版 `index.html`、`style.css`、`script.js`、`questions/`、`assets/`。

# v3.2 ERP 原生 Schema v2 遷移準備

此批只加入遷移能力，不會直接刪除任何 Legacy 資料。

## 執行方式

1. 將本批上傳到 `v3.2-erp-native` branch。
2. 打開 GitHub → Actions。
3. 選擇 `Generate ERP Schema v2`。
4. 點 `Run workflow`，Branch 選 `v3.2-erp-native`。
5. Workflow 會：
   - 讀取現有 ERP Legacy JSON
   - 使用專案既有 migration 轉成 Schema v2
   - 驗證 443 題
   - 產生 `manifest.json` / `questions.json`
   - 將作者 catalog 切換到 `v2-package`
   - 將網站版本升為 v3.2
   - 執行完整 `npm run ci`
   - 全部通過後自動 commit 回該 branch

## 不會處理

- 不刪 `questions/ERP_Planner_202509_V06_improved_explanations.json`
- 不修改機車題庫
- 不刪 `legacy-v2.html`
- 不修改 `main`

ERP Legacy 檔暫時保留，是為了讓舊版網站仍能回退使用。

# Release Cutover：v3 升格正式入口

## 切換結果

完成本批後：

- `index.html`：新版正式入口
- `v3.html`：保留新版相容入口
- `legacy-v2.html`：舊版回退入口
- `script.js` / `style.css` / 舊 `questions/`：暫時保留，供 legacy-v2 使用

## 上傳前必要步驟

本更新包**不包含 `legacy-v2.html`**，因為它必須由目前 repository 中尚未被覆蓋的舊 `index.html` 直接重新命名而來。

在 github.dev 的 `next-v3`：

1. 將目前舊 `index.html` Rename 為 `legacy-v2.html`
2. 確認 `legacy-v2.html` 仍存在
3. 再上傳本批更新包
4. 新 `index.html` 會由已通過 RC 驗收的 `v3.html` 內容建立

若沒有先 Rename，CI 會故意失敗，避免舊版回退入口遺失。

## PWA

- Manifest `start_url` 改為 `./`
- Service Worker App Shell 同時快取：
  - `index.html`
  - `v3.html`
- Navigation 離線 fallback 改為優先 `index.html`
- Cache version：`moxin-quiz-v3-release-1`

舊的已安裝 PWA 若仍以 `/v3.html` 啟動也不會失效，因為 `v3.html` 保留。

## 正式切換後驗收

Pages 綠燈後：

1. 直接開 repository 根網址，應進新版
2. `/v3.html` 應仍進同一新版
3. `/legacy-v2.html` 應可開舊版
4. Ctrl+Shift+R 後再測一次根網址
5. Offline reload 根網址
6. 題庫與學習資料仍應存在（同 origin / IndexedDB，不因入口檔名改變）

完成後才進行 `next-v3 → main` 合併。

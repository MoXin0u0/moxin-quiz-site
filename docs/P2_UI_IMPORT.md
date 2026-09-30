# P2：題庫庫與匯入 UI

本階段新增獨立 `v3.html`，不取代既有 `index.html`，因此舊站仍可正常運作。

## 已接上

- IndexedDB 初始化狀態
- 已匯入題庫列表
- ZIP / JSON 題庫檢查
- 完整資料夾題庫檢查
- Validator 報告摘要與問題清單
- 驗證通過後寫入 IndexedDB
- 同 ID 題庫更新確認
- 刪除本機題庫
- 手機 / 平板 / 桌面 RWD App Shell

## 尚未接上

- 練習頁
- 題庫詳情與搜尋篩選
- 錯題 / 收藏 / 不熟題 UI
- 學習統計
- PWA / Service Worker

## 測試方式

此頁使用 ES Modules 與 IndexedDB，因此必須透過 HTTP(S) 開啟，不應直接雙擊 `v3.html` 使用 `file://`。
正式環境仍以 GitHub Pages 為目標。

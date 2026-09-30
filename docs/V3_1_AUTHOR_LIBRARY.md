# v3.1：作者題庫 / 自行新增題庫

## 目標

題庫頁依「來源」拆成兩類：

- 作者題庫：由網站維護者提供，可加入、更新、移除本機版本。
- 自行新增：使用者自行匯入 ZIP / JSON / Folder，只存在自己的 IndexedDB。

`category` 仍保留作為內容分類，不與來源分類混用。

## 資料規則

IndexedDB `banks` record 新增：

- `sourceType`: `author` 或 `user`
- `sourceMetadata`: 題庫來源補充資料

舊版已存在但沒有 `sourceType` 的題庫，一律視為 `user`，避免把使用者資料誤判成作者題庫。

使用者自行匯入時，即使 manifest 自稱為作者題庫，也會由 Importer 強制寫成 `sourceType: user`。

## 作者題庫清單

`author-banks.json` 是很小的 catalog，只列出作者題庫資訊與來源。

第一個作者題庫：

- ERP 規劃師題庫 2025.09 V06
- 443 題
- catalog 版本：1.1.0
- 作者顯示：墨忻

本階段為降低資料重複，ERP catalog 暫時指向 repository 既有 Legacy JSON。
使用者按「加入我的題庫」時：

1. 下載既有 Legacy JSON
2. 由既有 `legacy-v1-to-v2.js` 轉成 Schema v2
3. 執行 Schema v2 validator
4. 通過後才寫入 IndexedDB，並標記 `sourceType: author`

因此本機保存的仍是 Schema v2。

## 更新規則

作者 catalog 的版本高於本機作者題庫版本時，UI 顯示「有新版」。

更新作者題庫時：

- 題目內容重新寫入
- 學習紀錄保留
- `bankId + questionId` 穩定識別仍維持

## 機車題庫

本功能不將既有機車題庫列入作者 catalog，也不進行遷移。

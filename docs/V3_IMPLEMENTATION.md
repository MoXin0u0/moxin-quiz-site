# MoXin Quiz v3 — P0/P1 implementation notes

這一批建立新版底層架構，不會修改舊版 `index.html`、`style.css`、`script.js`，因此目前 GitHub Pages 仍維持舊版網站。

## P0 已完成

- ES Modules 基礎結構
- Schema v2 定義
- Legacy v1 → Schema v2 Migration
- IndexedDB schema
- localStorage 小型設定層
- 獨立 scoring / shuffle 模組
- Schema Validator

## P1 已加入

- IndexedDB Repository Layer
  - 題庫 / 題目 / Assets
  - 作答紀錄
  - 收藏與筆記
  - Session
- ZIP 題庫安全讀取基礎
  - Path traversal 防護
  - ZIP 大小 / 單檔 / 檔案數 / 壓縮比限制
  - CRC32 驗證
  - Reject encrypted / Zip64 / unsupported compression
- JSON / Folder / ZIP package reader
- 匯入前統一 Validator
- Schema v2 範例題庫 `examples/sample-v2/`
- 零相依 Node unit tests

## 尚未接線

這一批仍沒有把新版 importer 接到正式 UI，也不會取代舊版 localStorage。下一階段會建立 v3 App Shell / 題庫管理頁，先把題庫匯入與 IndexedDB 真正接到介面，再開始搬移練習流程。

## ZIP 相容性

目前 ZIP reader 支援一般 Stored / Deflate ZIP，使用瀏覽器 `DecompressionStream('deflate-raw')`。Zip64、加密 ZIP 與特殊壓縮法會明確拒絕，不會嘗試不安全解析。

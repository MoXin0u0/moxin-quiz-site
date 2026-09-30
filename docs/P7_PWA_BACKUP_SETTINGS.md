# P7：PWA、離線、設定與完整備份

## PWA

新增：

- `manifest.webmanifest`
- `service-worker.js`
- 192 / 512 / maskable App icon
- 設定頁中的安裝狀態
- `beforeinstallprompt` 安裝流程
- Service Worker 更新檢查

Service Worker 會預先快取 v3 App Shell：

- v3.html
- v3 CSS
- v3 JavaScript modules
- PWA manifest / icons

題庫內容與題庫圖片原本就儲存在 IndexedDB，因此 App Shell 已快取後，可在離線狀態讀取本機題庫與進行練習。

## 設定

主導覽「設定」正式啟用：

- 主題
  - 跟隨系統
  - 淺色
  - 深色
- 字體大小
  - 標準
  - 較大
  - 特大
- 選項間距
  - 緊湊
  - 標準
  - 寬鬆
- 減少動畫

設定仍只放在 localStorage；大型資料不放 localStorage。

## 完整備份 / 還原

備份格式：

`moxin-quiz-backup` version 1

包含 IndexedDB：

- banks
- questions
- assets（Blob 會轉成 Base64）
- attempts
- progress
- favorites
- notes
- mastery
- reviewSchedule
- sessions

以及：

- `moxin.v3.settings`

還原採完整取代模式，會在單一 IndexedDB transaction 中清空並寫回目前 v3 stores。

備份 JSON 因圖片 Base64 會比原始 Blob 大，屬正常現象。

目前匯入備份檔上限為 400 MB，避免瀏覽器一次解析過大的 JSON 導致記憶體壓力。

## Preflight

設定頁新增正式入口前檢查：

- Secure Context / HTTPS
- IndexedDB 支援
- v3 DB 能否開啟
- Service Worker 支援
- Browser storage estimate
- Persistent Storage 狀態

「未取得 persistent storage」屬警告而不是阻塞錯誤。

## 尚未切換正式入口

P7 仍維持：

- `index.html` = 舊版
- `v3.html` = 新版

下一階段應先做跨裝置 / 瀏覽器回歸測試與 GitHub Pages 實際測試，再決定是否讓 v3 升格為 `index.html`。

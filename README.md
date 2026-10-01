# 墨忻刷題網

墨忻刷題網 v3.3 是一個部署於 GitHub Pages 的 **Local-first 個人刷題平台**。網站不需要後端、登入系統或付費伺服器；題庫與學習紀錄主要保存在瀏覽器 IndexedDB，並支援 PWA 離線使用。

## 目前功能

- 作者題庫與使用者自行新增題庫分流
- ZIP / JSON / 資料夾匯入，匯入前 Schema 驗證
- 題庫 ZIP 匯出，連同題庫內 assets 圖片一起打包
- 單選、複選、是非、填空四種題型
- 題庫內搜尋、題型／難度／章節篩選
- 錯題、收藏、不熟題、筆記
- 未完成練習與模擬考恢復
- 今日複習與間隔複習排程
- 學習統計與熟練度
- 限時模擬考、題號導覽、交卷分析
- 完整本機資料備份與還原
- 深色模式、字體大小、選項間距、減少動畫
- PWA App Shell 與離線刷題
- 題庫工具：Schema v2 AI 提示詞、正式題庫結構說明
- 手機、平板、桌面 RWD

## 題庫來源

### 作者題庫

作者題庫由網站維護者透過 `author-banks.json` 發布。使用者按下「加入我的題庫」後才會下載並寫入 IndexedDB。

目前作者題庫：

- ERP 規劃師題庫 2025.09 V06
- Schema 2.0
- 443 題
- 題庫版本 1.2.0

作者題庫有新版時，網站會顯示更新提示；使用者自行決定是否更新。

### 自行新增

使用者可以匯入：

- 正式 ZIP 題庫包
- 單一 JSON
- 完整題庫資料夾

自行新增的題庫只存在目前瀏覽器，不會自動上傳 GitHub。

## 正式題庫 Package

建議交換格式：

```text
bank/
├── manifest.json
├── questions.json
└── assets/
    └── images/
```

Schema 版本目前為 `2.0`。

支援題型：

- `single-choice`
- `multiple-choice`
- `true-false`
- `fill-in`

題庫匯入前會檢查永久題目 ID、題型、答案、選項、圖片路徑與其他結構問題。

## 題庫分享

進入已加入的題庫後可使用「匯出題庫 ZIP」。

匯出的 ZIP 包含：

- `manifest.json`
- `questions.json`
- 題庫內 `assets/`

不包含：

- 錯題狀態
- 收藏
- 不熟題
- 筆記
- 熟練度
- 作答歷史
- 模擬考紀錄

因此題庫內容與個人學習資料維持分離。

## AI 題庫製作流程

網站不串接 AI API，也不儲存 API Key。

到「題庫工具」可複製 Schema v2 專用提示詞，再到外部 AI 工具處理自己的來源資料。AI 產出的題目與答案仍應人工核對，完成後再回網站匯入驗證。

## 本機資料

主要資料儲存在 IndexedDB：

- banks
- questions
- assets
- attempts
- progress
- favorites
- notes
- mastery / review schedules
- sessions

少量 UI 偏好使用 localStorage。

如果清除網站資料、更換瀏覽器或更換裝置，本機資料不會自動同步。請定期到「設定」下載完整備份。

## PWA / Offline

Service Worker 快取 App Shell。已加入 IndexedDB 的題庫在離線狀態仍可練習、收藏、寫筆記與記錄進度。

作者題庫本體不會全部預先塞入 App Shell；只有使用者實際加入後才保存到 IndexedDB。

## Legacy v2

舊版網站已封存到：

```text
legacy-v2/
```

舊網址 `legacy-v2.html` 只保留相容轉址。

舊版包含當時的 Legacy JSON 題庫與機車題庫歷史資料。機車題庫未確認是否為最新版本，因此沒有升級成 v3 作者題庫，也不應視為目前推薦題庫。

## 開發與測試

本專案維持零前端框架與零執行期第三方 CDN 依賴。

執行完整測試：

```bash
npm run ci
```

其中包含單元測試與 release preflight。

主要開發結構：

```text
/
├── index.html
├── v3.html
├── manifest.webmanifest
├── service-worker.js
├── author-banks.json
├── author-banks/
├── src/
├── styles/
├── tests/
├── docs/
├── examples/
└── legacy-v2/
```

## 部署

GitHub Pages：

```text
Branch: main
Folder: / (root)
```

正式入口為 repository Pages 根網址；`v3.html` 保留相容入口。

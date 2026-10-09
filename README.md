# 墨忻刷題網

> **正式版本與後續工作**：本頁描述現行 V5.0.0 正式功能；V5 上線後的工程、UI／UX、「墨境」工作品牌與使用者協議規劃，請參閱 [後續改善工作索引](docs/roadmap/README.md) 與 [正式版固定基準](docs/roadmap/V5_PRODUCTION_BASELINE.md)。\
> 「墨境」目前僅是內部工作名稱，網站對外名稱、網址及 Google 同步設定尚未更動。

墨忻刷題網 **v5.0.0 正式版** 是部署於 GitHub Pages 的 **Local-first / Offline-ready 個人學習與刷題平台**。核心功能不要求登入：題庫、學習紀錄、目標與工作室草稿先寫入本機 IndexedDB，PWA 離線時仍可使用。V5 另外加入 **可選用的 Google Drive appDataFolder 跨裝置同步**；完整備份仍是獨立的資料安全機制，不會被同步取代。

> V5.0.0 正式版啟用 **Production Cloud Sync**：`features.cloudSync=true`，並使用已配置的 Google Web OAuth Client ID。Google 授權仍必須由使用者明確觸發；Local-only 啟動不會自動登入，也不會因雲端不可用而阻擋本機學習。

## V5 定位與入口

v4.1 將網站拆成兩層：

```text
index.html  → 公開首頁
app.html    → 學習大廳
v3.html     → 舊網址相容入口（與 app.html 相同）
```

公開首頁提供功能介紹、開始使用、使用流程、更新日誌與資料說明；不初始化 IndexedDB。
PWA 的 `start_url` 為 `./app.html`，因此安裝後仍直接進入學習大廳。

### V5 可選用雲端同步

V5 採 **Local-first + Optional Cloud Sync**：

- 不登入仍可完整練習、複習、模擬考、統計與使用題庫工作室。
- 本機 mutation 先成功寫入 IndexedDB，再由同步流程處理雲端。
- Google Drive 僅使用 `drive.appdata` / `appDataFolder`，不把題庫資料散落到一般 Drive。
- 作者題庫內容不重複上傳；同步的是 membership/reference 與個人學習資料。
- 首次同步與切換帳號會先做 Inventory / Reconciliation，確認前不把本機資料寫進目標帳號。
- 衝突敏感資料不會 silent overwrite；Note 可選本機、雲端或文字合併。
- 完整備份與同步彼此獨立；備份檔不包含 OAuth token、裝置雲端操作狀態。

## v4.0 主要功能

### 題庫與練習

- 作者題庫與使用者自行新增題庫分流
- ZIP / JSON / 題庫資料夾匯入，匯入前 Schema 2.0 驗證
- 題庫 ZIP 匯出，連同題庫內 assets 圖片一起打包
- 單選、複選、是非、填空四種題型
- 題庫內搜尋、題型／難度／章節篩選
- 錯題、收藏、不熟題、筆記
- 未完成練習與模擬考恢復
- 間隔複習與今日到期題
- 限時模擬考、題號導覽、交卷分析

### 題庫工作室

- 建立新題庫
- 編輯自行新增題庫
- 作者題庫另存副本後編輯
- 題目新增、刪除、複製、排序
- 永久題目 ID
- 章節、標籤、難度
- 題目圖片與詳解圖片
- 批次貼題與人工確認
- 外部 Package → Studio Draft
- Schema 2.0 即時驗證
- 草稿保存
- JSON / ZIP 匯出

### 今日學習

「今日學習」使用第二層 Learning Hub：

```text
總覽
複習
學習目標
考前衝刺
```

支援：

- 每日刷題目標
- 每日複習目標
- 全域或指定題庫目標
- 今日目標達成率
- 最近 7 日達成狀況
- 連續學習天數
- 指定多個考試題庫的考前衝刺
- 錯題 → 不熟 → 到期 → 低熟練 → 未作答的衝刺優先序

### 學習統計

「學習統計」拆成：

```text
總覽
趨勢
弱點分析
題庫分析
```

包含：

- 7 / 30 日作答趨勢
- 7 / 30 日正確率
- 題型正確率
- 章節正確率
- 弱點章節
- Global / 單題庫分析
- 題庫熟練度

### 首頁

首頁提供：

- 今日目標
- 全站連續學習
- 繼續上次練習
- 今日複習
- 快速錯題
- 考前衝刺
- 完整備份提醒

### 顯示與離線

- PWA App Shell
- 離線刷題與本機紀錄
- Light / Dark
- Academy / Epic / Focus
- Full / Reduced / Off 場景效果
- 手機、平板、桌面 RWD
- 減少動畫、字體大小、選項間距

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

不包含個人的：

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

可在「題庫工作室」使用 Schema 2.0 題庫結構與提示詞，將外部 AI 整理的結果帶回網站驗證、批次建題與人工修正。AI 產出的題目與答案仍應人工核對。

## 本機資料

主要資料儲存在 IndexedDB，包括：

- banks
- questions
- assets
- attempts
- progress
- favorites
- notes
- mastery
- reviewSchedule
- sessions
- studioDrafts
- learningGoals

少量 UI / release metadata 使用 localStorage。

如果沒有啟用可選用的雲端同步，清除網站資料、更換瀏覽器或更換裝置時，本機資料不會自動搬移。無論是否使用同步，都建議定期到「設定」下載完整備份。

### 內部相容性名稱

v4.0 **刻意保留**下列歷史 namespace：

```text
IndexedDB: moxin-quiz-v3
Settings:  moxin.v3.settings
```

這不是網站仍停留在 v3，而是為了讓既有 v3.3 使用者直接升級後仍讀得到原本資料與設定。

同樣地，`v3.html` 目前保留為既有網址的相容入口，內容與 `index.html` 相同。

## 完整備份

完整備份涵蓋題庫、assets、學習紀錄、Session、工作室草稿與學習目標。V5 仍把 Backup 與 Sync 視為兩個不同的安全層；還原備份會建立新的裝置身分，不會還原 OAuth token 或舊裝置的雲端操作狀態。

v4.0 發布前已以真實 Chromium 做過：

```text
下載完整備份
→ 全新 Browser Context
→ 從備份還原
→ 確認題庫與資料重新出現
```

## PWA / Offline

Service Worker 快取 App Shell。已加入 IndexedDB 的題庫在離線狀態仍可練習並保存本機進度。

v4.0 發布前已驗證：

```text
Online
→ Service Worker ready
→ Offline
→ Reload
→ 網站與本機題庫仍可開啟
```

作者題庫本體不會全部預先塞入 App Shell；只有使用者實際加入後才保存到 IndexedDB。

## Legacy v2

舊版網站封存於：

```text
legacy-v2/
```

舊網址 `legacy-v2.html` 只保留相容轉址。

舊版包含當時的 Legacy JSON 題庫與機車題庫歷史資料。機車題庫未確認是否為最新版本，因此沒有升級成目前作者題庫，也不應視為推薦題庫。

## 開發與測試

本專案維持零前端框架與零執行期第三方 CDN 依賴。

完整 repository regression：

```bash
npm run ci
```

RC1 真實瀏覽器測試：

```bash
npm run audit:browser
```

Browser Audit 覆蓋：

- 新使用者與 Empty State
- 回訪使用者
- 真實作答與 Feedback
- 模擬考
- 7 種 Viewport
- Light / Dark
- Academy / Epic / Focus
- 大量題庫
- 長文字
- Accessibility
- Backup Round Trip
- v3.3 → v4.0 IndexedDB migration
- Offline PWA

主要結構：

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

GitHub Pages 正式設定：

```text
Branch: main
Folder: / (root)
```

入口結構：

```text
/          → 公開首頁
/app.html  → 學習大廳
/v3.html   → 舊網址相容入口
```

PWA 安裝後使用 `./app.html` 作為 start_url。

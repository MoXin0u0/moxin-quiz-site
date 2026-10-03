# 墨忻刷題網 v4.0 — RC1 Browser UX Audit

## 目的

RC1 不再只依賴 unit / structural regression。

此階段會用真正的 Chromium + Playwright，以使用者操作方式啟動本機網站、點擊導覽、切換分頁、作答、開始模擬考、備份、還原與離線重載。

每次 workflow 都由 GitHub Actions checkout 真正的 `v4.0-learning-studio`，再啟動本機 HTTP server，因此測試的是完整 repository，而不是 mock UI。

## 使用者情境

### 1. 新使用者

模擬完全沒有本機資料：

```text
我的題庫
→ 今日學習
→ 模擬考
→ 學習統計
→ 題庫工作室
→ 設定
```

檢查 Empty State、導覽、Console / Page Error、水平溢位與 Accessibility。

### 2. 回訪學習者

建立代表性本機資料：

- 3 個題庫
- 四種題型
- attempts
- wrong / due / favorite / unfamiliar
- Global learning goal
- Exam sprint
- unfinished Practice Session
- 舊的 backup timestamp

實際操作：

```text
首頁
→ 繼續上次練習
→ 作答
→ Feedback
→ 今日學習四個 Tab
→ 學習統計四個 Tab
→ 7 / 30 日
→ Global / Bank scope
→ 模擬考
```

### 3. 畫面尺寸矩陣

固定測：

- 320 × 568
- 390 × 844
- 844 × 390
- 768 × 1024
- 1024 × 768
- 1366 × 768
- 1920 × 1080

每種尺寸至少檢查：

- 我的題庫
- 今日學習
- 學習統計

Hard gate：

```text
document 不得產生水平 overflow
主要 UI block 不得跑出 viewport
```

手機另外記錄小於 32px 的可操作目標，列為 warning。

## 視覺設定矩陣

在 Mobile 與 Desktop 分別實際載入：

- Academy / Light / Full
- Academy / Dark / Reduced
- Epic / Light / Full
- Epic / Dark / Full
- Focus / Light / Off
- Focus / Dark / Off

每組都保存 full-page screenshot artifact。

## 大量資料

建立：

```text
36 題庫
360 題
```

實際測：

- 首頁
- Learning Hub
- 考前衝刺題庫搜尋
- Statistics

並記錄導覽時間。

超過 3 秒列 warning；超過 7 秒 hard fail。

## v3.3 → v4.0 Migration

Browser test 會先手動建立 IndexedDB version 2，寫入：

- banks
- questions
- attempts
- progress
- favorites
- notes
- mastery
- reviewSchedule
- unfinished session
- UI settings

之後才打開 v4.0。

必須自動升成 DB version 3，且：

- 舊資料仍存在
- `studioDrafts`
- `learningGoals`

新 store 成功加入。

## Backup Round Trip

實際按：

```text
下載完整備份
```

取得 JSON 檔。

再開一個全新 Browser Context：

```text
設定
→ 從備份還原
→ Confirm
→ Reload
```

還原後原題庫必須重新出現。

## Offline PWA

允許 Service Worker：

```text
Online load
→ SW ready
→ Reload
→ Browser offline
→ Reload
```

離線狀態仍必須開啟首頁並正常讀取 IndexedDB。

## Accessibility

使用 axe-core 實際掃描代表頁面。

Hard fail：

- Critical
- Serious button-name
- Serious label
- Serious ARIA contract
- Serious color-contrast

其他 serious / moderate 會留下 warning，等人工判斷是否需要阻擋正式版。

## Artifact

每次 workflow 都會上傳：

```text
rc1-browser-ux-audit
├─ report.md
├─ report.json
├─ rc1-full-backup.json
└─ screenshots/
```

即使 audit 失敗，也會保留 artifact 供後續分析。

## RC1 原則

Browser UX Audit 全綠不代表立刻合併 `main`。

它只是 RC1 的其中一個 gate；之後仍需：

1. 整理 audit warnings
2. 修復真正問題
3. Release metadata cleanup
4. Main cutover rehearsal

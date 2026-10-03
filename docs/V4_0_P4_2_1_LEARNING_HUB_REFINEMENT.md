# 墨忻刷題網 v4.0 — P4.2.1 Learning Hub Refinement

## 1. Hero / 總覽固定為全站摘要

P4.2 的最上層 Hero 曾直接沿用目前 P3 scope，因此切到單一題庫後，「今日刷題 / 連續學習」看起來像全站資料、實際卻只是該題庫。

P4.2.1 改為：

```text
Hero / 全站今日摘要
→ 固定 bankId = null

P3 學習目標卡
→ 繼續使用目前 P3 scope
```

總覽會明確同時顯示：

- 全站刷題
- 全站複習
- 全站模擬考
- 全站 streak
- 目前 P3 目標範圍

## 2. Hub Tab 不再重查 IndexedDB

第一次進入今日學習或資料真正改變時：

```text
IndexedDB → build model → state.learningHubModel
```

單純切：

```text
總覽 / 複習 / 學習目標 / 考前衝刺
```

只會：

```text
cached model → render
```

不再重新讀取每個題庫的 questions / progress / favorites / unfamiliar / due。

## 3. 大量題庫搜尋

當本機題庫超過 6 個時，P4 多題庫選擇會顯示搜尋欄，可依題庫名稱或 bank ID 過濾。

搜尋只改變畫面顯示，不影響已勾選狀態。

## 4. Mobile Hero 壓縮

手機版會：

- 降低 Hero padding
- 縮小標題
- 四項統計改 2 × 2
- 隱藏純裝飾 floating stat
- 更快看到第二層 Hub 導覽

通過後 P4 Core / P4.1 / P4.2 / P4.2.1 可一起封為 Stable。

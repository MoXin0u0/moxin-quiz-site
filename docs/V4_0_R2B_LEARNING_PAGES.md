# v4.0 R2B — 學習頁資訊架構重做

R2A 只建立了 scoped theme，實際畫面仍過度接近後台。R2B 改為直接重做 learner-facing DOM / component hierarchy。

## 已重做

### 我的題庫
- 新的學習 Hero，不再使用原本後台式標題卡。
- 加入「今日複習 / 模擬考 / 學習統計」學習捷徑。
- 右側使用純 UI study scene：讀 / 練 / 複三階段，不使用虛構統計數字。
- 題庫來源與題庫收藏改成 learning section hierarchy。
- 匯入工具仍保留較工具型的介面。

### 今日複習
- 使用真實的到期、錯題、不熟題、收藏數作為今日摘要。
- 以「今日重點」視覺呈現目前最需要處理的內容。
- 每個題庫的四種複習方式都有真實比例條與明確 CTA。
- 不新增不存在的 streak、學習時數或假資料。

### 模擬考
- 加入四步驟考試流程。
- 顯示真實可用題庫、可抽題數與未完成考試數。
- 每個題庫改成考卷設定卡：題數、時間與開始按鈕有清楚層級。
- 原本的 resume exam 功能與 data attributes 保留。

### 學習統計
- 整體正確率使用真實 accuracy 畫成環形圖。
- 總作答、已作答題、今日到期都來自現有統計資料。
- 每題庫新增真實 mastery distribution bar。
- 不捏造時間趨勢、連續天數或歷史圖表。

## Light / Dark

R2B 保留兩套獨立學習色彩：
- Light：柔白 / 淺藍 / 深色文字。
- Dark：深藍 / 靛青 / 紫藍與青綠點綴。

不是單純反相。

## 移除

R2A Hero 右上角的 `✦` 裝飾已完全移除。

## 不影響

- 題庫工作室
- 設定
- IndexedDB
- Schema 2.0
- 作答 / 複習 / 模擬考 / 統計計算邏輯
- P2A 圖片資產
- P2B Parser（此處 R2B 指 UI redesign milestone，不是 Parser P2B；Parser 工作後續重新命名避免衝突）

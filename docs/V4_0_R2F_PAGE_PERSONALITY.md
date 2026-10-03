# v4.0 R2F — Learning Page Personality & Scene Framework

## 目的

R2F 不新增題庫或學習邏輯，而是讓四個 learner-facing 主頁具有各自明確的視覺個性，同時保留同一套產品語言。

正式的史詩動畫風場景圖之後會接入 bounded scene slot，不再直接黏在 page background，避免重演 R2C 的錯位與響應式問題。

## 頁面個性

### 我的題庫
- 靛藍 / 青綠主調。
- 作為整個學習流程的起點。
- `learning-art-slot` 保留正式場景圖掛載位置。
- 新增 `--learning-library-art` custom property，未來只需替換 artwork，不需要重排 DOM。

### 今日複習
- 青綠 / 天藍主調。
- 以「記憶焦點」作為 Hero 右側視覺。
- 今日到期、錯題、不熟與收藏仍全部使用既有真實資料。

### 模擬考
- 紫色 / 暖金主調。
- 將流程視覺獨立成 `learning-exam-flow-steps`，避免手機版 caption 與橫向流程互相干擾。
- 未改動任何開始考試、續考或考試設定 hook。

### 學習統計
- 藍色 / 青綠主調。
- 加入「整體掌握」場景框架與分析感網格。
- 正確率與 mastery 仍使用現有真實數據。

## Scene Framework

新增：
- `.learning-scene-panel`
- `.learning-scene-panel-heading`
- `data-learning-scene="library|review|exam|stats"`

這些結構把「內容」與「情境視覺」分離。未來的場景圖可以是史詩動畫、奇幻圖書館、天空城、天文台、森林遺跡、未來資料殿堂等，不需要修改功能 DOM。

## 響應式

- Desktop：保留完整 atmosphere panel。
- Tablet：維持兩欄但降低裝飾主導性。
- Mobile：scene heading 保留，裝飾降級；模擬考步驟仍可橫向滑動。
- `<= 520px`：隱藏 scene caption 的次要說明。

## Motion

只有極輕微的 ambient breathe 動畫；以下情況自動停用：
- OS `prefers-reduced-motion: reduce`
- App `data-reduce-motion="true"`

## 不變更

- IndexedDB
- Schema 2.0
- 題庫 / 複習 / 模擬考 / 統計計算
- R2E 題庫詳情、刷題與正式考試行為
- 題庫工作室與設定頁

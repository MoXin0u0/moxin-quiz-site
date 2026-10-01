# v4.0 R2I — Learning Visual Style System

## 目標

把 R2H 的 learner-facing UI 從「固定設計」整理成可切換的 Style Pack 系統。

色彩模式與學習風格互相獨立：

- `data-theme`: `light` / `dark`
- `data-learning-style`: `academy` / `focus`
- `data-scene-intensity`: `full` / `reduced` / `off`

因此可自由組合，例如：

- Dark + 經典學院 + 完整場景
- Light + 經典學院 + 減弱場景
- Dark + 純粹專注 + 關閉場景

## 第一批可用 Style Pack

### 經典學院 `academy`

R2H 目前的正式預設風格。保留 whole-page artwork、學院式深度、完整陰影與品牌色。

### 純粹專注 `focus`

使用相同的資訊架構與功能，但：

- 移除大型 Hero artwork
- 移除大部分 decorative layer
- 降低陰影與圓角
- 減少 glow / backdrop blur
- 讓內容、題目、圖表成為主角

## 後續 Style Pack

設定頁先顯示但不可選：

- 史詩幻想
- 自然晨光

原因是這兩套需要真正獨立的場景素材與 art direction，不使用同一批 R2G 圖片換色冒充不同風格。

## 場景效果

場景效果與 Style Pack 分開：

- `full`：完整
- `reduced`：降低 Hero artwork 與 decorative layer 的存在感
- `off`：關閉大型場景，但保留目前 Style Pack 的配色、卡片與元件語言

`focus` 本身會隱藏 Hero artwork，即使場景效果設定為完整也仍以專注模式為準。

## 持久化

`learningStyle` 與 `sceneIntensity` 存在既有 `moxin.v3.settings` localStorage。

不修改 IndexedDB，也不改題庫或學習紀錄。舊版設定資料會由 `normalizeSettings()` 自動補入預設值，因此向下相容。

## 防止 FOUC

`index.html` / `v3.html` head 中的既有早期設定 script 會在 CSS 載入前同步設定：

- `data-learning-style`
- `data-scene-intensity`

避免重新整理時先短暫顯示錯誤風格。

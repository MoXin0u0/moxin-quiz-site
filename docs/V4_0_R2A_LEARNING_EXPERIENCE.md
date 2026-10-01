# v4.0 R2A — Learning Experience Visual Layer

## 介面分區

R2A 將網站正式分成兩種視覺語氣。

### 學習區
- 我的題庫
- 今日複習
- 模擬考 / 正式考試流程
- 學習統計
- 題庫詳情
- 刷題畫面

這些畫面採更具沉浸感、動機感與學習氣氛的 Light / Dark 專屬視覺。

### 工具／後台區
- 題庫工作室
- 設定

保持目前較理性、工具型、後台式的視覺，不套用 Learning Layer。

## Light / Dark

Light 與 Dark 使用不同的 scoped `--learn-*` token，而不是簡單反相：

- Light：柔白、淺藍、冷灰、深色文字、日間學習感。
- Dark：深藍、靛青、紫藍與青綠點綴、夜間專注感。

## R2A 第一批

- 學習區加入獨立 canvas 背景與層次。
- 前四個主導覽項目採學習區 active style。
- 題庫工作室前加入視覺分隔，形成學習 / 工具兩組。
- 題庫卡、複習卡、模擬考設定與統計卡片改為 learning surfaces。
- 題庫詳情、刷題、正式考試延伸使用同一視覺語言。
- Light / Dark 有不同 motivational microcopy。
- 行動版仍使用既有底部導航。

## CSS 載入順序

`v4-learning.css` 明確在 `v4-design.css` 後載入，確保學習區 scoped 規則可以覆蓋既有通用元件樣式。

## 不變更

不修改 IndexedDB、題目 Schema、作答、複習、考試、統計、題庫工作室、P2A 圖片資產或 P2B Parser 邏輯。

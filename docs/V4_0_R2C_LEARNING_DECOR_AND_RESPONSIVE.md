# v4.0 R2C — 學習頁情境插畫與響應式修正

R2B 已完成 learner-facing pages 的資訊架構重做；R2C 進一步處理兩個問題：

1. 桌面版學習頁外圍仍有留白。
2. 行動版在較窄寬度下，部分情境視覺容易顯得擁擠。

## 本次調整

### 1) 情境插畫資產
新增四個 theme-aware decorative SVG：

- `assets/learning/light-sun-corner.svg`
- `assets/learning/light-books-side.svg`
- `assets/learning/dark-moon-lantern.svg`
- `assets/learning/dark-desk-side.svg`

用途：
- 淺色模式：陽光、窗景、書本、植物。
- 深色模式：月光、夜桌、提燈、書本。

這些插畫只做情境襯底，不承載功能，不與實際資料耦合。

### 2) 桌面版留白補強
學習頁根容器新增 theme-aware 背景插畫層，利用 `::after` 以多重背景圖片擺放在：

- 右上 / 右側
- 左下 / 左側

因此可以填補學習頁外圍的空白，但不會擠壓內容布局。

### 3) 卡片內部情境補強
以下元件新增輕量插畫襯底：

- `learning-hero-scene`
- `learning-review-focus`
- `learning-accuracy-card`

插畫透明度較低，避免影響可讀性。

### 4) 響應式修正
為避免手機與平板錯位，本次新增 breakpoint 行為：

- `<= 1100px`：縮小背景插畫尺寸與透明度。
- `<= 940px`：再進一步縮小，避免壓迫內容。
- `<= 760px`：只保留一張主要插畫，移到頁面下方角落。
- `<= 520px`：移除頁面外圍背景插畫，只保留卡片內淡化插畫。

另外也微調：

- `learning-hero-scene` 高度
- `learning-scene-note` 位置與字級
- `learning-book-stack` 與 `learning-scene-path` 在手機上的尺寸與間距
- `learning-action` 最小高度

## 不影響

- 題庫 / 複習 / 模擬考 / 統計資料邏輯
- IndexedDB 與 Schema
- 題庫工作室與設定頁的後台風格
- P2A 圖片資產管理

## Cache

Service Worker cache version 升級為：

`moxin-quiz-v3-4.0.0-r2c-1`

避免使用者持續看到舊版無插畫樣式。

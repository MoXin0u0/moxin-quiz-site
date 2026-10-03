# v4.0 R2G — Learning Scene Integration

## 目的

R2F 已建立四個學習頁的 scene slot；R2G 把真正的網站情境視覺接入這些 slot，而不是把大圖黏在 page background。

## 場景資產

新增 8 個輕量 WebP：

- library-light / library-dark
- review-light / review-dark
- exam-light / exam-dark
- stats-light / stats-dark

目前素材採電影感、動畫化處理的學習靜物場景。視覺資產和版面契約已分離，因此後續可直接替換成更偏史詩動畫、奇幻學院、星海圖書館等風格，不必再動 DOM。

## Light / Dark

- Light：日光、植物、書本、筆記與溫暖工作桌。
- Dark：提燈、月夜色溫、深色書本與夜間專注氛圍。

各頁使用獨立裁切與構圖，不是同一張圖單純換濾鏡。

## 響應式策略

### 桌面

- 我的題庫：場景圖完整顯示於 art slot。
- 今日複習 / 模擬考 / 學習統計：場景位於右側並使用 mask 漸隱，功能資料永遠在前景。

### 平板

降低場景不透明度與占比。

### 手機

- 我的題庫 art slot 依 R2D 規則隱藏。
- 其他 scene art 也隱藏，只保留資訊與操作。

因此情境圖不會造成手機破版。

## 效能

8 張正式 WebP 合計約 620 KB，單張皆小於 180 KB，並加入 Service Worker APP_SHELL，可離線顯示。

若瀏覽器支援 `prefers-reduced-data: reduce`，場景圖會停用。

## 不變更

- IndexedDB / Schema 2.0
- 題庫、複習、模擬考、統計邏輯
- 題庫工作室與設定
- 作答與 Session 行為

# v4.0 R2D — Learning Layout Polish

R2D 的目標不是新增插畫，而是先把學習區的版面骨架整理到可以穩定承載後續任何視覺風格。

## 桌面版

- 移除 learner-facing app shell 原本的 1500px 限制。
- 學習頁可使用 Sidebar 以外的完整可用寬度。
- 學習頁本身最高控制在 1800px，避免超寬螢幕把內容拉得過散。
- 題庫工作室與設定仍維持原本 1500px 的工具型寬度。
- 模擬考與學習統計在寬螢幕會更有效利用橫向空間。

## 情境視覺容器

R2C 的四張臨時 SVG 不再直接畫在整頁背景上。

首頁 Hero 右側改成 `.learning-art-slot`：

- 有固定的版面邊界。
- 使用 `--learning-art-image` 作為未來插畫入口。
- 未來可以放史詩動畫、奇幻圖書館、天空、星海、城市、自然、魔法學院等任何符合頁面氣氛的視覺，不限制題材。
- 插畫只能存在於 slot 內，因此換圖不需要重新改版面。

目前 slot 只使用非常淡的 CSS ambient layer；R2B 的「讀 / 練 / 複」彩色書條已移除。

## 手機版

### Bottom navigation

行動版 `.app-header` 取消 backdrop-filter / containing-block 風險，並強制 Main Nav 固定在 viewport 底部，避免先前導覽列跑到畫面上方。

### Hero

- 移除手機版外層的大框中框。
- Hero 標題與說明降低尺寸與行高。
- 三個學習捷徑改成一列三格 App-style quick actions。
- 手機直接隱藏 art slot，內容優先；正式插畫未來只在有足夠空間時出現。

### 今日複習 / 學習統計

- 今日重點環與正確率環在手機改成橫向 compact card。
- 減少不必要的垂直高度。

### 模擬考

- 四步驟流程在手機改成水平可滑動的步驟列。
- 題數 / 時間保留雙欄配置；極窄螢幕再降為單欄。

### Small screens

- `<= 520px`：縮小 Header、Navigation、Hero typography 與卡片間距。
- `<= 390px`：複習方式、模擬考設定、熟練度 Legend 轉為單欄，避免壓縮。

## 插畫策略

R2D 不限制未來主題。後續可依頁面、季節、題庫類型或使用情境使用不同場景，例如：

- 高空雲海、晨曦城市
- 古典圖書館、魔法學院
- 星海觀測台、深夜車站
- 雨夜書店、燭光書桌
- 森林遺跡、山頂天文台
- 未來感資料殿堂

重點是所有圖都必須遵守 art-slot 尺寸、safe crop 與 mobile fallback 規則。

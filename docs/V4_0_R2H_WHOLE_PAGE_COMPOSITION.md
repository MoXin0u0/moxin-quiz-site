# v4.0 R2H — Whole-page Learning Composition

## 背景

R2G 已完成四組 Light / Dark 場景資產，但呈現方式仍是把場景放進 Hero 右上方的小框。
這使場景被壓縮、被資料遮擋，而且沒有真正參與學習頁的資訊架構。

R2H 淘汰這個 runtime layout，改成整個 Hero 本身就是視覺畫布。

## 設計原則

### Content Safe Area

主要標題、說明、CTA、真實學習資料固定在 Hero 左側內容安全區。
桌面約占 58–64%，平板略放寬，避免文字壓到主視覺。

### Art Safe Area

場景圖填滿 Hero，主體偏向右側約 35–45% 區域。
前景使用漸層遮罩，讓插畫自然淡入文字區，而不是被獨立框起來。

### CTA First

- 我的題庫：`選擇題庫開始練習`
- 今日複習：依真實資料自動挑選到期 / 錯題 / 不熟 / 收藏的下一步
- 模擬考：`建立模擬考`
- 學習統計：真實統計資料與正確率為視覺主角

## 四個頁面

### 我的題庫

場景鋪滿 Hero，文字與 CTA 位於 Content Safe Area。
`選題庫 → 練習 → 複習` 只作為場景中的低權重流程提示，不再是一個獨立圖片框。

### 今日複習

移除 `記憶焦點` 小框。
Hero 直接顯示四個真實複習數字，並依優先順序找出下一個可立即執行的複習模式。

優先順序：

1. 今日到期
2. 錯題
3. 不熟題
4. 收藏題

### 模擬考

移除 `考場流程` 小框。
場景成為整個考場 Hero，流程四步驟在 Content Safe Area 內以低權重 timeline 顯示。

### 學習統計

移除 `整體掌握` 小框。
Hero 仍有場景氣氛，但整體正確率圓環直接放在 Art Safe Area 前方，資料而非插畫成為主角。

## 響應式

### Desktop

- Hero 約 360–510 px 高
- Artwork fill Hero
- Content Safe Area 約 58–64%
- Art Safe Area 約 35–45%

### Tablet

- Content Safe Area 約 67%
- Art 的視覺權重下降
- 模擬考流程改為 2 × 2

### Mobile

- 插畫改為 Hero 上半部裁切背景
- 強化垂直漸層遮罩
- 文字與操作放在下方，100% 寬
- 今日複習右側數字取消，避免重複
- 統計圓環改為正常內容卡位置
- 操作優先於場景完整度

## 資產

R2G 的 8 張 WebP 不刪除，仍由 Service Worker 離線快取。
R2H 只改它們的版面角色：從小框內 artwork 變成 full Hero artwork。
未來替換成更高品質史詩動畫風資產時，不需要再改 DOM。

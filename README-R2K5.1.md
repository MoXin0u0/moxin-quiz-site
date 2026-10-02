# MoXin Quiz v4.0 — R2K.5.1 Academy Asset Style Correction

這一包不是示意圖，而是可直接覆蓋網站的正式資產修正。

## 修正範圍
- 替換 Academy 的 8 張 Desktop Hero（4 pages × Light/Dark）
- 替換 Academy 的 8 張 Mobile Hero
- 沿用 R2K.5 的既有檔名與 `scene-assets.js` 路徑，因此不重構 loader
- 場景改為高細節古典學院：木作、書籍、手稿、黃銅儀器、拱窗、石材、光影與空間層次
- 左側仍保留文字安全區，主要視覺集中在右側
- SCENE_CACHE_VERSION 改為 `moxin-quiz-scenes-r2k.5-2`，強制淘汰 R2K.5 的舊簡化場景快取

## 未變更
- Epic 場景本輪不替換
- R2K.4 responsive loader 不變
- Full / Reduced / Off 語義不變
- APP_SHELL 架構不變

## 建議 Commit
`style(v4.0): correct academy scene asset detail`

## 驗收
1. Academy / Full / Light：右側書籍、黃銅儀器、窗框與桌面物件應明顯具有材質與細節。
2. Academy / Full / Dark：月光與室內暖光應同時存在，不應退化成單色線稿。
3. Reduced：應只是降低存在感，不改變素材本體細節。
4. Mobile：主要物件應位於可見區，不靠桌面圖硬裁。

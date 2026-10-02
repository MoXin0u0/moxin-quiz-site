# MoXin Quiz v4.0 — R2K.5.2 Epic Style Correction

這一包直接實作，不新增示意圖。

## 本輪內容
- 替換 Epic 的 8 張 Desktop Hero（4 pages × Light/Dark）
- 替換 Epic 的 8 張 Mobile Hero
- 素材改為高細節史詩幻想場景：浮空學院、魔導書、晶體、符文、試煉平台、星圖與魔法資料介面
- 左側刻意維持乾淨文字安全區；高細節主體集中在右側
- 沿用既有檔名與 R2K.4 loader，不改頁面 DOM
- APP cache 升為 `moxin-quiz-v3-4.0.0-r2k.5-2`
- Scene cache 升為 `moxin-quiz-scenes-r2k.5-3`，避免 cache-first 繼續顯示舊簡化 Epic 圖
- 新增 Epic 資產 SHA-256 regression
- 新增文字對比 regression：鎖住 Epic Light/Dark 的 content-safe mask 與前景字色，避免未來圖片與文字混在一起

## 建議 Commit
`style(v4.0): correct epic scene detail and lock hero contrast`

## 驗收
1. Epic Full 應明顯比舊版線稿豐富，右側有可辨識的建築、晶體、魔導物件與空間層次。
2. Light 左側深色文字應位於高不透明淺色安全區。
3. Dark 左側淺色文字應位於高不透明深色安全區。
4. Reduced 只降低場景存在感，不應把文字可讀性一起降低。
5. Mobile 應使用 `*-mobile.webp`，不是直接裁 Desktop。

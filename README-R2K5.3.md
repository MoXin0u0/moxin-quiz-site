# MoXin Quiz v4.0 — R2K.5.3 Native Epic Asset Rebuild

本包直接替換網站正式 Epic 資產，沒有採用任何拼圖、contact sheet 或 UI mockup 作為圖片來源。

## 為什麼需要 R2K.5.3
R2K.5.2 的 Epic 圖雖輸出為 2560×1440，但來源曾由低解析拼圖區塊放大，因此實際細節不足。
R2K.5.3 改成 8 張獨立的 single-scene 高解析來源，每張來源至少 1600×900，再各自製作 Desktop/Mobile。

## 內容
- Epic 4 pages × Light/Dark × Desktop/Mobile = 16 張正式 WebP
- Desktop：2560×1440
- Mobile：1080×1440
- 不修改 scene-assets.js 路徑
- 保留現有 Epic 文字安全遮罩與 Light/Dark 字色
- APP cache：moxin-quiz-v3-4.0.0-r2k.5-3
- Scene cache：moxin-quiz-scenes-r2k.5-4
- 新增來源 provenance manifest，防止未來再從縮圖／拼圖放大
- 新增資產 SHA-256、來源尺寸、production 尺寸與 detailScore regression

## 建議 Commit
`style(v4.0): rebuild epic scenes from native single-scene sources`

## 驗收重點
1. Full 模式的建築、書本、儀器、符文、水晶邊緣應清楚，不應有 R2K.5.2 的大面積柔化感。
2. Academy 與 Epic 都維持高細節，但 Epic 額外具有浮空建築、符文、晶體與藍紫魔法光。
3. 左側文字不得與背景互相吃色；Light/Dark 的 content-safe mask regression 仍保留。
4. 手機載入 `*-mobile.webp`，不得使用桌面圖硬裁。

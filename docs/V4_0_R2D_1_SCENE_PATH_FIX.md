# v4.0 R2D.1 — 我的題庫情境區定位 Hotfix

## 問題

R2D 將「選題庫 → 練習 → 複習」保留在 `learning-art-slot` 底部，
但較早的一條共用規則：

`.learning-hero-scene > * { position: relative; }`

在 cascade 中覆蓋了原本的 absolute positioning。

因此 `.learning-scene-path` 雖然仍有 `bottom / left / right`，
實際卻以 relative 元素參與正常文件流，看起來像跑到情境卡上緣。

## 修正

R2D 最終覆蓋規則明確加入：

`position: absolute;`

並限制其最大寬度在 art slot 內。

## 影響

只修正「我的題庫」Hero 情境區的底部流程標示定位。
不變更任何資料、題庫、作答、複習、模擬考或統計邏輯。

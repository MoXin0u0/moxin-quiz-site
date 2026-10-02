# MoXin Quiz v4.0 — R2K.5.2.1 Cache Regression Hotfix

## 問題
R2K.5.2 將 APP cache revision 從 `-1` 提升為 `-2`，
但 R2F / R2G / R2I / R2J / R2K / R2K.2 的舊 milestone regression
仍把 cache revision 寫死為 `-1`。

因此目前 Actions 是「測試契約過期」，不是 Epic 場景或 APP_SHELL 壞掉。

目前 service worker：
- `moxin-quiz-v3-4.0.0-r2k.5-2`
- `moxin-quiz-scenes-r2k.5-3`

## 修正
只修改 6 個舊 regression tests：
- v40-r2f-page-personality-run.mjs
- v40-r2g-scene-integration-run.mjs
- v40-r2i-visual-style-system-run.mjs
- v40-r2j-epic-style-run.mjs
- v40-r2k-style-differentiation-run.mjs
- v40-r2k2-scene-clarity-run.mjs

將固定 `-1` 改成允許合法的數字 revision `-\d+`。
沒有修改 service-worker、圖片、CSS、loader 或產品功能。

## 建議 Commit
`test(v4.0): stop pinning milestone tests to cache revision 1`

# 墨忻刷題網 v4.0 — Development Changelog

本檔集中保存 v4.0 開發里程碑摘要。根目錄只保留正式 `README.md`；一次性更新包說明不再累積在 repository root。

## P2B.1 — Studio Batch Import UI
- P2B Parser Core 接入題庫工作室。
- 工作室首頁與編輯器新增「批次貼題」入口。
- 提供 ready / review / unparsed 預覽。
- review 題目必須由使用者明確勾選後才加入草稿。
- 新草稿批次匯入會取代初始空白 starter question。
- 加入後仍使用既有 Question Draft Model 與 Inspector 驗證。
- 新增離線 App Shell 項目。
- 清理 repository root 的里程碑 README。

## P2B — Batch Question Parser Core
- 新增 `src/studio/batch-parser.js`。
- 支援常見題號、題型、答案、詳解、章節、標籤與難度。
- 不猜答案；資訊不足標示 review；原始文字保留。

## R2K.5.4 — True Epic World Separation
- Epic 與 Academy 使用完全不同的場景來源與世界結構。
- 8 張獨立 Epic source；Desktop / Mobile 共 16 張正式資產。
- 新增 provenance 與 Academy-vs-Epic 視覺差異 gate。

## R2K.5.3 — Epic Native Source Experiment
- 解決低解析來源放大的模糊問題。
- 後續發現仍沿用 Academy 世界結構，因此由 R2K.5.4 取代。

## R2K.5.2 / R2K.5.2.1
- 第一輪 Epic 高細節素材整合。
- 修正舊 milestone tests 固定 cache revision 的問題。

## R2K.5.1 — Academy Style Correction
- Academy 改為高細節古典學院場景。
- Desktop / Mobile 使用獨立 production assets。

## R2K.5 — Production Scene Assets
- 建立 production asset pipeline 與尺寸 / 資產品質 audit。

## R2K.4 — Responsive Scene Runtime
- Desktop / Mobile、focal point、高 DPI fallback。
- Save-Data / prefers-reduced-data。
- decode 後再交換場景，降低閃爍。

## R2K.3 / R2K.3.1 — High-Fidelity Scene Pipeline
- 場景資產退出 APP_SHELL，改用 Runtime Scene Cache。
- R2G / R2H regression contract 對齊新 cache 架構。

## 文件規則
- 長期規格放在 `docs/`。
- 里程碑摘要追加到本檔。
- 根目錄不再新增 `README-<milestone>.*`。

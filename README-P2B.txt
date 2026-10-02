# R2K 後主線恢復 — v4.0 P2B Batch Parser Core

這一包不修改場景、不生成圖片，也不修改學習區視覺。

新增：

- `src/studio/batch-parser.js`
- `tests/v40-p2b-batch-parser-run.mjs`
- `docs/V4_0_P2B_BATCH_PARSER.md`

修改：

- `package.json`：把 P2B regression 接到既有 `npm test`

本階段刻意不修改 `studio-r1.js`。先把 Parser Core 與安全規則固定，下一階段才接 UI。

建議 commit：

`feat(v4.0): add safe batch question parser core`

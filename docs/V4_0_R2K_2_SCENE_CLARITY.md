# v4.0 R2K.2 — Scene Clarity

## 問題

「完整」與「減弱」視覺差異不足。

原因不是設定沒有儲存，而是：
- Full 仍受到 Whole-page Hero 強遮罩影響。
- Academy Full 的 dark grading 使用過低 brightness / saturation。
- Epic 的 particle overlay 比例過高。
- Reduced 雖降低 opacity，但 Full 本身也已經被處理得過於 atmospheric。

## 修正後語義

### 完整
- Desktop artwork opacity = 1
- 不使用 blur
- Academy / Epic 只保留輕量 color grading
- Hero mask 只保護左側 Content Safe Area，約在中段前淡出
- Epic particles 降低存在感

### 減弱
- artwork opacity 約 24%
- saturation / contrast 明顯降低
- 使用較強 content-safe mask

### 關閉
- 沿用既有行為，完全不顯示 artwork

### Mobile
仍以內容優先，但 Full 與 Reduced 保持明顯可辨識的場景強度差異。

## 後續

R2K.2 修正的是 CSS presentation。
現有 R2K WebP 本身仍帶有柔焦美術與較高壓縮，下一輪正式場景資產應以更高細節重新製作，而不是用 CSS 銳化假裝增加細節。

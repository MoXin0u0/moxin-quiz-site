# R2K.5.4 Visual Acceptance — True Epic World Separation

## Hard rules
- Epic 不得使用任何 R2K.5.1 Academy source filename。
- Epic source `derivedFromAcademy` 必須為 false。
- 四頁必須是四種不同空間語義，不得只換顏色或加特效。
- Light / Dark 可以共享世界概念，但必須使用獨立來源圖。
- Desktop / Mobile 都由該 Epic source 製作，不得回退到 Academy。

## Page identity
- Library: floating-library-city
- Review: memory-sanctum
- Exam: sky-trial-arena
- Stats: astral-observatory

## Side-by-side local audit
R2K.5.4 在封包前將 8 張 Epic desktop 與 R2K.5.1 Academy 對應圖縮放到相同尺寸，
計算 normalized mean absolute RGB difference；門檻為 0.12。
低於門檻的頁面不得出包。

## Text readability
沿用既有 Epic Light/Dark content-safe mask。
背景世界可以華麗，但左側文字區仍由 CSS overlay 負責對比，不把文字直接烤進圖片。

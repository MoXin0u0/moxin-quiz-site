# v4.0 P2A — 題目與詳解圖片資產管理

## 範圍

P2A 只處理題庫工作室的圖片生命週期，不包含批次貼題與 ZIP / JSON 直接開啟編輯。

## 支援格式

- PNG
- JPG / JPEG
- WebP
- GIF
- SVG

沿用既有 package 限制：

- 單檔最多 25 MB
- 題庫解壓後內容約 250 MB 上限
- package 檔案最多 5000 個

## 路徑規則

工作室新加入的圖片使用：

`assets/images/<questionId>/<question|explanation>/<filename>.<ext>`

例如：

`assets/images/Q001/question/diagram.png`

同名圖片不覆蓋，會自動產生 `diagram-2.png` 等新路徑。

## 題目圖片與詳解圖片

每題分成：

- `images`：題目圖片
- `explanationImages`：詳解圖片

兩區皆支援：

- 選擇多張圖片
- 拖曳加入
- 縮圖預覽
- 更換
- 移除

## 刪除安全性

移除某題的圖片引用時，只有在整份題庫已經沒有任何其他題目引用該 asset 時，才會移除 Blob。

因此舊題庫若本來有共用圖片，不會因為其中一題移除圖片就破壞其他題目。

## 複製題目

工作室複製題目時，圖片會建立新的 asset path：

- 原題：`Q001/...`
- 副本：`Q002/...`

Blob 內容可以重用，但 package path 不共用，避免後續更換圖片時互相影響。

## 未使用圖片

工作室會顯示整份題庫的：

- 圖片資產數
- 總容量
- 未使用圖片數

未使用 asset 不會被偷偷刪除；使用者可按「清理未使用圖片」明確移除。

## 預覽與儲存

圖片預覽使用 Blob URL，離開工作室或圖片被移除時會回收 URL。

草稿圖片保存在 IndexedDB `studioDrafts`；正式儲存題庫後寫入既有 `assets` store；ZIP writer 沿用既有邏輯，會把所有 draft assets 寫入 ZIP。

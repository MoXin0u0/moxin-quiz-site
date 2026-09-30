# P3：題庫詳情、篩選與練習流程

本階段把新版資料層第一次接成完整作答流程。

## 新增能力

- 題庫卡片可進入題庫詳情
- 題目搜尋
- 題型、難度、章節篩選
- 題目預覽
- 依目前篩選結果開始練習
- 四種題型作答
  - 單選
  - 複選
  - 是非
  - 填空
- 答錯題目回到本輪 queue，直到答對
- 即時判分與詳解
- 題目與詳解圖片從 IndexedDB Blob 載入
- 收藏狀態寫入 IndexedDB
- 每次作答寫入 attempts
- 每題累積 progress（attempts / correctCount / wrongCount / lastResult）
- 練習 session 持續寫入 IndexedDB
- 本輪完成摘要

## 尚未完成

- 錯題本與收藏列表頁
- 不熟題標記 UI
- 恢復未完成 Session 的 UI
- 筆記 UI
- 模擬考
- 熟練度 / 間隔複習
- PWA / Service Worker
- 將 v3.html 正式取代 index.html

## 注意

仍然使用 `v3.html` 作為新版入口，既有 `index.html` 不會被覆蓋。

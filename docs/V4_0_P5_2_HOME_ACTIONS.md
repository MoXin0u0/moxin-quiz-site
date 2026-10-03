# 墨忻刷題網 v4.0 — P5.2 Home Actions

## 目標

P5.2 強化「我的題庫」首頁上半部，但不新增另一個龐大的主導覽頁。

首頁 Hero 下方新增「今日概況」，只放：

- 今日目標達成率
- 全站連續學習
- 繼續上次練習
- 今日複習
- 快速錯題
- 考前衝刺
- 最近完整備份

題庫收藏與匯入區維持原本位置。

## 今日目標

首頁只顯示一組主要目標：

1. 若有啟用中的 Global 目標，優先使用 Global。
2. 否則使用最近更新、且題庫仍存在的單題庫目標。
3. 沒有有效目標時顯示「尚未設定」。

首頁會顯示目標 scope，避免把單題庫進度誤認成全站。

## 連續學習

固定使用所有題庫的 attempts 計算：

- streak
- 今日碰觸題數
- 今日一般刷題
- 今日複習

不受 P3 目前選擇的 scope 影響。

## 繼續上次練習

Sessions repository 新增全站最新未完成 Practice Session 查詢。

只考慮：

- 未 finished
- 未 submitted
- 非 exam
- 對應題庫仍存在

首頁直接進入原本的 resumePractice() 流程，不建立第二套 Session 邏輯。

## 今日複習 / 快速錯題

今日複習顯示所有題庫到期總數，進入 Learning Hub 的「複習」。

快速錯題會選擇目前錯題數最多的題庫直接開始 wrong review；若目前沒有錯題，改為進入複習頁。

## 考前衝刺

首頁顯示：

- 考試名稱
- 倒數日數
- 本次選擇題庫數

按下後進入 Learning Hub 的「考前衝刺」，不在首頁重複整套 P4 設定。

## 完整備份

新增極小的 localStorage metadata：

```text
moxin.v4.backup.meta
```

只保存：

```text
lastFullBackupAt
```

完整備份成功下載後才更新。

首頁狀態：

- 從未備份：提醒
- 0–6 天：正常
- >= 7 天：過久未備份提醒

這個 metadata 本身不是學習資料，也不改動既有 Backup Format。

## 效能

首頁每次回到「我的題庫」會刷新一次今日摘要。

不會在卡片切換時建立新的長期 watcher，也不新增輪詢。

## RWD

- Desktop：3 張摘要卡 + 4 張快捷卡
- Tablet：2 欄
- Mobile：單欄

## P5 狀態

P5 Analytics Core、P5.1 Statistics IA/UI、P5.2 Home Actions 完成後，P5 roadmap 的「統計與首頁」可以進入整體回歸與 Stable 驗收。

# 墨忻刷題網 v4.0 — P3 Learning Goal Progress Core

## 目的

P3 Core 將既有 `learningGoals` 設定與 `attempts` 作答紀錄接起來，提供：

- 今日一般刷題數
- 今日複習數
- 每日目標進度
- 最近 7 日達成狀況
- 連續學習天數
- 全域 / 指定題庫 scope

本階段只建立資料與計算核心；UI 留給 P3.1。

## 計數規則

### 每日刷題

一般 practice attempt 計入：

```text
filtered
未標示 mode 的舊紀錄
其他非 review / exam mode
```

同一題在同一天因答錯而重做多次，只計為 1 題，避免 retry 人為灌高每日目標。

### 每日複習

以下 mode 計入：

```text
review
due
wrong
unfamiliar
favorite
scheduled-review
review:*
```

同一題同一天在 review 中重做多次，只計為 1 題。

### 模擬考

```text
exam
exam:*
```

不計入「每日刷題」或「每日複習」，但算作當天有學習，因此會維持連續學習天數。

### 同題跨類型

同一題如果今天先做一般練習、後來又進入複習，它可以：

```text
practice +1
review +1
```

但 `answered` 的 unique question count 仍只算 1 題。

## 日期與時區

正式執行時使用瀏覽器本機日期：

```text
Date.getFullYear()
Date.getMonth()
Date.getDate()
```

因此台灣凌晨不會因 UTC 日界線被算到前一天。

核心另外支援注入 IANA timezone（例如 `Asia/Taipei`）供 regression 做跨 UTC 邊界驗證。

## 連續學習天數

有任一：

- 一般練習
- 複習
- 模擬考

就視為當天有學習。

若今天尚未作答，但昨天有學習，streak 不會在「今天尚未結束」時立刻歸零；會以昨天作為目前 streak 尾端。

若昨天也沒有活動，streak 為 0。

## 目標完成規則

`dailyPracticeTarget > 0` 才啟用一般練習目標。

`dailyReviewTarget > 0` 才啟用複習目標。

當天只有所有已設定的 target 都完成，才算：

```text
achieved = true
```

若兩個 target 都是 0，即使 goal.enabled = true，也不算達成日。

## 最近 7 日

目前資料庫只保存「目前 learning goal」，沒有每天的歷史 goal snapshot。

因此最近 7 日的達成狀況採：

> 用目前設定的 target 回看最近 7 天。

這是 P3 的正式語義；未來若增加 goal history store，才可改成「依當時目標」重建歷史。

## Scope

若 goal 有：

```text
bankId
```

只計算該題庫 attempts。

若 `bankId = null`，則計算所有題庫。

## Repository

P3 Core 追加：

```js
listAllAttempts()
```

到 attempts repository，供 P3.1 UI 一次取得完整作答紀錄後進行本機 aggregation。

目前是個人 Local-first 網站，此方式足以維持簡單可靠；若未來作答紀錄量非常大，再考慮建立 daily aggregate store。

## 下一階段

P3.1 — Learning Goal UI：

```text
設定每日刷題 / 複習目標
→ 顯示今日進度
→ 顯示 streak
→ 顯示最近 7 日達成狀況
→ 支援全域 / 指定題庫目標
```

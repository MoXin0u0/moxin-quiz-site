# 墨忻刷題網 v4.0 — P5 Analytics Core

## Roadmap 對位

P5「統計與首頁」先拆成 Core 與 UI，避免再次把大量功能直接堆進既有頁面。

本階段 P5 Core 完成：

- 7 日作答趨勢
- 30 日作答趨勢
- 7 / 30 日正確率
- 題型正確率
- 章節正確率
- 弱點章節排序

P5.1 再建立「學習統計」第二層：

```text
總覽 / 趨勢 / 弱點分析 / 題庫分析
```

首頁快捷入口、繼續上次練習與備份提醒另放 P5.2，避免一次改動過大。

## 統計口徑

### 作答趨勢

趨勢統計的是 `attempts` 記錄，不做同題去重。

因此：

```text
同一天 Q001 作答 3 次
→ 作答趨勢 +3
```

這和 P3 每日目標的 unique-question 語義不同。

### 正確率

```text
correct attempts / all attempts
```

一般練習、複習、考前衝刺與模擬考都屬於「實際作答」，因此 P5 的一般作答統計全部納入。

P3 仍維持原規則：exam 不會灌入每日刷題 / 複習目標。

## 日期

P5 沿用 P3 的 `localDateKey()`。

也就是：

- Production：瀏覽器本機日期
- Regression：可注入 IANA timezone

因此 P3 與 P5 的「今天」不會使用不同日界線。

## 題型統計

Attempts 本身沒有保存題型，因此 P5 使用：

```text
bankId + questionId
```

回查目前本機 questions metadata。

支援：

- single-choice
- multiple-choice
- true-false
- fill-in
- unknown

如果歷史 attempt 指向已不存在的題目，不會把該紀錄整筆丟掉；它會進 unknown。

## 章節統計

有 chapter：使用 chapter。

題目存在但 chapter 為空：`未分類`。

歷史 attempt 對應題目已刪除：`已移除題目`。

「已移除題目」保留在統計資料品質中，但不會被當成可行動的弱點章節。

## 弱點章節

預設至少 3 次作答才進正式弱點排名。

排序：

1. 正確率低
2. 錯誤次數高
3. 作答次數高
4. 章節名稱

如果所有章節都不足 3 次作答，仍提供 provisional 排名，UI 必須標示「樣本較少」，避免把 1 題答錯誤解成確定弱點。

## Global / Bank Scope

Core 支援：

```text
bankId = null → 全站
bankId = ERP  → 指定題庫
```

P5.1 題庫分析可以直接共用，不需要重寫統計公式。

## Data Quality

回傳：

```text
attemptsWithoutValidTimestamp
attemptsWithoutQuestionMetadata
```

避免舊資料或刪題造成統計 silently drop。

## 下一階段

P5.1 — Statistics IA & UI

```text
總覽
趨勢
弱點分析
題庫分析
```

P5.2 — Home Actions

- 今日目標達成率
- 連續學習
- 繼續上次練習
- 今日複習
- 快速錯題
- 考前衝刺
- 最近備份與提醒

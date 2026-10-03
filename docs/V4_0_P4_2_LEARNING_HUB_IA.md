# 墨忻刷題網 v4.0 — P4.2 Learning Hub IA Refactor

## 1. 今日複習 → 今日學習

主導覽改名為「今日學習」，頁內建立第二層：

```text
總覽 / 複習 / 學習目標 / 考前衝刺
```

P3、P4、Review 不再全部垂直堆疊。

## 2. P4 與 P3 scope 解耦

P4 使用獨立 learningGoals record：

```text
id = exam-sprint
bankId = null
sprintBankIds = [...]
sprintDailyTarget = ...
```

不新增 IndexedDB store，也不需要 DB migration。

## 3. P4 題庫必須明確選取

新 P4 不再把 Global 解讀為全部題庫。使用者可勾選一個或多個考試題庫。

空陣列代表：

```text
missing-bank-selection
```

而不是「全部題庫」。

舊 P4.1 bankId / global contract 保留 Core compatibility；新 exam-sprint record 一律使用明確 sprintBankIds。

## 4. P4 每日題數獨立

新增：

```text
sprintDailyTarget
```

0 代表自動依候選題數 / 剩餘學習日推導建議值。

## 5. P3 預設更安全

若沒有既有 P3 設定，優先選第一個本機題庫，而不是預設 Global。

Global 仍保留，但 UI 明確標為「全部題庫（整體目標）」。

## 6. 全站密度審查

另建立 `V4_0_UX_DENSITY_AUDIT.md`，把 Library、Stats、Studio、Settings、Exam、Practice 的密度風險記錄下來。

P5 統計開始前，必須先使用第二層資訊架構，不再做單頁長列表式堆疊。

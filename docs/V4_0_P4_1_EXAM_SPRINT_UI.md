# 墨忻刷題網 v4.0 — P4.1 Exam Sprint UI & Session Integration

## 位置

考前衝刺放在「今日複習」頁面、P3 學習目標之後。

不新增主導覽，因為 P3 與 P4 都屬同一個每日學習節奏：

```text
今日目標
→ 考前衝刺
→ 複習路線
```

## 設定

每個 Global / Bank scope 都可分別保存：

- examLabel
- examDate
- sprintEnabled

沿用既有 `learningGoals` store，不新增 IndexedDB migration。

## 顯示

P4.1 顯示：

- 距離考試天數
- 今日還需衝刺題數
- 每日 target
- 考前預計覆蓋 / 候選題數
- coverage gap
- 建議每日題數
- 六層題源構成
- 今日依題庫拆分的啟動入口

## Session

Bank scope：

```text
今日 P4 selected
→ 保留 P4 priority 順序
→ createPracticeSession(mode = sprint, shuffleQuestions = false)
```

Global scope：

```text
P4 global selected
→ 依 bankId 分組
→ 每次只啟動一個題庫 Session
```

因此不會把不同題庫的 asset Blob 與 metadata 混在同一個 Practice Session。

`sprint` attempts 仍屬一般 practice 類別，因此會計入 P3 的每日一般刷題與 streak。

## 今日已做題目的排除

P4 Core 追加一項防重規則：

若某題已在今天以一般 practice 類型完成，它已經算進 P3 的 unique practice count。

因此 P4 今日 selection pool 會排除該題，避免：

```text
remainingToday = 1
但又選到今天做過的 Q001
→ Q001 重做不會讓 unique count +1
→ 使用者永遠差 1 題
```

review / exam attempt 不會被當成「今日一般 practice 已完成」。

## 排序

P4 selection 的優先順序在 Session 中保留，不再被一般練習的 shuffle 打散。

一般 practice / review 仍維持原本的 random shuffle，只有 P4 sprint 使用 ordered queue。

# 墨忻刷題網 v4.0 — P4 Exam Sprint Core

## Roadmap 對位

這裡的 P4 是 **v4.0「考前衝刺」**。

Repository 既有 `docs/P4_LEARNING.md` 是早期 v3 開發階段文件，名稱相同但不是這一階段。

v4.0 P4 依 `docs/V4_0_PLAN.md`：

1. 目前錯題
2. 不熟題
3. 已到期複習題
4. 低熟練度題
5. 尚未作答題
6. 其他題目

每題只會落入最高優先級一次。

## 每日題數

目前 learningGoals schema 沒有另外的 `sprintQuestionTarget`，所以不新增 DB migration。

- `dailyPracticeTarget > 0`：尊重使用者目前每日一般刷題目標。
- `dailyPracticeTarget = 0`：才使用 `ceil(候選題數 / 剩餘學習日)` 作為 fallback。

同時額外計算：

- recommendedDailyTarget
- projectedCoverage
- coverageGap

如果每日目標不足以在考前覆蓋所有候選題，P4.1 UI 只提示，不會偷偷改高使用者目標。

## 今日進度

今日已完成的一般 practice 會從 daily target 扣除。

例如每日目標 30、今天已做 12：

```text
remainingToday = 18
```

P4 今日 queue 只選 18 題。

## Global / Bank Scope

Bank goal 只選該題庫。

Global goal 可以排序多個題庫；key 使用 `bankId + questionId`，避免不同題庫都有 Q001 時互相衝突。

既有 Practice Session 是單題庫模式，因此 P4.1 UI 的 Global sprint 要依 bank 分組啟動，不把多題庫 assets 混進單一 session。

## 下一階段

P4.1 — Exam Sprint UI & Session Integration：

- 考試名稱
- 考試日期
- 啟用考前衝刺
- 倒數
- 今日 sprint target
- 六層題源構成
- coverage gap / 建議每日題數
- Bank scope 直接開始 sprint
- Global scope 依題庫分組開始
- Session mode 使用 `sprint`

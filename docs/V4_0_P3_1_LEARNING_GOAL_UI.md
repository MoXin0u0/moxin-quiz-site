# 墨忻刷題網 v4.0 — P3.1 Learning Goal UI

## 位置

P3.1 放在「今日複習」頁面。

原因是這個頁面本來就是每日學習節奏與複習路線的入口；學習目標放在 Hero 與題庫複習路線之間，可以同時顯示：

- 今日一般刷題進度
- 今日複習進度
- 連續學習天數
- 最近 7 日達成狀況
- 全部題庫 / 指定題庫目標

不額外增加主導覽項目。

## Scope

下拉選單支援：

```text
全部題庫
指定本機題庫
```

Global goal 使用：

```text
id = global
bankId = null
```

題庫目標使用：

```text
id = bank:<bankId>
bankId = <bankId>
```

這讓 `learningGoals` store 可以同時保存全域與多個題庫目標。

## UI 行為

### 今日整體進度

P3 Core 已提供的 `completionPercent` 直接呈現，不在 UI 重新發明計算規則。

### 每日刷題 / 每日複習

顯示：

```text
已完成 / 目標
剩餘題數
完成狀態
```

若 target = 0：

```text
目前沒有設定每日目標
```

### 最近 7 日

每一天顯示：

- 日期
- 達成 ✓
- 未達成百分比
- 當天 unique answered 題數

資料語義仍維持 P3 Core：

> 使用「目前目標」回看最近七日，而不是假裝保存了歷史目標快照。

### Streak

UI 不自行計算 streak，只顯示 P3 Core 結果。

## 儲存

表單只保存：

- enabled
- dailyPracticeTarget
- dailyReviewTarget
- scope / bankId

所有數值仍由 repository `normalizeLearningGoal()` 做第二層正規化。

## RWD

- Desktop：三張摘要卡、兩張 target 卡。
- Tablet：表單 2 欄。
- Mobile：摘要、target、表單全部單欄。
- 最近 7 日會依螢幕寬度從 7 欄降為 4 欄、2 欄。

## 下一步

P3.1 實機驗收重點：

1. Global target 儲存後重新進頁仍存在。
2. 切換到某個題庫可建立獨立 target。
3. 作答一般練習後 practice count 增加。
4. due / wrong / unfamiliar / favorite 複習後 review count 增加。
5. exam 不增加上述兩項，但 streak 可維持。
6. 同題 retry 不重複灌高題數。
7. Light / Dark、Academy / Epic、Desktop / Mobile 都保持可讀。

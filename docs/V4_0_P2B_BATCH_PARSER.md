# 墨忻刷題網 v4.0 — P2B Batch Question Parser Core

## 本里程碑範圍

P2B 第一階段只建立「批次文字 → Question Draft」核心，不在這一包修改工作室 UI。

目的：

```text
原始文字
→ 分割題目
→ 結構解析
→ Draft Model
→ 狀態分類
→ 後續由 Studio Preview 讓使用者人工確認
```

Parser 不直接寫入 `questions` store，也不直接建立正式題庫。

---

## 安全原則

### 1. 絕不猜答案

如果來源只有：

```text
1. ERP 系統的核心目的是？
A. 整合資訊
B. 製作圖片
```

Parser 可以建立暫存 Draft，但：

```js
answer: []
```

狀態必須是 `review`。

### 2. 不確定的題型必須標記確認

例如：

```text
企業資源規劃的英文縮寫是？
答案：ERP
```

因為沒有明確 `題型：填空`，Parser 可以暫列 `fill-in` 方便人工編輯，但必須標記：

```text
status: review
```

不會假裝這是 100% 確定的題型。

### 3. 無法解析的原文不可丟棄

每個 candidate 都保留：

```js
candidate.raw
```

另外結構中無法可靠歸類的行會保存在：

```js
candidate.source.unparsedLines
```

### 4. 解析後仍必須通過既有 R1 Draft Model

P2B 使用：

- `nextQuestionId()`
- `normalizeQuestionDraft()`
- `validateQuestionDraft()`

因此不建立第二套題目規則。

---

## 狀態

### ready

Parser 有足夠資訊，而且 Draft Validation 通過。

例如：

```text
1. ERP 系統的核心目的是？
A. 整合企業資訊
B. 只處理圖片
答案：A
```

### review

有可用的 Draft，但仍需要人工確認，例如：

- 缺少答案
- 題型只能推定
- 題型與答案結構衝突
- 答案引用不存在的選項
- 無法辨識難度
- 有未歸類文字

### unparsed

連題目文字都無法建立，Parser 只保留原始區塊。

---

## 支援題目起始格式

目前支援：

```text
1. 題目
1、題目
Q1 題目
第1題 題目
題目：內容
```

## 支援欄位

```text
題目：
題型：
類型：
答案：
正解：
詳解：
解析：
章節：
標籤：
標記：
難度：
```

繁體 / 簡體常見寫法皆納入。

## 支援題型名稱

- 單選 / 單選題 / single-choice
- 複選 / 多選 / multiple-choice
- 是非 / 判斷 / true-false
- 填空 / 填空題 / fill-in

## 選項格式

包含常見：

```text
A. 內容
A、內容
A) 內容
(A) 內容
A 內容
```

## 答案

選擇題：

```text
答案：A
答案：A,C
答案：A、C
答案：AC
```

是非題只有明確 token 才會設定：

```text
正確 / 錯誤
O / X
True / False
```

其他值不會自動猜成 Boolean。

---

## Public API

### `parseBatchQuestionText(text, options)`

回傳：

```js
{
  sourceText,
  preamble,
  candidates,
  summary: {
    total,
    ready,
    review,
    unparsed
  }
}
```

### `parseQuestionBlock(block, options)`

解析單一題目區塊。

### `selectBatchQuestions(candidates, options)`

將已確認的 candidate 重新配置永久題目 ID，準備加入目前 Studio Draft。

預設只選 `ready`；只有 UI 在使用者明確確認後才應：

```js
includeReview: true
```

### `splitQuestionBlocks(text)`

提供 Preview/UI 查看 Parser 如何切題。

---

## 下一階段：P2B UI Integration

核心測試通過後，下一包才修改 `src/ui/studio-r1.js`：

1. 工作室首頁新增「批次貼題」。
2. textarea 貼上原始文字。
3. 顯示 `ready / review / unparsed` 三類預覽。
4. 每題可以取消加入。
5. `review` 必須明確確認。
6. `unparsed` 顯示原文，不自動建立題目。
7. 確認後使用 `selectBatchQuestions()` 加入目前草稿。
8. 再交由現有 Inspector / Draft Validation 處理。

不會直接寫入正式題庫。

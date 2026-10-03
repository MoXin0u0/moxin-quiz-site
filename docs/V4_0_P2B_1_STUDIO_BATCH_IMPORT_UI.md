# 墨忻刷題網 v4.0 — P2B.1 Studio Batch Import UI

## 目的

把 P2B Parser Core 正式接進題庫工作室。

```text
原始文字
→ 解析
→ ready / review / unparsed 預覽
→ 使用者勾選
→ 加入目前 Studio Draft
→ 既有 Inspector / Draft Validation 再驗證
```

## 安全行為

- `ready`：預設勾選。
- `review`：預設不勾選，必須明確勾選「我已確認，仍加入草稿」。
- `unparsed`：不可直接加入，只保留原始文字。
- Parser 不直接寫入正式題庫。
- 加入草稿時重新配置永久題目 ID。
- 缺少答案仍維持 `answer: []`，交由工作室既有驗證提示。

## 入口

- 工作室首頁「批次貼題」：建立新草稿後直接開啟解析器。若草稿只有初始空白 Q001，成功匯入後會用批次題目取代這個空白 starter。
- 編輯器「批次貼題」：把解析結果附加到目前草稿。

## 預覽資訊

每題顯示：

- 狀態
- 題型
- 題目
- 答案
- 章節
- 難度
- 選項
- Parser / Draft issues
- 原始文字

## Offline

`src/ui/studio-batch-import.js` 與 `styles/v4-studio-batch.css` 都加入 Service Worker APP_SHELL。

## Repository hygiene

同步移除根目錄的一次性 `README-R2K*` 與 `README-P2B.txt`。里程碑摘要集中到 `docs/V4_0_CHANGELOG.md`。

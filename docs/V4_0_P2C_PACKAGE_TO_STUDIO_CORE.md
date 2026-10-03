# 墨忻刷題網 v4.0 — P2C Package → Studio Draft Core

## 目的

P2C Core 把既有的 ZIP / JSON 題庫讀取與驗證流程，接到題庫工作室 Draft Model。

本階段不新增 UI。資料流程為：

```text
ZIP / JSON
→ package-reader
→ validator
→ P2C plan
→ Studio Draft
→ 後續 P2C.1 UI 開啟
```

## 核心 API

### `inspectStudioPackagePlan(pkg, options)`

重新使用正式 `validatePackage()` 做 canonical validation，不直接相信匯入物件上舊的 `pkg.report`。

回傳：

- `valid`
- `report`
- `mode`
- `hasCollision`
- `originalBankId`
- `targetBankId`
- `sourceKind`
- `sourceName`
- `questionCount`
- `assetCount`
- `warningCount`
- `errorCount`

### `createStudioDraftFromInspectedPackage(pkg, options)`

建立可以交給 Studio 儲存 / 編輯的 Draft。

## ID 安全規則

### 來源 ID 沒有碰撞

例如：

```text
來源 ID：erp-demo
本機不存在 erp-demo
```

工作室保留：

```text
erp-demo
```

但 `draft.bankId = null`，因為 ZIP / JSON 是外部來源，不會被視為已安裝本機題庫的直接編輯連結。

### 來源 ID 已存在

例如本機已經有：

```text
erp-demo
```

P2C 會建立：

```text
erp-demo-copy
```

如果也存在：

```text
erp-demo-copy
erp-demo-copy-2
```

則建立：

```text
erp-demo-copy-3
```

避免外部檔案靜默覆蓋既有題庫。

## 作者題庫安全

從檔案開啟的 package 永遠是「外部工作草稿」，不直接連結到本機已安裝的作者題庫。

因此：

- 不覆寫作者題庫。
- 不覆寫同 ID 的本機題庫。
- 發生 ID collision 時一定改成 copy ID。
- 最終仍由現有 `saveDraftToLibrary()` 的保護再次驗證。

## Questions

題目會經過：

```text
normalizeQuestionDraft()
```

保留永久 Question ID，不任意重新編號。

這樣可以保留題庫內部引用語義，也避免匯入後產生不必要的 ID 漂移。

## Assets

ZIP 中已讀出的 Blob 會帶入 Draft：

```text
path
mimeType
size
blob
```

Question 的：

```text
images
explanationImages
```

路徑保持不變。

## Validation

P2C Core 重新執行正式 `validatePackage()`：

- Error → 禁止建立 Draft。
- Warning → 允許開啟，在 P2C.1 UI 顯示警告。
- 不信任舊的 `pkg.report.valid`。

這可避免 package 在 inspect 後被修改，卻仍使用過期驗證結果。

## JSON 與圖片

JSON 本身不攜帶圖片 Blob。

若 JSON 題目引用了找不到的圖片，現行 validator 會產生 warning；P2C 仍可開啟 Draft，讓使用者在 Studio 裡補圖或修正。

完整含圖片交換仍建議 ZIP。

## 下一階段

P2C.1 UI Integration：

```text
選擇 ZIP / JSON
→ 題庫檢查摘要
→ 錯誤 / 警告預覽
→ 「加入我的題庫」
   或
   「在題庫工作室中開啟」
→ Studio Draft
```

# 墨忻刷題網 v4.0 — P2C.1 Import → Studio UI Integration

## 目的

把 P2C Core 接到目前「我的題庫」匯入檢查畫面，讓 ZIP、JSON 或題庫資料夾完成驗證後，可以選擇：

- 匯入到我的題庫
- 在題庫工作室中開啟

## 工作室流程

```text
選擇 ZIP / JSON / 資料夾
→ Schema 驗證
→ 題庫檢查摘要
→ 在題庫工作室中開啟
→ P2C canonical validation
→ 建立並儲存 Studio Draft
→ 自動切換到題庫工作室
→ 直接開啟剛建立的草稿
```

## ID 衝突

外部題庫 ID 尚未存在時保留原 ID。

若本機已有同 ID，工作室路徑不會覆蓋現有題庫，而是使用 P2C Core 產生的安全 copy ID，例如：

```text
erp-demo
→ erp-demo-copy
→ erp-demo-copy-2
```

檢查畫面會在使用者點擊前顯示預計使用的 Studio ID。

原本「匯入到我的題庫」的更新行為保持不變，因此兩條路徑用途明確分開。

## Warning / Error

- Warning：允許開進 Studio，再由 Inspector 修正。
- Error：禁止匯入，也禁止建立 Studio Draft。

## 導航

`renderQuestionBankTools(container, { draftId })` 會把指定 draft 傳給 Studio。

`mountStudioWorkspace(mount, { draftId })` 收到 draftId 時，優先直接打開該草稿，不停留在工作室首頁。

# B01｜安全防護與 CI：工程審查／驗收紀錄

> 基準：V5.0.0 `e26bcdd71bf06ac359eabb2750f049afaac7280c`。  
> PR 方式：B01 堆疊於尚未合併的 B00 分支；不得直接部署 `main`。  
> 來源：AUD-001、AUD-002、AUD-003、AUD-024、AUD-029、AUD-031。  
> **狀態：實作中／證據於 PR 及 Actions 完成後補上；不能將此文件當作滲透測試通過證明。**

## 1. 本批實作範圍與安全契約

### ZIP 來源與威脅模型（AUD-001）
- 外來 ZIP 檔的 central-directory 欄位可能不實，包括檔案大小、壓縮比例、名稱、項目數與本地檔頭。
- 不再依賴 `Response(stream).arrayBuffer()` 產生未受限的大型解壓資料；改為 `ReadableStreamDefaultReader` 逐區塊檢查**實際已輸出位元組數**，超過單檔、宣告大小、剩餘總量或壓縮比時立即取消 reader，拒絕整份 ZIP。
- 在進入解壓前，拒絕壓縮大小／總量／重複路徑／path traversal；在解壓時核對 local 與 central 的方法、flag、路徑。保留 CRC32 與完整大小驗證。
- 儲存策略：`readZip` 全部成功才返回 Map；後續 package/schema 驗證仍在匯入路徑中執行。**沒有把解壓過程中的錯誤當成合法的部分匯入。**
- 預期範圍：常規 Stored（method 0）與 DEFLATE（method 8）；原本已不支援加密 ZIP 與 Zip64，仍維持。

### CI 與依賴（AUD-002／003／024）
- `.github/workflows/v3-regression.yml` 沿用歷史檔名，Workflow 顯示名更新為 `V5 Regression`；push 覆蓋 `main`、`improvement/**` 等現有分支，**pull_request 無 paths 排除**，避免只改 `app.html` 漏跑。
- `V5 browser + accessibility baseline` 對所有適用 PR、`main` push 執行，並要求 `Unit + release preflight` 先成功。
- Playwright、`@axe-core/playwright` 列入鎖定版 `devDependencies`；`package-lock.json` 由 GitHub Actions 的 `npm install --package-lock-only` 實際產生，CI 改用 `npm ci --ignore-scripts`。
- `tests/b01-zip-security-run.mjs` 與 `scripts/b01-security-audit.mjs` 被加入現有單元測試／CI。無第三方 runtime framework 的產品原則不變。

### 仍需額外核准的倉庫保護（AUD-031）
- 2026-10-09 GitHub API 回報 `main.protected=false`，`required_status_checks` 未啟用。
- 分支保護／ruleset 是**GitHub 儲存庫設定**，不應以修改 YAML 假裝已啟用。
- 倉庫管理者需在 Settings → Branches／Rules → Branch protection rules 或 Rulesets 中針對 `main`：
  1. 要求 Pull Request 才能合併；
  2. 啟用 required status checks：`Unit + release preflight`、`V5 browser + accessibility baseline`（待新 PR 訊號確認後選取）；
  3. 設定視情況要求分支最新、阻止強制推送與刪除；
  4. 對正式合併需保留擁有者審查／核准；驗證未通過時不可 bypass。
- 完成時請提供 Settings 截圖或 API `protected=true` 及 required check 結果；**在那之前 G1 Gate 維持未通過**。

## 2. XSS／CSP 與輸入邊界（AUD-029）— 分清已驗證與剩餘風險

### 本批自動化證據
- ZIP 適用惡意檔案測試：過度膨脹、偽裝宣告大小、CRC、目錄路徑、local/central 不一致、重複、累計上限、正常 ZIP round trip。
- `scripts/b01-security-audit.mjs` 偵測 `src/` 的動態代碼執行構造（`eval`／`new Function`）、公共 HTML 中的 `javascript:` 導覽連結，守護 ZIP 串流限額與最小 Google Drive scope；這是**基礎靜態合約掃描，不等同完整 SAST 或滲透測試**。

### CSP 尚不能直接強制上線
- 目前公開頁面含 inline script，用來初始化主題等；App 也採本機 ES modules 與 Google GIS／Drive API。嚴格 `script-src`、`connect-src`、`frame-src` 等必須以真實瀏覽器與 Google 授權流程驗證。
- GitHub Pages 靜態部署對自訂 HTTP CSP header 有限制；可研議 HTML meta CSP，但功能支援和限制必須逐項測試，不能簡單加入禁止 inline 的政策導致主題初始化或 OAuth 無法運行。
- 後續進行：列出所有 inline script、第三方 domain、API endpoint、worker／blob／image 的實際來源；設計安全的 nonce/hash 或外部化腳本策略；檢測 CSP violation、登入／離線／PWA；不預設允許 `unsafe-eval` 或任意 `*` 來源。

### 尚待真實安全測試
- 所有透過 `innerHTML` 與 template string 輸出的題庫名稱、題目、筆記、題庫詳解、使用者字串，仍要逐個 sink 驗證 escaping／sanitization 與事件屬性／URL protocol 白名單；本次不宣稱全站 XSS 絕對安全。
- 題庫 ZIP/JSON image MIME、SVG／Data URL／Blob、匯入容量與巨大巢狀 JSON、目錄穿越和資源耗盡等，需專項 Fuzz、跨瀏覽器及必要時專業安全審核。
- Google token、Cloud profile 授權邊界、跨帳戶切換、被撤銷裝置持續離線的行為，沿用 V5 已記錄的驗收；本批未更動 OAuth／同步實作，也未執行獨立滲透測試。
- 安全事故回報與使用者隱私揭露將由 B02 的 LEG-018 等項目銜接。

## 3. 發布 Gate 與回滾

- G1-1：惡意 ZIP 與正常 ZIP 測試全部 PASS，未出現資料部分寫入。
- G1-2：PR 和 main 的 Unit + Browser Jobs 在最新 Workflow 實際觸發並通過；不能採用 V5 發版時的舊 CI 當證據。
- G1-3：`npm ci` 可重現安裝；嚴重依賴稽核議題另註解處置。
- G1-4：**main protection / required checks 真正生效**，不能只看 YAML。
- G1-5：安全邊界掃描有清楚限制；若完整 CSP 仍是待辦，必須明示與後續安排。
- 未完成 G1 所有條件前 **不能標記 B01 完全結案**，但已實作內容可作為 Draft PR 待驗收。
- 回滾程式碼時不得降回僅支援 DB v3 的客戶端；目前變更不涉及 DB schema、OAuth 資料或雲端資料變更。

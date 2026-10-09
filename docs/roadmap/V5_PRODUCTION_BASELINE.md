# V5.0.0 正式版固定基準（B00 / G0）

> 狀態：V5 production 快照與後續改善前置契約。此文件只記錄可核對的原始碼與既有發布證據，不代表再次通過正式站全流程測試。  
> 基準日期：2026-10-09（Asia/Taipei）  
> 固定來源：[`main @ e26bcdd71bf06ac359eabb2750f049afaac7280c`](https://github.com/MoXin0u0/moxin-quiz-site/commit/e26bcdd71bf06ac359eabb2750f049afaac7280c)  
> B00 實作策略：獨立 PR；除中性 package metadata 外，只增加文件／治理檔案；不觸及正式環境配置。

## 1. 基準識別與已存在的證據

| 項目 | 固定事實／來源 |
| --- | --- |
| Repo／正式入口 | `MoXin0u0/moxin-quiz-site`；`index.html` 公開首頁、`app.html` 學習大廳、`v3.html` 相容入口 |
| 來源 commit | `e26bcdd71bf06ac359eabb2750f049afaac7280c`（2026-10-09 審查基準） |
| V5 合併 commit | `2eaef7dd0c4fd5bbcaffa2ec3eb1761f8d663b2d`；PR [#7](https://github.com/MoXin0u0/moxin-quiz-site/pull/7) |
| V5 完成簽核 | [docs/v5-manual-cloud-gate.md](../v5-manual-cloud-gate.md)；已記錄 Pages / OAuth production smoke PASS |
| 正式版本 | `APP_CONFIG.appVersion=5.0.0`、`releaseChannel=production` |
| 資料庫 | IndexedDB 名稱 `moxin-quiz-v3`，**DB version=4**（名稱中的 v3 是歷史識別，不能依品牌變更） |
| 題庫與同步協定 | Question Bank Schema `2.0`；Cloud Sync Schema `1` |
| 同步 | `features.cloudSync=true`，選用 Google Drive `appDataFolder`；OAuth scope `https://www.googleapis.com/auth/drive.appdata` |
| PWA | GitHub Pages，同來源部署；`manifest.webmanifest` 的 `start_url=./app.html`、`scope=./` |
| 完整備份 | Backup v2；與雲端同步獨立。OAuth token／裝置雲端運行狀態不得被還原 |
| 追蹤 | [V5 後續改善整合總計畫](./V5_AFTERCARE_MASTER_PLAN.md)；AUD-001～032、UI-001～040、BR-001～014、LEG-001～020 |

原 V5 測試證據屬於**當時已記錄的發布結果**，不等於 B00 改動後或未來 B01～B09 自動通過；每批另附新測試證據。

**尚無獨立證據事項：** 本批未取得新一輪真實設備截圖、Core Web Vitals、Firefox/WebKit、異機雙裝置、滲透測試及完整官方商標審查，須明確維持待驗證。V5 已記錄兩個隔離瀏覽器 context 的同步測試，不應錯寫成兩台實體裝置。

## 2. 資料與使用者體驗不可變條件

1. 不登入、離線、Local-only 的核心學習保持可用；OAuth 必須由使用者主動啟動。
2. 本機 mutation 先成功寫入；雲端同步可選、不取代備份，失敗時不阻斷本機操作。
3. 不修改 DB 名稱／key／schema、題庫與題目 ID、歷史學習紀錄、Outbox、cloud profile、OAuth origin／Client ID、PWA scope 或 service-worker cache key。
4. 進行帳戶切換時，未確認前不得將帳號 A 的資料上傳至 B；撤銷裝置不能再推送資料。
5. 不變更模擬考快照、原期限、冪等交卷；恢復不能延長期限。
6. **不能回退到僅支援 IndexedDB v3 的舊客戶端。** 若需停用同步，應保留 Local-first 與持久 Outbox，而非清空使用者資料。
7. 「墨境」目前僅為中文工作名稱；B00 不變更產品顯示名、Google OAuth 品牌、網域、商標聲明或條款生效日期。
8. 後續服務條款／隱私政策不得提前聲稱未驗證的資料處理行為或不可行的完全刪除能力。

## 3. 變更與回滾契約

- 所有批次從固定基準或最新版 `main` 的已審核 commit 開分支；PR 描述列出 `Bxx`、`AUD/UI/BR/LEG` 原 ID、風險、測試與明確的非變更範圍。
- 若 PR 對既有資料庫、雲端協定、OAuth、PWA 或匯入格式產生影響，必須有獨立相容性與回滾設計；不可只寫「git revert」。
- B00 的預期回滾僅需撤回文件／PR 模板與中性的 `package.json:name` 變更；不清除使用者儲存空間，不部署舊 DB-v3-only 前端。
- 保留 V5 commit 及 [正式發布簽核](../v5-manual-cloud-gate.md) 作為修復參照。基準 SHA 本身不可變；本批未新增 Git Tag，正式 Tag 是否補建另行核准。
- 正式 GitHub Pages 的部署或合併 `main` 均需另行核准，不因 PR 已建立而自動發布。

## 4. B00 驗收表

| 檢查項 | 標準 | B00 狀態 |
| --- | --- | --- |
| 固定 Base | 原始 SHA、PR #7 與發版記錄互相對照 | 已由 GitHub 檢查 |
| 現行／歷史文件 | README → 現行索引；舊 `v5-implementation-status.md` 明示只供開發追溯 | 已在本 PR 提案；待合併 |
| 議題索引 | 106 個 ID 不重編；B00～B09 明確指派 | 已在總計畫；待合併 |
| PR 工作格式 | 原 ID、基準、風險、資料不變條件、測試、回滾與驗收人 | 已新增 PR 模板；待合併 |
| 可回退且不影響 Runtime | 檢查差異範圍；不修改同步或儲存程式 | 待 PR diff 核對 |
| CI / 正式站 Gate | `npm run ci`、必要瀏覽器實測與新 Actions 結果 | 待執行；不得假稱 PASS |

B00 完成只代表**治理基礎完成**；AUD-001/002/003/007/024/029/031 等安全與 CI 實作仍屬 B01。服務條款與隱私權政策完善屬 B02。

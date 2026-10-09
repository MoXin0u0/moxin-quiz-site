# B02｜資料流與權益清冊（Code-anchored Data Map）

> 審查基準：`main @ 6b20284cb0c86304368d3bd694b461dda067a426`，2026-10-09。  
> 狀態：**工程可核對的事實清單／法律政策草案依據**，不是完整封包側錄，也不代表已通過個資法或 Google 審查。  
> 對應：LEG-007/008/009/010/011，關聯 LEG-001/005/012/015/018/020。  
> 正式對外文件現況：`terms.html` 與 `privacy.html` 最後更新 2026-10-08。本 B02 PR **不擅自將尚未批准的政策文字發布到這兩個頁面**。

## 1. 功能／資料／位置／使用者控制的逐項對照

| 作業與資料項目 | 來源與實際儲存／傳輸方式（已核實的程式碼） | 使用者控制與風險 | 需進一步核實 |
| --- | --- | --- | --- |
| 題庫、題目、圖片、筆記、作答／複習／Session、學習目標／Studio | `src/storage/db.js`：IndexedDB `moxin-quiz-v3`、DB v4，含 `banks`, `questions`, `assets`, `attempts`, `progress`, `favorites`, `notes`, `mastery`, `reviewSchedule`, `sessions`, `studioDrafts`, `learningGoals` 等 | 未登入可用；瀏覽器網站資料被清除／瀏覽器私密模式／儲存配額可能喪失本機資料 | 實際各瀏覽器／平台的資料保留與清除行為 |
| 外觀與一般設定 | `src/storage/settings.js` 以 `moxin.v3.settings` 等 localStorage key；`src/ui/settings.js` 可調整 | 跟隨目前網站 origin，清除該網站資料會失去設定 | 檢查每個 localStorage key、遷移與備份包含情況 |
| 完整備份檔 | `src/storage/backup.js`：Backup v2 包含題庫、學習紀錄、草稿及部分 sync revision/tombstone；`devices`, `syncMeta`, `syncOutbox`, `syncReceipts`, `cloudObjects` 是還原時清理的 operational stores | 使用者自行下載／保管；完整備份不等於 Google 同步，也不會還原原本 OAuth access token | 不應承諾備份「完全不含任何可能識別帳號的欄位」，須逐類審查 `accountSettings` |
| Google OAuth access token | `src/cloud/google/google-auth.js`：`accessToken`、`tokenResponse` 保存在 TokenManager 物件記憶體，過期會要求再次使用者互動；未見寫入 localStorage/backup 的指令 | 授權僅在使用者觸發連結或切換時請求；Google 第三方授權可另行撤回 | 瀏覽器擴充套件、第三方 SDK、例外記錄中的機密暴露另需安全測試 |
| Google API scope | `src/app/config.js`：`https://www.googleapis.com/auth/drive.appdata`；`src/cloud/google/google-auth.js` 傳給 `initTokenClient` | 不要求對一般 My Drive 的全面存取；功能選用，本機不須 OAuth | Google Cloud Console 的授權同意畫面／資料宣告與實際 scope 是否一致，需管理者截圖 |
| Google 帳號識別 | `src/cloud/google/google-drive.js:getAccountProfile` 請求 `/about?fields=user(permissionId,displayName,emailAddress,photoLink)`，返回 providerSubject/displayName/displayEmail/photoUrl | 用於確認帳戶、連結與切換；`src/sync/account-lifecycle.js` 的 reconciliation 本機持有帳號識別資訊，解除連結會清理部分雲端操作狀態 | 檢查 accountSettings/syncMeta 裡的可識別字段，以及實際備份是否含關聯字段 |
| Google appDataFolder 同步 | `src/cloud/google/google-drive.js`：`/files?spaces=appDataFolder` 與 `parents:['appDataFolder']` 上傳，僅使用使用者授權的 Google API | 用戶主動開啟、查看同步盤點並確認；`src/app/sync-ui.js` 無 token 時自動同步跳過；同步不取代獨立備份 | 雲端檔案物件的完整格式／保留策略、裝置實測、Google 端刪除功能 |
| 同步用裝置與歷史資料 | `src/storage/db.js` 定義 `devices`, `syncMeta`, `syncOutbox`, `syncReceipts`, `syncRevisions`, `syncConflicts`, `syncTombstones`, `cloudObjects` | 用來防止跨帳號錯誤推送、保留修訂與衝突處理；離線不同裝置資料仍各自存在 | 雲端 object/commit/checkpoint 真正保留週期；目前不應填入任意「30 天」等期限 |
| GitHub Pages 主機與網路連線 | `index.html`、`app.html`、`service-worker.js` 靜態部署，網站入口使用 GitHub Pages；`privacy.html` 也告知第三方託管 | 網站請求、網域存取紀錄等可能由託管／網路第三方依各自政策處理 | GitHub Pages 日誌保存、Cookie、訪客識別與實際 CDN 網路行為須核對供應商文件，不能寫「沒有任何日誌」 |
| 題庫原作者／使用者自製內容 | `src/question-bank/package-reader.js`、`src/question-bank/importer.js` 將匯入／使用者資料保存本機；作者題庫由 `author-banks.json` 等靜態來源提供 | 使用者自行匯入內容必須有使用權；並非上傳後即轉讓著作權給網站 | 作者題庫的原始授權、公開分享功能、侵權／勘誤的實際受理管道 |
| 第三方代碼與 API | `src/cloud/google/gis-loader.js` 載入 GIS；`src/app/config.js` 宣告 Google API host，網站在 GitHub Pages 運行 | 第三方可能獨立依服務條款處理請求 | 用瀏覽器 Network 實測有無 analytics、第三方字型/CDN、其他資料流；本次**不保證**完全沒有 |

## 2. 四種「刪除／解除」不是同義詞

| 動作 | 目前核實可說的事實 | 不可寫成 |
| --- | --- | --- |
| 解除這個裝置的雲端連結 | `src/app/sync-ui.js:unlinkCloud` 顯示確認；`src/sync/account-lifecycle.js:unlinkCurrentCloudProfile` 清理本機雲端運行與連結狀態、保留本機題庫與學習資料，返回 `revokedRemoteData:false` | 「已刪除 Google 雲端檔案」「已清空所有裝置」 |
| 撤銷 Google 第三方授權 | `src/cloud/google/google-auth.js:revokeCurrentAccess` 有 Google GIS revoke 呼叫能力，但目前尚未核實該函式是否已提供給使用者可見按鈕；可循 Google 帳戶第三方連結管理頁操作 | 「解除裝置連結就同時撤銷 Google 帳戶授權」「撤權會自動刪掉 Drive 檔案」 |
| 清除目前瀏覽器網站資料 | 透過瀏覽器 UI 移除該 origin 的 IndexedDB、localStorage/快取等（實際項目依瀏覽器）；目前未發現一鍵清空所有裝置的產品流程 | 「已清除 Google appDataFolder」「已清除其他裝置的本機資料」 |
| 刪除 Google appDataFolder 同步資料 | `src/cloud/google/google-drive.js:deleteFile` 具 API 低階刪除函式；**未核實有完整雲端刪除 UI、刪除整個 appData 資料範圍、其他裝置防重建機制** | 「目前已支援一鍵永久清空所有雲端同步資料」 |

**必要操作提醒**：對本機內容執行破壞性清理前先下載備份；如果仍有其他裝置啟用同步，應先檢查其連結狀態，否則資料可能因後續同步而重新出現。這是風險提醒，並非承諾一定會重建。

## 3. 對 Google API 的用途與限制（需與授權畫面核實）

- 只應利用 Google API 取得的帳號／Drive 資料提供使用者可以辨識的同步、身分識別、衝突復原與裝置管理功能，不能擅自增加廣告定向、販售、信用評分等用途。
- Google API Services User Data Policy 要求公開且可及的 Privacy Policy，充分揭露存取、用途、儲存與共享，若用途產生實質變更需重新通知／必要時取得同意。
- **目前已驗證程式碼路徑，不等於已獨立完成 Google OAuth 正式驗證、Google Cloud Console 比對、第三方追蹤網路側錄。** 確認後才能正式寫「所有第三方資料處理皆符合某政策」的絕對保證。
- Google 官方政策：https://developers.google.com/terms/api-services-user-data-policy
- Google Workspace 資料規則：https://developers.google.com/workspace/workspace-api-user-data-developer-policy
- Google OAuth policy：https://developers.google.com/identity/protocols/oauth2/policies

## 4. 臺灣法規告知對照（法律核准前之檢查表）

臺灣《個人資料保護法》第 8 條列出：管理者名稱、蒐集目的、個資類別、利用期間／地區／對象／方式、當事人權利行使方式及可自由提供時不提供的影響等事項。需要先確認本服務實際角色、活動與適用法律，不因靜態站或免費就自行認定豁免。

| 待核實事項 | 來源依據／應填證據 | 狀態 |
| --- | --- | --- |
| 服務提供者／個資管理者名稱（不得直接以未知別名冒充法律實體） | 產品負責人確認對外署名／責任主體 | **待決策** |
| 可非公開提交私密資料的聯絡管道 | 可靠信箱／表單／隱私回報流程，回覆角色與處理能力 | **待決策** |
| 個資類別與蒐集目的 | 本清冊及實際 OAuth scope／本機 SyncMeta | 程式部分已核對；待資料流測試 |
| 處理與保存期間／地區／對象／方式 | 本機、Google Drive、GitHub Pages 供應商政策及產品停止流程 | **待查證** |
| 個資當事人的查詢、更正、停止處理、刪除等權利 | 不宣稱可遠端處理操作者無法存取的私有 Browser/Drive，需提供可行步驟 | **待產品／法律審核** |
| 未成年、服務地域與主管法規 | 產品服務對象、Google 未成年政策／主管法規 | **待決策** |
| 事件通知、政策版本與實質變更 | 受理管道、修訂摘要、生效日、Google 資料用途變更同意 | **待程序設計** |

官方來源：https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=I0050021

## 5. 稽核結論與發布阻擋

- 已核實：Local-first、IndexedDB v4、Google `drive.appdata` 權限、帳號顯示資訊欄位、TokenManager 記憶體儲存、備份與同步的分離、解除連結的本機／雲端差別。
- 尚未確認：服務合法主體、聯絡管道、Google Console 真正審查狀態、所有網路端來源、是否有可用的雲端完整刪除工具、資料保存期限、最終法律適用與未成年規則。
- **禁止上線**：將不確定資訊填進現行 Terms／Privacy、強制 Local-only 訪客授權、默認同步刪除、把「Google OAuth 同意」誤寫為「服務條款同意」。

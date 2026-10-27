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
| **Draft PR 中** Google Forms 回報入口（已提供短連結，正式 main 尚未啟用） | 使用者自願送出的回饋內容／可能自願提供的電子郵件，透過 Google Forms 與表單擁有者帳戶處理 | 本機學習與 OAuth 不依賴填表；負責人已實測未登入／Email 非必填可提交，並**聲明目前只有本人查看、管理回覆**；不是 Google 後台共用權限的獨立驗證 | 負責人已確認目前未連結 Google Sheets（未獨立查核）；**2026-10-13 負責人提供的「簡報」設定截圖已顯示查看結果摘要關閉**（非獨立登入驗證）；**同日共用／發布選項截圖顯示只有擁有者、編輯者檢視權限受限、作答者知道連結即可存取、已發布且接受回覆**（非平台獨立稽核）；**2026-10-13 初次截圖曾顯示「發生頁面」意外為檔案上傳、頂端說明空白；後續同日截圖已確認該題改為簡答選填、頂端已補用途／Google 處理／保存／聯絡說明**。原 2026-10-10 匿名測試不得當修改後現行通過；**修正後桌面無痕免登入填答三項（免登入、Email 留空提交成功、他人回覆不可見）已由負責人於 2026-10-13 逐項確認 PASS**，屬手動回報而非後台 API 稽核；歷史 Drive 附件資料夾及新一輪手機端仍待驗證；**分類重疊已由後續編輯截圖更正為七類單選必填（當時顯示儲存中，待重開確認）**。正式發布前仍須核實其餘實際欄位、回覆者端摘要可見性、Google 平台實際權限／資料處理、保存／刪除；如日後新增 Sheets 再評估獨立分享權限；見 [表單規格](./B02_GOOGLE_FORMS_INTAKE_SPEC.md) |
| GitHub Pages 主機與網路連線 | `index.html`、`app.html`、`service-worker.js` 靜態部署，網站入口使用 GitHub Pages；`privacy.html` 也告知第三方託管 | 網站請求、網域存取紀錄等可能由託管／網路第三方依各自政策處理 | GitHub Pages 日誌保存、Cookie、訪客識別與實際 CDN 網路行為須核對供應商文件，不能寫「沒有任何日誌」 |
| Gmail 備援聯絡途徑（已獲准公開，B02 Draft PR） | 寄件人自願寄送的電子郵件地址、主旨、內文及可能附帶的檔案，由寄件平台／Google Gmail 與個人開發者處理 | 僅用於受理、回覆與跟進使用者主動聯絡；請勿提供密碼、存取 token 或完整私人備份 | **一般使用者聯絡案件自結案後保留 2 年，每 3 個月人工檢查到期；特殊案件另依必要與適用法律處理，無自動刪除（2026-10-13 決議）**；Gmail 權限、結案紀錄、人工刪除與安全事故 SOP 待實測；對外信箱為 `moxin82771@gmail.com`；見 [Gmail SOP](./B02_GMAIL_RETENTION_SOP.md) |
| 題庫原作者／使用者匯入第三方內容 | `src/question-bank/package-reader.js`、`src/question-bank/importer.js` 處理本機匯入；作者題庫由 `author-banks.json` 等靜態來源提供 | D-05 已確認可為私人學習匯入第三方內容，但仍須具個別合法利用依據；私人同步／備份不同於公開分享，ZIP 匯出不代表取得再散布權 | 現有 ERP 規劃師資料有 443 筆（`ERP_Planner_202509_V06`），已確認 CERPS「ERP 規劃師－試題指南 2025.09 V06」官方 PDF 共 441 題號；其中 Q206_2／Q411_2 為重複紀錄；**來源已知不代表取得公開再利用授權**，解析／圖片與法定考試例外仍待逐項核對；日後公開分享前的合法利用依據及侵權處理另見 [D-05 規格](./B02_CONTENT_RIGHTS_AND_SHARING.md) |
| 第三方代碼與 API | `src/cloud/google/gis-loader.js` 載入 GIS；`src/app/config.js` 宣告 Google API host，網站在 GitHub Pages 運行 | 第三方可能獨立依服務條款處理請求 | 用瀏覽器 Network 實測有無 analytics、第三方字型/CDN、其他資料流；本次**不保證**完全沒有 |

## 2. 四種「刪除／解除」不是同義詞

**D-06（2026-10-10）已決議：暫緩新建「完整刪除 Google appDataFolder 同步資料」及跨裝置防重建功能**。此處保留能力與限制的盤點，是為了準確描述現有使用者控制及依法資料請求流程，**不是規劃立即開發該功能**；同時不得宣稱解除連結或撤銷 Google OAuth 即可刪除全部遠端資料。開發者不能預設可直接存取或清空使用者私人 appDataFolder；依法提出的個資權益請求仍應依可處理的實際資料、權限及適用法律受理、說明可行途徑。

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
| 服務提供者／個資管理者名稱（不得直接以未知別名冒充法律實體） | 2026-10-10 已決定採個人開發者身分，公開署名「墨忻（MoXin）」；如適用法律要求法定自然人身分，須另取本人提供及公開同意 | **創作者署名已決議；個資蒐集者法定識別仍待核對** |
| 可非公開提交私密資料的聯絡管道 | 已決定 Google Forms 為主要入口、專用 Gmail 備援；公開 Email `moxin82771@gmail.com` 已於 2026-10-10 獲准 | **策略已選、連結已提供、未登入提交已實測；負責人聲明僅本人查看回覆、沒有連結 Sheets；Forms 一般案件結案後 1 年、Gmail 一般案件結案後 2 年／每 3 個月人工檢查已決議；後台權限、實際執行仍待核對** |
| 個資類別與蒐集目的 | 本清冊及實際 OAuth scope／本機 SyncMeta | 程式部分已核對；待資料流測試 |
| 處理與保存期間／地區／對象／方式 | **一般 Google Forms 回覆：案件結案後 1 年；備援 Gmail 的墨忻刷題網一般聯絡案件：結案後 2 年、每 3 個月人工檢查（均已決議）**；特殊案件個別處理；本機學習資料、Google Drive 同步與 GitHub Pages 不套用上述期限 | **Forms 與 Gmail 均已決議每 3 個月人工檢查；Forms 一年、Gmail 二年；檢查頻率不自動延長到期日。均無自動刪除，結案紀錄、人工刪除與實際權限待驗證；其他資料保存方式仍待查證；見 [Forms SOP](./B02_GOOGLE_FORMS_RETENTION_SOP.md)** |
| 個資當事人的查詢、更正、停止處理、刪除等權利 | 不宣稱可遠端處理操作者無法存取的私有 Browser/Drive，需提供可行步驟 | **待產品／法律審核** |
| 未成年、服務地域與主管法規 | 2026-10-10 已確認臺灣為主要目標地區、繁體中文為主要語言，產品全年齡適用（包含未成年人／兒童）；核心本機使用不需 Google 登入、生日與身分證明 | **年齡／地域定位已決議；法定代理人處理、Google 監護帳號的 OAuth 相容、兒童個資與跨境法律仍待審核** |
| 事件通知、政策版本與實質變更 | 受理管道、修訂摘要、生效日、Google 資料用途變更同意 | **待程序設計** |

官方來源：https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=I0050021

## 5. 稽核結論與發布阻擋

- 已核實：Local-first、IndexedDB v4、Google `drive.appdata` 權限、帳號顯示資訊欄位、TokenManager 記憶體儲存、備份與同步的分離、解除連結的本機／雲端差別。
- 尚未確認：服務提供者正式法律署名、Google 表單欄位／後台權限、Google Forms／Gmail 人工清理實作驗證與服務提供者正式法律署名（保存年限已決議、基本免登入提交已實測）、Google Console 真正審查狀態、所有網路端來源、是否有可用的雲端完整刪除工具、資料保存期限、最終法律適用、法定代理人／兒童資料處理程序與受監護 Google 帳號相容（臺灣主要地區、繁體中文、全年齡適用已決議）。
- **禁止上線**：將不確定資訊填進現行 Terms／Privacy、強制 Local-only 訪客授權、默認同步刪除、把「Google OAuth 同意」誤寫為「服務條款同意」。


## 2026-10-13 補充：歷史檔案上傳資料夾檢查

**驗收：PASS（負責人目視確認）**。負責人找到原 Google Forms 檔案上傳題型所建立的 Google Drive 資料夾，並回報**檢查當下資料夾內沒有檔案**。本結果只適用於該資料夾的當下可見內容，不表示從未上傳檔案、不代表其他位置或副本不存在，更不等於已執行永久刪除；沒有刪除任何資料。舊紀錄內「資料夾未知」係較早階段狀態，以此補充為最新結果。接續驗收「詳細說明」欄位必填、手機無痕填答、分類變更儲存確認及資料人工清理 SOP；LEG-012／020 仍未整體通過。


## 2026-10-13 補充：詳細說明必填狀態

**負責人明確確認：「詳細說明」欄位目前為必填**，符合 B02 規劃的段落文字必填欄位。這是表單擁有者的設定回報，不是本次直接取得後台開關截圖或獨立 Google Forms API 稽核；亦沒有以空白詳細說明進行新的負向提交測試。之前截圖未顯示必填星號為歷史觀察，以此次明確回報更新現況。此項可記錄為 **PASS（負責人確認）**。仍待手機無痕提交、分類變更儲存確認、Forms/Gmail 人工結案和刪除流程、法務發布 Gate；LEG-012／020 整體未通過。


## 2026-10-13 補充：手機端無痕匿名填答 PASS（負責人實測）

負責人已於完成手機私密／無痕瀏覽器、未登入 Google、不填電子郵件、使用不含個人資料測試內容的操作後，明確回覆**「全部通過」**，對應前次三項驗收：**① 不需登入 Google；② 電子郵件留空仍成功提交；③ 無法查看其他填答者的回覆**。此為**產品負責人的手機端手動測試回報，三項 PASS**，不是我們自行操作手機或獨立登入 Google 後台。**不以三項通過推定所有手機品牌、瀏覽器與字體縮放均已完成 UI 視覺測試；文字截斷、橫向溢出與特定互動細節尚無逐項結果**。此前文件的「手機端待驗證」屬本次確認前的歷史狀態，已由此項更新。Google Forms 資料流／Sheets、分類變更儲存狀態及人工結案／刪除管理仍有未完成的 Gate；負責人明確要求案件清冊暫緩，LEG-012／020 整體**仍為 BLOCKED**，Draft PR #13 不合併 main。


## 2026-10-20｜D-07 Google User Data Disclosure 正式／草案差異稽核

已完成**公開隱私／條款 HTML 與 Google OAuth／Drive 原始碼、B02 草案及 Google 官方公開政策的第一輪靜態一致性比對**，新增 [GD-01～GD-12 差異與依賴清單](./B02_GOOGLE_USER_DATA_DISCLOSURE_GAP_AUDIT.md)。**CODE 一致**：選用 OAuth／本機優先、單一 `drive.appdata`、Google `about.user(permissionId,displayName,emailAddress,photoLink)`、記憶體 access token、appDataFolder 的 API 行為，以及解除裝置連結不等於雲端刪除。**P1 主要差異**：`main/privacy.html`／`terms.html` 的聯絡段落仍只引導使用者到**公開 GitHub Issues**，沒有 B02 已決策的**Google Forms 私下回報＋公開備援 Gmail**；保留／刪除期限、權利請求回應和法定身分告知尚未具備發布核准。**文件出版差異**：B02 隱私草案含內部測試歷史，不得直接全篇當作對外政策。

目前 **D07-06 公開連結訪客實測 PASS**、Search Console project URL-prefix ownership PASS；**Google User Data disclosure 的完整法律與實機稽核 PARTIAL／PENDING、OAuth authorized-domain／Branding verification 仍 PENDING**。下一步按稽核清單：同步資料逐類及資源載入核對 → 非公開請求及保存流程 → 乾淨對外版本草案／法律審核 → 負責人另行授權正式發布和品牌送審。**本輪只建立 Draft 文件，不修改 main／Google Console 或正式隱私條款**。


## 2026-10-20｜雲端 entity 與歷史保留風險程式碼核對

已核實 `src/sync/entity-types.js` 列有 **13 種**可同步 entity，`initial-seed.js` 讀取作答、收藏、精熟、筆記、目標、帳號設定、作者題庫資訊、裝置、Session、工作室草稿、題庫、題目、素材及墓碑資訊；`cloud-object-transport.js` 可上傳 Blob 圖片／素材及 JSON 文件；`checkpoint.js` 含資料修訂、刪除 tombstone 與裝置索引。**checkpoint 7 天／100 commits 的設定不是資料保存期限，也不能推定清除所有舊資料。** GD-04 P0 原始碼清單 PASS，但真實 Google Drive 寫入／刪除／歷史殘留仍 PENDING。見 [GD-04A／04B 稽核](./B02_GOOGLE_USER_DATA_DISCLOSURE_GAP_AUDIT.md)。

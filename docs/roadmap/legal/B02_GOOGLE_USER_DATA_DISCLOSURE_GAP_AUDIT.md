# B02 D-07｜Google 使用者資料告知與正式法律頁一致性差異稽核

> 稽核時間：2026-10-20｜依據：`main` 已公開的 `privacy.html`、`terms.html`、`index.html`，及 `main` Google OAuth／Drive 程式碼；對照 B02 **內部待審草案**。  
> **狀態：SOURCE REVIEW COMPLETE／POLICY RELEASE BLOCKED。本文是審查清單，不是使用者政策或法律意見；未修改 `main`、Google Console，未同意送出品牌驗證。**  
> 檔案基準：正式 `main` 為獨立 Search Console 驗證檔 PR #14 合併後版本；B02 Draft PR #13 仍未合併。

## 1. 稽核目的與判準

以 Google [品牌驗證前置條件](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)與 [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) 為比對標準：公開首頁／政策 URL 必須可訪問且同網域，政策須完整且準確揭露 Google 使用者資料的**存取、用途、保存、分享**，實際處理不得超出已公開揭露內容。**URL 可訪問性 PASS 不等於政策內容／合法性／Google 品牌已獲核准**。

**證據分級**：`CODE PASS`＝已閱讀原始碼對應行為；`OWNER PASS`＝負責人實測／截圖；`PARTIAL`＝已有部分公開告知，但不足以完成送審；`BLOCKED`＝依 B02 決策與政策差異，正式發布前應處理；`PENDING`＝尚缺實機、後台或法律核對，不能單憑靜態原始碼宣稱全部通過。

## 2. 程式碼、正式公開政策與 B02 草案逐項比對

| ID | 實際程式或正式政策證據 | 判定 | 送審前處置 |
| --- | --- | --- | --- |
| GD-01｜本機優先與選用 OAuth | `src/app/config.js` 設 `cloudSync: true`，`privacy.html` 說明本機功能不必 Google 登入，雲端同步需使用者選擇；首頁可見功能說明 | **CODE PASS** | 沿用，不得寫成「所有功能都不會與外部網路連線」。 |
| GD-02｜最小授權範圍 | `config.js` 的 `googleDriveScope` 僅 `drive.appdata`；`google-auth.js` 透過 GIS `initTokenClient` 請求；`privacy.html` 明確揭露 scope、appDataFolder，不宣稱可管理全部 My Drive | **CODE PASS＋Console 截圖一致** | 明確說明這是 Google Drive app 資料範圍，不是完整私人雲端檔案讀取；若未來增加 scope 必須重新審查。 |
| GD-03｜Google 帳號識別資料 | `google-drive.js` GET `/about?fields=user(permissionId,displayName,emailAddress,photoLink)`；公開 `privacy.html` 已逐類列出 | **CODE PASS** | 保持「Google 回傳才使用」的條件，勿推論一定取得所有欄位。 |
| GD-04｜access token／同步保存 | `google-auth.js` 使用記憶體 token manager；`google-drive.js` 對 `appDataFolder` 列檔、讀取、建立、更新與特定檔案刪除；公開政策說明記憶體 token、使用者自己 Drive 的 appDataFolder | **CODE PASS／細節 PARTIAL** | 未發現前端程式將 token 寫入完整備份的依據；須再核對 `src/sync/` 的**逐類同步資料與持續保存／歷史修訂策略**，不能把單檔 API delete 說成已有「一鍵刪除全部遠端資料」。 |
| GD-05｜解除連結、撤銷與刪除 | `privacy.html` 已清楚區分解除裝置、Google 撤權、清除瀏覽器與 Google appDataFolder 刪除；D-06 已決議完整遠端一鍵刪除功能暫緩 | **文字基本一致／權利流程 PENDING** | 補合理的保存判準、不可代刪的技術界線、使用者請求與回覆方式；不要承諾全部遠端資料均可即時刪除。 |
| GD-06｜第三方傳輸／使用與分享 | 公開 `privacy.html` 提到 GitHub Pages 靜態託管、Google Drive／Identity 與 Limited Use；無自建集中同步帳號資料庫的原始碼／架構依據 | **PARTIAL** | 正式文案要區分：使用者的 Google 帳戶／Google API、GitHub 網站連線處理、選填的 Forms／Gmail 非公開回報；說明用途、可能接收者及不會做的用途，不保證「沒有任何平台日誌」。是否另有統計／第三方腳本需按實際資源載入查核。 |
| GD-07｜私人回報與個資權利受理 | `main/privacy.html` 與 `main/terms.html` 現行聯絡段落**只導向公開 GitHub Issues**；B02 決策已選 Google Forms（主要，回覆者可免登入）＋`moxin82771@gmail.com`（公開備援） | **HIGH／BLOCKED（待新政策發布）** | 在正式隱私／條款提供非公開聯絡方式、說明 GitHub Issues 只適合非敏感公開產品問題；不得要求於公開 Issues 張貼私人題庫、身分證明、OAuth token 或個資刪除請求細節。Forms 目前已由負責人完成功能驗收，但**連結尚未合併 main**；此差異是發布 Gate，不是表單功能失敗。 |
| GD-08｜保存期限 | `main/privacy.html` 對本機、Drive 保存說明多為使用者控制，**沒有** B02 決策的 Forms 結案後 1 年／Gmail 結案後 2 年／每 3 個月人工檢查；B02 草案清楚區分期限與「人工刪除仍待驗證」 | **HIGH／BLOCKED（新處理流程）** | 正式政策拆開寫本機、Drive、Forms、Gmail；Forms／Gmail 期限目前是**未生效的管理決策**，不可寫成已證明的自動清理保證。案件清冊依負責人指示暫緩，但權利請求與履行能力不能因此一律 PASS。 |
| GD-09｜資料管理者與法定告知 | 現行公開政策展示產品名，未充分確認個人開發者公開署名與法定管理者揭露需求；B02 D-01 選「墨忻（MoXin）」署名但法律識別待確認 | **LEGAL BLOCKED** | 先核定適用法律／個資法告知要求，不擅自公開開發者法定姓名，也不能假設品牌別名足夠。 |
| GD-10｜未成年／跨境／政策變更 | B02 擬全年齡、臺灣繁中主要對象；公開政策未完整區分受監護 Google 帳號適用情況、跨境服務與重大資料用途變更的重新告知／同意流程 | **PENDING** | D-04／D-08／D-09 另行法律與流程確認，不把 Google OAuth 授權等同於網站條款同意。 |
| GD-11｜新版草案可發布性 | `B02_PRIVACY_DRAFT.md` 在保存段落混合大量 2026-10-13 內部截圖、驗收狀態、已修復缺陷與早期歷史 PENDING 文字 | **HIGH／DRAFT EDITORIAL BLOCKED** | **不可直接複製整份內部草案到公開 `privacy.html`**；需將內部驗收紀錄留在稽核檔，另整理簡潔的「使用者看得到的政策正式版本」，避免內部更新歷史自相矛盾。此為文件出版品質問題，**不是**目前 Google Forms 又出現舊缺陷。 |
| GD-12｜網站連結與 OAuth 品牌現況 | 負責人 2026-10-20 無痕測試首頁／Privacy／Terms 及首頁連結 **PASS**；Search Console 專案路徑 URL-prefix ownership PASS；Google Auth Platform Branding 仍未驗證 | **URL／OWNER PASS；BRANDING PENDING** | Google 官方另要求核實 OAuth authorized top private domain 所有權。專案 URL-prefix PASS 不等於 `moxin0u0.github.io` Domain property 或品牌核准；未獲同意不按 Verify Branding。 |

## 3. D-07 正式修訂工作的依賴順序

**P0 — Google 資料使用真實性**：逐項確認 `src/sync/` 真正送入 appDataFolder 的資料種類、修訂／衝突與清理機制，以及網路第三方載入清單；用確實存在的行為編寫公開告知。此步只讀，不能據此增改 Google scope。

**P1 — 可安全私下聯絡**：正式政策與條款規劃 Google Forms（主要）＋已核准公開的 Gmail（備援）；OAuth consent 的**獨立使用者支援信箱維持不公開**，不與一般 Gmail 混為一個，Google Console 不需修改。

**P2 — 保存及權利請求可執行**：對外政策區分各資料位置與期限、結案後一年／兩年決策、人工處理限制，以及沒有一鍵完整雲端刪除；案件清冊暫緩，不等於履行期限已有驗收。識別、權利、未成年及跨境告知仍待 D-01／04／06／10 法律核准。

**P3 — 編寫乾淨的公開法律版**：移除內部截圖／測試／歷史問題敘述，保留正式使用者應讀的蒐集者、目的、資料類別、使用／儲存／分享、第三方、保存／刪除、權利、聯絡、政策變更。網站正式 `privacy.html`／`terms.html` 改動**必須再獲負責人明確批准後另行實作與發布**，不能將本文件建立當成發布授權。

**P4 — OAuth 品牌驗證**：先完成 Google 公開政策內容與授權網域風險核對，再由負責人決定是否啟動 `Verify Branding`。Scope 目前僅 `drive.appdata`，Google Console 已顯示 Data Access scope verification 不需要；Branding 仍獨立 PENDING。

## 4. 交付與安全界線

- **本次已完成**：已檢視上述正式 HTML、OAuth／Drive 原始碼、B02 法律草案與 Google 公開政策；得到可追蹤的差異與編修順序，沒有假設 Forms／Gmail 已被正式網站啟用。
- **本次未完成**：逐一捕捉網路封包、跨裝置同步資料全量稽核、實機權利請求／刪除、法律核定、Google 品牌審查，及對正式網站部署新政策。
- **不得動作**：不合併 B02 PR #13、不改 `main`、不公開本人未核准個資、不更動 Google Console／帳單／DNS、不送出品牌驗證。


## 5. P0｜同步內容資料流深入檢查（原始碼補充，2026-10-20）

來源：`main/src/sync/entity-types.js`、`initial-seed.js`、`cloud-contract.js`、`cloud-object-transport.js`、`object-mutation-transport.js`、`checkpoint.js`。**本節是程式碼可達行為，不是使用者帳號實際雲端檔案的後台稽核。**

### GD-04A：13 種可同步資料實體

`SYNC_ENTITY_TYPES` 明列 **13 種**：`attempt`、`favorite`、`unfamiliar`、`note`、`learning-goal`、`account-settings`、`author-library`、`device`、`practice-session`、`exam-session`、`exam-answer`、`studio-draft`、`user-bank`。依 `initial-seed.js` 初始同步資料來源，可分類如下：

| 對使用者的說明分類 | 程式碼例子 | 隱私政策應揭露的資訊 |
| --- | --- | --- |
| 作答／歷史紀錄 | `attempt`（答題時間與記錄）、`practice-session`、`exam-session`、`exam-answer` | 作答事件、測驗／練習過程及答案可能隨同步進入 Google Drive；並非只有成績摘要。 |
| 收藏／精熟度／筆記／目標 | `favorite`、`unfamiliar`、`note`、`learning-goal` | 包含使用者輸入的**筆記文字及偏好／學習歷史**，不能僅籠統寫為不含私人內容的「設定」。 |
| 帳號及裝置／作者資料 | `account-settings`、`author-library`、`device` | 可能包含裝置識別、標籤及帳號／題庫來源相關設定，應與 Google 帳號基本識別區分。 |
| 題庫工作室及使用者題庫 | `studio-draft`、`user-bank` | **題目、題幹、使用者自訂內容及圖片／附件素材**可能隨同步送入 appDataFolder；這不是網站對公眾分享。 |

`initial-seed.js` 先從 IndexedDB 的 `attempts`、`favorites`、`mastery`、`notes`、`learningGoals`、`accountSettings`、`authorLibrary`、`devices`、`sessions`、`studioDrafts`、`banks`、`questions`、`assets` 等讀取初始內容，並將合適記錄寫入同步 outbox。**這是具條件、依特定 entity 與版本／revision 處理的同步，不等於完整本機備份全部欄位都自動上傳**。程式中 `exam-answer` 屬可同步實體，但初始 seed 的特定資料來源不能代替它在所有執行路徑下的生命週期驗收。

### GD-04B：雲端保存的技術物件種類

- `cloud-contract.js` 定義的物件有 **profile、commit、checkpoint、asset、draft、user-bank、session**。同步 commit 會帶 `deviceId`、`profileId`、`mutations` 及時間／revision 資訊；**不是僅存匿名計數**。
- `cloud-object-transport.js` 可上傳 **Blob 二進位素材**、題庫與草稿的 JSON 文件；`object-mutation-transport.js` 會把草稿／題庫關聯素材與資料檔引用一起建立。原本 `privacy.html` 已提題庫、題目與圖片保存在本機，但**正式 Google 雲端同步段落應明確補上這些種類也可能進入 appDataFolder**。
- `checkpoint.js` 會記錄修訂索引、已刪除資料的 **tombstone head index**、裝置識別／標籤／最近同步資訊。**操作資料刪除與同步版本追蹤是兩回事**，不能因畫面刪掉一題就承諾相應歷史 commit、資產或所有遠端快照立即消失。
- `APP_CONFIG.syncLimits.checkpointEveryCommits=100`、`checkpointMaxAgeMs=7 日` 是**建立 checkpoint 的頻率／最大間隔參數，並非 Google 雲端資料保存 7 天或 100 次即自動刪除**。所讀取的 `checkpoint.js`、`commit-transport.js`、`cloud-profile.js`、`object-mutation-transport.js` 沒有足夠證據證明 Google 所有舊歷史物件會定期被遠端完全清除。
- 目前使用 **Google Drive API over HTTPS**，`ensureCloudAsset` 與 `ensureJsonDocumentObject` 使用內容 hash 檢查完整性；**內容 hash 不是端到端加密**。不能宣稱 Google 無法讀到 appDataFolder 內容、或應用已實作端到端加密，除非另外拿到具體程式碼／封包證據。

### 已收斂的 P0 與尚未驗收項目

**P0 source-level 類別清單已完成**；目前可基於 13 種可同步實體、雲端物件類型，對外準確描述「可能同步的資料」。正式政策仍需避免過度承諾同步永不遺失、所有舊修訂會於固定期間自動刪除或雲端內容完全沒有任何服務供應商能處理。

**實機 PENDING**：逐種實體建立／修改／刪除後在 Google appDataFolder 的寫入實況、可能的殘留歷史物件、跨裝置重建行為、使用者資料請求時可處理範圍；另應檢查 `account-settings` payload 不會被錯誤寫入 OAuth token 等敏感值（目前未看到 TokenManager 將 token 塞入該 payload，但尚未逐個呼叫端做全域封包驗證）。**這些差距不授權本輪修改網站功能。**

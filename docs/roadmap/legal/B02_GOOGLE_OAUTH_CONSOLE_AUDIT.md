# B02 D-07｜Google OAuth Console、scope 與正式告知對照（稽核規格）

> 建立：2026-10-14｜對應 LEG-008／009、LEG-010、LEG-020。
> **狀態：網站程式碼與部分既有網頁告知已核對；Google Cloud Console 實際設定、品牌驗證與正式發布狀態尚未查核。此文件僅供 B02 Draft PR，未經核准不得更新正式 `terms.html`、`privacy.html` 或合併 `main`。**

## A. 已由專案程式碼核實（不是 Google 後台驗收）

| 項目 | 程式碼證據 | 結論 |
| --- | --- | --- |
| OAuth 客戶端形式 | `src/cloud/google/google-auth.js`：Google Identity Services `google.accounts.oauth2.initTokenClient`，讀取 `src/app/config.js` 的 `googleClientId` | 瀏覽器端 token client；**不在文件或截圖散布 client secret、token**。 |
| 申請的 scope | `src/app/config.js` 的 `googleDriveScope`：`https://www.googleapis.com/auth/drive.appdata`；傳給 `initTokenClient` | 目前程式碼明列的 Drive scope 是 **`drive.appdata`**，不是整個 My Drive 的 `drive`／`drive.readonly`。 |
| scope 類別 | [Google Drive API scopes 官方列表](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) 將 `drive.appdata` 歸類為 **Non-sensitive（非敏感）** | **不得宣稱目前請求 restricted Drive scope**；但非敏感 scope **不等於**正式品牌與 OAuth 驗證條件自動通過。 |
| Google API 行為 | `src/cloud/google/google-drive.js`：`/files?spaces=appDataFolder`、建立檔案時 `parents:['appDataFolder']` | App 專用隱藏同步資料區；需進一步查核實機授權及同步行為。 |
| 帳號資訊 | `getAccountProfile` 以 Google Drive `/about?fields=user(permissionId,displayName,emailAddress,photoLink)` 讀取必要欄位 | 預期會取得 permission ID 與可能的名稱／Email／照片；需與實際授權畫面及正式隱私政策一致。 |
| token 行為 | `google-auth.js`：access token 保存在 TokenManager 記憶體；`include_granted_scopes: true` | 程式請求 scope 已知，但**不得在未實測時保證 Google 授權回應只包含一個 scope**；應核對同一用戶先前授權合併情況。 |
| 現行隱私頁 | `privacy.html` 已提 `drive.appdata`、appDataFolder、帳號辨識與第三方 Google 資料處理 | **文字存在不代表 Google Console 的 Privacy URL 指向正確網址，也不代表 B02 待審稿草案已正式生效。** |

## B. Google Cloud Console 核對順序（只讀，不擅自改設定）

進入 [Google Auth Platform](https://console.cloud.google.com/auth/overview)，選擇與網站 **實際 `googleClientId` 相符**的專案；不要把其它專案的 OAuth 設定誤當本網站。Google 官方控制台分為 **Branding、Audience、Clients、Data Access、Verification Center**：[官方頁面](https://support.google.com/cloud/answer/15544987?hl=en)。

| 順序 | 頁面 | 須核對的項目 | 目前結果 |
| --- | --- | --- | --- |
| D07-01 | **Clients** | 使用中的 OAuth Client 類型、公開 Client ID 是否對應網站程式碼；授權 JavaScript origins 是否含實際正式網站 origin（需逐一對照 scheme／host／port，非整個 path） | **PENDING：無 Console 畫面** |
| D07-02 | **Branding** | 應用名稱是否與「墨忻刷題網／MoXin Quiz」一致；使用者支援信箱、首頁、隱私權政策 URL、授權網域是否實際有效；草稿與已發布品牌是否有差異 | **PENDING** |
| D07-03 | **Audience** | Internal／External、Testing／In production、測試使用者限制是否阻擋一般用戶；受監護 Google 帳戶可能另有限制 | **PENDING** |
| D07-04 | **Data Access** | 已登記的 scope 與真正程式請求是否一致；確認 `drive.appdata`，若有多餘 scope 要求另行查明用途（先不任意刪除） | **PENDING** |
| D07-05 | **Verification Center** | 品牌驗證／必要時 scope 驗證／發布準備狀態，以及 Google 是否要求後續動作；**不可單靠 `drive.appdata` 是非敏感就判為不需任何驗證** | **PENDING** |
| D07-06 | **正式網站／隱私頁** | 首頁是否公開、Privacy URL 是否可公開訪問、首頁是否連到同網域的隱私頁，與 Console 值吻合；是否仍有草稿告知與已發布告知不一致 | **PENDING：需網址與發布狀態比對** |
| D07-07 | **實機 OAuth** | 使用者同意畫面可見的應用名稱／權限文字、是否會出現未驗證警告、授權／拒絕／取消、進入本機模式不強制 OAuth | **PENDING** |

**官方驗證要求**：Google 可能要求首頁與隱私權政策可公開存取、首頁與政策位於同網域並正確連結，且授權網域依適用規則驗證所有權。[品牌／Scope 驗證準備](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)。GitHub Pages 的共用網域等情況須依 Google 對實際網域的規則檢查，不能單憑 GitHub 專案歸屬宣稱 Google 網域驗證已成功。

## C. 安全證據收集原則

- 可由負責人提供上述五個 Google Auth Platform 頁面的**必要部分畫面**，或依表格逐項文字回報；**請遮蔽 Google 帳戶個資、專案識別碼、完整 OAuth Client ID（如不必比對）、API 金鑰、client secret、token、回應內容、測試使用者 Email 等**。
- 實際比對完整 Client ID、URL 或 origin 時，在負責人私人管理介面進行即可；GitHub 文件僅記錄**相符／不符與已確認的公開網址**，不貼私人 Console 編輯連結或憑證。
- **只讀盤點**：未獲負責人特別批准，不變更 Audience（例如切換到正式發布）、不增刪 scope、不送出品牌驗證、不更新 OAuth Client、不變更正式法律政策或合併 main。
- 問題分流：品牌／隱私網址不符 → 先修改 B02 審稿草案和發布計畫；scope 不符／不預期之較廣權限 → 先停止公開宣稱資料最小化、另做權限評估；Testing 狀態 → 評估測試使用者限制與正式發布前置條件；身份／法律條款與提供者本名問題 → D-01／D-10 另行核准。

## D. D-07 Gate

- [x] 原始碼確認 GIS token client、設定 scope 為 `drive.appdata`、Drive API `appDataFolder`、帳號資料欄位及 token 記憶體保存。
- [x] 依 Google 官方文件確認 **`drive.appdata` 是 non-sensitive Drive scope**；沒有將它寫成受限制的完整 Drive 存取權。
- [ ] Google Auth Platform 的 Branding／Audience／Clients／Data Access／Verification Center 由負責人核對。
- [ ] 正式首頁與 Privacy URL／授權網域及 OAuth 使用者可見內容完成比對；D-01／D-10 法律審閱門檻仍獨立存在。
- [ ] 完成實機 OAuth 授權與取消測試，確認真實畫面、未驗證警告和帳號範圍；不得以靜態測試當實機證明。
- [ ] D-07 全項完成後仍不自動解除 LEG-020；須負責人核准正式法律版本及發布。

## E. 2026-10-14｜八張 Google Auth Platform 截圖審查（最新狀態）

> **此節為最新證據，取代上方原訂核對表尚無截圖的 PENDING 記錄。** 下方是產品負責人提供的 Console 截圖觀察，而非我們登入 Google 後台做獨立稽核；包含個人 Google 帳戶及遮罩憑證的原始截圖**不上傳公開 GitHub**。

| 核對區域 | 最新觀察與結果 |
| --- | --- |
| Branding | **PARTIAL**：應用程式名稱「墨忻刷題網」；首頁、隱私頁、服務條款均填入同一 GitHub Pages 網域，授權網域已登記；品牌驗證仍未完成，Logo 尚未上傳。OAuth 使用者支援信箱與已核准公開的網站備援 Gmail 不是同一個信箱；不一定是錯誤，待負責人確認是否刻意分流。私有支援地址不記錄在公開文件。 |
| Audience | **設定 PASS**：External／In production（實際運作中）；UI 顯示 OAuth 使用者 1／100。這只是當下 UI 指示，不應在未核實政策適用前宣稱非敏感權限永遠只有 100 人上限。 |
| Web OAuth Client | **配置 PASS**：Client ID 與 src/app/config.js 一致；JavaScript origins 包含正式 GitHub Pages HTTPS origin 與 localhost:4173，沒有 redirect URI，符合目前 Google GIS token client 用法。Console 有被遮罩的啟用中 Client secret；僅此**不代表秘密已外洩**，也不應將 secret 寫入前端。 |
| Data Access | **PASS**：非敏感範圍只有 drive.appdata；敏感範圍與受限制範圍均空白，與網站程式碼相符。 |
| Verification Center | **品牌待處理**：Branding 尚未驗證，Google 表示品牌尚未向使用者顯示；Data Access status 因未要求敏感或受限制 scope，表示**目前不需要資料存取權限驗證**。兩個驗證不是同一回事。 |
| Settings | **可見設定已核對**：兩個 OIDC 進階安全性相關開關未勾；此專案使用 Google OAuth token client，而不是以登入 Google 作為自建後端的驗證憑證。 |

**目前確認的阻擋項**：品牌驗證未完成；首頁／Privacy／Terms 真實對外可訪問性尚未透過非管理者瀏覽器核實，Google Search Console 網域所有權未證明；OAuth 同意畫面實機流程仍未驗收；OAuth 支援信箱是否刻意與網站備援信箱分離仍待產品負責人決定。正式頁面 Privacy 文字雖已記載 drive.appdata，但此事不等於 B02 待審稿法律政策已批准。

**Google 官方依據**：[Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049?hl=en) 區分 Branding verification 與 Data Access verification；品牌核准後如需要公開顯示經驗證的品牌，仍須執行 Publish branding。單獨看到 Audience In production 不等於品牌已驗證。

**安全規則**：不公開私人 Google 帳戶、完整 Console URL、Client secret、token、原始管理畫面；不替使用者切回 Testing、修改 scopes／client origins、送出品牌驗證或變更正式網站政策。全部先以 Draft PR 文書追蹤，LEG-020 仍未通過。
## F. 2026-10-14｜D-07 OAuth 使用者支援信箱分流已決議

**產品負責人明確決定：「維持目前獨立的信箱」。** Google Auth Platform Branding 的 **OAuth 使用者支援 Email 繼續沿用 Console 目前所選的獨立信箱**，不要求與墨忻刷題網的一般回報／備用 Gmail 相同。網站一般意見回報、題庫勘誤、隱私請求與其他非 OAuth 聯絡仍使用先前同意公開的 `moxin82771@gmail.com`（主要入口仍為 Google Forms）。

**判定：D-07 支援信箱配置決策 PASS（負責人授權保留現狀）**。不公開或複製 OAuth 獨立信箱實際地址到 GitHub、政策草案、網站或公用 issue，也不在 Google Console 變更帳號；本決策**不等於**已獨立測試該信箱的可收信性、處理時效、私人帳號防護或 Google 品牌驗證所需的其他條件。

**後續待辦**：有需要時由負責人自行確認 OAuth 獨立信箱能持續收到使用者支援信件，以及 Branding 顯示值仍正確；D-07 接續核查 GitHub Pages 首頁／Privacy／Terms URL 能否由未登入訪客存取、Google Search Console 網域所有權、實機 OAuth 同意畫面及品牌驗證／發布狀態。無須再要求統一兩信箱；仍不擅自送出品牌驗證或修改正式政策。
## G. 2026-10-14｜Google Search Console 資源清單截圖（尚無資源）

**負責人提供 Search Console 登入畫面截圖**，左上資源選單顯示「找不到相符資源」與「新增資源」；**在此登入帳號與畫面下未找到任何可驗證的 Search Console 資源**。因此 **D07-08：網域所有權確認 PENDING**，不能宣稱 GitHub Pages 已通過 Google Search Console 所有權驗證。這不表示網站已經驗證失敗、其他 Google 帳號也無資源或網站目前無法使用。

**安全優先的下一步**：在同一個對應 OAuth Cloud 專案的 Google 帳號，Search Console 選「新增資源」→「網址前置字元」，先填入 `https://moxin0u0.github.io/moxin-quiz-site/`（**含最後斜線**），讓 Google 顯示該網址前置字元資源的驗證方式。此為確認 GitHub Pages 專案路徑實際控制權的候選方式，**尚未完成驗證**。Google Search Console 官方說明 URL-prefix 可透過 HTML 標記或 HTML 檔案證明所有權；HTML 標記須出現在資源首頁 `<head>`，且要先正式部署成為訪客可見的原始碼，才可按 Verify。請勿使用無法控制的 `github.io` DNS 建立網域資源。參考：[新增資源](https://support.google.com/webmasters/answer/34592?hl=zh-Hant)、[驗證網站擁有權](https://support.google.com/webmasters/answer/9008080?hl=zh-Hant)。

**OAuth 驗證重要限制**：Google OAuth 品牌驗證要求確認**已授權網域（authorized domain）**的所有權，即 Google 文件稱的 top private domain；因此**就算 `/moxin-quiz-site/` 路徑層級的 URL-prefix 成功驗證，也不能直接宣稱整個 `moxin0u0.github.io` 授權網域已符合 OAuth 品牌驗證**。必須回到 OAuth Console 檢視驗證接受情況；若 Google 要求網域更高層級所有權而無法在 GitHub Pages 控制其根目錄，可能需評估可控自訂網域或其他經 Google 支援的方案，不能保證不需付費，也不應先動 DNS。參考：[Google OAuth 品牌驗證所需網域](https://developers.google.com/identity/verification/authentication-verification)。

**發布邊界**：此階段只完成資源類型選擇及查看驗證方式。若 Google 給 HTML meta tag 或檔案，正式驗證需要修改／部署網站頁面；**本次未取得使用者同意修改 main 或發布網站，因此不得擅自改動正式 `index.html`、部署 HTML 驗證檔、變更 DNS 或按品牌驗證**。可先在 B02 Draft PR 做具體部署計畫，等使用者另行授權。若 Search Console 要求驗證檔／標記，勿把帳號與私人主控台畫面貼到公開 Issue。

**尚待**：D07-08 Search Console 實際驗證、D07-06 對外 URL 可訪問性、D07-07 實機 OAuth 與品牌驗證／發布、D-01／D-10 法律發布審核。
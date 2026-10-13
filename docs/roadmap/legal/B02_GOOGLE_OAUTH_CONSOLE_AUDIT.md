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

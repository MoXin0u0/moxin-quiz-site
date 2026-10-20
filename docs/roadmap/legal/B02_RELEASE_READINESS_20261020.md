# B02｜正式發布前交接、風險分級與合併門檻（2026-10-20）

> **狀態：工程候選版 READY；法律／營運發布 Gate 尚未解除。**
> 本文件是 B02 發布決策快照，不是法律意見、Google 審核結果，也不代表新版政策已在正式站生效。

## 1. 可核對的 GitHub 基準

- Repo：`MoXin0u0/moxin-quiz-site`，正式分支 `main`。
- `main`：`a1eed741cb0ac43f03ba828da7da830a83d7378b`（PR #14 Search Console HTML 所有權驗證檔，已合併）。
- B02 PR #13：`improvement/b02-terms-privacy-rights @ 6e6a9662bba708245434533c28e22174ad38f6bf`（此查核時間點：Open、非 Draft、未合併；35 檔變更）。
- 最新完成的 [V5 Regression #39399414222](https://github.com/MoXin0u0/moxin-quiz-site/actions/runs/39399414222)：`Unit + release preflight`、`V5 browser + accessibility baseline` **均 PASS**。任何後續提交都必須重新以新 Head CI 判定。
- B02 候選 `privacy.html`／`terms.html`：版本 B02-1.0、最後更新日期 2026-10-20；`service-worker.js` 將 production 快取版由 `prod-1` 升為 `prod-2`。現行 `main` 仍是 2026-10-08 政策頁、`prod-1`。
- 2026-10-20 前後 Google Search Console URL-prefix 的成功結果來自**產品負責人的 Google Console 畫面**；與 Google OAuth 品牌驗證／其授權頂層網域所有權審查**不等同**。

## 2. 範圍已完成：技術與政策候選稿

| 子項 | 狀態 | 判斷依據／限制 |
| --- | --- | --- |
| 設定與同步中心之政策入口 | 候選版已實作且 CI PASS | 尚未正式部署 |
| 正式對外 `privacy.html`、`terms.html` | 候選稿已實作 | 不以工程 CI 代表法律核准 |
| 13 類 Google 同步 entity 告知 | 靜態原始碼對照完成 | 遠端歷史資料實機清理未驗證 |
| Forms 私密聯絡、Gmail 備援 | 負責人已通過桌面／手機匿名提交驗收 | 後台保存和人工刪除未完整實測 |
| PWA 法律頁快取刷新 | 快取代號已更新、CI PASS | 部署後跨裝置快取切換仍需實際觀察 |
| OAuth `drive.appdata` 非敏感範圍 | 源碼與產品負責人 Console 截圖相符 | 品牌驗證未完成 |

## 3. 合併前必須處理或正式界定的阻擋事項

| 優先 | 原始追蹤 | 未完成條件 | 下一個可驗證成果 |
| --- | --- | --- | --- |
| P0 | LEG-001／008／020（D-01／10） | 「墨忻（MoXin）」是經批准的公開署名；其是否滿足現況下適用的蒐集者識別／告知義務仍無法律核實。**絕不在公開 repo 放真實姓名、身分證件、私人帳戶資料**。 | 核對現行臺灣《個人資料保護法》第 8 條及適用例外，由具資格人士確認可行告知／識別方案；若需揭露其他個資，必須取得負責人對具體資料的另行同意。 |
| P0 | LEG-012／018／020（D-02） | Forms 一般案件結案後 1 年、Gmail 一般案件結案後 2 年、每 3 個月人工檢查的**管理政策已定**，但案件清冊已依負責人指示暫緩；結案日期識別、到期追蹤與人工刪除尚未完整驗證。 | 設計**不強迫採 Excel／Google Sheets**的等效實行辦法，使用無敏感資料的測試案件驗證；公開政策只能寫明實際能力，不得承諾自動刪除。 |
| P0 | LEG-003／016／020（D-05） | 現有公開 CERPS ERP 參考題型 441 原題號，repo 443 筆（2 筆重複）；來源已核對，但公開重製／轉為互動題庫的授權或法律依據未證實。 | 取得具體許可／有效合法依據，或另經負責人批准後採取對外內容停用、替換或最小化風險措施。**不自行刪除使用者作答紀錄或擅自下架**。 |
| P0 | LEG-015／020（D-08／09／10） | 正式版本公告、生效日期、更新通知、舊版政策取得方式及最終責任審稿紀錄尚未簽核。 | 核對政策候選版日期和發布日，建立可操作的版本／重大更新告知流程，記錄核准結論。不要將 OAuth 授權視為法律條款的概括接受。 |

上述項目中，CERPS 權利疑義原本已存在於正式網站；它不一定要求與純文字透明度改善同一個 PR 解決，但**不能將 B02 整批標成法律 Gate PASS**。若要先發布範圍較小的「更準確的資訊告知」，須明確說明這是有限發布、不宣稱整體合規，也應個別完成政策真實性與適用法律評估。

### 獨立追蹤，不得混用驗證結果

- Google Auth Platform：External／In production、非敏感 `drive.appdata` scope 已對照；品牌仍未驗證，且 `moxin0u0.github.io` 作為共用託管網域的所有權／Domain property 風險待 Google 實際審核。Search Console 的 `/moxin-quiz-site/` URL-prefix PASS 不表示頂層授權網域或 Branding PASS。**不自動變更 OAuth scope、網域、計費設定**。
- D-06 完整 `appDataFolder` 一鍵刪除功能已明確暫緩；不能把「解除連結」或「取消授權」說成已刪除遠端所有資料。
- B03～B09 不因技術 CI 綠燈而提前啟動；保留 IndexedDB v4、雲端資料格式與既有使用者資料相容性。

## 4. 發布執行條件與回滾

1. 完成 P0 的事實核實、可履行方案與必要法律判斷；在未取得證據前持續保持「未結案」，不得僅因使用者授權推進工作便自動勾選 PASS。
2. 保證 `privacy.html`、`terms.html`、首頁、設定／雲端入口、Google OAuth Console 公開 URL 和實際資料存取一致；任何改版都需要重跑最新 Head 的兩項 required CI。
3. 更新 PR 描述、Issue #12 的最新狀態；明確區分「法律候選稿／技術驗收」與「政策正式生效」。
4. 如獲發布前置條件全數滿足，依既有負責人授權、GitHub 保護規則及 expected Head SHA 合併 PR；之後核對 main 版本、Pages 上線、政策入口、深淺色／手機、PWA 更新；如失敗，以不更動用戶資料的方式回滾本批介面／政策變更。
5. 只有完成正式上線查核才能將 B02 標記已發布；OAuth Brand Verify／Publish Branding 是**獨立步驟**，須以 Google Console 的實際結果驗收，不得自行宣告通過。

## 5. 官方核對資料（不代表法律審查意見）

- [臺灣《個人資料保護法》法規與第 8 條告知要求](https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=I0050021)（注意法規條文之施行狀態）。
- [Google OAuth 品牌驗證與授權網域要求](https://developers.google.com/identity/verification/authentication-verification)。
- [Google OAuth 品牌驗證說明](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)。
- [CERPS 官方來源與權利風險](./B02_CONTENT_RIGHTS_AND_SHARING.md)。
- [B02 詳細決策與 LEG-001～020 Gate](./B02_DECISIONS_AND_RELEASE_GATE.md)。

**本次交接與文件更新不會修改 `main`、公開法律頁、Google Forms 真實回覆或 Google Auth Platform 設定。**

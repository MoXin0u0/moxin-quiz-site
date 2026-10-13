import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderSettings } from '../src/ui/settings.js';
import { renderCloudSettingsCard, renderSyncCenter } from '../src/ui/sync-center.js';
import { APP_CONFIG } from '../src/app/config.js';

const read = name => fs.readFileSync(name, 'utf8');
const settingsRoot = { innerHTML: '' };
const baseSettings = {
  theme: 'system',
  fontScale: 'normal',
  optionSpacing: 'normal',
  reduceMotion: false,
  learningStyle: 'academy',
  sceneIntensity: 'full',
  studioTypeSwitchConfirm: true,
};
const sync = {
  syncUiEnabled: true,
  cloudConfigured: true,
  cloudRuntimeEnabled: true,
  connected: false,
  presentation: { tone: 'neutral', label: '僅此裝置' },
};

renderSettings(settingsRoot, {
  settings: baseSettings,
  storage: { counts: {}, estimate: null },
  checks: [],
  pwa: {},
  sync,
});

const settingsHTML = settingsRoot.innerHTML;
assert.match(settingsHTML, /href="\.\/privacy\.html"/);
assert.match(settingsHTML, /href="\.\/terms\.html"/);
assert.match(settingsHTML, /data-legal-data-controls/);
assert.match(settingsHTML, /解除此裝置連結/);
assert.match(settingsHTML, /撤銷 Google 存取權/);
assert.match(settingsHTML, /清除瀏覽器網站資料/);
assert.match(settingsHTML, /Google 雲端同步資料/);
assert.match(settingsHTML, /不等於刪除/);
assert.match(settingsHTML, /rel="noopener noreferrer"/);
assert.match(settingsHTML, /Google 官方第三方授權管理說明/);

// User-supplied feedback respondent link must be visible without requiring OAuth.
const feedbackUrl = 'https://forms.gle/3Vhia7MFyvzyV6s2A';
const landingHTML = read('index.html');
assert.match(settingsHTML, /data-feedback-card/);
assert.match(settingsHTML, /data-open-feedback-form/);
assert.match(settingsHTML, /透過 Google Forms 處理/);
assert.match(settingsHTML, /未成年使用者如需提供聯絡資訊/);
assert.ok(settingsHTML.includes(`href="${feedbackUrl}"`));
assert.match(landingHTML, /id="contact"/);
assert.match(landingHTML, /href="#contact"/);
assert.match(landingHTML, /data-feedback-link/);
assert.match(landingHTML, /data-feedback-footer-link/);
assert.match(landingHTML, /回報表單由 Google Forms 提供/);
assert.match(landingHTML, /未成年使用者如需提供聯絡資訊/);
assert.match(landingHTML, /開發者：墨忻（MoXin）/);
assert.match(settingsHTML, /個人開發者墨忻（MoXin）/);
assert.match(read('docs/roadmap/legal/B02_TERMS_DRAFT.md'), /公開開發者署名為「墨忻（MoXin）」/);
assert.match(read('docs/roadmap/legal/B02_PRIVACY_DRAFT.md'), /公開署名「墨忻（MoXin）」/);
assert.equal(Array.from(landingHTML.matchAll(/href="https:\/\/forms\.gle\/3Vhia7MFyvzyV6s2A"/g)).length, 2);
assert.equal(Array.from(settingsHTML.matchAll(/href="https:\/\/forms\.gle\/3Vhia7MFyvzyV6s2A"/g)).length, 1);
assert.match(landingHTML, /href="mailto:moxin82771@gmail\.com" data-contact-email/);
assert.match(landingHTML, /href="mailto:moxin82771@gmail\.com" data-feedback-email-footer/);
assert.match(settingsHTML, /href="mailto:moxin82771@gmail\.com" data-feedback-email/);
assert.match(landingHTML + settingsHTML, /moxin82771@gmail.com/);
assert.match(read('docs/roadmap/legal/B02_TERMS_DRAFT.md'), /moxin82771@gmail.com/);
assert.match(read('docs/roadmap/legal/B02_PRIVACY_DRAFT.md'), /moxin82771@gmail.com/);
assert.match(read('docs/roadmap/legal/B02_GOOGLE_FORMS_INTAKE_SPEC.md'), /歷史免登入填寫測試紀錄（2026-10-10）/);
assert.match(read('docs/roadmap/legal/B02_DECISIONS_AND_RELEASE_GATE.md'), /無痕視窗未登入可提交/);


const cloudHTML = renderCloudSettingsCard(sync);
assert.match(cloudHTML, /data-cloud-link-disclosure/);
assert.match(cloudHTML, /Drive appDataFolder/);
assert.match(cloudHTML, /href="\.\/privacy\.html"/);

const modalRoot = { innerHTML: '' };
renderSyncCenter(modalRoot, sync);
assert.match(modalRoot.innerHTML, /data-sync-privacy-notice/);
assert.match(modalRoot.innerHTML, /Google 授權不等於本站服務條款的接受/);
assert.match(modalRoot.innerHTML, /未成年使用者需符合 Google 帳戶年齡與家長監護規定/);
assert.match(modalRoot.innerHTML, /href="\.\/terms\.html"/);
assert.match(modalRoot.innerHTML, /href="\.\/privacy\.html"/);

// The same disclosure must remain available to linked users without changing their actions.
const linkedRoot = { innerHTML: '' };
renderSyncCenter(linkedRoot, {
  ...sync,
  connected: true,
  account: { displayName: 'Mock Account', displayEmail: 'mock@example.invalid' },
});
assert.match(linkedRoot.innerHTML, /data-unlink-cloud/);
assert.match(linkedRoot.innerHTML, /data-switch-cloud-account/);
assert.match(linkedRoot.innerHTML, /data-sync-privacy-notice/);

for (const file of ['index.html', 'terms.html', 'privacy.html']) {
  const html = read(file);
  assert.match(html, /href="\.\/app\.html"/, `${file} should link to app`);
}
assert.match(read('index.html'), /href="\.\/privacy\.html"/);
assert.match(read('index.html'), /href="\.\/terms\.html"/);

// Fee language must describe the current free offering without promising perpetual free access.
const draftTerms = read('docs/roadmap/legal/B02_TERMS_DRAFT.md');
const releaseGate = read('docs/roadmap/legal/B02_DECISIONS_AND_RELEASE_GATE.md');
assert.match(draftTerms, /目前墨忻刷題網完全免費/);
assert.match(draftTerms, /不代表承諾永久免費/);
assert.match(releaseGate, /D-03 已確認目前完全免費|D-03（2026-10-10）/);

// Region decision: Taiwan is the primary audience, not an implicit overseas access ban.
assert.match(draftTerms, /臺灣使用者為主要服務對象/);
assert.match(read('docs/roadmap/legal/B02_PRIVACY_DRAFT.md'), /臺灣使用者為主要對象/);
assert.match(releaseGate, /決策紀錄 D-04/);
assert.match(draftTerms, /未成年人／兒童/);
assert.match(draftTerms, /全年齡/);
assert.match(draftTerms, /本機練習不設 18 歲/);
assert.match(draftTerms, /Family Link/);
assert.match(read('docs/roadmap/legal/B02_PRIVACY_DRAFT.md'), /全年齡適用/);
assert.match(read('docs/roadmap/legal/B02_PRIVACY_DRAFT.md'), /不以年齡辨識為由蒐集生日/);
assert.match(releaseGate, /決策紀錄 D-04 年齡補充/);
assert.match(releaseGate, /受監護帳號/);

// D-05: private import permission does not grant unrestricted public redistribution.
assert.match(draftTerms, /允許使用者將第三方題庫/);
assert.match(draftTerms, /公開下載/);
assert.match(draftTerms, /已有必要授權/);
assert.match(draftTerms, /第 9 條/);
assert.match(releaseGate, /決策紀錄 D-05/);
assert.match(read('docs/roadmap/legal/B02_CONTENT_RIGHTS_AND_SHARING.md'), /私人使用與公開分享的界線/);
assert.match(read('docs/roadmap/legal/B02_CONTENT_RIGHTS_AND_SHARING.md'), /既有作者題庫的來源初步盤點/);
assert.match(read('docs/roadmap/legal/B02_CONTENT_RIGHTS_AND_SHARING.md'), /已取得 ERP 官方 PDF 原始出處/);
assert.match(read('docs/roadmap/legal/B02_CONTENT_RIGHTS_AND_SHARING.md'), /Q206_2/);
assert.match(read('docs/roadmap/legal/B02_CONTENT_RIGHTS_AND_SHARING.md'), /Q411_2/);
assert.match(read('docs/roadmap/legal/B02_CONTENT_RIGHTS_AND_SHARING.md'), /公開再利用權限尚未核准/);
assert.match(releaseGate, /來源已確認、授權未確認/);
assert.match(read('docs/roadmap/legal/B02_CONTENT_RIGHTS_AND_SHARING.md'), /legacySource/);
assert.match(draftTerms, /官方考試題目及網路資料整理/);
assert.match(draftTerms, /不代表每題均為原創/);
assert.match(read('docs/roadmap/legal/B02_CONTENT_RIGHTS_AND_SHARING.md'), /LEG-020/);

// D-06: cloud full deletion is deferred, without misrepresenting user rights or implemented APIs.
assert.match(releaseGate, /決策紀錄 D-06/);
assert.match(releaseGate, /暫緩/);
assert.match(draftTerms, /暫緩此專用功能/);
assert.match(draftTerms, /不能保證代刪私人 appDataFolder/);
assert.match(read('docs/roadmap/legal/B02_PRIVACY_DRAFT.md'), /暫緩的是全量刪除的產品功能/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /不是規劃立即開發該功能/);

// D-02: owner-attested access is not an independently verified Google Forms permission audit.
const intakeSpec = read('docs/roadmap/legal/B02_GOOGLE_FORMS_INTAKE_SPEC.md');
// Owner accepts the Forms UI/configuration phase; retention/delete implementation is still an independent release blocker.
assert.match(intakeSpec, /Google Forms 設定階段總結與轉序/);
assert.match(intakeSpec, /負責人接受的表單功能／設定階段結束/);
assert.match(releaseGate, /LEG-012／018／020 整體 Gate 繼續未通過/);
// D-07 code facts must not be misrepresented as independent Cloud Console review.
const d07Audit = read('docs/roadmap/legal/B02_GOOGLE_OAUTH_CONSOLE_AUDIT.md');
assert.match(d07Audit, /Google Cloud Console 實際設定、品牌驗證與正式發布狀態尚未查核/);
assert.match(d07Audit, /drive.appdata.*非敏感/);
assert.match(d07Audit, /include_granted_scopes: true/);
assert.match(d07Audit, /Branding、Audience、Clients、Data Access、Verification Center/);
assert.match(d07Audit, /只讀盤點/);
assert.match(d07Audit, /八張 Google Auth Platform 截圖審查/);
assert.match(d07Audit, /目前不需要資料存取權限驗證/);
assert.match(d07Audit, /品牌驗證仍未完成/);
assert.match(d07Audit, /支援信箱與已核准公開的網站備援 Gmail 不是同一個信箱/);
assert.match(d07Audit, /維持目前獨立的信箱/);
assert.match(d07Audit, /支援信箱配置決策 PASS/);
assert.match(d07Audit, /Google Search Console 資源清單截圖（尚無資源）/);
assert.match(d07Audit, /D07-08：網域所有權確認 PENDING/);
assert.match(d07Audit, /不能直接宣稱整個/);
assert.match(releaseGate, /D-07 Search Console 尚無可確認資源/);
assert.match(d07Audit, /不等於.*已獨立測試該信箱的可收信性/);
assert.match(releaseGate, /D-07 聯絡配置決策 PASS/);

assert.match(releaseGate, /D-07 八張 Console 實際截圖核對結果/);
assert.match(releaseGate, /D-07 Google Auth Platform 稽核啟動/);

const draftPrivacy = read('docs/roadmap/legal/B02_PRIVACY_DRAFT.md');
assert.match(draftPrivacy, /原先的信箱不一致屬刻意分工/);
assert.match(intakeSpec, /只有個人開發者本人查看、管理/);
assert.match(intakeSpec, /尚未經我們直接檢查 Google Forms 後台/);
assert.match(intakeSpec, /Google Sheets/);
assert.match(draftPrivacy, /開發者本人一人/);
assert.match(draftPrivacy, /此非我們獨立取得 Google 管理端權限清單/);
assert.match(releaseGate, /單人存取/);

// Forms responses currently have no owner-reported linked Google Sheets, but are still held by Google Forms.
assert.match(intakeSpec, /目前沒有連結 Google Sheets/);
assert.match(intakeSpec, /尚未進行後台獨立驗證/);
assert.match(intakeSpec, /不代表 Google Forms 不保存回覆/);
assert.match(draftPrivacy, /沒有將 Google Forms 回覆連結 Google Sheets 試算表/);
assert.match(releaseGate, /未連結 Google Sheets/);

// D-02 (2026-10-13): owner-provided Forms UI screenshots show results summary OFF; this is not an independent backend audit.
assert.match(intakeSpec, /查看結果摘要：關閉/);
assert.match(intakeSpec, /截圖已確認/);
assert.match(intakeSpec, /共用」與「發布選項/);
assert.match(intakeSpec, /僅顯示表單擁有者本人/);
assert.match(intakeSpec, /未顯示其他共同編輯者/);
assert.match(intakeSpec, /編輯者檢視權限/);
assert.match(intakeSpec, /接受回應：開啟/);
assert.match(releaseGate, /編輯者一般存取權為「限制」/);
assert.match(draftPrivacy, /沒有其他共同編輯者/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /作答者知道連結即可存取/);
assert.match(intakeSpec, /實際 Google 帳戶／Forms 權限獨立核對/);

// D-02: the 2026-10-13 owner-provided question screenshots found a blocking upload field;
// documentation must not silently keep the older anonymous-submission PASS as a current gate.
assert.match(intakeSpec, /發生頁面」為檔案上傳題型/);
assert.match(intakeSpec, /表單說明空白/);
assert.match(intakeSpec, /修正後桌面端無痕匿名填答 PASS/);
assert.match(intakeSpec, /不需登入 Google、電子郵件選填且成功送出/);
assert.match(intakeSpec, /手機端無痕匿名填答三項 PASS/);
assert.match(intakeSpec, /其他手機版面／瀏覽器情境/);
assert.match(intakeSpec, /① 不需登入 Google；② 電子郵件留空仍成功提交；③ 無法查看其他填答者的回覆/);
assert.match(releaseGate, /手機端無痕匿名填答 PASS（負責人實測）/);
assert.match(draftPrivacy, /手機端手動測試回報，三項 PASS/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /手機端無痕匿名填答 PASS/);
assert.match(intakeSpec, /桌面匿名提交子項 PASS，但 LEG-012 與 LEG-020 整體仍未通過/);
assert.match(releaseGate, /修正後桌面無痕匿名提交複驗/);
assert.match(draftPrivacy, /桌面匿名填答三項/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /修正後桌面無痕免登入填答三項/);
// Screenshot-verified remediation is distinct from unverified historical uploads and a new anonymous submission.
assert.match(intakeSpec, /題型／告知兩項截圖修正（2026-10-13）/);
assert.match(intakeSpec, /類別整理後續截圖驗收/);
assert.match(intakeSpec, /儲存中/);
assert.match(intakeSpec, /著作權或授權／安全／其他/);
assert.match(releaseGate, /類別清理再確認/);
assert.match(draftPrivacy, /問題分類修正截圖/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /分類重疊已由後續編輯截圖更正/);
assert.match(intakeSpec, /題型下拉已顯示/);
assert.match(intakeSpec, /舊附件資料夾與已存資料/);
assert.match(intakeSpec, /歷史檔案上傳資料夾檢查/);
assert.match(intakeSpec, /負責人明確確認：「詳細說明」欄位目前為必填/);
assert.match(releaseGate, /詳細說明必填狀態/);
assert.match(draftPrivacy, /PASS（負責人確認）/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /負責人明確確認：「詳細說明」欄位目前為必填/);
assert.match(releaseGate, /檢查當下資料夾內沒有檔案/);
assert.match(draftPrivacy, /不表示從未上傳檔案/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /原 Google Forms 檔案上傳題型/);
assert.match(releaseGate, /同日後續截圖修正確認/);
assert.match(releaseGate, /法律發布仍 BLOCKED/);
assert.match(draftPrivacy, /2026-10-13 後續修正截圖驗收/);
assert.match(draftPrivacy, /修改後表單無須登入/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /頂端已補用途/);
assert.match(intakeSpec, /既存附件資料夾|舊附件資料夾|附件資料夾/);
assert.match(releaseGate, /題型更正為簡答選填、頂端告知已補/);
assert.match(draftPrivacy, /Google Forms 修正後桌面與手機三項匿名提交均已由負責人確認 PASS/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /後續同日截圖已確認該題改為簡答選填/);
assert.match(releaseGate, /設定 → 簡報/);
assert.match(draftPrivacy, /查看結果摘要：關閉/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /查看結果摘要關閉/);
assert.match(draftPrivacy, /沒有其他共同編輯者/);

assert.match(draftPrivacy, /案件處理完成日起保留 1 年/);
assert.match(intakeSpec, /案件處理完成後保留 1 年/);
assert.match(releaseGate, /一般 Google Forms 回覆結案後保留 1 年/);
const gmailSop = read('docs/roadmap/legal/B02_GMAIL_RETENTION_SOP.md');
// D-02 (2026-10-13): quarterly owner-approved Forms reviews are distinct from one-year expiry and actual deletion execution.
const formsSop = read('docs/roadmap/legal/B02_GOOGLE_FORMS_RETENTION_SOP.md');
assert.match(formsSop, /手機端無痕匿名填答三項已由負責人確認 PASS/);
assert.match(formsSop, /每 3 個月人工檢查/);
assert.match(formsSop, /結案後保留 1 年/);
assert.match(formsSop, /不是將結案後一年的保存期限自動延長三個月/);
assert.match(formsSop, /回覆.*個別/);
assert.match(formsSop, /不刪任何真實使用者回覆/);
assert.match(formsSop, /沒有自動刪除/);
assert.match(formsSop, /沒有連結 Google Sheets/);
assert.match(formsSop, /個別回覆介面查看：負責人已回報完成/);
assert.match(formsSop, /不將本回報寫成「單筆刪除 PASS」/);
assert.match(formsSop, /非公開的最小化案件清冊儲存方式/);
assert.match(formsSop, /案件清冊建立暫緩/);
assert.match(formsSop, /暫緩，不是取消既有資料保存/);
assert.match(formsSop, /不能證明或對外保證能可靠地按期限完成清理/);
assert.match(releaseGate, /2026-10-13 D-02 工作項目暫緩/);
assert.match(intakeSpec, /人工保存與清理決策（2026-10-13 已同意）/);
assert.match(releaseGate, /每 3 個月人工檢查到期回覆/);
assert.match(draftPrivacy, /每 3 個月人工檢查/);
assert.match(draftTerms, /兩者均每 3 個月人工檢查/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /Forms 與 Gmail 均已決議每 3 個月人工檢查/);
assert.match(gmailSop, /跨管道對照（2026-10-13 補充）/);

assert.match(draftPrivacy, /Gmail 備援信件一般案件自結案後保留 2 年/);
assert.match(draftPrivacy, /每 3 個月人工檢查到期案件/);
assert.match(releaseGate, /Gmail 一般案件結案後保留 2 年/);
assert.match(intakeSpec, /Gmail 備援一般案件另採結案後 2 年/);
assert.match(gmailSop, /結案後保留 2 年/);
assert.match(gmailSop, /每 3 個月人工檢查/);
assert.match(gmailSop, /沒有自動刪除/);
assert.match(draftTerms, /備用 Gmail 一般案件於結案後保留 2 年/);
assert.doesNotMatch(draftPrivacy, /Gmail 保存期限尚未決定|Gmail 備援信件的保存與刪除期限尚未決議/);
assert.match(read('docs/roadmap/legal/B02_DATA_FLOW_AND_RIGHTS.md'), /Gmail 的墨忻刷題網一般聯絡案件：結案後 2 年/);

// Drafts must not be silently copied into public policy pages without approval.
assert.match(read('docs/roadmap/legal/B02_TERMS_DRAFT.md'), /尚未生效/);
assert.match(read('docs/roadmap/legal/B02_PRIVACY_DRAFT.md'), /未生效/);
assert.match(read('docs/roadmap/legal/B02_DECISIONS_AND_RELEASE_GATE.md'), /LEG-020/);
for (const file of ['terms.html','privacy.html']) {
  assert.match(read(file), /最後更新：2026-10-08/);
  assert.doesNotMatch(read(file), /【待確認】|B02.*待審稿草案/);
}

// The whole B02 does not alter the Local-first identity or expand the Google OAuth scope.
assert.equal(APP_CONFIG.dbVersion, 4);
assert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');
assert.equal(APP_CONFIG.cloud.googleDriveScope, 'https://www.googleapis.com/auth/drive.appdata');
assert.equal(APP_CONFIG.features.cloudSync, true);
console.log('B02 policy links, user control guidance, draft boundary and Local-first contracts PASS.');

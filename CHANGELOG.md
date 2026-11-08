# 墨忻刷題網｜版本更新紀錄（CHANGELOG）

> 這是**唯一持續維護的版本更新紀錄檔**。產品版本、已正式合併的功能批次、安全性修正與重要相容性變更，都集中追加於此。
> 最後核對：2026-11-08（臺灣時間）；資料依據為 GitHub `main`、已合併 PR 與 GitHub Actions。
> **網站對外應用程式版本仍為 v5.0.0**；B00～B09 是「V5 上線後改善批次」，並不是 v5.1／v5.2 等正式版本號。Service Worker 的 `prod-4`～`prod-7` 是快取版本，不等於產品主版本。

## 維護方式（自本次整理起適用）

- **同一份檔案持續更新**：依正式發佈日期倒序，把功能新增、問題修正、安全改進、資料相容性及必要使用者提醒記在本檔。
- **不因每一步工作另開進度 Markdown／文字檔**。開發中細節、當次 CI 與 Review 以 Git commit、PR、Issue 為準；一個批次完成並發布時再更新本檔，不將每次重跑測試寫成新版本。
- **發布和開發分開**：未合併的功能只能列在「待處理」，不得寫成已上線；確認 PR 合併、GitHub Pages 部署和必要回歸測試後才標記「已發布」。
- 規格、資料格式、安全及法律判斷等**確實需要長期參照**的內容仍可保留獨立技術文件，但它們不是另一份版本更新日誌；既有歷史不刪除其 Git commit 與 PR 追溯。
- 更新時**修改此檔原有章節**，不要再建立 `CHANGELOG_Bxx.md`、`UPDATE_STEP_xx.md` 或「每次操作一檔」的紀錄。公開首頁的簡短版本介紹只需摘錄此檔，不再平行維護另一套完整歷史。

## 目前正式站摘要（2026-11-08）

- **產品版本**：v5.0.0（Local-first / Offline-ready / Google Drive 選用同步）。
- **已正式部署**：B00、B01、B02-Lite、B03、B04-01、B04-02，以及僅測試層的 IndexedDB 清理競態修補。
- **最新正式主分支基準**：[`8d2c12fc`](https://github.com/MoXin0u0/moxin-quiz-site/commit/8d2c12fc81ca5f941bfa8bd5dc50efe2a288cff5)，PWA App Shell `prod-7`。
- **最新主分支自動化驗證**：[GitHub Pages 部署 SUCCESS](https://github.com/MoXin0u0/moxin-quiz-site/actions/runs/42461393408)；[V5 完整 Regression SUCCESS](https://github.com/MoXin0u0/moxin-quiz-site/actions/runs/42461393708)。
- **尚未宣稱完成的事項**：Android/iOS 真實軟體鍵盤、下載與不同裝置的實機驗收；CERPS 題庫再利用權利及個資蒐集者識別充分性仍獨立追蹤。自動化 CI 綠燈不能替代這些查核。
- V5 原始開發分支的 B00～B13 與**上線後** B00～B09 是**兩套不同的階段編碼**；不要混同。完整技術歷史參考 [V5 實作紀錄](docs/v5-implementation-status.md)，下一批工作看 [V5 後續索引](docs/roadmap/README.md)。

## v5.0.0｜正式發布後更新（同一產品版本，依日期倒序）

### 2026-11-08｜B04-02：三主題配色可讀性與正式回歸修復

- **已發布** [PR #24](https://github.com/MoXin0u0/moxin-quiz-site/pull/24)：改善「經典學院／史詩幻想／純粹專注」的明暗模式警示卡文字、經典學院深色頁面強調色、學習標籤、考試步驟數字與圖示的可讀性。
- Chromium 覆蓋 **3 種風格 × 2 種明暗模式 × 2 種螢幕尺寸**，共 12 組代表性配色測試；測試代表性背景，**不是所有真實裝置逐像素視覺驗收**。
- PWA App Shell 遞增為 `prod-7`；B04-01 原有彈窗和動畫改善保留。
- **已發布** [PR #25](https://github.com/MoXin0u0/moxin-quiz-site/pull/25)：僅修正 V5 瀏覽器測試刪除 IndexedDB 時對暫時 `blocked` 事件過早判錯的問題，保留 10 秒逾時保護。**沒有修改**實際 IndexedDB、Google 同步程式、使用者資料或快取版本。
- 最終 `main` 版本 `8d2c12fc` 的 Pages 和完整 V5 Regression **均為 SUCCESS**，以本節上方連結為準。

### 2026-11-08｜B04-01：減少動畫與手機輸入彈窗

- **已發布** [PR #22](https://github.com/MoXin0u0/moxin-quiz-site/pull/22)：修正「減少動畫」CSS 語法；改善彈窗隨手機虛擬鍵盤的可視區域調整與捲動。
- 單行輸入支援 Enter 確認；多行內容支援 Ctrl／Command + Enter 確認，普通 Enter 保留換行；中文輸入法組字期間避免誤提交。
- 當批快取由 `prod-5` 增至 `prod-6`，其後已由 B04-02 更新為 `prod-7`。
- 依產品決策**取消獨立無障礙介面改造專項**；保留既有基本文字可讀性、鍵盤操作與自動化防退化測試。

### 2026-11-06｜B02-Lite：精簡條款、隱私與私密聯絡

- **已發布** [PR #20](https://github.com/MoXin0u0/moxin-quiz-site/pull/20)：隱私權政策與服務條款新增白話摘要，說明本機資料、Google Drive `drive.appdata` 選用同步、解除連結與刪除不同、資料備份及使用者權利。
- 沿用已驗收的 Google Forms 匿名回報與備用 Gmail，不要求全站登入或強制同意視窗，也不新增客服後端。
- 保留 2026-10-08 版法律頁歷史。當批 PWA `prod-5`。
- 原始候選 [PR #13](https://github.com/MoXin0u0/moxin-quiz-site/pull/13) 已由 #20 取代、關閉，避免重複合併。
- 重要界線：**免費與免責聲明不等於取得第三方題庫授權，也不代表已完成法律認證**；CERPS 著作權和資料蒐集者識別問題繼續以 Issue 獨立追蹤。

### 2026-11-06｜B03：學習操作與手機題庫工作室

- **已發布** [整合 PR #19](https://github.com/MoXin0u0/moxin-quiz-site/pull/19)，一次整合原 B03-01／02／03 三批功能，避免重複合併。
- B03-01：修正設定頁舊「v3 本機資料」和同步中心「V5 開發分支」等過時提示，讓一般使用者理解本機功能及雲端可用狀態。
- B03-02：學習大廳以「作者題庫／自行新增 → 題庫清單 → 開始練習」優先呈現，主視覺與儀表板移至次要位置，並修正部分深色標籤可讀性。
- B03-03：手機工作室提供題目列表、編輯、檢查、下載快捷導覽，切題後定位編輯區；區分草稿自動儲存、加入題庫與 ZIP／JSON 匯出。
- 整合 PWA `prod-4`；模擬手機、圖片、30 題長清單與完整瀏覽器回歸通過。真實手機系統鍵盤／下載仍需實機補驗。

### 2026-10-09｜B00～B01：V5 發布後安全基礎

- **B00 已合併** [PR #9](https://github.com/MoXin0u0/moxin-quiz-site/pull/9)：固定 V5 正式基準、後續批次索引、相容性與回滾條件，保留原本問題 ID。
- **B01 已合併** [PR #11](https://github.com/MoXin0u0/moxin-quiz-site/pull/11)：ZIP 解壓大小／路徑／CRC 等防護、惡意輸入測試、鎖版依賴與正式分支瀏覽器回歸流程。
- 此兩批是工程與安全改善，沒有更改既有題庫、學習紀錄或 Google 同步資料格式。

### 2026-10-09（GitHub 合併日期，臺灣時間）｜v5.0.0 正式主版本

- **已合併** [PR #7](https://github.com/MoXin0u0/moxin-quiz-site/pull/7)：在原 v4.1 上完成 Local-first、Offline-ready、**Google 登入／Google Drive appDataFolder 可選用同步**的正式 V5。
- 延續本機 IndexedDB、題庫、草稿、作答歷史和完整備份；新增可確認的首次同步／切換帳號流程、衝突處理、雲端物件與裝置狀態管理。
- 不登入仍可學習；Google 授權需使用者主動啟用，不因同步不可用而阻擋本機學習。
- V5 本體開發原有 B00～B13 詳細里程碑保存在 [歷史實作文件](docs/v5-implementation-status.md)，不把其每一筆測試提交改寫為獨立正式版本。

## 待處理（不是已發布更新）

- B04-03：補驗其他 Dialog 類型、短螢幕、手機橫向、真實系統鍵盤與檔案下載；依實際問題決定是否修補，追蹤 [Issue #23](https://github.com/MoXin0u0/moxin-quiz-site/issues/23)。
- B05：Academy／Epic 場景區分、Full 強度與高 DPI 畫質。
- B06：作者題庫 443 題的來源、答案／詳解審查；CERPS 再利用權利須另案處理。
- B07：程式架構、效能與長時間壓力測試。
- B08：可能採用的「墨境」品牌／Logo／更名相容性（尚非正式更名）。
- B09：最終跨裝置、跨瀏覽器與 PWA 整合驗收。

---

## v4.1｜公開首頁與學習入口
- 新增正式公開首頁，提供開始使用、功能介紹、使用流程、更新日誌與資料說明。
- 原 Learning Studio 入口移至 `app.html`。
- `v3.html` 與 `app.html` 維持 byte-identical，保留既有網址相容性。
- PWA start_url 改為 `./app.html`，安裝後直接進入學習大廳。
- Landing 不初始化 IndexedDB，降低首次瀏覽成本。
- Service Worker App Shell 同時快取 Landing + App。
- 新增 5 viewport × Light/Dark 真實 Chromium Landing audit。

## v4.0｜正式發布與開發里程碑（原歷史紀錄）

### v4.0 Production Cutover
- 公開版本由 v4.0 RC1 升為 v4.0 / appVersion 4.0.0 / production channel。
- APP cache 更新至 r2k.5-21。
- Production regression 取代 RC1-only release gates。
- 正式 PR 使用 Merge Commit，保留 merge SHA 作 rollback anchor。
- GitHub Pages source 切換／確認為 main + root。
- 公開網址完成 production smoke 並建立 v4.0.0 GitHub Release。

### RC1 — Main Cutover Rehearsal
- 驗證 main 為 release candidate 祖先，candidate 不得 behind main。
- 使用 temporary worktree + --no-ff merge 模擬正式 PR merge commit。
- 在 synthetic post-merge tree 重跑完整 npm run ci / v4 preflight。
- 對合併後 root、v3.html、manifest、service worker、legacy-v2.html 做 HTTP smoke。
- 使用 git revert -m 1 模擬非破壞性 rollback，並要求 rollback tree 等同 origin/main。
- 新增 durable cutover contract regression 與 git-state artifact。
- 記錄 Pages deployment source 與 main/root 正式部署要求。
- RC1 標記 Stable；下一步為 Production Cutover。

### RC1 — Release Metadata Cleanup
- 使用者可見版本由 v3.3 + v4 preview 整理為 v4.0 RC1。
- 更新 title、meta description、PWA manifest 與 README。
- APP_CONFIG 新增 appVersion=4.0.0-rc.1 / releaseChannel=rc1。
- package metadata 升級為 moxin-quiz-site-v4-rc1；npm preflight 改用 v4 release preflight。
- 保留 moxin-quiz-v3 IndexedDB、moxin.v3.settings 與 v3.html 作相容 namespace / entry，不做高風險重新命名。
- 新增 RC1 release metadata regression。
- APP cache 更新至 r2k.5-20。
- RC1 僅剩 Main Cutover Rehearsal。

### RC1 — Browser UX Audit
- 正式進入 v4.0 Release Readiness，不再新增功能主線。
- 新增真實 Chromium + Playwright 使用者流程 audit。
- 覆蓋 Empty / Returning / Heavy Library / Backup / Migration / Offline PWA。
- 建立 320×568 到 1920×1080 的 7 組 viewport matrix。
- 建立 Academy / Epic / Focus 與 Light / Dark / scene intensity 代表組合。
- 加入水平 overflow、主要區塊 viewport、runtime error、network error 與 axe-core accessibility gates。
- Browser audit screenshots / JSON / Markdown report 由 GitHub Actions artifact 保留。
- 第一輪 Browser Audit 修正 preview badge / active nav 對比、Home progressbar ARIA 與多個行動目標尺寸。
- Audit runner 改為單一 scenario 失敗不阻斷其餘 viewport / visual / migration / offline 測試。
- APP cache 更新至 r2k.5-19。

### P5 Final Audit — Stable
- 首頁 / 今日學習 / 學習統計完成跨頁資料口徑與 Empty State 回歸。
- 驗證 Home 今日目標直接共用 P3 engine；Home / Learning Hub Global 摘要不受 bank scope 汙染。
- 驗證 P3 unique-question 與 P5 attempt-count 的刻意差異，避免未來誤合併統計口徑。
- 驗證首頁 due / wrong、resume session、sprint、backup 與既有流程一致。
- Home Action 動態 note 改為統一 HTML escape，補強匯入題庫名稱的輸出安全。
- 加入 Desktop / Tablet / Mobile、theme token、offline APP_SHELL、release equality final gates。
- 新增 16 組 P5 cross-page audit regression。
- P5「統計與首頁」正式標記 Stable / Maintenance Only。
- APP cache 更新至 r2k.5-18。

### P5.2 — Home Actions
- 「我的題庫」Hero 下方新增今日概況，不新增新的主導覽層級。
- 顯示主要學習目標、全站 streak、今日碰觸題數與未完成 Practice Session。
- 新增今日複習、快速錯題、考前衝刺快捷入口；直接重用既有 P3/P4/Review 流程。
- Sessions repository 新增全站最新未完成 Practice Session 查詢，並排除已刪除題庫。
- 完整備份成功後記錄 lastFullBackupAt；首頁對從未備份與 >= 7 天未備份給出提醒。
- Backup metadata 僅存在 localStorage，不改動既有 Backup Format。
- 新增 Desktop / Tablet / Mobile RWD 與 P5.2 regression。
- APP cache 更新至 r2k.5-17。

### P5.1 — Statistics IA & UI
- 學習統計正式拆成「總覽 / 趨勢 / 弱點分析 / 題庫分析」第二層，不再使用超長單頁。
- Hero 維持 Global 總作答與整體正確率；scope 只影響深入分析，避免語意混淆。
- 趨勢頁支援 Global / Bank scope 與 7 / 30 日切換，顯示每日作答量與正確率。
- 弱點頁顯示弱點章節、樣本不足標記、題型正確率、章節正確率與資料品質提醒。
- 題庫分析保留既有熟練度卡片，但移到獨立頁籤。
- 新增 statsModel cache；切 Tab、期間或 scope 不重新查 IndexedDB。
- 新增 P5.1 Desktop / Tablet / Mobile RWD 與 regression。
- APP cache 更新至 r2k.5-16。

### P5 — Analytics Core
- 正式進入 v4.0 統計與首頁主線，先完成統計 Core，再接分層 UI。
- 新增 7 / 30 日作答趨勢與正確率。
- 新增題型正確率、章節正確率與弱點章節排序。
- 趨勢採 attempt 次數；與 P3 unique-question 每日目標語義明確分離。
- 題型 / 章節由 bankId + questionId 回查目前題目 metadata；刪題歷史不 silent drop。
- 弱點章節預設至少 3 次作答；樣本不足時回傳 provisional 結果。
- Global / Bank scope 共用同一套 Core；日期沿用 P3 localDateKey。
- 新增 16 組 regression；analytics engine 加入 APP_SHELL。
- APP cache 更新至 r2k.5-15。

### P4.2.1 — Learning Hub Refinement
- Hero 與總覽新增真正 Global 今日摘要，不再誤用目前 P3 題庫 scope。
- P3 目標卡仍保留自己的單題庫 / Global scope，並明確顯示目前目標範圍。
- Hub 內部 Tab 改用 cached model 重新 render，不再每次切頁都重查所有 IndexedDB 資料。
- 本機題庫超過 6 個時，P4 多題庫選擇新增名稱 / ID 搜尋。
- 手機版壓縮今日學習 Hero，讓第二層導覽更快進入 viewport。
- APP cache 更新至 r2k.5-14。

### P4.2 — Learning Hub IA Refactor
- 主導覽「今日複習」升級為「今日學習」，建立總覽 / 複習 / 學習目標 / 考前衝刺第二層。
- P3、P4、Review 不再垂直完整堆疊；總覽只保留今日決策資訊。
- P4 與 P3 scope 完全解耦，使用獨立 exam-sprint record。
- P4 新增 sprintBankIds 多題庫明確選擇；空選擇不再等同全部題庫。
- P4 新增 sprintDailyTarget；0 代表依剩餘題量與天數自動建議。
- P3 題庫範圍改成單一題庫優先、Global 明確標示「全部題庫（整體目標）」。
- 沒有既有 P3 設定時，預設第一個本機題庫，不自動使用 Global。
- 新增全站 UX Density Audit，P5 統計開始前先建立次層架構。
- APP cache 更新至 r2k.5-13。

### P4.1 — Exam Sprint UI & Session Integration
- 「今日複習」頁在 P3 學習目標後新增考前衝刺 Dashboard。
- 支援 Global / Bank scope 的考試名稱、日期與 sprintEnabled 設定。
- 顯示倒數、今日剩餘題數、六層題源、coverage gap 與建議每日題數。
- Global 今日清單依 bank 分組啟動；維持單題庫 Practice Session，避免跨題庫 assets 混用。
- Sprint Session 使用 mode=sprint 並保留 P4 priority 順序，不套用一般練習 shuffle。
- 今日已算入 P3 unique practice 的題目會從 P4 今日 selection pool 排除，避免重做後目標數字不前進。
- 新增 P4.1 regression 與 Desktop / Tablet / Mobile RWD。
- APP cache 更新至 r2k.5-12。

### P4 — Exam Sprint Core
- 正式進入 v4.0 考前衝刺主線；此 P4 與舊 v3 docs/P4_LEARNING.md 不同。
- 選題優先序固定為：目前錯題 → 不熟題 → 到期題 → 低熟練題 → 未作答 → 其他。
- 每題只進入最高優先 tier，一律以 bankId + permanent questionId 去重。
- dailyPracticeTarget 有設定時尊重使用者值；未設定時才依候選題數 / 剩餘學習日推導 fallback。
- 額外計算 recommendedDailyTarget / projectedCoverage / coverageGap，不偷偷提高使用者每日目標。
- 今日已完成一般 practice 會扣除，產生真正剩餘的 sprint queue。
- 支援 Global / Bank scope；Global 保留跨題庫 key，P4.1 再依 bank 分組啟動 Session。
- 新增 26 組 regression；P4 engine 加入 APP_SHELL。
- APP cache 更新至 r2k.5-11。

### P3.1.1 — Learning Goal Activity UX
- 未啟用有效 target 時，「今日整體進度」顯示「尚未設定」，近 7 日達成顯示「—」。
- 最近 7 日有作答日期改顯示「有學習」，並保留實際題數。
- 啟用有效 target 後才顯示百分比、達成 ✓ 與 X / 7。
- 僅調整 UI 呈現，不更動 P3 Core 統計規則。
- APP cache 更新至 r2k.5-10。

### P3.1 — Learning Goal UI
- 「今日複習」頁新增學習目標 Dashboard，不增加主導覽負擔。
- 可設定全部題庫或指定題庫的每日一般刷題 / 每日複習目標。
- 顯示今日整體進度、practice / review 個別進度、連續學習天數與最近 7 日達成狀況。
- Scope 採 global / bank:<bankId>，可同時保存多組目標。
- UI 只呈現 P3 Core 結果，不重複實作統計邏輯。
- 新增 Desktop / Tablet / Mobile RWD，並加入 P3.1 regression。
- APP cache 更新至 r2k.5-9。

### P3 — Learning Goal Progress Core
- 將 learningGoals 與 attempts 正式接成每日目標進度引擎。
- 一般練習 / 複習 / 模擬考採明確分類；exam 不灌入每日刷題或複習目標。
- 同題同日 retry 去重，避免答錯重做造成目標數字失真。
- 使用瀏覽器本機日界線，並加入 Asia/Taipei 跨 UTC regression。
- 新增最近 7 日達成狀況、全域 / 題庫 scope 與連續學習 streak。
- 最近 7 日以「目前 target」回看，規格明確記錄，不假裝有歷史 goal snapshot。
- attempts repository 新增 listAllAttempts()，P3 engine 加入 APP_SHELL。
- 新增 24 組 regression。

### P2C.1 — Import → Studio UI Integration
- ZIP / JSON / 資料夾檢查結果新增「在題庫工作室中開啟」。
- 檢查畫面顯示 P2C 的目標題庫 ID；同 ID 已存在時明確顯示安全 copy ID。
- 外部 package 建立 Studio Draft 後，自動導航並直接開啟該草稿。
- Schema warning 可進 Studio 修正；Schema error 仍阻止開啟。
- 原本「匯入到我的題庫 / 更新題庫」流程保持不變。
- 新增 P2C.1 UI regression，並更新 APP cache。

### P2C — Package → Studio Draft Core
- 新增 ZIP / JSON inspected package → Studio Draft 的正式轉換層。
- 重新執行 canonical validator，不信任過期 pkg.report。
- 外部 package 永遠建立未連結的工作草稿，不直接覆寫已安裝題庫。
- 題庫 ID 衝突時自動建立 -copy / -copy-2… 安全 ID。
- 保留 Question ID、圖片引用與 ZIP Blob assets。
- 新增 16 組 regression；P2C Core 加入 APP_SHELL。

### P2B.1.1 — Batch Preview Scroll Fix
- 批次貼題視窗改為固定可用高度的四列 Grid：標題、輸入區、可捲動預覽、底部操作列。
- 題目預覽區加入獨立垂直捲動，不再因多題內容超出視窗而看不到後續題目。
- 小高度螢幕會自動縮短原始文字輸入區，優先保留預覽空間。
- APP cache revision 更新，避免舊 CSS 持續被 Service Worker 使用。
- 加入 scrollbar / overscroll regression，避免後續樣式調整再次破壞捲動。

### P2B.1 — Studio Batch Import UI
- P2B Parser Core 接入題庫工作室。
- 工作室首頁與編輯器新增「批次貼題」入口。
- 提供 ready / review / unparsed 預覽。
- review 題目必須由使用者明確勾選後才加入草稿。
- 新草稿批次匯入會取代初始空白 starter question。
- 加入後仍使用既有 Question Draft Model 與 Inspector 驗證。
- 新增離線 App Shell 項目。
- 清理 repository root 的里程碑 README。

### P2B — Batch Question Parser Core
- 新增 `src/studio/batch-parser.js`。
- 支援常見題號、題型、答案、詳解、章節、標籤與難度。
- 不猜答案；資訊不足標示 review；原始文字保留。

### R2K.5.4 — True Epic World Separation
- Epic 與 Academy 使用完全不同的場景來源與世界結構。
- 8 張獨立 Epic source；Desktop / Mobile 共 16 張正式資產。
- 新增 provenance 與 Academy-vs-Epic 視覺差異 gate。

### R2K.5.3 — Epic Native Source Experiment
- 解決低解析來源放大的模糊問題。
- 後續發現仍沿用 Academy 世界結構，因此由 R2K.5.4 取代。

### R2K.5.2 / R2K.5.2.1
- 第一輪 Epic 高細節素材整合。
- 修正舊 milestone tests 固定 cache revision 的問題。

### R2K.5.1 — Academy Style Correction
- Academy 改為高細節古典學院場景。
- Desktop / Mobile 使用獨立 production assets。

### R2K.5 — Production Scene Assets
- 建立 production asset pipeline 與尺寸 / 資產品質 audit。

### R2K.4 — Responsive Scene Runtime
- Desktop / Mobile、focal point、高 DPI fallback。
- Save-Data / prefers-reduced-data。
- decode 後再交換場景，降低閃爍。

### R2K.3 / R2K.3.1 — High-Fidelity Scene Pipeline
- 場景資產退出 APP_SHELL，改用 Runtime Scene Cache。
- R2G / R2H regression contract 對齊新 cache 架構。


## v3 系列｜主要版本摘要

### v3.3｜題庫工具、匯出與舊版封存
- 完整將 v2 舊網站移入 `legacy-v2/`，舊網址保留相容入口；不把未確認最新的機車題庫重新發布為作者題庫。
- 完善正式 ZIP 匯出（題目與圖片，不包含個人學習紀錄）、Schema 2.0 題庫工具與 AI 製作提示。

### v3.2｜ERP 作者題庫格式遷移
- 加入將 ERP Legacy 題庫轉為原生 Schema v2 Package 的流程與 443 題驗證；舊檔保留供相容／回退，不清除使用者資料。

### v3.1｜作者題庫與自行新增分流
- 依來源分離作者題庫與使用者匯入的題庫；為既有無來源欄位的資料採保守相容轉換；支援加入、更新與本機保存，初始 ERP 題庫為 443 題。

> v3 之前的詳細開發規格與舊 v2 來源仍保留在 Git 歷史與 `docs/`、`legacy-v2/`；沒有足夠驗證資料的舊變更不補造日期、版本或驗收結果。

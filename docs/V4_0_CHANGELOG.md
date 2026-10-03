# 墨忻刷題網 v4.0 — Development Changelog

本檔集中保存 v4.0 開發里程碑摘要。根目錄只保留正式 `README.md`；一次性更新包說明不再累積在 repository root。

## P5.2 — Home Actions
- 「我的題庫」Hero 下方新增今日概況，不新增新的主導覽層級。
- 顯示主要學習目標、全站 streak、今日碰觸題數與未完成 Practice Session。
- 新增今日複習、快速錯題、考前衝刺快捷入口；直接重用既有 P3/P4/Review 流程。
- Sessions repository 新增全站最新未完成 Practice Session 查詢，並排除已刪除題庫。
- 完整備份成功後記錄 lastFullBackupAt；首頁對從未備份與 >= 7 天未備份給出提醒。
- Backup metadata 僅存在 localStorage，不改動既有 Backup Format。
- 新增 Desktop / Tablet / Mobile RWD 與 P5.2 regression。
- APP cache 更新至 r2k.5-17。

## P5.1 — Statistics IA & UI
- 學習統計正式拆成「總覽 / 趨勢 / 弱點分析 / 題庫分析」第二層，不再使用超長單頁。
- Hero 維持 Global 總作答與整體正確率；scope 只影響深入分析，避免語意混淆。
- 趨勢頁支援 Global / Bank scope 與 7 / 30 日切換，顯示每日作答量與正確率。
- 弱點頁顯示弱點章節、樣本不足標記、題型正確率、章節正確率與資料品質提醒。
- 題庫分析保留既有熟練度卡片，但移到獨立頁籤。
- 新增 statsModel cache；切 Tab、期間或 scope 不重新查 IndexedDB。
- 新增 P5.1 Desktop / Tablet / Mobile RWD 與 regression。
- APP cache 更新至 r2k.5-16。

## P5 — Analytics Core
- 正式進入 v4.0 統計與首頁主線，先完成統計 Core，再接分層 UI。
- 新增 7 / 30 日作答趨勢與正確率。
- 新增題型正確率、章節正確率與弱點章節排序。
- 趨勢採 attempt 次數；與 P3 unique-question 每日目標語義明確分離。
- 題型 / 章節由 bankId + questionId 回查目前題目 metadata；刪題歷史不 silent drop。
- 弱點章節預設至少 3 次作答；樣本不足時回傳 provisional 結果。
- Global / Bank scope 共用同一套 Core；日期沿用 P3 localDateKey。
- 新增 16 組 regression；analytics engine 加入 APP_SHELL。
- APP cache 更新至 r2k.5-15。

## P4.2.1 — Learning Hub Refinement
- Hero 與總覽新增真正 Global 今日摘要，不再誤用目前 P3 題庫 scope。
- P3 目標卡仍保留自己的單題庫 / Global scope，並明確顯示目前目標範圍。
- Hub 內部 Tab 改用 cached model 重新 render，不再每次切頁都重查所有 IndexedDB 資料。
- 本機題庫超過 6 個時，P4 多題庫選擇新增名稱 / ID 搜尋。
- 手機版壓縮今日學習 Hero，讓第二層導覽更快進入 viewport。
- APP cache 更新至 r2k.5-14。

## P4.2 — Learning Hub IA Refactor
- 主導覽「今日複習」升級為「今日學習」，建立總覽 / 複習 / 學習目標 / 考前衝刺第二層。
- P3、P4、Review 不再垂直完整堆疊；總覽只保留今日決策資訊。
- P4 與 P3 scope 完全解耦，使用獨立 exam-sprint record。
- P4 新增 sprintBankIds 多題庫明確選擇；空選擇不再等同全部題庫。
- P4 新增 sprintDailyTarget；0 代表依剩餘題量與天數自動建議。
- P3 題庫範圍改成單一題庫優先、Global 明確標示「全部題庫（整體目標）」。
- 沒有既有 P3 設定時，預設第一個本機題庫，不自動使用 Global。
- 新增全站 UX Density Audit，P5 統計開始前先建立次層架構。
- APP cache 更新至 r2k.5-13。

## P4.1 — Exam Sprint UI & Session Integration
- 「今日複習」頁在 P3 學習目標後新增考前衝刺 Dashboard。
- 支援 Global / Bank scope 的考試名稱、日期與 sprintEnabled 設定。
- 顯示倒數、今日剩餘題數、六層題源、coverage gap 與建議每日題數。
- Global 今日清單依 bank 分組啟動；維持單題庫 Practice Session，避免跨題庫 assets 混用。
- Sprint Session 使用 mode=sprint 並保留 P4 priority 順序，不套用一般練習 shuffle。
- 今日已算入 P3 unique practice 的題目會從 P4 今日 selection pool 排除，避免重做後目標數字不前進。
- 新增 P4.1 regression 與 Desktop / Tablet / Mobile RWD。
- APP cache 更新至 r2k.5-12。

## P4 — Exam Sprint Core
- 正式進入 v4.0 考前衝刺主線；此 P4 與舊 v3 docs/P4_LEARNING.md 不同。
- 選題優先序固定為：目前錯題 → 不熟題 → 到期題 → 低熟練題 → 未作答 → 其他。
- 每題只進入最高優先 tier，一律以 bankId + permanent questionId 去重。
- dailyPracticeTarget 有設定時尊重使用者值；未設定時才依候選題數 / 剩餘學習日推導 fallback。
- 額外計算 recommendedDailyTarget / projectedCoverage / coverageGap，不偷偷提高使用者每日目標。
- 今日已完成一般 practice 會扣除，產生真正剩餘的 sprint queue。
- 支援 Global / Bank scope；Global 保留跨題庫 key，P4.1 再依 bank 分組啟動 Session。
- 新增 26 組 regression；P4 engine 加入 APP_SHELL。
- APP cache 更新至 r2k.5-11。

## P3.1.1 — Learning Goal Activity UX
- 未啟用有效 target 時，「今日整體進度」顯示「尚未設定」，近 7 日達成顯示「—」。
- 最近 7 日有作答日期改顯示「有學習」，並保留實際題數。
- 啟用有效 target 後才顯示百分比、達成 ✓ 與 X / 7。
- 僅調整 UI 呈現，不更動 P3 Core 統計規則。
- APP cache 更新至 r2k.5-10。

## P3.1 — Learning Goal UI
- 「今日複習」頁新增學習目標 Dashboard，不增加主導覽負擔。
- 可設定全部題庫或指定題庫的每日一般刷題 / 每日複習目標。
- 顯示今日整體進度、practice / review 個別進度、連續學習天數與最近 7 日達成狀況。
- Scope 採 global / bank:<bankId>，可同時保存多組目標。
- UI 只呈現 P3 Core 結果，不重複實作統計邏輯。
- 新增 Desktop / Tablet / Mobile RWD，並加入 P3.1 regression。
- APP cache 更新至 r2k.5-9。

## P3 — Learning Goal Progress Core
- 將 learningGoals 與 attempts 正式接成每日目標進度引擎。
- 一般練習 / 複習 / 模擬考採明確分類；exam 不灌入每日刷題或複習目標。
- 同題同日 retry 去重，避免答錯重做造成目標數字失真。
- 使用瀏覽器本機日界線，並加入 Asia/Taipei 跨 UTC regression。
- 新增最近 7 日達成狀況、全域 / 題庫 scope 與連續學習 streak。
- 最近 7 日以「目前 target」回看，規格明確記錄，不假裝有歷史 goal snapshot。
- attempts repository 新增 listAllAttempts()，P3 engine 加入 APP_SHELL。
- 新增 24 組 regression。

## P2C.1 — Import → Studio UI Integration
- ZIP / JSON / 資料夾檢查結果新增「在題庫工作室中開啟」。
- 檢查畫面顯示 P2C 的目標題庫 ID；同 ID 已存在時明確顯示安全 copy ID。
- 外部 package 建立 Studio Draft 後，自動導航並直接開啟該草稿。
- Schema warning 可進 Studio 修正；Schema error 仍阻止開啟。
- 原本「匯入到我的題庫 / 更新題庫」流程保持不變。
- 新增 P2C.1 UI regression，並更新 APP cache。

## P2C — Package → Studio Draft Core
- 新增 ZIP / JSON inspected package → Studio Draft 的正式轉換層。
- 重新執行 canonical validator，不信任過期 pkg.report。
- 外部 package 永遠建立未連結的工作草稿，不直接覆寫已安裝題庫。
- 題庫 ID 衝突時自動建立 -copy / -copy-2… 安全 ID。
- 保留 Question ID、圖片引用與 ZIP Blob assets。
- 新增 16 組 regression；P2C Core 加入 APP_SHELL。

## P2B.1.1 — Batch Preview Scroll Fix
- 批次貼題視窗改為固定可用高度的四列 Grid：標題、輸入區、可捲動預覽、底部操作列。
- 題目預覽區加入獨立垂直捲動，不再因多題內容超出視窗而看不到後續題目。
- 小高度螢幕會自動縮短原始文字輸入區，優先保留預覽空間。
- APP cache revision 更新，避免舊 CSS 持續被 Service Worker 使用。
- 加入 scrollbar / overscroll regression，避免後續樣式調整再次破壞捲動。

## P2B.1 — Studio Batch Import UI
- P2B Parser Core 接入題庫工作室。
- 工作室首頁與編輯器新增「批次貼題」入口。
- 提供 ready / review / unparsed 預覽。
- review 題目必須由使用者明確勾選後才加入草稿。
- 新草稿批次匯入會取代初始空白 starter question。
- 加入後仍使用既有 Question Draft Model 與 Inspector 驗證。
- 新增離線 App Shell 項目。
- 清理 repository root 的里程碑 README。

## P2B — Batch Question Parser Core
- 新增 `src/studio/batch-parser.js`。
- 支援常見題號、題型、答案、詳解、章節、標籤與難度。
- 不猜答案；資訊不足標示 review；原始文字保留。

## R2K.5.4 — True Epic World Separation
- Epic 與 Academy 使用完全不同的場景來源與世界結構。
- 8 張獨立 Epic source；Desktop / Mobile 共 16 張正式資產。
- 新增 provenance 與 Academy-vs-Epic 視覺差異 gate。

## R2K.5.3 — Epic Native Source Experiment
- 解決低解析來源放大的模糊問題。
- 後續發現仍沿用 Academy 世界結構，因此由 R2K.5.4 取代。

## R2K.5.2 / R2K.5.2.1
- 第一輪 Epic 高細節素材整合。
- 修正舊 milestone tests 固定 cache revision 的問題。

## R2K.5.1 — Academy Style Correction
- Academy 改為高細節古典學院場景。
- Desktop / Mobile 使用獨立 production assets。

## R2K.5 — Production Scene Assets
- 建立 production asset pipeline 與尺寸 / 資產品質 audit。

## R2K.4 — Responsive Scene Runtime
- Desktop / Mobile、focal point、高 DPI fallback。
- Save-Data / prefers-reduced-data。
- decode 後再交換場景，降低閃爍。

## R2K.3 / R2K.3.1 — High-Fidelity Scene Pipeline
- 場景資產退出 APP_SHELL，改用 Runtime Scene Cache。
- R2G / R2H regression contract 對齊新 cache 架構。

## 文件規則
- 長期規格放在 `docs/`。
- 里程碑摘要追加到本檔。
- 根目錄不再新增 `README-<milestone>.*`。

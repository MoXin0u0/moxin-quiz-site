# 墨忻刷題網 v4.0 — Learning Studio 規格

## 版本定位

v4.0 將現有刷題網站擴充成完整的本機優先個人學習系統。本版四大主軸：

1. 題庫工作室
2. 學習目標
3. 考前衝刺
4. 統計與首頁強化

正式站仍維持 GitHub Pages、Vanilla JS、ES Modules、IndexedDB、PWA、Schema 2.0，不新增後端、帳號系統或付費 API。

## 開發安全原則

- 所有開發只在 `v4.0-learning-studio`。
- 不以整個資料夾取代 repository。
- 每個里程碑獨立測試與驗收。
- IndexedDB 升級只新增 store / index，不刪除既有 store。
- 題庫內容與個人學習資料持續分離。
- 作者題庫預設唯讀；需要修改時建立使用者副本。
- v4.0 完整驗收前不修改正式 `main`。
- 每次更新包只包含明確需新增或覆蓋的檔案，不要求先刪任何資料夾。

## P0 — Storage Foundation

IndexedDB version 2 → 3，只新增：

### studioDrafts

保存題庫工作室草稿：

- id
- bankId（可為 null）
- status
- manifest
- questions
- assets（Blob）
- sourceBankVersion
- createdAt
- updatedAt

### learningGoals

保存全域或指定題庫學習目標：

- id
- bankId
- enabled
- dailyPracticeTarget
- dailyReviewTarget
- examDate
- examLabel
- sprintEnabled
- createdAt
- updatedAt

兩個 store 都納入完整備份／還原。

## P1 — 題庫工作室核心

- 建立新題庫
- 編輯自行新增題庫
- 作者題庫使用「另存副本」後才能編輯
- 題庫名稱、ID、版本、作者、分類、描述
- 單選、複選、是非、填空
- 題目新增、刪除、複製、上下移動
- 自動產生永久題目 ID
- 章節、標籤、難度
- 即時 Schema 2.0 驗證
- 草稿自動保存
- 題目預覽
- JSON / ZIP 匯出
- 儲存到「自行新增」題庫

## P2 — 圖片與批次建題

- 題目圖片
- 詳解圖片
- 圖片 package path 管理
- 刪除未引用圖片
- 批次文字轉草稿
- 解析後逐題人工確認
- 不自動猜測缺失答案
- AI Schema v2 匯入後可直接進工作室修改

## P3 — 學習目標

- 每日刷題目標
- 每日複習目標
- 今日進度
- 連續學習天數
- 最近 7 日達成狀況
- 全域或指定題庫目標

## P4 — 考前衝刺

設定考試日期後，依剩餘日數與目標題數安排每日衝刺。

選題優先順序：

1. 目前錯題
2. 不熟題
3. 已到期複習題
4. 低熟練度題
5. 尚未作答題
6. 其他題目

同一題只出現一次，題目不足時才向下一層補足。

## P5 — 統計與首頁

**狀態：Stable（P5 Final Audit）**

- 7 / 30 日作答趨勢
- 7 / 30 日正確率
- 題型正確率
- 章節正確率
- 弱點章節
- 今日目標達成率
- 連續學習天數
- 繼續上次練習
- 今日複習
- 快速錯題練習
- 考前衝刺快捷入口
- 最近完整備份時間與過久未備份提醒

## RC1 — v4.0 Release Readiness

**狀態：Stable（Main Cutover Rehearsal）**

- ✅ v3.3 → v4.0 IndexedDB upgrade simulation
- ✅ 完整備份 export / restore round trip
- ✅ 真實 Chromium 使用者流程
- ✅ Desktop / Tablet / Mobile viewport matrix
- ✅ Light / Dark × Academy / Epic / Focus visual matrix
- ✅ 大量題庫 / 長文字 / Empty State
- ✅ Accessibility / horizontal overflow / runtime error audit
- ✅ Offline PWA reload
- ✅ Release metadata cleanup
- ✅ Main cutover rehearsal

## 相容性要求

v3.3 的以下資料必須無損保留：

- 作者／使用者題庫
- assets
- attempts
- progress
- favorites
- notes
- mastery
- reviewSchedule
- practice / exam sessions
- UI settings

Schema 2.0 題庫交換格式維持不變。

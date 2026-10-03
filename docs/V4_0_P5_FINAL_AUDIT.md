# 墨忻刷題網 v4.0 — P5 Final Audit

## Audit 範圍

P5 Final Audit 不再增加新的功能頁，而是把下列三個互相關聯的區域一起驗證：

```text
我的題庫首頁
今日學習
學習統計
```

涵蓋：

- 資料口徑一致性
- Empty State
- Global / Bank scope
- Session resume
- 今日複習 / 快速錯題
- 考前衝刺入口
- 完整備份提醒
- Desktop / Tablet / Mobile
- Theme token / Dark Mode 相容性
- Offline App Shell
- Release cutover invariant

## 統計口徑確認

### 今日目標

首頁直接使用 P3 `buildLearningGoalProgress()`。

因此首頁與 Learning Hub 的目標百分比不是另外計算一套公式。

### 連續學習

首頁 streak 固定使用 Global attempts。

不受 Learning Hub 目前選定的 P3 bank scope 影響。

### 今日複習 / 快速錯題

首頁 summary 與 Learning Hub 採相同語義：

- due：目前到期且題目仍存在
- wrong：目前 `lastResult === wrong` 且題目仍存在

快速錯題只決定「先進哪個題庫」，不建立新的 review engine。

### P3 與 P5 的數字差異

保留既有設計：

```text
P3 / Home 每日學習
→ 同題同日 unique-question

P5 Statistics
→ 實際 attempt 次數
```

Retry 因此可以讓 P5 趨勢 +1，但不會讓 P3 今日目標重複灌水。

## Scope

- Home Hero / streak：Global
- Home 今日目標：明確顯示所採用 goal scope
- Learning Hub Hero / summary：Global
- Learning Hub P3 card：目前 P3 scope
- Statistics Hero：Global
- Statistics Trends / Weakness：可切 Global / Bank

## Empty State

驗證：

- 沒有題庫
- 沒有 attempts
- 沒有 learning goal
- 沒有 unfinished session
- 沒有 backup metadata

各頁仍必須能正常 render，且不得虛構進度。

## Security Hardening

Final Audit 發現 Home Action generic note 原先允許 caller 傳入已組合 HTML 字串。

現在改為：

```text
所有 action note
→ renderAction() 統一 escapeHtml()
```

並移除 sprint note 的預先 escape，避免 double escaping。

因此匯入題庫名稱即使包含 HTML-like 文字，也只會當文字顯示。

## RWD / Theme

Final Audit 靜態 gate：

- Home：980 / 620 breakpoint
- Statistics：980 / 820 / 620 breakpoint
- Learning Hub：620 mobile compaction
- P5 新 CSS 不新增固定 hex 色碼
- 使用既有 `--learn-*` theme tokens

## Offline / Release

P5 runtime assets 必須全部存在 APP_SHELL。

`index.html` 與 `v3.html` 必須 byte-for-byte 相同。

## Stable Criteria

當：

```text
P5 Analytics Core
P5.1 Statistics IA/UI
P5.2 Home Actions
P5 Final Audit
```

全部通過 `npm run ci`，且已完成實機畫面驗收後：

```text
P5 — 統計與首頁 = Stable
```

後續除 bugfix / regression 外進入 Maintenance Only。

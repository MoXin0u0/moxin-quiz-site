# 墨忻刷題網 v4.0 — RC1 Release Metadata Cleanup

## 目的

RC1 Browser UX Audit 已通過後，將網站從開發期的：

```text
v3.3
v4 preview
```

整理成正式的：

```text
v4.0 RC1
```

這個階段仍然不是 `main` cutover，也不是最終 Production 標記。

## 使用者可見版本

更新：

- HTML `<title>`
- Header version badge
- HTML meta description
- PWA manifest description
- README

Header 不再同時顯示：

```text
v3.3 + v4 preview
```

而只保留：

```text
v4.0 RC1
```

## Runtime Release Metadata

`APP_CONFIG` 新增：

```text
appVersion: 4.0.0-rc.1
releaseChannel: rc1
```

供後續 cutover / diagnostics 使用。

## 相容性名稱不改

下列名稱雖然包含 `v3`，但它們是資料相容性 namespace，不是畫面版本：

```text
IndexedDB:
moxin-quiz-v3

localStorage:
moxin.v3.settings
```

RC1 不重新命名。

原因是正式升級最重要的要求是：

```text
既有 v3.3 使用者直接開 v4.0
→ 原本資料與設定仍然被同一套程式讀取
```

若只是為了版本字樣漂亮而改 DB / localStorage key，反而會製造資料遷移風險。

`v3.html` 也繼續保留，作為既有相容入口；它與 `index.html` 必須 byte-for-byte 相同。

## Service Worker

本輪 HTML / manifest metadata 有變動，因此 App Shell revision：

```text
r2k.5-19
→ r2k.5-20
```

Cache namespace 暫時仍保留 `moxin-quiz-v3-`，因為目前 activation cleanup 已以此 namespace 管理既有 client cache。

正式 Main Cutover Rehearsal 再決定是否需要改為 v4 cache namespace；如果改，必須同時驗證舊 cache 清理。

## Preflight

新增：

```text
scripts/v4-release-preflight.mjs
```

`npm run preflight` 正式改用 v4 preflight。

舊 `scripts/v3-release-preflight.mjs` 暫時保留作歷史相容檔，不作為 RC1 release gate。

## README

README 改為 v4.0 RC1 功能面：

- 題庫工作室
- 圖片與批次建題
- 學習目標
- 考前衝刺
- Learning Hub
- 7 / 30 日統計
- 弱點分析
- 首頁快捷行動
- 完整備份
- PWA / Offline
- RWD / Light / Dark / Academy / Epic / Focus

並明確記錄內部 v3 namespace 的相容性理由。

## 下一步

完成後 RC1 剩下：

```text
Main Cutover Rehearsal
```

Rehearsal 必須驗證：

- branch → main 的差異
- main cutover 後 GitHub Pages
- manifest / SW 更新
- 舊 cache 清理
- v3.html 相容入口
- IndexedDB v2 → v3
- Backup restore
- rollback 路徑

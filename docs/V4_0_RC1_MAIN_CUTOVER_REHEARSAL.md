# 墨忻刷題網 v4.0 — RC1 Main Cutover Rehearsal

## 定位

此階段只做「正式合併的完整演練」，不會修改遠端 `main`。

目前 `v4.0-learning-studio` 與 `main` 的關係必須滿足：

```text
main 是 release candidate 的祖先
candidate ahead > 0
candidate behind = 0
```

因此正式 cutover 不需要處理 main-side divergence。

## 演練方式

GitHub Actions 會：

```text
checkout v4.0-learning-studio
→ 套用 rehearsal contract
→ npm run ci
→ 在本機建立 candidate commit
→ 建立 temporary worktree 指向 origin/main
→ 使用 --no-ff 模擬正式 merge commit
→ 在「合併後的 tree」重新跑 npm run ci
→ 啟動 HTTP server 做 production-root smoke
→ 模擬 git revert -m 1 rollback
→ 驗證 rollback tree 完全回到 origin/main
→ 全綠後才把 rehearsal contract commit push 回 v4 branch
```

遠端 `main` 在整個 workflow 中不會被 push。

## 為什麼模擬 Merge Commit

正式發布建議透過 Pull Request：

```text
v4.0-learning-studio
→ main
→ Create a merge commit
```

而不是直接 force push 或手動重設 `main`。

原因是若正式發布後發現嚴重問題，可用：

```bash
git revert -m 1 <release-merge-commit>
```

建立正常的 rollback commit，不需要改寫 `main` 歷史。

Rehearsal 會真的在 temporary worktree 做一次這種 revert，並要求 revert 後的 tree 與目前 `origin/main` 完全相同。

## Production-root Smoke

Synthetic merge 完成後會啟動本機 HTTP server，驗證：

- `/` 可以開啟
- `/` 顯示 `v4.0 RC1`
- `/v3.html` 可以開啟
- `/` 與 `/v3.html` byte-identical
- `manifest.webmanifest` 可讀
- `service-worker.js` 可讀
- Service Worker cache revision 為 `r2k.5-20`
- `legacy-v2.html` 相容入口仍存在

## GitHub Pages 注意事項

Repository 的 Pages deployment history 顯示近期部署的 `head_branch` 是：

```text
v4.0-learning-studio
```

因此目前實際 Pages source 與 README 所寫的「正式 Branch: main」並不一致。

這不是程式碼 regression，但它是正式 cutover 前必須處理的 deployment setting。

Rehearsal workflow 會嘗試透過 GitHub REST API 讀取 Pages source：

- 若能取得：寫入 artifact report
- 若權限不足：留下 `unavailable`，不因此誤判程式碼失敗

正式 Production cutover 時必須確認 Pages source 最終為：

```text
Branch: main
Path: /
```

## 已經不重跑的高成本項目

以下已在 RC1 Browser UX Audit 全綠，不需要在 cutover rehearsal 重複 56 張 screenshot：

- 7 viewport
- Light / Dark
- Academy / Epic / Focus
- Heavy library
- Backup round trip
- v3.3 → v4 migration
- Offline PWA
- Accessibility

Cutover rehearsal 專注在「合併之後是否還是同一個可發布產品」。

## RC1 完成條件

本 workflow 全綠後，RC1 可標：

```text
Stable（Main Cutover Rehearsal）
```

接著才進入真正 Production Cutover。

Production Cutover 本身應另外處理：

1. 將 RC1 metadata 升為正式 v4.0
2. 建立 `v4.0-learning-studio → main` Pull Request
3. 使用 Merge Commit
4. 將 GitHub Pages source 確認／切換為 `main / root`
5. 等 Pages deployment 綠燈
6. 對公開網址做 production smoke
7. 保留 release merge SHA，作 rollback anchor

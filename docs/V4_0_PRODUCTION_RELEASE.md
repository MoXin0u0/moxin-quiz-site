# 墨忻刷題網 v4.0 — Production Release

Version: **v4.0**  
Tag: **v4.0.0**  
Channel: **production**

正式發布前已完成 RC1 Release Readiness、Main Cutover Rehearsal、真實 Chromium 使用者流程、RWD／主題矩陣、Backup/Restore、v3.3 → v4.0 migration、Offline PWA、完整 regression、synthetic merge 與 rollback rehearsal。

Production 使用：

```text
Branch: main
Path: /
```

相容 namespace 刻意保留：

```text
IndexedDB: moxin-quiz-v3
Settings: moxin.v3.settings
Compatibility entry: v3.html
```

正式 PR 使用 Merge Commit；release notes 保留 merge SHA 作 rollback anchor。

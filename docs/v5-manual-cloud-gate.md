# MoXin Quiz V5｜Manual Cloud / Production Cutover Gate

Status: **BLOCKED — dormant cloud runtime / no live Google credentials configured**

This checklist is the manual half of the V5 release gate. Automated CI can validate Local-first behavior, deterministic sync semantics, failure handling, accessibility, and provider boundaries, but it cannot replace real Google account / Drive / two-device validation.

## Preconditions

Before running the manual gate:

- `features.cloudSync=true`
- Google OAuth Client ID configured for the intended GitHub Pages origin
- Drive scope remains exactly `https://www.googleapis.com/auth/drive.appdata`
- DB remains IndexedDB v4
- Cloud Sync Schema remains v1
- `minimumClientVersion=5.0.0`
- release channel is no longer `development`
- V5 automated CI is fully green
- PR remains unmerged until all manual checks below are recorded

Run:

```bash
npm run preflight
npm run preflight:cloud-cutover
```

The second command is intentionally expected to fail while the branch is still dormant.

## Manual two-device matrix

Record concrete evidence for every row before authorizing production cutover.

| Scenario | Required result | Evidence |
| --- | --- | --- |
| Local → Cloud | Existing local data uploads only after explicit first-sync confirmation | ✅ PASS — live OAuth + empty first-sync confirmation + post-confirm automatic sync completed; Sync Center returned SYNCED with pending=0/conflicts=0 |
| Fresh device bootstrap | New device discovers profile and reconstructs user data without replacing newer local data incorrectly | ✅ PASS — isolated incognito browser registered as device 2, discovered the same cloud profile, pulled the synced learning-goal data, and reached SYNCED |
| Bidirectional propagation | A change made on device B reaches device A through the same cloud profile | ✅ PASS — device B changed the synced learning-goal data, automatic sync returned pending=0/conflicts=0, and device A received the change after manual sync |
| Two devices offline attempts | Each device can answer offline independently | ✅ PASS — video evidence shows isolated device/browser sessions operating with DevTools Offline and retaining separate local attempt activity |
| Reconnect union | Immutable Attempt Events from both devices converge without duplication/loss | ✅ PASS — after reconnect/sync, both device views converged on the same刷題統計（今日刷題 2、刷題 2/9）while sync status returned green; no attempt was overwritten |
| Note concurrent edit | Real concurrent edits surface a conflict; local / cloud / merge paths behave as designed | ✅ PASS — post-repair live retest succeeded: the manual merged Note value propagated correctly, both devices converged to the merged text, and the stale conflict no longer remained actionable. |
| Favorite concurrent edit | Deterministic LWW resolves explicit boolean state consistently | ✅ PASS — live two-device retest succeeded after the runtime UI refresh repair: device B changed the shared question from favorite to not favorite, device A remained on the open Practice question, manual sync applied the remote LWW result, and A updated in place from `★ 已收藏` to `☆ 收藏` without reload/navigation; both devices ended consistent with pending=0/conflicts=0. |
| User Bank conflict | Losing branch is preserved as a conflict copy | Pending |
| Studio Draft conflict | Losing branch is preserved as a conflict copy | Pending |
| Unfinished Practice | Resume state survives cross-device reconciliation according to revision rules | Pending |
| Unfinished Exam takeover | Frozen snapshot/deadline semantics remain intact on another device | Pending |
| Expired Exam | Deadline/status cannot be bypassed by device switching or offline time | Pending |
| Large asset resumable upload | Interrupted large upload retries without a broken document pointer | Pending |
| Authorization expiration | Local work continues; sync becomes AUTH_REQUIRED without losing Outbox data | Pending |
| Account switch | Old-profile pending data is not silently uploaded into the new account | Pending |
| Device revoke | Revoked device may observe revocation but cannot push afterward | Pending |
| Backup restore → reconcile | Restore creates a new device identity, then reconciles without restoring OAuth/device cloud state | Pending |
| PWA offline boot | Installed app opens offline and existing local learning remains usable | Pending |

## Additional safety observations

During manual testing verify:

- Local writes succeed before cloud operations.
- Offline is not rendered as a danger/error state.
- First Sync and account switch perform inventory/planning only before explicit Apply.
- No native browser `confirm()` / `alert()` is used in cloud or restore risk flows.
- Author Bank content is not uploaded as duplicated user content.
- Asset upload ordering remains binary first, pointer/document last.
- Open conflicts block automatic push.
- Automatic sync never opens OAuth/GIS by itself.
- Remote-applied learning state refreshes the currently visible learning UI without requiring navigation/reload, while unsaved Note textarea input is preserved.
- Backup remains independent from Sync.

## Production cutover sequence

Do not reorder these steps without updating the Master Spec / release decision record.

1. Freeze `main`.
2. Create a release-candidate tag from the validated V5 head.
3. Re-run migration against real V4 fixtures.
4. Run the full automated gate plus this manual two-device matrix.
5. Merge only after explicit authorization.
6. Bump the Service Worker cache namespace for the production cutover.
7. Run GitHub Pages smoke tests.
8. Verify migration and Local-only startup first.
9. Verify Cloud opt-in second.
10. Retain a DB-v4-compatible hotfix branch.

## Rollback invariant

After production has opened IndexedDB v4, rollback **must not** deploy a client that only requests DB v3.

Cloud can be disabled through the feature flag while preserving Local-first operation and durable Outbox data. Do not clear the Outbox merely to roll back cloud functionality.

## Sign-off

- Automated gate head: `6deca330d36826c0b8202505b2e73c6c878ec1d8`
- Push workflow: ✅ PASS — Unit + release preflight and full browser/accessibility gate
- PR workflow: _Pending_
- Real Google account used: _Pending_
- Device A / Browser: Chrome normal profile on Codespaces forwarded-port RC
- Device B / Browser: Chrome incognito profile on the same RC origin (isolated browser storage)
- Manual matrix completed by: _Pending_
- Production merge authorized by: _Pending_

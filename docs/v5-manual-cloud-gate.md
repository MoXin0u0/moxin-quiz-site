# MoXin Quiz V5｜Manual Cloud / Production Cutover Gate

Status: **PRODUCTION CANDIDATE READY — automated + manual gates passed; main merge pending explicit authorization**

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

On the production candidate, both preflight commands must pass. The validated RC is configured as `appVersion=5.0.0` / `releaseChannel=production`, and `preflight:cloud-cutover` returns `READY`.

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
| User Bank conflict | Losing branch is preserved as a conflict copy | ✅ PASS — live two-device test succeeded: concurrent offline edits to the same user bank produced a resolvable conflict, selecting the cloud branch preserved the losing device branch as a separate conflict-copy bank, and both devices converged after sync without data loss. |
| Studio Draft conflict | Losing branch is preserved as a conflict copy | ✅ PASS — live two-device test succeeded: concurrent offline edits to the same Studio Draft produced a resolvable conflict, selecting the cloud branch preserved the losing device branch as a separate draft copy with a new Draft ID, and both devices converged after sync without data loss. |
| Unfinished Practice | Resume state survives cross-device reconciliation according to revision rules | ✅ PASS — live two-device test succeeded: device A created an unfinished Practice session and synced it, device B resumed the same session at the inherited progress rather than restarting, continued the session, synced the newer state, and device A then received the updated progress with pending=0/conflicts=0. |
| Unfinished Exam takeover | Frozen snapshot/deadline semantics remain intact on another device | ✅ PASS — live two-device test succeeded: an active exam created on device A resumed on device B as the same exam session, preserving the frozen question snapshot, existing answers, question order, and original deadline/remaining-time semantics rather than restarting or extending the exam. |
| Expired Exam | Deadline/status cannot be bypassed by device switching or offline time | ✅ PASS — live two-device expiry test succeeded: once the original exam deadline elapsed, switching devices did not restart or extend the timer, and the expired session followed the timeout/submission path instead of allowing continued unrestricted answering. |
| Large asset resumable upload | Interrupted large upload retries without a broken document pointer | ✅ PASS — live Google Drive test succeeded: a large asset upload was interrupted, the failed sync retained pending local work, retry completed successfully after connectivity returned, and the second device received the complete bank with the asset intact and no broken document reference. |
| Authorization expiration | Local work continues; sync becomes AUTH_REQUIRED without losing Outbox data | ✅ PASS — live test succeeded: after the in-memory Google access token was cleared by reload, local work continued normally, pending sync data was retained without an automatic OAuth popup, and an explicit manual sync re-authorized Google access and uploaded the preserved Outbox changes successfully to the second device. |
| Account switch | Old-profile pending data is not silently uploaded into the new account | ✅ PASS — live two-account test succeeded: selecting a different Google account entered inventory/reconciliation planning without uploading before explicit Apply, cancelling preserved the original profile and pending local data, and confirming the switch then rebound the device to the target profile and synchronized the preserved local data without deleting the old account's cloud data. |
| Device revoke | Revoked device may observe revocation but cannot push afterward | ✅ PASS — live two-device test succeeded: device A revoked device B, B subsequently observed its revoked state and could no longer push new local changes, while B's local data remained intact and A never received the post-revocation test mutation. An additional unlink/relink retest also succeeded: after locally unlinking a device, reconnecting to the cloud profile restored normal synchronization and upload behavior. |
| Backup restore → reconcile | Restore creates a new device identity, then reconciles without restoring OAuth/device cloud state | ✅ PASS — live restore test succeeded: restoring Backup v2 replaced local user data while resetting cloud operational state, created a fresh device identity, required an explicit reconnect/reconciliation flow, and then converged with the newer cloud state without rolling the cloud profile backward. |
| PWA offline boot | Installed app opens offline and existing local learning remains usable | ✅ PASS — installed PWA cold-started successfully with the network fully unavailable, loaded the cached App Shell and existing IndexedDB learning data, allowed new offline learning activity, preserved that activity across a second offline cold start, and synchronized normally after connectivity returned. |

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

- Automated gate head: `cf77c7f5604fc75626ba1893f78a2d69c68ff471`
- Push workflow: ✅ PASS — GitHub Actions run `37669209524`; Unit + release preflight, cloud-cutover READY check, and full browser/accessibility gate all passed
- PR workflow: ✅ PASS — PR #7 head fast-forwarded to the validated production candidate; pull-request run `37670343952` passed Unit + release preflight and the full browser/accessibility gate
- Real Google account used: ✅ PASS — live Google OAuth / Drive appDataFolder validation completed, including two-account switching
- Device A / Browser: Chrome normal profile on Codespaces forwarded-port RC
- Device B / Browser: Chrome incognito profile on the same RC origin (isolated browser storage)
- Manual matrix completed by: ✅ Live user validation completed 2026-10-08
- Pages deployment: ✅ PASS — GitHub Pages deployment for production-candidate head `03f33ed3fbde3ab0fb46ee737d14591260d936b2` completed successfully; configured homepage/privacy/terms paths are included in that deployment
- OAuth audience: _Testing — ready for the user to switch to In production now that the public Pages deployment contains the configured policy URLs_
- Production merge authorized by: _Pending_

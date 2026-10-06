# MoXin Quiz V5 Implementation Status

Updated: 2026-10-05

## Baseline

- Branch: `v5-cloud-sync`
- V4.1 base: `bc71d9514ef7d66f314c7e6d64f680c2f88fd7a9`
- Draft PR: #7
- `main` remains unchanged.
- Current validated head: `417b3c8110d3f58eb8d02f611d925e4d8826f2ed`

## Gate status

| Batch / Gate | Status | Evidence |
| --- | --- | --- |
| B00 Baseline Freeze | ✅ Complete | Frozen V4.1 contract + isolated V5 branch |
| G0 Baseline | ✅ PASS | Unit regression + release preflight + browser + landing audits |
| B01 Theme / Contrast / Accessibility | ✅ Complete | P0A fixes + static contrast contract + 54-case browser matrix |
| G1 UI Foundation | ✅ PASS | 3 styles × 2 themes × 3 intensities × 3 viewports |
| B02 DB v4 + Canonical Foundation | ✅ Complete | IndexedDB v4 structural schema, canonical JSON/hash, HLC/revision primitives, V5 repositories |
| B03 Deterministic V4 → V5 Migration | ✅ Complete | Resumable deterministic migration, legacy event/revision IDs, fingerprints, derived rebuild |
| B04 Backup v2 Recovery | ✅ Complete | Backup v2 export/restore contract, new device identity after restore, recovery gate |
| B05 Transactional Outbox | ✅ Complete | Same-transaction local state + outbox mutation contract |
| B06 Learning Events / Derived State | ✅ Complete | Attempt Event source of truth, progress/review deterministic reducers |
| B07 Exam Integrity | ✅ Complete | Frozen exam snapshot, atomic/idempotent submission, terminal session semantics |
| B07.5 Cross-feature Consistency Repair | ✅ Complete | Migration bootstrap, unanswered policy, tombstone ancestry, session checkpoint semantics, PWA cache/version regression repair |
| G2 Local Data Integrity | ✅ PASS | Unit + release preflight + all V5 browser gates green at current head |
| B08 Google Identity + Drive Provider Foundation | ✅ Complete | Lazy GIS token model, Drive appDataFolder adapter, provider-neutral contract, dormant-by-default tests |
| G3 Cloud Provider Foundation | ✅ PASS | Push + PR regression and browser provider gate green at B08 head |
| B09 Immutable Commit Transport | ✅ Complete | Durable outbox payload snapshots, immutable hashed commits, lost-response recovery, receipts, remote staging/apply callback |
| G4 Commit Transport | ✅ PASS | Push + PR unit/browser gates green at B09 head |
| B10 Deterministic Merge + Remote Apply | 🚧 Implemented / gating | Revision ancestry, LWW boolean state, conflict staging, atomic remote receipt/apply, derived rebuild, first-sync inventory planner |

## Current green CI evidence

At `417b3c8110d3f58eb8d02f611d925e4d8826f2ed`:

- Unit + release preflight: PASS
- Existing app browser audit: PASS
- Landing browser audit: PASS
- V5 P0A 54-case browser matrix: PASS
- IndexedDB v4 structural audit: PASS
- Deterministic V4 → V5 migration audit: PASS
- Backup v2 recovery audit: PASS
- Transactional outbox audit: PASS
- Exam atomic/idempotent audit: PASS
- Cross-feature consistency audit: PASS

## B07.5 repair notes

The pre-B08 consistency pass closed several issues that would otherwise make cloud sync unsafe:

- App bootstrap now completes the V5 migration before the app publishes the ready state.
- V5 migration completion includes a derived-state rebuild marker and self-heals an older incomplete completion state.
- Migration runners are serialized in one realm and, when available, across tabs via the Web Locks API.
- Legacy unanswered exam attempts migrate as `unanswered`, not as ordinary wrong answers.
- `unanswered` remains a distinct review outcome and does not silently demote mastery.
- Note and Learning Goal recreation descends from the latest delete tombstone revision.
- Practice navigation checkpoints no longer create cloud lifecycle mutations; lifecycle changes still do.
- Session status is normalized so terminal timestamps take precedence over stale `active` flags.
- Frozen exam question sets are never silently shrunk during resume; incomplete snapshots stop safe finalization instead.
- V5 service-worker cache namespaces retire older V5 app-shell caches.
- Historical V3/V4 regression assertions were made version-compatible without weakening their underlying feature checks.

## Production safety

- The V5 branch uses IndexedDB version 4 and must remain isolated from production until the full V5 release gate is complete.
- Production rollback after DB v4 must use a client that can open DB v4; do not roll back to a client that requests DB v3.
- OAuth/Drive support must remain optional and must never block local-only startup or offline practice.
- The PR remains draft; no merge to `main` is authorized at this stage.

## Current implementation target

B08/G3 and B09/G4 are complete. B10 is now implemented and under gating:

1. Remote mutable revisions are compared by ancestry before any overwrite; known descendants apply, known ancestors are ignored, divergent conflict-sensitive branches are staged as conflicts.
2. Favorite/unfamiliar and other coalescible state use deterministic HLC/revision ordering rather than wall-clock-only LWW.
3. Concurrent Note/Goal/session edits are preserved instead of silently overwritten; delete-vs-edit and divergent submitted Exam branches receive explicit conflict kinds.
4. Attempt Events merge as an immutable eventId union; an eventId/content collision becomes a conflict instead of a duplicate or overwrite.
5. Remote commit application and its sync receipt are now one IndexedDB transaction, making crash/replay behavior idempotent.
6. Remote Attempt application rebuilds the affected Progress and Review Schedule from Attempt Events, preserving the source-of-truth contract.
7. Receiving a remote revision advances the local HLC so a future local edit cannot accidentally sort behind a known remote clock.
8. First-sync inventory discovery is read-only and classifies both-empty / upload-local / download-cloud / merge-required before any mutation.
9. User-bank binary/document object application remains intentionally blocked until the object-reference transport batch; B10 will not inline large bank payloads into commit JSON.

After G5 passes, the next target is B11: cloud object documents/assets, full user-bank and Studio draft transport, then first-sync reconciliation execution.

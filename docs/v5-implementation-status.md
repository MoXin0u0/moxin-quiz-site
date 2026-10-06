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
| B09 Immutable Commit Transport | 🚧 Implemented / gating | Durable outbox payload snapshots, immutable hashed commits, lost-response recovery, receipts, remote staging/apply callback |

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

B08 and G3 are complete. B09 is now implemented and under gating:

1. Every newly-created Outbox mutation carries a durable payload snapshot in the same IndexedDB transaction as the local change.
2. Immutable Cloud Commit objects use canonical JSON + SHA-256 payload hashes and per-device monotonic sequences.
3. A prepared commit is persisted in `syncMeta.pendingCloudCommit`; retries reuse the same commit ID/hash/sequence.
4. Publish checks Drive for an existing commit before creating it, so a lost upload response does not duplicate the commit.
5. Successful publish records a receipt, deletes acknowledged outbox rows, advances the device sequence, and caches the Drive object mapping.
6. Pull discovery validates hashes/schema/profile, deduplicates commit IDs, stages unseen commits, and records a receipt only after the apply callback succeeds.
7. The transport remains dormant behind the cloud feature flag; B09 does not yet enable automatic cloud sync in the product UI.

After G4 passes, the next target is B10: deterministic entity merge/apply rules, conflict staging, and first-sync reconciliation groundwork.

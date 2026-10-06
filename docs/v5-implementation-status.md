# MoXin Quiz V5 Implementation Status

Updated: 2026-10-06

## Baseline

- Branch: `v5-cloud-sync`
- V4.1 base: `bc71d9514ef7d66f314c7e6d64f680c2f88fd7a9`
- Draft PR: #7
- `main` remains unchanged.
- Current validated head before B11B: `8015be0842a03822d2bdcc254c49ba7279281d65`

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
| B10 Deterministic Merge + Remote Apply | ✅ Complete | Revision ancestry, LWW boolean state, conflict staging, atomic remote receipt/apply, derived rebuild, first-sync inventory planner |
| G5 Deterministic Merge | ✅ PASS | Push + PR unit/browser gates green at B10 head |
| B11A Cloud Object Documents + Assets | ✅ Complete | Content-addressed assets, immutable JSON documents, SHA-256 round-trip verification, object refs |
| G6A Cloud Object Transport | ✅ PASS | Push + PR unit/browser gates green at B11A head |
| B11B Studio / User Bank Object Sync | ✅ Complete | Sync-aware repositories, durable Blob snapshots, object materialization, object-backed remote apply |
| G6B Object-backed Repository Sync | ✅ PASS | Unit gate green; browser object-sync gate green on B11B implementation head |
| B12 Sync Cycle + First-sync Execution | 🚧 Implemented / gating | First-sync inventory/confirmation, legacy seed, Pull→Apply→Push orchestration, retry/backoff/runtime states |

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

B08/G3, B09/G4, B10/G5, B11A/G6A, and B11B/G6B are complete. B12 is now implemented and under gating:

1. Binary assets are addressed by SHA-256 and discovered before upload, so identical assets are reused across document revisions instead of duplicated.
2. Studio Draft, User Bank, Session, and Checkpoint JSON objects use immutable object IDs plus canonical SHA-256 content verification.
3. JSON uploads are downloaded once for round-trip verification before their object reference is considered valid.
4. Object references carry objectType/objectId/contentHash/size/mimeType/Drive file ID and are now legal Cloud Mutation payload references.
5. Studio Draft/User Bank document builders strip local Blob/storage-only fields and retain stable asset path→hash metadata.
6. Uploaded asset references are attached to JSON documents only after every required binary object exists, preserving binary-first / document-last ordering.
7. Downloads verify both Drive appProperties ownership and the actual SHA-256 content before returning data.

B11B adds the repository/runtime bridge that B11A intentionally did not include:

1. Studio Draft writes now create revisioned transactional Outbox snapshots, including SHA-256 asset hashes and a content fingerprint.
2. User Bank publication now writes bank/questions/assets plus revision/outbox data atomically; author-bank content remains local/catalog-backed and is not uploaded.
3. Local-only bank removal remains separate from the explicit synced user-bank delete path, preventing a device cleanup action from becoming a cloud-wide delete.
4. Pending Studio/User Bank mutations upload binary assets first, then immutable JSON documents, then attach the resulting objectRef to the Outbox row.
5. Identical asset hashes are reused across draft and published-bank documents.
6. Remote object-backed mutations are downloaded and SHA-256 verified before the IndexedDB write transaction starts, avoiding network waits inside an active IDB transaction.
7. Remote Studio Drafts are hydrated back with their assets; remote User Banks atomically replace bank/questions/assets and preserve the cloud revision.
8. Cloud commits remain small because object-backed mutations carry references instead of embedded large documents.

B12 now adds the first end-to-end sync-cycle orchestrator:

1. First cloud setup performs local/remote inventory and stores a reconciliation plan before mutating learning data.
2. The cycle refuses to run while the first-sync plan is still awaiting explicit confirmation.
3. Confirmation seeds migrated V4/V5 local entities that have revisions but no Outbox rows yet, including immutable Attempt Events and user-created banks/drafts while excluding author-bank content.
4. The runtime executes Pull → Stage → Atomic Apply → conflict check → object materialization → Push.
5. Open conflicts stop the push phase and switch runtime state to CONFLICT instead of propagating an unresolved branch automatically.
6. Retryable network/rate/server failures receive exponential backoff with jitter; authorization/config failures block mutations until explicitly resumed.
7. Runtime state now moves through SYNCING / SYNCED / PENDING / OFFLINE / AUTH_REQUIRED / CONFLICT / ERROR according to the actual cycle outcome.
8. A completed first-sync reconciliation records its completion only after pull/apply/push finishes with no pending mutations or conflicts.

After G7 passes, the next target is B13: checkpoint/profile frontier, device registry integration, account switching/revocation flows, and Sync Center product UI wiring.

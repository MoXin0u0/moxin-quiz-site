# MoXin Quiz V5｜Live Cloud RC Setup

Status: **Waiting for Google OAuth Client ID**

RC branch: `v5-cloud-sync-live-rc`

Base validated V5 head: `194fb155f4b4b7a9b7f4f7dd0143cb726eec1ae8`

## Safety state

The RC branch starts from the fully green B13 automated-readiness head and remains dormant until a real Google OAuth Web Client ID is supplied.

Current required invariants:

- `features.cloudSync=false` until the Client ID is configured.
- `syncUi=true`.
- IndexedDB remains version 4.
- Cloud Sync Schema remains version 1.
- Drive scope remains exactly `https://www.googleapis.com/auth/drive.appdata`.
- `main` must remain unchanged.
- PR #7 remains Draft.
- No production merge is authorized by this RC.

## Google Cloud project setup

Enable **Google Drive API**.

Configure **Google Auth Platform**:

- App name: `墨忻刷題網` (or an equivalent development label).
- Audience: External, Testing during RC validation.
- Add the Google account(s) used for live testing as Test users.
- Data Access scope:
  `https://www.googleapis.com/auth/drive.appdata`

Create an OAuth client:

- Application type: **Web application**
- Suggested name: `MoXin Quiz V5 RC`
- Authorized JavaScript origins:
  - `https://moxin0u0.github.io`
  - `http://localhost:4173` (desktop-local RC smoke test)
- Authorized redirect URIs: not required by the current GIS token-client callback flow.

GitHub Pages production origin:

- Site: `https://moxin0u0.github.io/moxin-quiz-site/`
- OAuth JavaScript origin must be origin-only:
  `https://moxin0u0.github.io`
  (do not include `/moxin-quiz-site/` in Authorized JavaScript origins)

## Activation sequence after Client ID is supplied

1. Write the Web Client ID only into the isolated RC branch.
2. Set `features.cloudSync=true` only on the RC branch.
3. Keep `releaseChannel=development` for live validation.
4. Run full automated CI.
5. Run `npm run preflight`.
6. Run the first localhost OAuth + Drive appDataFolder smoke test.
7. Only after that passes, prepare a reachable HTTPS RC for real two-device testing.
8. Complete `docs/v5-manual-cloud-gate.md`.
9. Do not merge to `main` until explicit production-cutover authorization.

## First live smoke test

Expected path:

1. Open RC on desktop.
2. Local-only startup must complete before any Google action.
3. Open Account & Sync.
4. Explicitly choose Google connection.
5. Complete OAuth consent.
6. Confirm the profile/inventory plan before any cloud write.
7. Create or modify one small local item.
8. Run/allow sync.
9. Verify Sync Center reaches SYNCED, Outbox reaches zero, and no conflict/error is present.
10. Inspect failure behavior by revoking/expiring authorization only after the success path is recorded.

Never paste or commit a Google **client secret**. This browser app only needs the OAuth Web **Client ID**.

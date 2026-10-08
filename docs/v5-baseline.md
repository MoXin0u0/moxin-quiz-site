# MoXin Quiz V5 Baseline

V5 implementation branch: `v5-cloud-sync`

Frozen V4.1 base commit:

```text
bc71d9514ef7d66f314c7e6d64f680c2f88fd7a9
```

Baseline product/storage contract:

- App version: `4.1.0`
- Question Bank Schema: `2.0`
- IndexedDB name: `moxin-quiz-v3`
- IndexedDB version: `3`
- `app.html` and `v3.html` are byte-identical at the baseline.
- V5 DB v4 must not be deployed to the production origin until the deterministic migration gate passes.

Required baseline commands:

```bash
npm test
npm run preflight
npm run audit:browser
npm run audit:landing
```

The existing GitHub Actions workflow executes `npm run ci` for pull requests. Browser audits remain a separate release-gate command unless a later V5 workflow explicitly adds them.

This file records the pre-V5 state only. It is not the V5 data contract.

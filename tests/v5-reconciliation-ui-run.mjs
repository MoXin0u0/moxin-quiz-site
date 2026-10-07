import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildReconciliationMessage,
  getReconciliationPlanPresentation,
} from '../src/ui/first-sync.js';

assert.equal(
  getReconciliationPlanPresentation('upload-local').title,
  '以本機資料開始',
);
assert.equal(
  getReconciliationPlanPresentation('download-cloud').title,
  '從雲端帶入資料',
);
assert.equal(
  getReconciliationPlanPresentation('merge-required').title,
  '智慧合併本機與雲端',
);

const message = buildReconciliationMessage({
  kind: 'first-sync',
  account: { displayEmail: 'student@example.com' },
  localInventory: {
    meaningfulCount: 3,
    summary: { attempts: 2, notes: 1 },
  },
  remoteInventory: {
    meaningfulCount: 0,
    fileCount: 0,
  },
  plan: 'upload-local',
});
assert.match(message, /student@example\.com/);
assert.match(message, /套用並開始同步/);
assert.match(message, /不會建立新的雲端 profile/);

const switchMessage = buildReconciliationMessage({
  kind: 'account-switch',
  account: { displayEmail: 'other@example.com' },
  localInventory: { meaningfulCount: 1, summary: { goals: 1 } },
  remoteInventory: { meaningfulCount: 2, fileCount: 3 },
  plan: 'merge-required',
});
assert.match(switchMessage, /帳號切換/);
assert.match(
  switchMessage,
  /不會把目前裝置的資料上傳到新的 Google 帳號/,
);
assert.match(switchMessage, /舊帳號不會被遠端清除/);

const engine = fs.readFileSync('src/sync/sync-engine.js', 'utf8');
const lifecycle = fs.readFileSync('src/sync/account-lifecycle.js', 'utf8');
const flow = fs.readFileSync('src/app/cloud-sync-flow.js', 'utf8');
const syncUi = fs.readFileSync('src/app/sync-ui.js', 'utf8');
const center = fs.readFileSync('src/ui/sync-center.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(engine, /ensureCloudProfile/);
assert.match(engine, /cancelFirstSyncReconciliation/);
assert.match(lifecycle, /cancelAccountSwitch/);
assert.match(flow, /planFirstCloudConnection/);
assert.match(flow, /applyFirstCloudConnection/);
assert.match(flow, /planCloudAccountSwitch/);
assert.match(flow, /applyCloudAccountSwitch/);
assert.match(syncUi, /showReconciliationPlanDialog/);
assert.match(syncUi, /data-switch-cloud-account/);
assert.match(center, /data-switch-cloud-account/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b13c51-1'/);
assert.match(sw, /src\/app\/cloud-sync-flow\.js/);
assert.match(sw, /src\/ui\/first-sync\.js/);

console.log('V5 B13C2 reconciliation UX contracts passed.');

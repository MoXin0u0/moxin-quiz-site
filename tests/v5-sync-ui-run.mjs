
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  SYNC_STATE_PRESENTATION,
  normalizeRuntimeState,
} from '../src/ui/sync-status.js';
import { APP_CONFIG } from '../src/app/config.js';

assert.deepEqual(
  Object.keys(SYNC_STATE_PRESENTATION),
  [
    'LOCAL_ONLY',
    'SYNCED',
    'PENDING',
    'SYNCING',
    'OFFLINE',
    'AUTH_REQUIRED',
    'CONFLICT',
    'ERROR',
  ],
);

assert.equal(SYNC_STATE_PRESENTATION.LOCAL_ONLY.label, '● 僅此裝置');
assert.equal(SYNC_STATE_PRESENTATION.SYNCED.label, '✓ 已同步');
assert.equal(SYNC_STATE_PRESENTATION.PENDING.label, '↑ 等待同步');
assert.equal(SYNC_STATE_PRESENTATION.SYNCING.label, '↕ 正在同步');
assert.equal(SYNC_STATE_PRESENTATION.OFFLINE.label, '◌ 離線使用中');
assert.equal(
  SYNC_STATE_PRESENTATION.AUTH_REQUIRED.label,
  '! 請重新連結 Google',
);
assert.equal(SYNC_STATE_PRESENTATION.CONFLICT.label, '! 需要處理');
assert.equal(SYNC_STATE_PRESENTATION.ERROR.label, '× 同步失敗');
assert.notEqual(SYNC_STATE_PRESENTATION.OFFLINE.tone, 'danger');
assert.equal(normalizeRuntimeState('unknown'), 'LOCAL_ONLY');

assert.equal(APP_CONFIG.features.syncUi, true);
assert.equal(APP_CONFIG.features.cloudSync, true);

const appHtml = fs.readFileSync('app.html', 'utf8');
const v3Html = fs.readFileSync('v3.html', 'utf8');
const p7 = fs.readFileSync('src/app/p7.js', 'utf8');
const home = fs.readFileSync('src/ui/home-dashboard.js', 'utf8');
const css = fs.readFileSync('styles/v5-sync.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

for (const html of [appHtml, v3Html]) {
  assert.match(html, /id="syncStatusHost"/);
  assert.match(html, /id="syncCenterHost"/);
  assert.match(html, /data-nav-more/);
  assert.match(html, /styles\/v5-sync\.css/);
  assert.match(html, /styles\/v5-dialogs\.css/);
  assert.match(html, /src\/app\/sync-ui\.js/);
}

assert.doesNotMatch(p7, /\bconfirm\s*\(/);
assert.doesNotMatch(p7, /\balert\s*\(/);
assert.match(p7, /showConfirmDialog/);
assert.match(p7, /showMessageDialog/);

assert.match(home, /kicker: '資料安全'/);
assert.match(home, /data-open-sync-center/);
assert.match(css, /grid-template-columns:\s*repeat\(5,/);
assert.match(css, /\.nav-more-mobile/);
assert.match(css, /\.settings-cloud-card/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b13d1-2'/);
assert.match(sw, /src\/ui\/sync-status\.js/);
assert.match(sw, /src\/ui\/sync-center\.js/);
assert.match(sw, /src\/ui\/dialogs\.js/);
assert.match(sw, /src\/app\/sync-ui\.js/);

console.log('V5 B13C1 Sync Center shell contracts passed.');

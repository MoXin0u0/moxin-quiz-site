import assert from 'node:assert/strict';
import { renderSettings } from '../src/ui/settings.js';
import { renderCloudSettingsCard, renderSyncCenter } from '../src/ui/sync-center.js';

// AUD-027 and AUD-032: real render paths, using only fake DOM containers.
// Do not mock or trigger OAuth, IndexedDB writes or network synchronization.
const settingsContainer = { innerHTML: '' };
renderSettings(settingsContainer, {
  settings: {
    theme: 'system',
    learningStyle: 'academy',
    sceneIntensity: 'full',
    fontScale: 'normal',
    optionSpacing: 'normal',
    reduceMotion: false,
    studioTypeSwitchConfirm: true,
  },
  storage: { counts: { banks: 2, questions: 25 } },
  checks: [],
  pwa: { registered: false, installable: false },
  sync: { cloudConfigured: false, cloudRuntimeEnabled: false, connected: false },
});
assert.match(settingsContainer.innerHTML, /還原採「完整取代」/);
assert.match(settingsContainer.innerHTML, /題庫與學習資料/);
assert.match(settingsContainer.innerHTML, /請先下載目前資料的完整備份/);
assert.doesNotMatch(settingsContainer.innerHTML, /v3 本機資料/);
assert.match(settingsContainer.innerHTML, /Google 雲端同步為選用功能/);

const local = {
  syncUiEnabled: true,
  connected: false,
  cloudConfigured: false,
  cloudRuntimeEnabled: false,
  presentation: { tone: 'neutral', label: '僅此裝置' },
  devices: [],
  conflictCount: 0,
  pendingCount: 0,
};
const localCard = renderCloudSettingsCard(local);
assert.match(localCard, /目前無法使用 Google 雲端連結/);
assert.match(localCard, /本機練習與完整備份不受影響/);
assert.doesNotMatch(localCard, /開發環境|Client ID|雲端執行開關/);
assert.match(localCard, /data-connect-cloud disabled/);

const localDialog = { innerHTML: '' };
renderSyncCenter(localDialog, local);
assert.match(localDialog.innerHTML, /Google 雲端同步目前無法連結/);
assert.match(localDialog.innerHTML, /網站完成 Google 連結設定後/);
assert.doesNotMatch(localDialog.innerHTML, /V5 開發分支|OAuth Client ID/);
assert.match(localDialog.innerHTML, /data-connect-cloud disabled/);
assert.match(localDialog.innerHTML, /data-sync-now disabled/);

const unavailable = renderCloudSettingsCard({ ...local, cloudConfigured: true, cloudRuntimeEnabled: false });
assert.match(unavailable, /雲端同步目前暫不可用/);
assert.match(unavailable, /data-connect-cloud disabled/);

const enabled = { ...local, cloudConfigured: true, cloudRuntimeEnabled: true };
const enabledCard = renderCloudSettingsCard(enabled);
assert.match(enabledCard, /你可以繼續只使用本機資料/);
assert.match(enabledCard, /data-connect-cloud >/);
assert.doesNotMatch(enabledCard, /Google 雲端同步目前無法連結/);
const enabledDialog = { innerHTML: '' };
renderSyncCenter(enabledDialog, enabled);
assert.doesNotMatch(enabledDialog.innerHTML, /Google 雲端同步目前無法連結/);
assert.match(enabledDialog.innerHTML, /data-connect-cloud >/);

const connected = { ...enabled, connected: true };
const connectedDialog = { innerHTML: '' };
renderSyncCenter(connectedDialog, connected);
assert.match(connectedDialog.innerHTML, /data-sync-now >/);
assert.match(connectedDialog.innerHTML, /解除此裝置連結/);
assert.match(connectedDialog.innerHTML, /切換 Google 帳號/);

console.log('B03 settings backup warning and conditional cloud copy PASS.');

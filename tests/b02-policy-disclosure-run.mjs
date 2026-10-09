import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderSettings } from '../src/ui/settings.js';
import { renderCloudSettingsCard, renderSyncCenter } from '../src/ui/sync-center.js';
import { APP_CONFIG } from '../src/app/config.js';

const read = name => fs.readFileSync(name, 'utf8');
const settingsRoot = { innerHTML: '' };
const baseSettings = {
  theme: 'system',
  fontScale: 'normal',
  optionSpacing: 'normal',
  reduceMotion: false,
  learningStyle: 'academy',
  sceneIntensity: 'full',
  studioTypeSwitchConfirm: true,
};
const sync = {
  syncUiEnabled: true,
  cloudConfigured: true,
  cloudRuntimeEnabled: true,
  connected: false,
  presentation: { tone: 'neutral', label: '僅此裝置' },
};

renderSettings(settingsRoot, {
  settings: baseSettings,
  storage: { counts: {}, estimate: null },
  checks: [],
  pwa: {},
  sync,
});

const settingsHTML = settingsRoot.innerHTML;
assert.match(settingsHTML, /href="\.\/privacy\.html"/);
assert.match(settingsHTML, /href="\.\/terms\.html"/);
assert.match(settingsHTML, /data-legal-data-controls/);
assert.match(settingsHTML, /解除此裝置連結/);
assert.match(settingsHTML, /撤銷 Google 存取權/);
assert.match(settingsHTML, /清除瀏覽器網站資料/);
assert.match(settingsHTML, /Google 雲端同步資料/);
assert.match(settingsHTML, /不等於刪除/);
assert.match(settingsHTML, /rel="noopener noreferrer"/);
assert.match(settingsHTML, /Google 官方第三方授權管理說明/);

const cloudHTML = renderCloudSettingsCard(sync);
assert.match(cloudHTML, /data-cloud-link-disclosure/);
assert.match(cloudHTML, /Drive appDataFolder/);
assert.match(cloudHTML, /href="\.\/privacy\.html"/);

const modalRoot = { innerHTML: '' };
renderSyncCenter(modalRoot, sync);
assert.match(modalRoot.innerHTML, /data-sync-privacy-notice/);
assert.match(modalRoot.innerHTML, /Google 授權不等於本站服務條款的接受/);
assert.match(modalRoot.innerHTML, /href="\.\/terms\.html"/);
assert.match(modalRoot.innerHTML, /href="\.\/privacy\.html"/);

// The same disclosure must remain available to linked users without changing their actions.
const linkedRoot = { innerHTML: '' };
renderSyncCenter(linkedRoot, {
  ...sync,
  connected: true,
  account: { displayName: 'Mock Account', displayEmail: 'mock@example.invalid' },
});
assert.match(linkedRoot.innerHTML, /data-unlink-cloud/);
assert.match(linkedRoot.innerHTML, /data-switch-cloud-account/);
assert.match(linkedRoot.innerHTML, /data-sync-privacy-notice/);

for (const file of ['index.html', 'terms.html', 'privacy.html']) {
  const html = read(file);
  assert.match(html, /href="\.\/app\.html"/, `${file} should link to app`);
}
assert.match(read('index.html'), /href="\.\/privacy\.html"/);
assert.match(read('index.html'), /href="\.\/terms\.html"/);

// Drafts must not be silently copied into public policy pages without approval.
assert.match(read('docs/roadmap/legal/B02_TERMS_DRAFT.md'), /尚未生效/);
assert.match(read('docs/roadmap/legal/B02_PRIVACY_DRAFT.md'), /未生效/);
assert.match(read('docs/roadmap/legal/B02_DECISIONS_AND_RELEASE_GATE.md'), /LEG-020/);
for (const file of ['terms.html','privacy.html']) {
  assert.match(read(file), /最後更新：2026-10-08/);
  assert.doesNotMatch(read(file), /【待確認】|B02.*待審稿草案/);
}

// The whole B02 does not alter the Local-first identity or expand the Google OAuth scope.
assert.equal(APP_CONFIG.dbVersion, 4);
assert.equal(APP_CONFIG.dbName, 'moxin-quiz-v3');
assert.equal(APP_CONFIG.cloud.googleDriveScope, 'https://www.googleapis.com/auth/drive.appdata');
assert.equal(APP_CONFIG.features.cloudSync, true);
console.log('B02 policy links, user control guidance, draft boundary and Local-first contracts PASS.');

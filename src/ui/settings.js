export function renderSettings(container, { settings, storage, checks, pwa }) {
  const counts = storage?.counts || {};
  const estimate = storage?.estimate;

  container.innerHTML = `
    <section class="hero-card">
      <div>
        <p class="eyebrow">Local Settings</p>
        <h2>設定與資料管理</h2>
        <p>偏好設定保存在 localStorage；題庫與學習紀錄保存在 IndexedDB。</p>
      </div>
      <div class="settings-pwa-status">
        <span class="status-badge ${pwa?.registered ? 'success' : 'warning'}">
          ${pwa?.registered ? 'PWA 已註冊' : 'PWA 尚未啟用'}
        </span>
        <span>${escapeHtml(pwa?.detail || '')}</span>
      </div>
    </section>

    <section class="settings-grid">
      <article class="panel settings-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Appearance</p>
            <h2>外觀</h2>
          </div>
        </div>

        <div class="settings-form">
          <label>
            主題
            <select data-setting-theme>
              ${option('system', '跟隨系統', settings.theme)}
              ${option('light', '淺色', settings.theme)}
              ${option('dark', '深色', settings.theme)}
            </select>
          </label>

          <label>
            字體大小
            <select data-setting-font-scale>
              ${option('normal', '標準', settings.fontScale)}
              ${option('large', '較大', settings.fontScale)}
              ${option('x-large', '特大', settings.fontScale)}
            </select>
          </label>

          <label>
            選項間距
            <select data-setting-option-spacing>
              ${option('compact', '緊湊', settings.optionSpacing)}
              ${option('normal', '標準', settings.optionSpacing)}
              ${option('comfortable', '寬鬆', settings.optionSpacing)}
            </select>
          </label>

          <label class="settings-toggle">
            <input type="checkbox" data-setting-reduce-motion ${settings.reduceMotion ? 'checked' : ''} />
            <span>
              <strong>減少動畫</strong>
              <small>關閉大部分平滑捲動與過場動畫。</small>
            </span>
          </label>
        </div>

        <div class="settings-actions">
          <button class="button secondary" type="button" data-reset-settings>重設所有偏好設定</button>
        </div>
      </article>

      <article class="panel settings-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Question Bank Studio</p>
            <h2>題庫工作室</h2>
          </div>
        </div>

        <p class="settings-copy">
          控制工作室在可能清除答案或選項時，是否先詢問你。
        </p>

        <div class="settings-form">
          <label class="settings-toggle">
            <input
              type="checkbox"
              data-setting-studio-type-switch-confirm
              ${settings.studioTypeSwitchConfirm ? 'checked' : ''}
            />
            <span>
              <strong>題型切換前確認</strong>
              <small>
                開啟時，若切換題型會清除答案或選項，會先顯示確認視窗。
                關閉後會直接切換，並在工作室顯示可復原提示。
              </small>
            </span>
          </label>
        </div>
      </article>

      <article class="panel settings-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Backup & Restore</p>
            <h2>完整備份與還原</h2>
          </div>
        </div>

        <p class="settings-copy">
          完整備份會包含題庫、題目、題庫圖片、作答紀錄、錯題狀態、收藏、不熟題、筆記、複習排程與 Session。
        </p>

        <div class="backup-summary">
          ${miniStat('題庫', counts.banks || 0)}
          ${miniStat('題目', counts.questions || 0)}
          ${miniStat('圖片', counts.assets || 0)}
          ${miniStat('作答', counts.attempts || 0)}
        </div>

        ${estimate ? `<p class="settings-note">目前網站約使用 ${formatBytes(estimate.usage || 0)}；瀏覽器配額約 ${formatBytes(estimate.quota || 0)}。</p>` : ''}

        <div class="settings-actions">
          <button class="button primary" type="button" data-export-backup>下載完整備份</button>
          <label class="button secondary file-button">
            從備份還原
            <input type="file" accept=".json,application/json" data-import-backup />
          </label>
        </div>

        <p class="settings-warning">
          還原採「完整取代」：目前瀏覽器中的 v3 本機資料會被備份內容取代。執行前建議先下載一份目前備份。
        </p>
      </article>

      <article class="panel settings-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Install</p>
            <h2>安裝與離線</h2>
          </div>
        </div>

        <p class="settings-copy">
          GitHub Pages 使用 HTTPS，可安裝為 PWA。App Shell 會由 Service Worker 快取；已匯入題庫則直接從 IndexedDB 讀取。
        </p>

        <div class="settings-actions">
          <button class="button primary" type="button" data-install-pwa ${pwa?.installable ? '' : 'disabled'}>
            ${pwa?.installed ? '已以 App 模式執行' : '安裝 App'}
          </button>
          <button class="button secondary" type="button" data-refresh-pwa>更新離線快取</button>
        </div>

        <p class="settings-note">
          若「安裝 App」不可按，可能是瀏覽器尚未提供安裝提示，或目前已經安裝。
        </p>
      </article>

      <article class="panel settings-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Preflight</p>
            <h2>正式入口前檢查</h2>
          </div>
        </div>

        <div class="preflight-list">
          ${(checks || []).map(check => `
            <div class="preflight-row ${check.ok ? 'ok' : check.warning ? 'warning' : 'error'}">
              <span class="preflight-mark">${check.ok ? '✓' : check.warning ? '!' : '×'}</span>
              <div>
                <strong>${escapeHtml(check.label)}</strong>
                <p>${escapeHtml(check.detail || '')}</p>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="settings-actions">
          <button class="button secondary" type="button" data-rerun-preflight>重新檢查</button>
        </div>
      </article>
    </section>
  `;
}

export function readSettingsForm(container) {
  return {
    theme: container.querySelector('[data-setting-theme]')?.value || 'system',
    fontScale: container.querySelector('[data-setting-font-scale]')?.value || 'normal',
    optionSpacing: container.querySelector('[data-setting-option-spacing]')?.value || 'normal',
    reduceMotion: container.querySelector('[data-setting-reduce-motion]')?.checked === true,
    studioTypeSwitchConfirm:
      container.querySelector('[data-setting-studio-type-switch-confirm]')?.checked !== false,
  };
}

function option(value, label, current) {
  return `<option value="${escapeAttr(value)}" ${current === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function miniStat(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

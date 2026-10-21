import { renderCloudSettingsCard } from './sync-center.js';

export function renderSettings(container, { settings, storage, checks, pwa, sync }) {
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
      ${renderCloudSettingsCard(sync)}
      <article class="panel settings-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Privacy</p>
            <h2>隱私與 Google 資料使用</h2>
          </div>
        </div>

        <p class="settings-copy">
          核心學習資料採本機優先保存；Google 雲端同步為選用功能，僅要求 Drive appDataFolder 權限。
        </p>

        <div class="settings-actions">
          <a class="button secondary" href="./privacy.html" target="_blank" rel="noopener noreferrer">查看隱私權政策</a>
          <a class="button secondary" href="./terms.html" target="_blank" rel="noopener noreferrer">查看服務條款</a>
        </div>

        <details class="settings-data-control" data-legal-data-controls>
          <summary>了解四種資料管理操作的差別</summary>
          <ol>
            <li><strong>解除此裝置連結：</strong>保留本機學習資料，但不會刪除既有 Google 雲端資料。</li>
            <li><strong>撤銷 Google 存取權：</strong>到 Google 帳戶的第三方連結管理頁操作，不等於刪除已儲存的 Drive 資料。</li>
            <li><strong>清除瀏覽器網站資料：</strong>只影響目前瀏覽器與網站，不會自動清除其他裝置或雲端。</li>
            <li><strong>清除 Google 雲端同步資料：</strong>目前沒有經驗證的一鍵完整刪除功能；請勿誤認為解除連結就能刪除。</li>
          </ol>
          <p>在清除資料前，請先下載完整備份並確認其他裝置的同步狀態。</p>
          <p><a href="https://support.google.com/accounts/answer/13533235?hl=zh-Hant" target="_blank" rel="noopener noreferrer">查看 Google 官方第三方授權管理說明</a></p>
        </details>
      </article>

      <article class="panel settings-card" data-feedback-card>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Contact & Feedback</p>
            <h2>聯絡與意見回饋</h2>
          </div>
        </div>
        <p class="settings-copy">
          有功能建議、錯誤回報、題庫勘誤或資料權益問題，可以透過 Google 表單聯絡個人開發者墨忻（MoXin）。
        </p>
        <p class="settings-note" data-feedback-privacy-notice>
          開啟表單後，你自願提交的內容與聯絡方式會透過 Google Forms 處理。
          請勿提供密碼、Google 授權憑證、身分證件或私人完整備份；
          本機練習與 Google Drive 同步都不需要填寫這份表單。
          未成年使用者如需提供聯絡資訊，建議請家長或監護人協助。
        </p>
        <div class="settings-actions">
          <a class="button secondary" href="https://forms.gle/3Vhia7MFyvzyV6s2A"
             target="_blank" rel="noopener noreferrer"
             data-open-feedback-form aria-label="開啟 Google 意見回饋表單（新分頁）">填寫意見回饋表單</a>
        </div>
        <p class="settings-note" data-feedback-backup>
          若 Google 表單無法使用，或需要另行聯繫，
          可使用備用電子郵件 <a href="mailto:moxin82771@gmail.com" data-feedback-email>moxin82771@gmail.com</a>。
          郵件內容將由個人開發者用於處理你主動提出的事項。
        </p>
      </article>

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

          <fieldset class="learning-style-settings">
            <legend>學習介面風格</legend>
            <p>只影響「我的題庫、今日複習、模擬考、學習統計」等學習畫面；題庫工作室與設定維持工具型介面。</p>

            <div class="learning-style-picker">
              ${styleOption({
                value: 'academy',
                label: '經典學院',
                description: '古典書庫、手稿、黃銅儀器與學院考場的學術氛圍。',
                current: settings.learningStyle,
                previewClass: 'academy',
              })}
              ${styleOption({
                value: 'focus',
                label: '純粹專注',
                description: '降低場景與裝飾，讓內容與題目成為主角。',
                current: settings.learningStyle,
                previewClass: 'focus',
              })}
              ${styleOption({
                value: 'epic',
                label: '史詩幻想',
                description: '漂浮魔導書、符文星圖、記憶水晶與試煉殿堂的幻想知識世界。',
                current: settings.learningStyle,
                previewClass: 'epic',
              })}
              ${futureStyle({
                label: '自然晨光',
                description: '清爽自然、明亮柔和的學習環境。',
                previewClass: 'nature',
              })}
            </div>
          </fieldset>

          <fieldset class="scene-intensity-settings">
            <legend>場景效果</legend>
            <p>可保留目前風格的配色與元件，但調整大型情境視覺的存在感。</p>
            <div class="scene-intensity-picker">
              ${radioPill('full', '完整', settings.sceneIntensity, '完整顯示情境視覺')}
              ${radioPill('reduced', '減弱', settings.sceneIntensity, '降低圖片與光影存在感')}
              ${radioPill('off', '關閉', settings.sceneIntensity, '隱藏大型場景，只保留介面風格')}
            </div>
          </fieldset>

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

      <article class="panel settings-card" data-backup-card>
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
    learningStyle:
      container.querySelector('[data-setting-learning-style]:checked')?.value || 'academy',
    sceneIntensity:
      container.querySelector('[data-setting-scene-intensity]:checked')?.value || 'full',
    studioTypeSwitchConfirm:
      container.querySelector('[data-setting-studio-type-switch-confirm]')?.checked !== false,
  };
}

function styleOption({ value, label, description, current, previewClass }) {
  const checked = current === value ? 'checked' : '';
  return `
    <label class="learning-style-option">
      <input
        type="radio"
        name="learning-style"
        value="${escapeAttr(value)}"
        data-setting-learning-style
        ${checked}
      />
      <span class="learning-style-preview ${escapeAttr(previewClass)}" aria-hidden="true">
        <i></i><i></i><i></i>
      </span>
      <span class="learning-style-copy">
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(description)}</small>
      </span>
      <span class="learning-style-check" aria-hidden="true">✓</span>
    </label>
  `;
}

function futureStyle({ label, description, previewClass }) {
  return `
    <div class="learning-style-option is-future" aria-disabled="true">
      <span class="learning-style-preview ${escapeAttr(previewClass)}" aria-hidden="true">
        <i></i><i></i><i></i>
      </span>
      <span class="learning-style-copy">
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(description)}</small>
      </span>
      <span class="learning-style-soon">準備中</span>
    </div>
  `;
}

function radioPill(value, label, current, description) {
  return `
    <label class="scene-intensity-option" title="${escapeAttr(description)}">
      <input
        type="radio"
        name="scene-intensity"
        value="${escapeAttr(value)}"
        data-setting-scene-intensity
        ${current === value ? 'checked' : ''}
      />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
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

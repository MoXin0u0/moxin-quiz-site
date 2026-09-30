export function renderStorageStatus(container, status) {
  if (!container) return;
  container.className = `storage-status ${status.ok ? 'is-ok' : 'is-error'}`;
  container.textContent = status.message;
}

export function renderBankLibrary(container, banks) {
  if (!container) return;
  if (!Array.isArray(banks) || banks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>目前還沒有本機題庫</strong>
        <p>從上方匯入 ZIP、JSON，或選擇完整題庫資料夾。</p>
      </div>
    `;
    return;
  }

  container.innerHTML = banks.map(bank => `
    <article class="bank-card">
      <div class="bank-card-topline">
        <span class="bank-id">${escapeHtml(bank.id)}</span>
        <span class="schema-chip">Schema ${escapeHtml(bank.schemaVersion || '2.0')}</span>
      </div>
      <h3>${escapeHtml(bank.name || bank.title || bank.id)}</h3>
      <p>${escapeHtml(bank.description || '沒有題庫說明。')}</p>
      <dl class="bank-meta">
        <div><dt>題數</dt><dd>${formatNumber(bank.questionCount ?? 0)}</dd></div>
        <div><dt>版本</dt><dd>${escapeHtml(bank.version || '—')}</dd></div>
        <div><dt>語言</dt><dd>${escapeHtml(bank.language || '—')}</dd></div>
        <div><dt>更新</dt><dd>${escapeHtml(formatDate(bank.updatedAt || bank.storedAt || bank.importedAt))}</dd></div>
      </dl>
      <div class="card-actions">
        <button class="button primary" type="button" data-open-bank="${escapeAttr(bank.id)}">查看題庫 / 開始練習</button>
        <button class="button danger-ghost" type="button" data-delete-bank="${escapeAttr(bank.id)}">刪除本機題庫</button>
      </div>
    </article>
  `).join('');
}

export function renderInspection(container, pkg, options = {}) {
  if (!container) return;
  if (!pkg) {
    container.innerHTML = '';
    return;
  }

  if (pkg.fatalError) {
    container.innerHTML = `
      <article class="inspection-card is-error">
        <div class="inspection-heading">
          <div>
            <span class="status-badge error">無法讀取</span>
            <h3>${escapeHtml(pkg.source?.name || '題庫')}</h3>
          </div>
          <button class="icon-button" type="button" data-dismiss-inspection aria-label="關閉檢查結果">×</button>
        </div>
        <p class="fatal-message">${escapeHtml(pkg.fatalError)}</p>
      </article>
    `;
    return;
  }

  const report = pkg.report;
  const manifest = pkg.manifest || {};
  const existing = options.existingBankIds?.has(manifest.id);
  const valid = report?.valid === true;
  const issues = Array.isArray(report?.issues) ? report.issues : [];
  const errors = report?.summary?.errors ?? 0;
  const warnings = report?.summary?.warnings ?? 0;
  const questionCount = report?.summary?.questionCount ?? pkg.questions?.length ?? 0;
  const assetCount = report?.summary?.assetCount ?? pkg.assets?.length ?? 0;
  const sourceName = pkg.source?.name || pkg.source?.kind || '題庫';

  container.innerHTML = `
    <article class="inspection-card ${valid ? 'is-valid' : 'is-error'}">
      <div class="inspection-heading">
        <div>
          <div class="inspection-status-row">
            <span class="status-badge ${valid ? 'success' : 'error'}">${valid ? '驗證通過' : '驗證失敗'}</span>
            ${existing ? '<span class="status-badge warning">將更新既有題庫</span>' : ''}
          </div>
          <h3>${escapeHtml(manifest.name || manifest.id || sourceName)}</h3>
          <p>${escapeHtml(sourceName)} · ${escapeHtml(manifest.id || '無 ID')}</p>
        </div>
        <button class="icon-button" type="button" data-dismiss-inspection aria-label="關閉檢查結果">×</button>
      </div>

      <div class="inspection-stats">
        ${stat('題目', questionCount)}
        ${stat('圖片', assetCount)}
        ${stat('錯誤', errors, errors ? 'danger' : '')}
        ${stat('警告', warnings, warnings ? 'warning' : '')}
      </div>

      ${issues.length ? `
        <details class="issue-details" ${errors ? 'open' : ''}>
          <summary>查看 ${issues.length} 項檢查結果</summary>
          <div class="issue-list">
            ${issues.map(issue => `
              <div class="issue-row ${escapeAttr(issue.severity)}">
                <span class="issue-severity">${issue.severity === 'error' ? '錯誤' : '警告'}</span>
                <div>
                  <code>${escapeHtml(issue.location || 'package')}</code>
                  <p>${escapeHtml(issue.message)}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </details>
      ` : '<p class="inspection-clean">沒有發現格式問題。</p>'}

      <div class="inspection-actions">
        <button class="button primary" type="button" data-import-inspected ${valid ? '' : 'disabled'}>
          ${existing ? '更新這個題庫' : '匯入到我的題庫'}
        </button>
        <button class="button secondary" type="button" data-dismiss-inspection>取消</button>
      </div>
    </article>
  `;
}

export function showToast(container, message, kind = 'info', options = {}) {
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`;
  toast.textContent = message;
  if (options.sticky) toast.dataset.stickyToast = 'true';
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  if (!options.sticky) {
    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => toast.remove(), 180);
    }, 3600);
  }
}

function stat(label, value, kind = '') {
  return `
    <div class="inspection-stat ${kind}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-TW').format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(date);
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

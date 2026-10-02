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
        <span class="schema-chip">自行新增</span>
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


export function renderAuthorBankLibrary(container, entries, installedBanks = []) {
  if (!container) return;

  if (!Array.isArray(entries) || entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>目前沒有作者題庫</strong>
        <p>作者題庫清單目前沒有可加入的項目。</p>
      </div>
    `;
    return;
  }

  const installedMap = new Map(
    (installedBanks || [])
      .filter(bank => bank?.id)
      .map(bank => [bank.id, bank]),
  );

  container.innerHTML = entries.map(entry => {
    const installed = installedMap.get(entry.id);
    const installedVersion = installed?.version || '';
    const hasUpdate = installed && compareSimpleVersions(entry.version, installedVersion) > 0;
    const isAuthorInstalled = installed?.sourceType === 'author';

    let statusText = '尚未加入';
    let statusClass = 'neutral';
    if (isAuthorInstalled && hasUpdate) {
      statusText = '有新版';
      statusClass = 'warning';
    } else if (isAuthorInstalled) {
      statusText = '已加入';
      statusClass = 'success';
    } else if (installed) {
      statusText = '同 ID 已存在';
      statusClass = 'warning';
    }

    return `
      <article class="bank-card author-bank-card">
        <div class="bank-card-topline">
          <span class="source-chip author">作者提供</span>
          <span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span>
        </div>
        <h3>${escapeHtml(entry.name)}</h3>
        <p>${escapeHtml(entry.description || '沒有題庫說明。')}</p>
        <dl class="bank-meta">
          <div><dt>題數</dt><dd>${formatNumber(entry.questionCount ?? 0)}</dd></div>
          <div><dt>版本</dt><dd>${escapeHtml(entry.version || '—')}</dd></div>
          <div><dt>作者</dt><dd>${escapeHtml(entry.author || '—')}</dd></div>
          <div><dt>分類</dt><dd>${escapeHtml(entry.category || '—')}</dd></div>
        </dl>
        <div class="card-actions">
          ${isAuthorInstalled ? `
            <button class="button primary" type="button" data-open-bank="${escapeAttr(entry.id)}">開始練習</button>
            ${hasUpdate ? `<button class="button secondary" type="button" data-install-author-bank="${escapeAttr(entry.id)}">更新題庫</button>` : ''}
            <button class="button danger-ghost" type="button" data-delete-author-bank="${escapeAttr(entry.id)}">移除本機版本</button>
          ` : `
            <button class="button primary" type="button" data-install-author-bank="${escapeAttr(entry.id)}">
              ${installed ? '改用作者版本' : '加入我的題庫'}
            </button>
          `}
        </div>
      </article>
    `;
  }).join('');
}

export function renderAuthorCatalogError(container, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <strong>作者題庫清單暫時無法讀取</strong>
      <p>${escapeHtml(message || '請稍後重新整理。')}</p>
    </div>
  `;
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
  const studioPlan = options.studioPlan || null;
  const studioValid = studioPlan?.valid === true;
  const studioCollision = studioPlan?.hasCollision === true;
  const studioTargetId = studioPlan?.targetBankId || manifest.id || '';

  container.innerHTML = `
    <article class="inspection-card ${valid ? 'is-valid' : 'is-error'}">
      <div class="inspection-heading">
        <div>
          <div class="inspection-status-row">
            <span class="status-badge ${valid ? 'success' : 'error'}">${valid ? '驗證通過' : '驗證失敗'}</span>
            ${existing ? '<span class="status-badge warning">本機已有同 ID 題庫</span>' : ''}
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

      ${studioPlan ? `
        <div class="inspection-studio-note ${studioCollision ? 'warning' : ''}">
          <strong>${studioCollision ? '工作室會建立可編輯副本' : '可直接開進題庫工作室'}</strong>
          <p>
            ${studioCollision
              ? `本機已有 ID「${escapeHtml(studioPlan.originalBankId)}」，工作室會改用「${escapeHtml(studioTargetId)}」，不會覆蓋目前本機題庫。`
              : `工作室草稿會使用 ID「${escapeHtml(studioTargetId)}」，原始匯入檔不會被修改。`}
            ${warnings ? '目前有警告項目，可進入工作室後再檢查與修正。' : ''}
          </p>
        </div>
      ` : ''}

      <div class="inspection-actions">
        <button class="button primary" type="button" data-import-inspected ${valid ? '' : 'disabled'}>
          ${existing ? '更新這個題庫' : '匯入到我的題庫'}
        </button>
        <button class="button secondary" type="button" data-open-inspected-studio ${studioValid ? '' : 'disabled'}>
          在題庫工作室中開啟
        </button>
        <button class="button secondary" type="button" data-dismiss-inspection>取消</button>
      </div>
    </article>
  `;
}

export function showToast(container, message, kind = 'info', options = {}) {
  if (!container) return;

  const duplicate = [...container.querySelectorAll('.toast')].find(node =>
    node.dataset.toastMessage === String(message) &&
    node.dataset.toastKind === String(kind)
  );
  if (duplicate) duplicate.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${kind}`;
  toast.textContent = message;
  toast.dataset.toastMessage = String(message);
  toast.dataset.toastKind = String(kind);
  if (options.sticky) toast.dataset.stickyToast = 'true';
  container.appendChild(toast);

  const visibleNonSticky = [...container.querySelectorAll('.toast:not([data-sticky-toast])')];
  while (visibleNonSticky.length > 4) {
    visibleNonSticky.shift()?.remove();
  }

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


function compareSimpleVersions(left, right) {
  const parse = value => String(value || '0')
    .split(/[+-]/, 1)[0]
    .split('.')
    .map(part => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.length, b.length, 3);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
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

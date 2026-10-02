import fs from 'node:fs';

const ROOT = process.cwd();

const NEW_BATCH_MODULE = 'import {\n  BATCH_PARSE_STATUS,\n  parseBatchQuestionText,\n  selectBatchQuestions,\n} from \'../studio/batch-parser.js\';\n\nconst STYLE_HREF = \'./styles/v4-studio-batch.css\';\n\nexport function openStudioBatchImportDialog({\n  existingQuestions = [],\n  typeLabels = {},\n} = {}) {\n  ensureBatchStyles();\n\n  return new Promise(resolve => {\n    const dialog = document.createElement(\'dialog\');\n    dialog.className = \'studio-r1-dialog studio-r1-batch-dialog\';\n    dialog.setAttribute(\'aria-labelledby\', \'studioBatchDialogTitle\');\n\n    dialog.innerHTML = `\n      <section class="studio-r1-batch-card">\n        <header class="studio-r1-batch-head">\n          <div>\n            <span class="studio-r1-kicker">P2B · 批次貼題</span>\n            <h3 id="studioBatchDialogTitle">把文字解析成工作室草稿</h3>\n            <p>只整理來源中明確提供的資料；缺少答案或題型不確定時會標成「需確認」，不會替你猜答案。</p>\n          </div>\n          <button class="studio-r1-batch-close" type="button" data-studio-batch-close aria-label="關閉">×</button>\n        </header>\n\n        <div class="studio-r1-batch-source">\n          <label for="studioBatchSource">原始題目文字</label>\n          <textarea\n            id="studioBatchSource"\n            data-studio-batch-source\n            rows="12"\n            placeholder="例如：\n1. ERP 系統的核心目的是？\nA. 整合企業流程與資訊\nB. 只處理薪資\n答案：A\n解析：ERP 用於跨部門資訊整合。"></textarea>\n\n          <div class="studio-r1-batch-source-actions">\n            <small>支援 1.／1、／Q1／第1題／題目：，以及答案、詳解、章節、標籤、難度等欄位。</small>\n            <button class="button primary" type="button" data-studio-batch-parse>解析題目</button>\n          </div>\n        </div>\n\n        <div class="studio-r1-batch-results" data-studio-batch-results>\n          <div class="studio-r1-empty">\n            <strong>尚未解析</strong>\n            <p>貼上題目文字後按「解析題目」。解析結果不會立即寫入草稿。</p>\n          </div>\n        </div>\n\n        <footer class="studio-r1-batch-footer">\n          <div data-studio-batch-selection-note>解析後可選擇要加入的題目。</div>\n          <div class="studio-r1-batch-footer-actions">\n            <button class="button secondary" type="button" data-studio-batch-close>取消</button>\n            <button class="button primary" type="button" data-studio-batch-add disabled>加入題目</button>\n          </div>\n        </footer>\n      </section>\n    `;\n\n    let result = null;\n    let settled = false;\n\n    const finish = value => {\n      if (settled) return;\n      settled = true;\n      if (dialog.open && typeof dialog.close === \'function\') dialog.close();\n      dialog.remove();\n      resolve(value);\n    };\n\n    const updateSelection = () => {\n      const selected = [\n        ...dialog.querySelectorAll(\'[data-batch-candidate-index]:checked:not(:disabled)\'),\n      ];\n      const addButton = dialog.querySelector(\'[data-studio-batch-add]\');\n      const note = dialog.querySelector(\'[data-studio-batch-selection-note]\');\n\n      if (addButton) {\n        addButton.disabled = selected.length === 0;\n        addButton.textContent = selected.length ? `加入 ${selected.length} 題` : \'加入題目\';\n      }\n\n      if (note) {\n        const reviewCount = selected.filter(\n          input => input.dataset.batchStatus === BATCH_PARSE_STATUS.REVIEW,\n        ).length;\n\n        note.textContent = selected.length\n          ? `已選 ${selected.length} 題${reviewCount ? `，其中 ${reviewCount} 題為人工確認項目` : \'\'}。`\n          : \'尚未選擇要加入的題目。\';\n      }\n    };\n\n    dialog.addEventListener(\'cancel\', event => {\n      event.preventDefault();\n      finish(null);\n    });\n\n    dialog.addEventListener(\'change\', event => {\n      if (event.target.matches(\'[data-batch-candidate-index]\')) updateSelection();\n    });\n\n    dialog.addEventListener(\'click\', event => {\n      if (event.target === dialog || event.target.closest(\'[data-studio-batch-close]\')) {\n        finish(null);\n        return;\n      }\n\n      if (event.target.closest(\'[data-studio-batch-parse]\')) {\n        const source = dialog.querySelector(\'[data-studio-batch-source]\')?.value || \'\';\n        const host = dialog.querySelector(\'[data-studio-batch-results]\');\n\n        if (!source.trim()) {\n          if (host) {\n            host.innerHTML =\n              \'<div class="studio-r1-batch-message is-warning">請先貼上要解析的題目文字。</div>\';\n          }\n          result = null;\n          updateSelection();\n          return;\n        }\n\n        result = parseBatchQuestionText(source, { existingQuestions });\n\n        if (host) {\n          host.innerHTML = renderBatchImportPreview(result, typeLabels);\n        }\n        updateSelection();\n        return;\n      }\n\n      if (event.target.closest(\'[data-studio-batch-add]\')) {\n        if (!result) return;\n\n        const selectedInputs = [\n          ...dialog.querySelectorAll(\'[data-batch-candidate-index]:checked:not(:disabled)\'),\n        ];\n        const selectedIndexes = selectedInputs.map(\n          input => Number(input.dataset.batchCandidateIndex),\n        );\n        const includeReview = selectedInputs.some(\n          input => input.dataset.batchStatus === BATCH_PARSE_STATUS.REVIEW,\n        );\n\n        const additions = selectBatchQuestions(result.candidates, {\n          existingQuestions,\n          includeReview,\n          selectedIndexes,\n        });\n\n        if (additions.length) finish(additions);\n      }\n    });\n\n    document.body.appendChild(dialog);\n\n    if (typeof dialog.showModal === \'function\') {\n      dialog.showModal();\n    } else {\n      dialog.setAttribute(\'open\', \'\');\n      dialog.classList.add(\'is-fallback\');\n    }\n\n    dialog.querySelector(\'[data-studio-batch-source]\')?.focus();\n  });\n}\n\nfunction renderBatchImportPreview(result, typeLabels) {\n  const summary = result?.summary || {\n    total: 0,\n    ready: 0,\n    review: 0,\n    unparsed: 0,\n  };\n\n  const preamble = result?.preamble?.trim()\n    ? `\n      <details class="studio-r1-batch-preamble">\n        <summary>解析前偵測到未歸入題目的前言</summary>\n        <pre>${escapeHtml(result.preamble)}</pre>\n      </details>\n    `\n    : \'\';\n\n  const cards = (result?.candidates || [])\n    .map(candidate => renderBatchCandidateCard(candidate, typeLabels))\n    .join(\'\');\n\n  return `\n    <div class="studio-r1-batch-summary" aria-label="解析摘要">\n      <div><span>全部</span><strong>${summary.total}</strong></div>\n      <div class="is-ready"><span>可直接加入</span><strong>${summary.ready}</strong></div>\n      <div class="is-review"><span>需確認</span><strong>${summary.review}</strong></div>\n      <div class="is-unparsed"><span>未解析</span><strong>${summary.unparsed}</strong></div>\n    </div>\n\n    ${preamble}\n\n    <div class="studio-r1-batch-list">\n      ${cards || `\n        <div class="studio-r1-empty">\n          <strong>沒有找到題目</strong>\n          <p>請檢查題號或「題目：」欄位格式。</p>\n        </div>\n      `}\n    </div>\n  `;\n}\n\nfunction renderBatchCandidateCard(candidate, typeLabels) {\n  const status = candidate.status;\n  const isReady = status === BATCH_PARSE_STATUS.READY;\n  const isReview = status === BATCH_PARSE_STATUS.REVIEW;\n  const isUnparsed = status === BATCH_PARSE_STATUS.UNPARSED;\n  const question = candidate.question;\n\n  const label = isReady ? \'可直接加入\' : isReview ? \'需確認\' : \'未解析\';\n  const checked = isReady ? \'checked\' : \'\';\n  const disabled = isUnparsed ? \'disabled\' : \'\';\n\n  const issues = (candidate.issues || [])\n    .map(item => `<li>${escapeHtml(item.message)}</li>`)\n    .join(\'\');\n\n  const options = question?.options?.length\n    ? `\n      <div class="studio-r1-batch-options">\n        ${question.options.map(option => `\n          <span>\n            <strong>${escapeHtml(option.id)}</strong>\n            ${escapeHtml(option.text)}\n          </span>\n        `).join(\'\')}\n      </div>\n    `\n    : \'\';\n\n  return `\n    <article class="studio-r1-batch-item is-${escapeAttr(status)}">\n      <div class="studio-r1-batch-item-head">\n        <label class="studio-r1-batch-select">\n          <input\n            type="checkbox"\n            data-batch-candidate-index="${candidate.index}"\n            data-batch-status="${escapeAttr(status)}"\n            ${checked}\n            ${disabled}\n          />\n          <span>\n            <strong>${escapeHtml(question?.id || `區塊 ${candidate.index + 1}`)}</strong>\n            <small>${\n              isReview\n                ? \'我已確認，仍加入草稿\'\n                : isUnparsed\n                  ? \'無法直接加入\'\n                  : \'加入草稿\'\n            }</small>\n          </span>\n        </label>\n\n        <span class="studio-r1-batch-status is-${escapeAttr(status)}">${label}</span>\n      </div>\n\n      ${question ? `\n        <div class="studio-r1-batch-question">\n          <div>\n            <span>${escapeHtml(typeLabels[question.type] || question.type)}</span>\n            <strong>${escapeHtml(question.question || \'未提供題目\')}</strong>\n          </div>\n\n          <dl>\n            <div>\n              <dt>答案</dt>\n              <dd>${escapeHtml(formatBatchCandidateAnswer(question))}</dd>\n            </div>\n            <div>\n              <dt>章節</dt>\n              <dd>${escapeHtml(question.chapter || \'—\')}</dd>\n            </div>\n            <div>\n              <dt>難度</dt>\n              <dd>${escapeHtml(question.difficulty || 3)}</dd>\n            </div>\n          </dl>\n\n          ${options}\n        </div>\n      ` : \'\'}\n\n      ${issues ? `<ul class="studio-r1-batch-issues">${issues}</ul>` : \'\'}\n\n      <details class="studio-r1-batch-raw">\n        <summary>查看原始文字</summary>\n        <pre>${escapeHtml(candidate.raw || \'\')}</pre>\n      </details>\n    </article>\n  `;\n}\n\nfunction formatBatchCandidateAnswer(question) {\n  const answer = Array.isArray(question?.answer) ? question.answer : [];\n  if (!answer.length) return \'尚未設定\';\n  if (question.type === \'true-false\') return answer[0] === true ? \'正確\' : \'錯誤\';\n  return answer.join(\'、\');\n}\n\nfunction ensureBatchStyles() {\n  if (document.querySelector(\'link[data-v4-studio-batch-styles]\')) return;\n\n  const link = document.createElement(\'link\');\n  link.rel = \'stylesheet\';\n  link.href = STYLE_HREF;\n  link.dataset.v4StudioBatchStyles = \'true\';\n  document.head.appendChild(link);\n}\n\nfunction escapeHtml(value) {\n  return String(value ?? \'\')\n    .replaceAll(\'&\', \'&amp;\')\n    .replaceAll(\'<\', \'&lt;\')\n    .replaceAll(\'>\', \'&gt;\')\n    .replaceAll(\'"\', \'&quot;\')\n    .replaceAll("\'", \'&#039;\');\n}\n\nfunction escapeAttr(value) {\n  return escapeHtml(value).replaceAll(\'`\', \'&#096;\');\n}\n';
const NEW_BATCH_CSS = '/* v4.0 P2B.1 — Studio Batch Import */\n\n.studio-r1-home-actions {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: flex-end;\n  gap: .55rem;\n}\n\n.studio-r1-batch-dialog {\n  width: min(1080px, calc(100vw - 2rem));\n  max-height: min(90vh, 920px);\n}\n\n.studio-r1-batch-card {\n  display: grid;\n  gap: 1rem;\n  max-height: min(90vh, 920px);\n  overflow: hidden;\n  padding: 1rem;\n  border: 1px solid var(--line);\n  border-radius: 18px;\n  background: var(--surface-elevated);\n  color: var(--text);\n  box-shadow: 0 28px 70px rgba(0, 0, 0, .30);\n}\n\n.studio-r1-batch-head,\n.studio-r1-batch-source-actions,\n.studio-r1-batch-footer,\n.studio-r1-batch-footer-actions,\n.studio-r1-batch-item-head,\n.studio-r1-batch-select {\n  display: flex;\n  align-items: center;\n}\n\n.studio-r1-batch-head {\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 1rem;\n}\n\n.studio-r1-batch-head h3 {\n  margin: .18rem 0 .35rem;\n}\n\n.studio-r1-batch-head p {\n  max-width: 760px;\n  margin: 0;\n  color: var(--text-muted);\n  line-height: 1.55;\n}\n\n.studio-r1-batch-close {\n  display: grid;\n  place-items: center;\n  width: 2.35rem;\n  height: 2.35rem;\n  flex: 0 0 auto;\n  border: 1px solid var(--line);\n  border-radius: 10px;\n  background: var(--surface-2);\n  color: var(--text);\n  font-size: 1.25rem;\n  cursor: pointer;\n}\n\n.studio-r1-batch-source {\n  display: grid;\n  gap: .5rem;\n}\n\n.studio-r1-batch-source > label {\n  font-size: .82rem;\n  font-weight: 800;\n}\n\n.studio-r1-batch-source textarea {\n  width: 100%;\n  min-height: 190px;\n  resize: vertical;\n  font: 500 .88rem/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.studio-r1-batch-source-actions {\n  justify-content: space-between;\n  gap: .8rem;\n}\n\n.studio-r1-batch-source-actions small,\n.studio-r1-batch-footer > div:first-child {\n  color: var(--text-muted);\n  line-height: 1.45;\n}\n\n.studio-r1-batch-results {\n  min-height: 120px;\n  overflow: auto;\n  padding-right: .15rem;\n}\n\n.studio-r1-batch-summary {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: .55rem;\n  margin-bottom: .7rem;\n}\n\n.studio-r1-batch-summary > div {\n  display: grid;\n  gap: .12rem;\n  padding: .65rem .75rem;\n  border: 1px solid var(--line);\n  border-radius: 11px;\n  background: var(--surface-2);\n}\n\n.studio-r1-batch-summary span {\n  color: var(--text-muted);\n  font-size: .73rem;\n}\n\n.studio-r1-batch-summary strong {\n  font-size: 1.1rem;\n}\n\n.studio-r1-batch-summary .is-ready strong { color: var(--success); }\n.studio-r1-batch-summary .is-review strong { color: var(--warning); }\n.studio-r1-batch-summary .is-unparsed strong { color: var(--danger); }\n\n.studio-r1-batch-list {\n  display: grid;\n  gap: .65rem;\n}\n\n.studio-r1-batch-item {\n  display: grid;\n  gap: .65rem;\n  padding: .8rem;\n  border: 1px solid var(--line);\n  border-radius: 13px;\n  background: var(--surface);\n}\n\n.studio-r1-batch-item.is-ready {\n  border-color: color-mix(in srgb, var(--success) 34%, var(--line));\n}\n\n.studio-r1-batch-item.is-review {\n  border-color: color-mix(in srgb, var(--warning) 40%, var(--line));\n}\n\n.studio-r1-batch-item.is-unparsed {\n  border-color: color-mix(in srgb, var(--danger) 34%, var(--line));\n  opacity: .88;\n}\n\n.studio-r1-batch-item-head {\n  justify-content: space-between;\n  gap: .75rem;\n}\n\n.studio-r1-batch-select {\n  gap: .55rem;\n  min-width: 0;\n  cursor: pointer;\n}\n\n.studio-r1-batch-select input {\n  min-height: 0;\n}\n\n.studio-r1-batch-select > span {\n  display: grid;\n  gap: .05rem;\n}\n\n.studio-r1-batch-select small {\n  color: var(--text-muted);\n}\n\n.studio-r1-batch-status {\n  flex: 0 0 auto;\n  padding: .25rem .52rem;\n  border-radius: 999px;\n  font-size: .72rem;\n  font-weight: 850;\n}\n\n.studio-r1-batch-status.is-ready {\n  background: var(--success-soft);\n  color: var(--success);\n}\n\n.studio-r1-batch-status.is-review {\n  background: var(--warning-soft);\n  color: var(--warning);\n}\n\n.studio-r1-batch-status.is-unparsed {\n  background: var(--danger-soft);\n  color: var(--danger);\n}\n\n.studio-r1-batch-question {\n  display: grid;\n  gap: .55rem;\n  padding: .7rem;\n  border-radius: 11px;\n  background: var(--surface-2);\n}\n\n.studio-r1-batch-question > div:first-child {\n  display: grid;\n  gap: .2rem;\n}\n\n.studio-r1-batch-question > div:first-child span {\n  color: var(--primary);\n  font-size: .72rem;\n  font-weight: 800;\n}\n\n.studio-r1-batch-question > div:first-child strong {\n  line-height: 1.5;\n}\n\n.studio-r1-batch-question dl {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: .45rem;\n  margin: 0;\n}\n\n.studio-r1-batch-question dl > div {\n  min-width: 0;\n}\n\n.studio-r1-batch-question dt {\n  color: var(--text-muted);\n  font-size: .68rem;\n}\n\n.studio-r1-batch-question dd {\n  overflow: hidden;\n  margin: .08rem 0 0;\n  font-size: .78rem;\n  font-weight: 750;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.studio-r1-batch-options {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: .35rem;\n}\n\n.studio-r1-batch-options span {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr);\n  gap: .4rem;\n  padding: .4rem .5rem;\n  border: 1px solid var(--line);\n  border-radius: 8px;\n  background: var(--surface);\n  font-size: .76rem;\n}\n\n.studio-r1-batch-issues {\n  display: grid;\n  gap: .28rem;\n  margin: 0;\n  padding: 0 0 0 1.15rem;\n  color: var(--warning);\n  font-size: .78rem;\n  line-height: 1.45;\n}\n\n.studio-r1-batch-raw summary,\n.studio-r1-batch-preamble summary {\n  color: var(--text-muted);\n  font-size: .76rem;\n  font-weight: 750;\n  cursor: pointer;\n}\n\n.studio-r1-batch-raw pre,\n.studio-r1-batch-preamble pre {\n  overflow: auto;\n  margin: .45rem 0 0;\n  padding: .65rem;\n  border: 1px solid var(--line);\n  border-radius: 9px;\n  background: var(--surface-3);\n  color: var(--text);\n  font: 500 .74rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  white-space: pre-wrap;\n}\n\n.studio-r1-batch-preamble {\n  margin-bottom: .7rem;\n  padding: .65rem;\n  border: 1px solid var(--warning);\n  border-radius: 10px;\n  background: var(--warning-soft);\n}\n\n.studio-r1-batch-message {\n  padding: .8rem;\n  border: 1px solid var(--line);\n  border-radius: 11px;\n  background: var(--surface-2);\n}\n\n.studio-r1-batch-message.is-warning {\n  border-color: color-mix(in srgb, var(--warning) 42%, var(--line));\n  background: var(--warning-soft);\n  color: var(--warning);\n}\n\n.studio-r1-batch-footer {\n  justify-content: space-between;\n  gap: 1rem;\n  padding-top: .8rem;\n  border-top: 1px solid var(--line);\n}\n\n.studio-r1-batch-footer-actions {\n  gap: .55rem;\n  flex: 0 0 auto;\n}\n\n@media (max-width: 720px) {\n  .studio-r1-home-actions,\n  .studio-r1-batch-source-actions,\n  .studio-r1-batch-footer {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .studio-r1-home-actions .button,\n  .studio-r1-batch-source-actions .button,\n  .studio-r1-batch-footer-actions .button {\n    width: 100%;\n  }\n\n  .studio-r1-batch-summary {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .studio-r1-batch-question dl,\n  .studio-r1-batch-options {\n    grid-template-columns: 1fr;\n  }\n\n  .studio-r1-batch-footer-actions {\n    width: 100%;\n  }\n}\n';
const NEW_P2B1_TEST = "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst studio = fs.readFileSync('src/ui/studio-r1.js', 'utf8');\nconst batchUi = fs.readFileSync('src/ui/studio-batch-import.js', 'utf8');\nconst batchCss = fs.readFileSync('styles/v4-studio-batch.css', 'utf8');\nconst sw = fs.readFileSync('service-worker.js', 'utf8');\n\nassert.match(studio, /openStudioBatchImportDialog/);\nassert.match(studio, /data-studio-new-batch/);\nassert.match(studio, /data-studio-batch-import/);\nassert.match(studio, /replaceStarter/);\nassert.match(studio, /isPristineStarterQuestion/);\nassert.match(studio, /state\\.draft\\.questions = additions/);\nassert.match(studio, /state\\.draft\\.questions\\.push\\(\\.\\.\\.additions\\)/);\n\nassert.match(batchUi, /from '\\.\\.\\/studio\\/batch-parser\\.js'/);\nassert.match(batchUi, /parseBatchQuestionText/);\nassert.match(batchUi, /selectBatchQuestions/);\nassert.match(batchUi, /BATCH_PARSE_STATUS/);\nassert.match(batchUi, /data-studio-batch-source/);\nassert.match(batchUi, /data-studio-batch-parse/);\nassert.match(batchUi, /data-studio-batch-add/);\nassert.match(batchUi, /data-batch-candidate-index/);\nassert.match(batchUi, /可直接加入/);\nassert.match(batchUi, /需確認/);\nassert.match(batchUi, /未解析/);\nassert.match(batchUi, /我已確認，仍加入草稿/);\nassert.match(batchUi, /includeReview/);\n\nassert.match(batchCss, /v4\\.0 P2B\\.1 — Studio Batch Import/);\nassert.match(batchCss, /\\.studio-r1-batch-dialog/);\nassert.match(batchCss, /\\.studio-r1-batch-item\\.is-ready/);\nassert.match(batchCss, /\\.studio-r1-batch-item\\.is-review/);\nassert.match(batchCss, /\\.studio-r1-batch-item\\.is-unparsed/);\nassert.match(batchCss, /@media \\(max-width: 720px\\)/);\n\nassert.match(sw, /\\.\\/styles\\/v4-studio-batch\\.css/);\nassert.match(sw, /\\.\\/src\\/ui\\/studio-batch-import\\.js/);\n\nfor (const legacyReadme of [\n  'README-P2B.txt',\n  'README-R2K3.1.txt',\n  'README-R2K4.txt',\n  'README-R2K5.txt',\n  'README-R2K5.1.md',\n  'README-R2K5.2.md',\n  'README-R2K5.2.1.md',\n  'README-R2K5.3.md',\n  'README-R2K5.4.md',\n]) {\n  assert.equal(\n    fs.existsSync(legacyReadme),\n    false,\n    `${legacyReadme} should be consolidated into docs/V4_0_CHANGELOG.md`,\n  );\n}\n\nassert.equal(fs.existsSync('docs/V4_0_CHANGELOG.md'), true);\n\nconsole.log('MoXin Quiz v4.0 P2B.1 Studio batch UI + repository hygiene tests passed.');\n";
const NEW_P2B1_DOC = '# 墨忻刷題網 v4.0 — P2B.1 Studio Batch Import UI\n\n## 目的\n\n把 P2B Parser Core 正式接進題庫工作室。\n\n```text\n原始文字\n→ 解析\n→ ready / review / unparsed 預覽\n→ 使用者勾選\n→ 加入目前 Studio Draft\n→ 既有 Inspector / Draft Validation 再驗證\n```\n\n## 安全行為\n\n- `ready`：預設勾選。\n- `review`：預設不勾選，必須明確勾選「我已確認，仍加入草稿」。\n- `unparsed`：不可直接加入，只保留原始文字。\n- Parser 不直接寫入正式題庫。\n- 加入草稿時重新配置永久題目 ID。\n- 缺少答案仍維持 `answer: []`，交由工作室既有驗證提示。\n\n## 入口\n\n- 工作室首頁「批次貼題」：建立新草稿後直接開啟解析器。若草稿只有初始空白 Q001，成功匯入後會用批次題目取代這個空白 starter。\n- 編輯器「批次貼題」：把解析結果附加到目前草稿。\n\n## 預覽資訊\n\n每題顯示：\n\n- 狀態\n- 題型\n- 題目\n- 答案\n- 章節\n- 難度\n- 選項\n- Parser / Draft issues\n- 原始文字\n\n## Offline\n\n`src/ui/studio-batch-import.js` 與 `styles/v4-studio-batch.css` 都加入 Service Worker APP_SHELL。\n\n## Repository hygiene\n\n同步移除根目錄的一次性 `README-R2K*` 與 `README-P2B.txt`。里程碑摘要集中到 `docs/V4_0_CHANGELOG.md`。\n';
const NEW_CHANGELOG = '# 墨忻刷題網 v4.0 — Development Changelog\n\n本檔集中保存 v4.0 開發里程碑摘要。根目錄只保留正式 `README.md`；一次性更新包說明不再累積在 repository root。\n\n## P2B.1 — Studio Batch Import UI\n- P2B Parser Core 接入題庫工作室。\n- 工作室首頁與編輯器新增「批次貼題」入口。\n- 提供 ready / review / unparsed 預覽。\n- review 題目必須由使用者明確勾選後才加入草稿。\n- 新草稿批次匯入會取代初始空白 starter question。\n- 加入後仍使用既有 Question Draft Model 與 Inspector 驗證。\n- 新增離線 App Shell 項目。\n- 清理 repository root 的里程碑 README。\n\n## P2B — Batch Question Parser Core\n- 新增 `src/studio/batch-parser.js`。\n- 支援常見題號、題型、答案、詳解、章節、標籤與難度。\n- 不猜答案；資訊不足標示 review；原始文字保留。\n\n## R2K.5.4 — True Epic World Separation\n- Epic 與 Academy 使用完全不同的場景來源與世界結構。\n- 8 張獨立 Epic source；Desktop / Mobile 共 16 張正式資產。\n- 新增 provenance 與 Academy-vs-Epic 視覺差異 gate。\n\n## R2K.5.3 — Epic Native Source Experiment\n- 解決低解析來源放大的模糊問題。\n- 後續發現仍沿用 Academy 世界結構，因此由 R2K.5.4 取代。\n\n## R2K.5.2 / R2K.5.2.1\n- 第一輪 Epic 高細節素材整合。\n- 修正舊 milestone tests 固定 cache revision 的問題。\n\n## R2K.5.1 — Academy Style Correction\n- Academy 改為高細節古典學院場景。\n- Desktop / Mobile 使用獨立 production assets。\n\n## R2K.5 — Production Scene Assets\n- 建立 production asset pipeline 與尺寸 / 資產品質 audit。\n\n## R2K.4 — Responsive Scene Runtime\n- Desktop / Mobile、focal point、高 DPI fallback。\n- Save-Data / prefers-reduced-data。\n- decode 後再交換場景，降低閃爍。\n\n## R2K.3 / R2K.3.1 — High-Fidelity Scene Pipeline\n- 場景資產退出 APP_SHELL，改用 Runtime Scene Cache。\n- R2G / R2H regression contract 對齊新 cache 架構。\n\n## 文件規則\n- 長期規格放在 `docs/`。\n- 里程碑摘要追加到本檔。\n- 根目錄不再新增 `README-<milestone>.*`。\n';

const DELETE_READMES = [
  'README-P2B.txt',
  'README-R2K3.1.txt',
  'README-R2K4.txt',
  'README-R2K5.txt',
  'README-R2K5.1.md',
  'README-R2K5.2.md',
  'README-R2K5.2.1.md',
  'README-R2K5.3.md',
  'README-R2K5.4.md',
];

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOne(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Patch anchor is not unique: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function patchStudio() {
  const path = 'src/ui/studio-r1.js';
  let source = read(path);

  const assetImport = `import {
  addQuestionImages,
  duplicateQuestionAssets,
  findUnusedAssets,
  getAssetByPath,
  getAssetUsageSummary,
  pruneUnusedAssets,
  removeQuestionImage,
  replaceQuestionImage,
} from '../studio/asset-manager.js';
`;

  if (!source.includes("from './studio-batch-import.js'")) {
    source = replaceOne(
      source,
      assetImport,
      assetImport + `
import {
  openStudioBatchImportDialog,
} from './studio-batch-import.js';
`,
      'studio batch import',
    );
  }

  if (!source.includes('data-studio-new-batch')) {
    source = replaceOne(
      source,
      `        <button class="button primary" type="button" data-studio-new>＋ 建立新題庫</button>`,
      `        <div class="studio-r1-home-actions">
          <button class="button secondary" type="button" data-studio-new-batch>批次貼題</button>
          <button class="button primary" type="button" data-studio-new>＋ 建立新題庫</button>
        </div>`,
      'studio home batch action',
    );
  }

  if (!source.includes("event.target.closest('[data-studio-new-batch]')")) {
    source = replaceOne(
      source,
      `    if (event.target.closest('[data-studio-new]')) return createNewDraft();

    if (event.target.closest('[data-studio-back]')) {`,
      `    if (event.target.closest('[data-studio-new-batch]')) {
      await createNewDraft();
      await importBatchQuestions({ replaceStarter: true });
      return;
    }

    if (event.target.closest('[data-studio-new]')) return createNewDraft();

    if (event.target.closest('[data-studio-back]')) {`,
      'studio home batch click',
    );
  }

  if (!source.includes('data-studio-batch-import')) {
    source = replaceOne(
      source,
      `          <button class="button secondary compact" type="button" data-studio-validate>檢查</button>
          <button class="button primary compact" type="button" data-studio-save-library \${report.valid ? '' : 'disabled'}>儲存到我的題庫</button>`,
      `          <button class="button secondary compact" type="button" data-studio-batch-import>批次貼題</button>
          <button class="button secondary compact" type="button" data-studio-validate>檢查</button>
          <button class="button primary compact" type="button" data-studio-save-library \${report.valid ? '' : 'disabled'}>儲存到我的題庫</button>`,
      'studio editor batch button',
    );
  }

  if (!source.includes("event.target.closest('[data-studio-batch-import]')")) {
    source = replaceOne(
      source,
      `    if (event.target.closest('[data-studio-validate]')) {
      updateInspector();
      setStatus('已重新檢查目前題庫。', 'ok');
      return;
    }

    if (event.target.closest('[data-studio-save-library]')) return saveDraftToLibrary();`,
      `    if (event.target.closest('[data-studio-batch-import]')) {
      await importBatchQuestions();
      return;
    }

    if (event.target.closest('[data-studio-validate]')) {
      updateInspector();
      setStatus('已重新檢查目前題庫。', 'ok');
      return;
    }

    if (event.target.closest('[data-studio-save-library]')) return saveDraftToLibrary();`,
      'studio editor batch click',
    );
  }

  if (!source.includes('async function importBatchQuestions')) {
    const helper = `
async function importBatchQuestions({ replaceStarter = false } = {}) {
  if (!state.draft) return;

  const canReplaceStarter =
    replaceStarter &&
    state.draft.questions.length === 1 &&
    isPristineStarterQuestion(state.draft.questions[0]);

  const existingQuestions = canReplaceStarter ? [] : state.draft.questions;
  const additions = await openStudioBatchImportDialog({
    existingQuestions,
    typeLabels: TYPE_LABELS,
  });

  if (!additions?.length) return;

  clearUndoState();

  if (canReplaceStarter) {
    state.draft.questions = additions;
  } else {
    state.draft.questions.push(...additions);
  }

  state.activeQuestionId = additions[0].id;
  await persistDraftNow();
  renderEditor();
  setStatus(
    \`已從批次文字加入 \${additions.length} 題。需確認的題目仍會由工作室驗證標示。\`,
    'ok',
  );
}

function isPristineStarterQuestion(question) {
  if (!question || question.type !== 'single-choice') return false;
  if (String(question.question || '').trim()) return false;
  if (String(question.explanation || '').trim()) return false;
  if ((question.answer || []).length) return false;
  if ((question.images || []).length || (question.explanationImages || []).length) return false;
  if (String(question.chapter || '').trim()) return false;
  if ((question.tags || []).length) return false;

  const options = Array.isArray(question.options) ? question.options : [];
  return options.length === 2 && options.every(option => !String(option.text || '').trim());
}

`;

    source = replaceOne(
      source,
      'async function changeCurrentQuestionType(targetType) {',
      helper + 'async function changeCurrentQuestionType(targetType) {',
      'studio batch helper insertion',
    );
  }

  write(path, source);
}

function patchServiceWorker() {
  const path = 'service-worker.js';
  let source = read(path);

  if (!source.includes("'./styles/v4-studio-batch.css'")) {
    source = replaceOne(
      source,
      "  './styles/v4-studio-r1.css',",
      "  './styles/v4-studio-r1.css',\n  './styles/v4-studio-batch.css',",
      'service worker batch css',
    );
  }

  if (!source.includes("'./src/ui/studio-batch-import.js'")) {
    source = replaceOne(
      source,
      "  './src/ui/studio-r1.js',",
      "  './src/ui/studio-r1.js',\n  './src/ui/studio-batch-import.js',",
      'service worker batch module',
    );
  }

  write(path, source);
}

function patchPackage() {
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const oldPiece =
    'node tests/v40-p2b-batch-parser-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';
  const newPiece =
    'node tests/v40-p2b-batch-parser-run.mjs && node tests/v40-p2b1-studio-batch-ui-run.mjs && node tests/v40-r2a-learning-experience-run.mjs';

  if (!pkg.scripts.test.includes('v40-p2b1-studio-batch-ui-run.mjs')) {
    if (!pkg.scripts.test.includes(oldPiece)) throw new Error('package.json P2B anchor not found');
    pkg.scripts.test = pkg.scripts.test.replace(oldPiece, newPiece);
  }

  write(path, JSON.stringify(pkg, null, 2) + '\n');
}

function writeNewFiles() {
  write('src/ui/studio-batch-import.js', NEW_BATCH_MODULE);
  write('styles/v4-studio-batch.css', NEW_BATCH_CSS);
  write('tests/v40-p2b1-studio-batch-ui-run.mjs', NEW_P2B1_TEST);
  write('docs/V4_0_P2B_1_STUDIO_BATCH_IMPORT_UI.md', NEW_P2B1_DOC);
  write('docs/V4_0_CHANGELOG.md', NEW_CHANGELOG);
}

function cleanupReadmes() {
  for (const path of DELETE_READMES) {
    if (fs.existsSync(path)) fs.rmSync(path);
  }
}

function verify() {
  const studio = read('src/ui/studio-r1.js');
  const sw = read('service-worker.js');
  const pkg = JSON.parse(read('package.json'));

  const required = [
    "from './studio-batch-import.js'",
    'data-studio-new-batch',
    'data-studio-batch-import',
    'async function importBatchQuestions',
    'isPristineStarterQuestion',
  ];

  for (const marker of required) {
    if (!studio.includes(marker)) throw new Error(`Post-patch verification failed: ${marker}`);
  }

  if (!sw.includes("'./styles/v4-studio-batch.css'")) {
    throw new Error('Batch CSS missing from APP_SHELL');
  }
  if (!sw.includes("'./src/ui/studio-batch-import.js'")) {
    throw new Error('Batch UI module missing from APP_SHELL');
  }
  if (!pkg.scripts.test.includes('v40-p2b1-studio-batch-ui-run.mjs')) {
    throw new Error('P2B.1 test missing from package.json');
  }

  for (const path of DELETE_READMES) {
    if (fs.existsSync(path)) throw new Error(`Legacy milestone README still exists: ${path}`);
  }
}

patchStudio();
patchServiceWorker();
patchPackage();
writeNewFiles();
cleanupReadmes();
verify();

console.log('P2B.1 Studio Batch Import UI + repository cleanup patch applied successfully.');

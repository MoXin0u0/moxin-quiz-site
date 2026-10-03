import {
  createQuestionDraft,
  nextQuestionId,
  normalizeQuestionDraft,
} from './question-draft.js';

export function createEmptyStudioPackage({ now = new Date(), existingBankIds = [] } = {}) {
  const timestamp = now.toISOString();
  const id = makeUniqueBankId(`my-bank-${compactTimestamp(now)}`, new Set(existingBankIds));
  const question = createQuestionDraft('single-choice', []);

  return {
    manifest: {
      schemaVersion: '2.0',
      id,
      name: '我的新題庫',
      description: '',
      version: '1.0.0',
      author: '',
      language: 'zh-TW',
      questionCount: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: { category: '自訂' },
    },
    questions: [question],
    assets: [],
  };
}

export function createQuestion(type = 'single-choice', existingQuestions = []) {
  return createQuestionDraft(type, existingQuestions);
}

export function duplicateQuestion(question, questions) {
  const copy = normalizeQuestionDraft(question);
  copy.id = nextQuestionId(questions);
  copy.question = copy.question ? `${copy.question}（副本）` : '';
  return copy;
}

export function moveQuestion(questions, questionId, delta) {
  const list = [...questions];
  const index = list.findIndex(question => question.id === questionId);
  if (index < 0) return list;
  const target = index + Number(delta || 0);
  if (target < 0 || target >= list.length) return list;
  [list[index], list[target]] = [list[target], list[index]];
  return list;
}

export function removeQuestion(questions, questionId) {
  if (!Array.isArray(questions) || questions.length <= 1) return [...(questions || [])];
  return questions.filter(question => question.id !== questionId);
}

export function createEditableCopyPackage(pkg, existingBankIds = []) {
  if (!pkg?.manifest || !Array.isArray(pkg.questions)) {
    throw new Error('題庫資料不完整，無法建立可編輯副本。');
  }

  const taken = new Set(existingBankIds);
  const baseId = `${sanitizeBankId(pkg.manifest.id || 'question-bank')}-copy`;
  const id = makeUniqueBankId(baseId, taken);
  const now = new Date().toISOString();

  return {
    manifest: {
      ...clone(pkg.manifest),
      id,
      name: `${pkg.manifest.name || pkg.manifest.title || pkg.manifest.id || '題庫'} 副本`,
      version: '1.0.0',
      questionCount: pkg.questions.length,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...(pkg.manifest.metadata || {}),
        copiedFrom: pkg.manifest.id || null,
      },
    },
    questions: pkg.questions.map(question => normalizeQuestionDraft(question)),
    assets: Array.isArray(pkg.assets) ? [...pkg.assets] : [],
  };
}

export function makeUniqueBankId(base, existingBankIds = new Set()) {
  const taken = existingBankIds instanceof Set ? existingBankIds : new Set(existingBankIds || []);
  const normalized = sanitizeBankId(base) || 'question-bank';
  if (!taken.has(normalized)) return normalized;

  let suffix = 2;
  while (taken.has(`${normalized}-${suffix}`)) suffix += 1;
  return `${normalized}-${suffix}`;
}

export function sanitizeBankId(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

export function parseTags(value) {
  return [...new Set(
    String(value || '')
      .split(/[,，\n]/)
      .map(item => item.trim())
      .filter(Boolean),
  )];
}

export function parseFillAnswers(value) {
  return [...new Set(
    String(value || '')
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean),
  )];
}

export function syncManifestQuestionCount(manifest, questions) {
  return {
    ...manifest,
    questionCount: Array.isArray(questions) ? questions.length : 0,
  };
}

function compactTimestamp(date) {
  const pad = value => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function clone(value) {
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

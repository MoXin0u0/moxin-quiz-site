const QUESTION_TYPES = new Set([
  'single-choice',
  'multiple-choice',
  'true-false',
  'fill-in',
]);

export function createEmptyStudioPackage({
  now = new Date(),
  existingBankIds = [],
} = {}) {
  const timestamp = now.toISOString();
  const id = makeUniqueBankId(
    `my-bank-${compactTimestamp(now)}`,
    new Set(existingBankIds),
  );
  const question = createQuestion('single-choice', []);

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
      metadata: {
        category: '自訂',
      },
    },
    questions: [question],
    assets: [],
  };
}

export function createQuestion(type = 'single-choice', existingQuestions = []) {
  const normalizedType = QUESTION_TYPES.has(type) ? type : 'single-choice';
  const id = nextQuestionId(existingQuestions);

  const base = {
    id,
    type: normalizedType,
    question: '',
    options: [],
    answer: [],
    explanation: '',
    images: [],
    explanationImages: [],
    chapter: '',
    tags: [],
    difficulty: 3,
  };

  return normalizeQuestionForType(base, normalizedType);
}

export function normalizeQuestionForType(question, type) {
  const normalizedType = QUESTION_TYPES.has(type) ? type : 'single-choice';
  const source = clone(question);
  const base = {
    ...source,
    type: normalizedType,
    images: Array.isArray(source.images) ? [...source.images] : [],
    explanationImages: Array.isArray(source.explanationImages)
      ? [...source.explanationImages]
      : [],
    tags: Array.isArray(source.tags) ? [...source.tags] : [],
    difficulty: Number.isInteger(source.difficulty) ? source.difficulty : 3,
  };

  if (normalizedType === 'single-choice' || normalizedType === 'multiple-choice') {
    const options = normalizeOptions(source.options);
    const optionIds = new Set(options.map(option => option.id));
    const previous = Array.isArray(source.answer)
      ? source.answer.filter(value => optionIds.has(value))
      : [];

    return {
      ...base,
      options,
      answer: normalizedType === 'single-choice'
        ? [previous[0] || options[0].id]
        : (previous.length ? previous : [options[0].id]),
      caseSensitive: undefined,
    };
  }

  if (normalizedType === 'true-false') {
    const current = Array.isArray(source.answer) && typeof source.answer[0] === 'boolean'
      ? source.answer[0]
      : true;

    return {
      ...base,
      options: [],
      answer: [current],
      caseSensitive: undefined,
    };
  }

  const fillAnswers = Array.isArray(source.answer)
    ? source.answer.filter(value => typeof value === 'string')
    : [];

  return {
    ...base,
    options: [],
    answer: fillAnswers.length ? fillAnswers : [''],
    caseSensitive: source.caseSensitive === true,
  };
}

export function duplicateQuestion(question, questions) {
  const copy = clone(question);
  copy.id = nextQuestionId(questions);
  copy.question = copy.question ? `${copy.question}（副本）` : '';
  return copy;
}

export function nextQuestionId(questions = []) {
  const used = new Set((questions || []).map(question => String(question?.id || '')));
  let max = 0;

  for (const id of used) {
    const match = /^Q(\d+)$/i.exec(id);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }

  let value = max + 1;
  let candidate = formatQuestionId(value);
  while (used.has(candidate)) {
    value += 1;
    candidate = formatQuestionId(value);
  }
  return candidate;
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
    questions: pkg.questions.map(question => clone(question)),
    assets: Array.isArray(pkg.assets) ? [...pkg.assets] : [],
  };
}

export function makeUniqueBankId(base, existingBankIds = new Set()) {
  const taken = existingBankIds instanceof Set
    ? existingBankIds
    : new Set(existingBankIds || []);
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

function normalizeOptions(options) {
  const source = Array.isArray(options) ? options : [];
  const result = [];
  const used = new Set();

  for (const option of source) {
    if (!option || typeof option !== 'object') continue;
    let id = String(option.id || '').trim().toUpperCase();
    if (!id || used.has(id)) id = nextOptionId(used);
    used.add(id);
    result.push({
      id,
      text: String(option.text || ''),
    });
  }

  while (result.length < 2) {
    const id = nextOptionId(used);
    used.add(id);
    result.push({ id, text: '' });
  }

  return result;
}

function nextOptionId(used) {
  for (let code = 65; code <= 90; code += 1) {
    const id = String.fromCharCode(code);
    if (!used.has(id)) return id;
  }
  let index = 1;
  while (used.has(`O${index}`)) index += 1;
  return `O${index}`;
}

function formatQuestionId(value) {
  return `Q${String(value).padStart(3, '0')}`;
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

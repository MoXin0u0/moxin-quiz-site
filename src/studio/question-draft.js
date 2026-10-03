import {
  QUESTION_TYPES,
  SUPPORTED_QUESTION_TYPES,
} from '../data/schema/question-bank.js';

const TYPE_SET = new Set(SUPPORTED_QUESTION_TYPES);
const CHOICE_TYPES = new Set([
  QUESTION_TYPES.SINGLE_CHOICE,
  QUESTION_TYPES.MULTIPLE_CHOICE,
]);

export function createQuestionDraft(type = QUESTION_TYPES.SINGLE_CHOICE, existingQuestions = []) {
  const normalizedType = normalizeType(type);
  return normalizeQuestionDraft({
    id: nextQuestionId(existingQuestions),
    type: normalizedType,
    question: '',
    options: CHOICE_TYPES.has(normalizedType) ? createBlankOptions() : [],
    answer: [],
    explanation: '',
    images: [],
    explanationImages: [],
    chapter: '',
    tags: [],
    difficulty: 3,
    ...(normalizedType === QUESTION_TYPES.FILL_IN ? { caseSensitive: false } : {}),
  });
}

export function normalizeQuestionDraft(input = {}) {
  const source = clone(input);
  const type = normalizeType(source.type);

  const normalized = {
    id: String(source.id || ''),
    type,
    question: String(source.question || ''),
    options: [],
    answer: [],
    explanation: String(source.explanation || ''),
    images: normalizeStringArray(source.images),
    explanationImages: normalizeStringArray(source.explanationImages),
    chapter: String(source.chapter || ''),
    tags: normalizeStringArray(source.tags),
    difficulty: normalizeDifficulty(source.difficulty),
  };

  if (source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata)) {
    normalized.metadata = clone(source.metadata);
  }

  if (CHOICE_TYPES.has(type)) {
    normalized.options = normalizeOptions(source.options);
    const optionIds = new Set(normalized.options.map(option => option.id));
    normalized.answer = normalizeStringArray(source.answer).filter(value => optionIds.has(value));

    if (type === QUESTION_TYPES.SINGLE_CHOICE && normalized.answer.length > 1) {
      normalized.answer = [];
    }
  } else if (type === QUESTION_TYPES.TRUE_FALSE) {
    normalized.options = [];
    normalized.answer = (
      Array.isArray(source.answer) &&
      source.answer.length === 1 &&
      typeof source.answer[0] === 'boolean'
    ) ? [source.answer[0]] : [];
  } else if (type === QUESTION_TYPES.FILL_IN) {
    normalized.options = [];
    normalized.answer = Array.isArray(source.answer)
      ? source.answer
          .filter(value => typeof value === 'string')
          .map(value => value.trim())
          .filter(Boolean)
      : [];
    normalized.caseSensitive = source.caseSensitive === true;
  }

  return normalized;
}

export function planQuestionTypeChange(question, targetType) {
  const source = normalizeQuestionDraft(question);
  const target = normalizeType(targetType);

  if (source.type === target) {
    return {
      from: source.type,
      to: target,
      requiresConfirmation: false,
      clearsAnswer: false,
      clearsOptions: false,
      reason: '',
    };
  }

  const sourceChoice = CHOICE_TYPES.has(source.type);
  const targetChoice = CHOICE_TYPES.has(target);
  let clearsAnswer = false;
  let clearsOptions = false;

  if (sourceChoice && targetChoice) {
    if (
      source.type === QUESTION_TYPES.MULTIPLE_CHOICE &&
      target === QUESTION_TYPES.SINGLE_CHOICE &&
      source.answer.length > 1
    ) {
      clearsAnswer = true;
    }
  } else {
    clearsAnswer = source.answer.length > 0;
    clearsOptions = sourceChoice && source.options.length > 0;
  }

  const losses = [];
  if (clearsOptions) losses.push('選項');
  if (clearsAnswer) losses.push('目前設定的答案');

  return {
    from: source.type,
    to: target,
    requiresConfirmation: losses.length > 0,
    clearsAnswer,
    clearsOptions,
    reason: losses.length ? `切換題型會清除：${losses.join('、')}。` : '',
  };
}

export function convertQuestionType(question, targetType) {
  const source = normalizeQuestionDraft(question);
  const target = normalizeType(targetType);

  if (source.type === target) return source;

  const common = {
    ...source,
    type: target,
    question: source.question,
    explanation: source.explanation,
    images: [...source.images],
    explanationImages: [...source.explanationImages],
    chapter: source.chapter,
    tags: [...source.tags],
    difficulty: source.difficulty,
  };

  if (CHOICE_TYPES.has(target)) {
    const sourceChoice = CHOICE_TYPES.has(source.type);
    const options = sourceChoice
      ? source.options.map(option => ({ ...option }))
      : createBlankOptions();

    let answer = [];
    if (source.type === QUESTION_TYPES.SINGLE_CHOICE && target === QUESTION_TYPES.MULTIPLE_CHOICE) {
      answer = [...source.answer];
    } else if (
      source.type === QUESTION_TYPES.MULTIPLE_CHOICE &&
      target === QUESTION_TYPES.SINGLE_CHOICE &&
      source.answer.length === 1
    ) {
      answer = [...source.answer];
    }

    const result = { ...common, options, answer };
    delete result.caseSensitive;
    return normalizeQuestionDraft(result);
  }

  if (target === QUESTION_TYPES.TRUE_FALSE) {
    const result = { ...common, options: [], answer: [] };
    delete result.caseSensitive;
    return normalizeQuestionDraft(result);
  }

  return normalizeQuestionDraft({
    ...common,
    options: [],
    answer: [],
    caseSensitive: false,
  });
}

export function validateQuestionDraft(question) {
  const q = normalizeQuestionDraft(question);
  const issues = [];

  if (!q.id.trim()) issues.push(error('id', '題目缺少永久 ID。'));
  if (!q.question.trim()) issues.push(error('question', '請輸入題目內容。'));
  if (!TYPE_SET.has(q.type)) issues.push(error('type', '不支援的題型。'));

  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) {
    issues.push(error('difficulty', '難度必須是 1～5。'));
  }

  if (CHOICE_TYPES.has(q.type)) {
    if (q.options.length < 2) issues.push(error('options', '選擇題至少需要兩個選項。'));

    const ids = new Set();
    q.options.forEach((option, index) => {
      if (!option.id.trim()) issues.push(error(`options[${index}].id`, '選項缺少 ID。'));
      if (ids.has(option.id)) issues.push(error(`options[${index}].id`, `選項 ID 重複：${option.id}`));
      ids.add(option.id);
      if (!option.text.trim()) {
        issues.push(error(`options[${index}].text`, `選項 ${option.id || index + 1} 尚未輸入內容。`));
      }
    });

    if (q.type === QUESTION_TYPES.SINGLE_CHOICE) {
      if (q.answer.length !== 1) issues.push(error('answer', '請明確選擇一個正確答案。'));
    } else if (q.answer.length < 1) {
      issues.push(error('answer', '請至少選擇一個正確答案。'));
    }

    q.answer.forEach(answer => {
      if (!ids.has(answer)) issues.push(error('answer', `答案 ${answer} 不存在於目前選項。`));
    });
  }

  if (q.type === QUESTION_TYPES.TRUE_FALSE) {
    if (q.answer.length !== 1 || typeof q.answer[0] !== 'boolean') {
      issues.push(error('answer', '請明確選擇「正確」或「錯誤」。'));
    }
  }

  if (q.type === QUESTION_TYPES.FILL_IN) {
    if (!q.answer.length) issues.push(error('answer', '請至少輸入一個可接受答案。'));
    if (q.answer.some(answer => !String(answer).trim())) {
      issues.push(error('answer', '填空答案不可為空白。'));
    }
  }

  return {
    valid: !issues.some(issue => issue.severity === 'error'),
    complete: !issues.some(issue => issue.severity === 'error'),
    issues,
    question: q,
  };
}

export function toSchemaQuestion(question) {
  const report = validateQuestionDraft(question);
  if (!report.valid) {
    throw new Error(
      report.issues
        .filter(issue => issue.severity === 'error')
        .map(issue => issue.message)
        .join(' '),
    );
  }
  return clone(report.question);
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

export function createBlankOptions() {
  return [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
  ];
}

function normalizeOptions(options) {
  const source = Array.isArray(options) ? options : [];
  const output = [];
  const used = new Set();

  for (const option of source) {
    if (!option || typeof option !== 'object') continue;
    let id = String(option.id || '').trim().toUpperCase();
    if (!id || used.has(id)) id = nextOptionId(used);
    used.add(id);
    output.push({ id, text: String(option.text || '') });
  }

  while (output.length < 2) {
    const id = nextOptionId(used);
    used.add(id);
    output.push({ id, text: '' });
  }
  return output;
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

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean)
    : [];
}

function normalizeDifficulty(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 5 ? numeric : 3;
}

function normalizeType(type) {
  return TYPE_SET.has(type) ? type : QUESTION_TYPES.SINGLE_CHOICE;
}

function formatQuestionId(value) {
  return `Q${String(value).padStart(3, '0')}`;
}

function error(location, message) {
  return { severity: 'error', location, message };
}

function clone(value) {
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

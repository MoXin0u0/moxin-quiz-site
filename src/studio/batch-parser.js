import {
  nextQuestionId,
  normalizeQuestionDraft,
  validateQuestionDraft,
} from './question-draft.js';

export const BATCH_PARSE_STATUS = Object.freeze({
  READY: 'ready',
  REVIEW: 'review',
  UNPARSED: 'unparsed',
});

const TYPE_ALIASES = new Map([
  ['single-choice', 'single-choice'],
  ['single choice', 'single-choice'],
  ['single', 'single-choice'],
  ['單選', 'single-choice'],
  ['單選題', 'single-choice'],
  ['单选', 'single-choice'],
  ['单选题', 'single-choice'],

  ['multiple-choice', 'multiple-choice'],
  ['multiple choice', 'multiple-choice'],
  ['multiple', 'multiple-choice'],
  ['複選', 'multiple-choice'],
  ['複選題', 'multiple-choice'],
  ['多選', 'multiple-choice'],
  ['多選題', 'multiple-choice'],
  ['复选', 'multiple-choice'],
  ['复选题', 'multiple-choice'],
  ['多选', 'multiple-choice'],
  ['多选题', 'multiple-choice'],

  ['true-false', 'true-false'],
  ['true false', 'true-false'],
  ['true/false', 'true-false'],
  ['是非', 'true-false'],
  ['是非題', 'true-false'],
  ['判断', 'true-false'],
  ['判斷', 'true-false'],
  ['判斷題', 'true-false'],
  ['判断题', 'true-false'],

  ['fill-in', 'fill-in'],
  ['fill in', 'fill-in'],
  ['fill-in-the-blank', 'fill-in'],
  ['填空', 'fill-in'],
  ['填空題', 'fill-in'],
  ['填空题', 'fill-in'],
]);

const TRUE_TOKENS = new Set([
  'TRUE', 'T', 'O', '○', '〇', '✓', '✔',
  '正確', '正确', '對', '对', '是',
]);

const FALSE_TOKENS = new Set([
  'FALSE', 'F', 'X', '×', '✗', '✘',
  '錯誤', '错误', '錯', '错', '否',
]);

const FIELD_RE = /^\s*(題目|题目|題型|题型|類型|类型|答案|正解|詳解|详解|解析|章節|章节|標籤|标签|標記|标记|難度|难度)\s*[:：]\s*(.*)$/i;
const QUESTION_START_RE = /^\s*(?:(?:第\s*(\d+)\s*題)|(?:第\s*(\d+)\s*题)|(?:Q\s*(\d+))|(?:(\d+)\s*[.．、]))\s*(.*)$/i;
const OPTION_RE = /^\s*(?:\(?\s*([A-H])\s*\)?\s*[.．、:：)]\s*|([A-H])\s+)(.+?)\s*$/i;

export function parseBatchQuestionText(sourceText, { existingQuestions = [] } = {}) {
  const normalizedText = normalizeSourceText(sourceText);
  const { blocks, preamble } = splitQuestionBlocks(normalizedText);
  const assignedQuestions = [...(existingQuestions || [])];
  const candidates = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const candidate = parseQuestionBlock(blocks[index], {
      index,
      existingQuestions: assignedQuestions,
    });

    candidates.push(candidate);
    if (candidate.question) assignedQuestions.push(candidate.question);
  }

  return {
    sourceText: normalizedText,
    preamble,
    candidates,
    summary: summarizeCandidates(candidates),
  };
}

export function parseQuestionBlock(rawBlock, { index = 0, existingQuestions = [] } = {}) {
  const raw = normalizeSourceText(rawBlock).trim();
  if (!raw) {
    return {
      index,
      raw,
      status: BATCH_PARSE_STATUS.UNPARSED,
      question: null,
      issues: [issue('empty-block', 'error', '這個區塊沒有可解析內容。')],
      source: emptySource(),
    };
  }

  const source = extractStructuredSource(raw);
  const parserIssues = [];

  if (!source.question.trim()) {
    return {
      index,
      raw,
      status: BATCH_PARSE_STATUS.UNPARSED,
      question: null,
      issues: [issue('missing-question', 'error', '找不到題目文字，已保留原始區塊供人工處理。')],
      source,
    };
  }

  const explicitType = normalizeExplicitType(source.type);
  if (source.type && !explicitType) {
    parserIssues.push(issue(
      'unknown-explicit-type',
      'review',
      `無法辨識題型「${source.type}」，請人工確認。`,
    ));
  }

  const answerShape = inspectAnswer(source.answer);
  const resolvedType = resolveQuestionType({
    explicitType,
    options: source.options,
    answerShape,
    parserIssues,
  });

  const id = nextQuestionId(existingQuestions);
  const draftInput = {
    id,
    type: resolvedType.type,
    question: source.question,
    options: resolvedType.type === 'single-choice' || resolvedType.type === 'multiple-choice'
      ? source.options
      : [],
    answer: buildAnswer({
      type: resolvedType.type,
      explicitType,
      options: source.options,
      answerShape,
      parserIssues,
    }),
    explanation: source.explanation,
    images: [],
    explanationImages: [],
    chapter: source.chapter,
    tags: parseTags(source.tags),
    difficulty: parseDifficulty(source.difficulty, parserIssues),
    ...(resolvedType.type === 'fill-in' ? { caseSensitive: false } : {}),
  };

  if (resolvedType.requiresReview) {
    parserIssues.push(issue(
      'inferred-type',
      'review',
      resolvedType.reason || '題型是由文字結構推定，請人工確認。',
    ));
  }

  if (source.unparsedLines.length) {
    parserIssues.push(issue(
      'unparsed-lines',
      'review',
      `有 ${source.unparsedLines.length} 行無法可靠歸類，已保留供人工確認。`,
    ));
  }

  const question = normalizeQuestionDraft(draftInput);
  const validation = validateQuestionDraft(question);
  const validationIssues = validation.issues.map(item => issue(
    `draft:${item.location}`,
    item.severity === 'error' ? 'error' : 'review',
    item.message,
  ));

  const issues = dedupeIssues([...parserIssues, ...validationIssues]);
  const status = validation.valid && !issues.some(item => item.severity === 'review' || item.severity === 'error')
    ? BATCH_PARSE_STATUS.READY
    : BATCH_PARSE_STATUS.REVIEW;

  return {
    index,
    raw,
    status,
    question,
    issues,
    source,
  };
}

export function selectBatchQuestions(candidates, {
  existingQuestions = [],
  includeReview = false,
  selectedIndexes = null,
} = {}) {
  const selectedSet = selectedIndexes == null
    ? null
    : new Set(Array.from(selectedIndexes, value => Number(value)));

  const output = [...(existingQuestions || [])];

  for (const candidate of candidates || []) {
    if (!candidate?.question) continue;
    if (selectedSet && !selectedSet.has(Number(candidate.index))) continue;
    if (candidate.status === BATCH_PARSE_STATUS.UNPARSED) continue;
    if (candidate.status === BATCH_PARSE_STATUS.REVIEW && !includeReview) continue;

    const question = normalizeQuestionDraft({
      ...candidate.question,
      id: nextQuestionId(output),
    });
    output.push(question);
  }

  return output.slice((existingQuestions || []).length);
}

export function summarizeCandidates(candidates) {
  const summary = {
    total: 0,
    ready: 0,
    review: 0,
    unparsed: 0,
  };

  for (const candidate of candidates || []) {
    summary.total += 1;
    if (candidate?.status === BATCH_PARSE_STATUS.READY) summary.ready += 1;
    else if (candidate?.status === BATCH_PARSE_STATUS.REVIEW) summary.review += 1;
    else summary.unparsed += 1;
  }

  return summary;
}

export function splitQuestionBlocks(sourceText) {
  const text = normalizeSourceText(sourceText);
  if (!text.trim()) return { blocks: [], preamble: '' };

  const lines = text.split('\n');
  const starts = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeLine(lines[index]);
    if (QUESTION_START_RE.test(line)) {
      starts.push(index);
      continue;
    }

    const field = FIELD_RE.exec(line);
    if (field && normalizeFieldName(field[1]) === 'question') {
      starts.push(index);
    }
  }

  const uniqueStarts = [...new Set(starts)].sort((a, b) => a - b);
  if (!uniqueStarts.length) {
    const paragraphBlocks = text
      .split(/\n\s*\n(?=\S)/)
      .map(block => block.trim())
      .filter(Boolean);

    return {
      blocks: paragraphBlocks.length > 1 ? paragraphBlocks : [text.trim()],
      preamble: '',
    };
  }

  const firstStart = uniqueStarts[0];
  const preamble = lines.slice(0, firstStart).join('\n').trim();
  const blocks = [];

  for (let i = 0; i < uniqueStarts.length; i += 1) {
    const start = uniqueStarts[i];
    const end = uniqueStarts[i + 1] ?? lines.length;
    const block = lines.slice(start, end).join('\n').trim();
    if (block) blocks.push(block);
  }

  return { blocks, preamble };
}

function extractStructuredSource(raw) {
  const lines = raw.split('\n');
  const source = emptySource();
  let activeField = null;
  let lastOption = null;

  for (let index = 0; index < lines.length; index += 1) {
    const originalLine = lines[index];
    const line = normalizeLine(originalLine);
    if (!line.trim()) {
      if (activeField === 'question' || activeField === 'explanation') {
        appendField(source, activeField, '');
      }
      continue;
    }

    const startMatch = QUESTION_START_RE.exec(line);
    if (startMatch) {
      const remainder = String(startMatch[5] || '').trim();
      if (remainder) appendField(source, 'question', remainder);
      activeField = 'question';
      lastOption = null;
      continue;
    }

    const fieldMatch = FIELD_RE.exec(line);
    if (fieldMatch) {
      const field = normalizeFieldName(fieldMatch[1]);
      const value = String(fieldMatch[2] || '').trim();
      activeField = field;
      lastOption = null;

      if (field === 'tags') {
        source.tags = [source.tags, value].filter(Boolean).join('，');
      } else if (field === 'question' || field === 'explanation') {
        appendField(source, field, value);
      } else {
        source[field] = value;
      }
      continue;
    }

    const optionMatch = OPTION_RE.exec(line);
    if (optionMatch) {
      const optionId = normalizeOptionId(optionMatch[1] || optionMatch[2]);
      const optionText = String(optionMatch[3] || '').trim();
      const existing = source.options.find(option => option.id === optionId);

      if (existing) {
        source.unparsedLines.push(originalLine);
        lastOption = null;
      } else {
        const option = { id: optionId, text: optionText };
        source.options.push(option);
        lastOption = option;
      }
      activeField = null;
      continue;
    }

    if (activeField === 'question' || activeField === 'explanation') {
      appendField(source, activeField, originalLine.trim());
      continue;
    }

    if (lastOption) {
      lastOption.text = `${lastOption.text}\n${originalLine.trim()}`.trim();
      continue;
    }

    if (!source.question.trim() && !source.options.length) {
      appendField(source, 'question', originalLine.trim());
      activeField = 'question';
      continue;
    }

    source.unparsedLines.push(originalLine);
  }

  source.question = cleanupMultiline(source.question);
  source.explanation = cleanupMultiline(source.explanation);
  return source;
}

function resolveQuestionType({ explicitType, options, answerShape, parserIssues }) {
  if (explicitType) {
    if (
      (explicitType === 'true-false' || explicitType === 'fill-in') &&
      options.length
    ) {
      parserIssues.push(issue(
        'type-option-conflict',
        'review',
        '題型標記與選項結構衝突，請人工確認。',
      ));
    }

    if (
      explicitType === 'single-choice' &&
      answerShape.kind === 'choice' &&
      answerShape.values.length > 1
    ) {
      parserIssues.push(issue(
        'single-multiple-answer-conflict',
        'review',
        '題型標記為單選，但答案包含多個選項。',
      ));
    }

    return { type: explicitType, requiresReview: false, reason: '' };
  }

  if (options.length >= 2) {
    if (answerShape.kind === 'choice' && answerShape.values.length > 1) {
      return { type: 'multiple-choice', requiresReview: false, reason: '' };
    }
    return { type: 'single-choice', requiresReview: false, reason: '' };
  }

  if (answerShape.kind === 'boolean') {
    return { type: 'true-false', requiresReview: false, reason: '' };
  }

  if (answerShape.kind === 'text') {
    return {
      type: 'fill-in',
      requiresReview: true,
      reason: '沒有明確題型標記；系統僅因「無選項＋文字答案」暫列為填空題。',
    };
  }

  return {
    type: 'fill-in',
    requiresReview: true,
    reason: '沒有足夠資訊判定題型；暫列為填空題且不建立答案。',
  };
}

function buildAnswer({ type, explicitType, options, answerShape, parserIssues }) {
  if (type === 'single-choice' || type === 'multiple-choice') {
    if (answerShape.kind === 'empty') return [];

    if (answerShape.kind !== 'choice') {
      parserIssues.push(issue(
        'choice-answer-unrecognized',
        'review',
        '答案不是可辨識的選項代號，未自動填入答案。',
      ));
      return [];
    }

    const optionIds = new Set(options.map(option => option.id));
    const invalid = answerShape.values.filter(value => !optionIds.has(value));

    if (invalid.length) {
      parserIssues.push(issue(
        'choice-answer-missing-option',
        'review',
        `答案引用不存在的選項：${invalid.join('、')}。`,
      ));
    }

    const valid = answerShape.values.filter(value => optionIds.has(value));
    if (type === 'single-choice' && valid.length !== 1) {
      return [];
    }

    return [...new Set(valid)];
  }

  if (type === 'true-false') {
    if (answerShape.kind === 'boolean') return [answerShape.value];
    if (answerShape.kind !== 'empty') {
      parserIssues.push(issue(
        'boolean-answer-unrecognized',
        'review',
        '是非題答案無法可靠辨識，未自動填入答案。',
      ));
    }
    return [];
  }

  if (type === 'fill-in') {
    if (answerShape.kind === 'empty') return [];
    if (answerShape.kind === 'text') return answerShape.values;

    if (explicitType === 'fill-in') {
      const raw = String(answerShape.raw || '').trim();
      return raw ? [raw] : [];
    }

    parserIssues.push(issue(
      'fill-answer-ambiguous',
      'review',
      '填空答案格式不明確，未自動填入答案。',
    ));
    return [];
  }

  return [];
}

function inspectAnswer(rawAnswer) {
  const raw = String(rawAnswer || '').trim();
  if (!raw) return { kind: 'empty', raw, values: [] };

  const normalized = normalizeLine(raw).trim();
  const upper = normalized.toUpperCase();

  if (TRUE_TOKENS.has(upper) || TRUE_TOKENS.has(normalized)) {
    return { kind: 'boolean', raw, value: true, values: [true] };
  }
  if (FALSE_TOKENS.has(upper) || FALSE_TOKENS.has(normalized)) {
    return { kind: 'boolean', raw, value: false, values: [false] };
  }

  const choiceCompact = upper
    .replace(/選項|选项/g, '')
    .replace(/[\s,，、;；/|+&及和與与]+/g, '');

  if (/^[A-H]+$/.test(choiceCompact)) {
    return {
      kind: 'choice',
      raw,
      values: [...new Set(choiceCompact.split(''))],
    };
  }

  const textValues = raw
    .split(/\r?\n|[;；]/)
    .map(value => value.trim())
    .filter(Boolean);

  return {
    kind: 'text',
    raw,
    values: [...new Set(textValues.length ? textValues : [raw])],
  };
}

function normalizeExplicitType(value) {
  const normalized = normalizeLine(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  return TYPE_ALIASES.get(normalized) || null;
}

function parseDifficulty(value, parserIssues) {
  if (!String(value || '').trim()) return 3;
  const number = Number(normalizeLine(value).trim());

  if (Number.isInteger(number) && number >= 1 && number <= 5) {
    return number;
  }

  parserIssues.push(issue(
    'invalid-difficulty',
    'review',
    '難度不是 1～5 的整數，已暫用預設值 3。',
  ));
  return 3;
}

function parseTags(value) {
  return [...new Set(
    String(value || '')
      .split(/[,，、;；\n]/)
      .map(item => item.trim())
      .filter(Boolean),
  )];
}

function appendField(source, field, value) {
  const text = String(value ?? '');
  source[field] = source[field]
    ? `${source[field]}\n${text}`
    : text;
}

function cleanupMultiline(value) {
  return String(value || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeFieldName(value) {
  const name = normalizeLine(value).trim();
  if (name === '題目' || name === '题目') return 'question';
  if (name === '題型' || name === '题型' || name === '類型' || name === '类型') return 'type';
  if (name === '答案' || name === '正解') return 'answer';
  if (name === '詳解' || name === '详解' || name === '解析') return 'explanation';
  if (name === '章節' || name === '章节') return 'chapter';
  if (name === '標籤' || name === '标签' || name === '標記' || name === '标记') return 'tags';
  if (name === '難度' || name === '难度') return 'difficulty';
  return name;
}

function normalizeOptionId(value) {
  return normalizeLine(value).trim().toUpperCase();
}

function normalizeSourceText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ');
}

function normalizeLine(value) {
  return String(value ?? '').normalize('NFKC');
}

function emptySource() {
  return {
    question: '',
    type: '',
    options: [],
    answer: '',
    explanation: '',
    chapter: '',
    tags: '',
    difficulty: '',
    unparsedLines: [],
  };
}

function issue(code, severity, message) {
  return { code, severity, message };
}

function dedupeIssues(issues) {
  const seen = new Set();
  return (issues || []).filter(item => {
    const key = `${item.code}|${item.severity}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

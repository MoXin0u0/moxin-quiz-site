import { createManifest, LEGACY_TYPE_MAP } from '../schema/question-bank.js';

export function migrateLegacyBank(legacyBank) {
  if (!legacyBank || typeof legacyBank !== 'object' || Array.isArray(legacyBank)) {
    throw new TypeError('Legacy bank must be an object.');
  }
  if (!legacyBank.bankId || !Array.isArray(legacyBank.questions)) {
    throw new Error('Legacy bank requires bankId and questions.');
  }

  const now = new Date().toISOString();
  const questions = legacyBank.questions.map((question, index) =>
    migrateQuestion(question, index),
  );
  const assetPaths = collectAssetPaths(questions);

  const manifest = createManifest({
    id: String(legacyBank.bankId),
    name: legacyBank.title || String(legacyBank.bankId),
    description: legacyBank.description || '',
    version: normalizeVersion(legacyBank.version),
    questionCount: questions.length,
    createdAt: normalizeDate(legacyBank.createdDate),
    updatedAt: now,
    metadata: {
      category: legacyBank.category || '',
      migratedFrom: 'legacy-v1',
    },
  });

  return {
    manifest,
    questions,
    assetPaths,
    assets: [],
    migration: {
      source: 'legacy-v1',
      migratedAt: now,
    },
  };
}

export function migrateQuestion(question, index = 0) {
  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    throw new Error(`Question ${index + 1} is not an object.`);
  }

  const type = LEGACY_TYPE_MAP[question.type] || question.type;
  if (!['single-choice', 'multiple-choice', 'true-false', 'fill-in'].includes(type)) {
    throw new Error(`Question ${question.id || index + 1} has unsupported legacy type: ${question.type}`);
  }

  const migrated = {
    id: String(question.id || `q${String(index + 1).padStart(3, '0')}`),
    type,
    question: String(question.question || ''),
    answer: migrateAnswer(type, question.answer),
    explanation: String(question.explanation || ''),
    images: migrateImages(question.images),
    explanationImages: migrateImages(question.explanationImages),
    chapter: String(question.chapter || '未分類'),
    tags: Array.isArray(question.tags) ? question.tags.map(String) : [],
    difficulty: normalizeDifficulty(question.difficulty),
  };

  const options = migrateOptions(question.options);
  if (options) migrated.options = options;
  if (type === 'fill-in') migrated.caseSensitive = question.caseSensitive === true;

  return migrated;
}

function migrateOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return undefined;
  return Object.entries(options).map(([id, text]) => ({
    id: String(id),
    text: String(text),
  }));
}

function migrateAnswer(type, answer) {
  if (type === 'multiple-choice') {
    return (Array.isArray(answer) ? answer : [answer])
      .filter(value => value !== undefined && value !== null && value !== '')
      .map(String)
      .sort();
  }
  if (type === 'fill-in') {
    return (Array.isArray(answer) ? answer : [answer])
      .filter(value => value !== undefined && value !== null)
      .map(String);
  }
  if (type === 'true-false') return [normalizeBoolean(answer)];
  return [String(answer ?? '')];
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'o', '○', '是', '對', '正確'].includes(normalized)) return true;
  if (['false', '0', 'x', '×', '否', '錯', '錯誤'].includes(normalized)) return false;
  return Boolean(value);
}

function migrateImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map(image => typeof image === 'string' ? image : image?.src)
    .filter(Boolean)
    .map(String);
}

function collectAssetPaths(questions) {
  const paths = new Set();
  questions.forEach(question => {
    [...(question.images || []), ...(question.explanationImages || [])]
      .forEach(path => paths.add(path));
  });
  return [...paths].sort();
}

function normalizeVersion(version) {
  const raw = String(version || '1.0.0').trim();
  if (/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(raw)) return raw;
  if (/^\d+\.\d+$/.test(raw)) return `${raw}.0`;
  if (/^\d+$/.test(raw)) return `${raw}.0.0`;
  return '1.0.0';
}

function normalizeDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00.000Z`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeDifficulty(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.min(5, Math.round(value)));
  }
  if (value === 'easy') return 1;
  if (value === 'medium') return 3;
  if (value === 'hard') return 5;
  return 2;
}

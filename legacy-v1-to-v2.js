import { createManifest, LEGACY_TYPE_MAP } from '../schema/question-bank.js';

export function migrateLegacyBank(legacyBank) {
  if (!legacyBank || typeof legacyBank !== 'object') {
    throw new TypeError('Legacy bank must be an object.');
  }
  if (!legacyBank.bankId || !Array.isArray(legacyBank.questions)) {
    throw new Error('Legacy bank requires bankId and questions.');
  }

  const now = new Date().toISOString();
  const manifest = createManifest({
    id: legacyBank.bankId,
    name: legacyBank.title || legacyBank.bankId,
    description: legacyBank.description || '',
    version: normalizeVersion(legacyBank.version),
    questionCount: legacyBank.questions.length,
    createdAt: legacyBank.createdDate || '',
    updatedAt: now,
  });

  const questions = legacyBank.questions.map((question, index) =>
    migrateQuestion(question, index),
  );

  return {
    manifest,
    questions,
    assets: collectAssetPaths(legacyBank.questions),
    migration: {
      source: 'legacy-v1',
      migratedAt: now,
    },
  };
}

function migrateQuestion(question, index) {
  const type = LEGACY_TYPE_MAP[question.type];
  if (!type) {
    throw new Error(`Question ${question.id || index + 1} has unsupported legacy type: ${question.type}`);
  }

  return {
    id: String(question.id || `q${String(index + 1).padStart(3, '0')}`),
    type,
    question: String(question.question || ''),
    options: migrateOptions(question.options),
    answer: migrateAnswer(type, question.answer),
    explanation: String(question.explanation || ''),
    images: migrateImages(question.images),
    chapter: question.chapter || '未分類',
    tags: Array.isArray(question.tags) ? [...question.tags] : [],
    difficulty: normalizeDifficulty(question.difficulty),
    ...(type === 'fill-in' ? { caseSensitive: question.caseSensitive === true } : {}),
  };
}

function migrateOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return undefined;
  return Object.entries(options).map(([id, text]) => ({ id, text: String(text) }));
}

function migrateAnswer(type, answer) {
  if (type === 'multiple-choice') return Array.isArray(answer) ? [...answer] : [answer].filter(Boolean);
  if (type === 'fill-in') return Array.isArray(answer) ? [...answer] : [answer].filter(v => v !== undefined && v !== null);
  if (type === 'true-false') return [Boolean(answer)];
  return [String(answer ?? '')];
}

function migrateImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map(image => typeof image === 'string' ? image : image?.src)
    .filter(Boolean);
}

function collectAssetPaths(questions) {
  const paths = new Set();
  questions.forEach(question => {
    [...(question.images || []), ...(question.explanationImages || [])]
      .map(image => typeof image === 'string' ? image : image?.src)
      .filter(Boolean)
      .forEach(path => paths.add(path));
  });
  return [...paths];
}

function normalizeVersion(version) {
  const value = String(version || '1.0.0');
  return /^\d+\.\d+\.\d+$/.test(value) ? value : `${value}.0`;
}

function normalizeDifficulty(value) {
  if (typeof value === 'number') return Math.max(1, Math.min(5, Math.round(value)));
  if (value === 'easy') return 1;
  if (value === 'medium') return 3;
  if (value === 'hard') return 5;
  return 2;
}

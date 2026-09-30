import {
  SAFE_IMAGE_EXTENSIONS,
  SCHEMA_VERSION,
  SUPPORTED_QUESTION_TYPES,
} from '../data/schema/question-bank.js';
import { extensionOf, normalizePackagePath } from '../utils/path.js';

const SAFE_IMAGE_TYPES = new Set(SAFE_IMAGE_EXTENSIONS);
const ALLOWED_MANIFEST_FIELDS = new Set([
  'schemaVersion', 'id', 'name', 'description', 'version', 'author', 'language',
  'questionCount', 'createdAt', 'updatedAt', 'metadata', 'source', 'license',
]);
const ALLOWED_QUESTION_FIELDS = new Set([
  'id', 'type', 'question', 'options', 'answer', 'explanation', 'images',
  'explanationImages', 'chapter', 'tags', 'difficulty', 'caseSensitive', 'metadata',
]);

export function validatePackage({ manifest, questions, assetPaths = [] }) {
  const issues = [];
  validateManifest(manifest, issues);
  validateQuestions(questions, issues);
  validateAssets(questions, assetPaths, issues);

  if (manifest && Array.isArray(questions) && Number.isFinite(manifest.questionCount) && manifest.questionCount !== questions.length) {
    issues.push(warning('manifest.questionCount', `manifest 記錄 ${manifest.questionCount} 題，但 questions.json 實際有 ${questions.length} 題。`));
  }

  return {
    valid: !issues.some(issue => issue.severity === 'error'),
    issues,
    summary: {
      errors: issues.filter(issue => issue.severity === 'error').length,
      warnings: issues.filter(issue => issue.severity === 'warning').length,
      questionCount: Array.isArray(questions) ? questions.length : 0,
      assetCount: Array.isArray(assetPaths) ? assetPaths.length : 0,
    },
  };
}

function validateManifest(manifest, issues) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    issues.push(error('manifest', 'manifest.json 必須是物件。'));
    return;
  }

  for (const field of ['schemaVersion', 'id', 'name', 'version']) {
    if (!manifest[field] || typeof manifest[field] !== 'string') {
      issues.push(error(`manifest.${field}`, `${field} 為必填字串。`));
    }
  }

  if (manifest.schemaVersion && manifest.schemaVersion !== SCHEMA_VERSION) {
    issues.push(error('manifest.schemaVersion', `目前僅支援 Schema ${SCHEMA_VERSION}。`));
  }
  if (manifest.id && !/^[A-Za-z0-9_-]+$/.test(manifest.id)) {
    issues.push(error('manifest.id', '題庫 ID 只能使用英文、數字、底線與連字號。'));
  }
  if (manifest.version && !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    issues.push(warning('manifest.version', '建議使用 SemVer，例如 1.0.0。'));
  }
  if (manifest.questionCount !== undefined && (!Number.isInteger(manifest.questionCount) || manifest.questionCount < 0)) {
    issues.push(error('manifest.questionCount', 'questionCount 必須是非負整數。'));
  }

  for (const field of Object.keys(manifest)) {
    if (!ALLOWED_MANIFEST_FIELDS.has(field)) {
      issues.push(warning(`manifest.${field}`, `未識別的 manifest 欄位：${field}`));
    }
  }
}

function validateQuestions(questions, issues) {
  if (!Array.isArray(questions)) {
    issues.push(error('questions', 'questions.json 根節點必須是陣列。'));
    return;
  }

  const seen = new Set();
  questions.forEach((question, index) => {
    const loc = `questions[${index}]`;
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      issues.push(error(loc, '題目必須是物件。'));
      return;
    }

    if (!question.id || typeof question.id !== 'string') {
      issues.push(error(`${loc}.id`, '題目缺少永久 ID。'));
    } else if (seen.has(question.id)) {
      issues.push(error(`${loc}.id`, `題目 ID 重複：${question.id}`));
    } else {
      seen.add(question.id);
    }

    if (!SUPPORTED_QUESTION_TYPES.includes(question.type)) {
      issues.push(error(`${loc}.type`, `不支援的題型：${question.type ?? ''}`));
    }
    if (!question.question || typeof question.question !== 'string') {
      issues.push(error(`${loc}.question`, '題目文字為必填字串。'));
    }
    if (typeof question.explanation !== 'string' || !question.explanation.trim()) {
      issues.push(warning(`${loc}.explanation`, '建議提供非空白詳解。'));
    }
    if (!Array.isArray(question.tags)) {
      issues.push(warning(`${loc}.tags`, 'tags 建議使用陣列。'));
    }
    if (!Number.isInteger(question.difficulty) || question.difficulty < 1 || question.difficulty > 5) {
      issues.push(warning(`${loc}.difficulty`, 'difficulty 建議為 1–5 的整數。'));
    }

    validateAnswer(question, loc, issues);
    validateImageList(question.images, `${loc}.images`, issues);
    validateImageList(question.explanationImages, `${loc}.explanationImages`, issues);

    for (const field of Object.keys(question)) {
      if (!ALLOWED_QUESTION_FIELDS.has(field)) {
        issues.push(warning(`${loc}.${field}`, `未識別的題目欄位：${field}`));
      }
    }
  });
}

function validateAnswer(question, loc, issues) {
  const options = Array.isArray(question.options) ? question.options : [];
  const optionIds = new Set();

  if (['single-choice', 'multiple-choice'].includes(question.type)) {
    if (options.length < 2) issues.push(error(`${loc}.options`, '選擇題至少需要 2 個選項。'));
    for (const [index, option] of options.entries()) {
      if (!option || typeof option.id !== 'string' || typeof option.text !== 'string') {
        issues.push(error(`${loc}.options[${index}]`, '選項必須包含 id 與 text 字串。'));
        continue;
      }
      if (optionIds.has(option.id)) issues.push(error(`${loc}.options[${index}].id`, `選項 ID 重複：${option.id}`));
      optionIds.add(option.id);
    }
  }

  if (!Array.isArray(question.answer) || question.answer.length === 0) {
    issues.push(error(`${loc}.answer`, 'answer 必須是非空陣列。'));
    return;
  }
  if (question.type === 'single-choice' && question.answer.length !== 1) {
    issues.push(error(`${loc}.answer`, '單選題只能有一個答案。'));
  }
  if (question.type === 'true-false' && (question.answer.length !== 1 || typeof question.answer[0] !== 'boolean')) {
    issues.push(error(`${loc}.answer`, '是非題答案必須是只含一個 boolean 的陣列。'));
  }
  if (question.type === 'fill-in' && question.answer.some(value => typeof value !== 'string')) {
    issues.push(error(`${loc}.answer`, '填空題答案必須全部是字串。'));
  }

  if (['single-choice', 'multiple-choice'].includes(question.type)) {
    question.answer.forEach(answer => {
      if (!optionIds.has(answer)) issues.push(error(`${loc}.answer`, `答案 ${answer} 不存在於 options。`));
    });
  }
}

function validateImageList(images, loc, issues) {
  if (images === undefined) return;
  if (!Array.isArray(images)) {
    issues.push(error(loc, '圖片欄位必須是陣列。'));
    return;
  }

  images.forEach((path, index) => {
    if (typeof path !== 'string' || !path.trim()) {
      issues.push(error(`${loc}[${index}]`, '圖片路徑必須是非空字串。'));
      return;
    }
    try {
      const normalized = normalizePackagePath(path);
      if (!normalized.startsWith('assets/')) {
        issues.push(warning(`${loc}[${index}]`, '建議圖片放在題庫 assets/ 目錄內。'));
      }
      const ext = extensionOf(normalized);
      if (!SAFE_IMAGE_TYPES.has(ext)) {
        issues.push(error(`${loc}[${index}]`, `不支援的圖片類型：${ext || 'unknown'}`));
      }
    } catch (err) {
      issues.push(error(`${loc}[${index}]`, err.message));
    }
  });
}

function validateAssets(questions, assetPaths, issues) {
  if (!Array.isArray(questions) || !Array.isArray(assetPaths)) return;
  const known = new Set();
  for (const rawPath of assetPaths) {
    try {
      const path = normalizePackagePath(rawPath);
      if (known.has(path)) issues.push(error('assets', `資產路徑重複：${path}`));
      known.add(path);
    } catch (err) {
      issues.push(error('assets', err.message));
    }
  }

  questions.forEach((question, index) => {
    for (const field of ['images', 'explanationImages']) {
      for (const path of question[field] || []) {
        let normalized;
        try { normalized = normalizePackagePath(path); } catch { continue; }
        if (!known.has(normalized)) {
          issues.push(warning(`questions[${index}].${field}`, `找不到引用圖片：${normalized}`));
        }
      }
    }
  });
}

function error(location, message) {
  return { severity: 'error', location, message };
}
function warning(location, message) {
  return { severity: 'warning', location, message };
}

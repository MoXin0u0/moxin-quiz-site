import { SCHEMA_VERSION, SUPPORTED_QUESTION_TYPES } from '../data/schema/question-bank.js';

const SAFE_IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

export function validatePackage({ manifest, questions, assetPaths = [] }) {
  const issues = [];
  validateManifest(manifest, issues);
  validateQuestions(questions, issues);
  validateAssets(questions, assetPaths, issues);

  return {
    valid: !issues.some(issue => issue.severity === 'error'),
    issues,
    summary: {
      errors: issues.filter(issue => issue.severity === 'error').length,
      warnings: issues.filter(issue => issue.severity === 'warning').length,
      questionCount: Array.isArray(questions) ? questions.length : 0,
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

    validateAnswer(question, loc, issues);
    validateImageList(question.images, `${loc}.images`, issues);
  });
}

function validateAnswer(question, loc, issues) {
  const options = Array.isArray(question.options) ? question.options : [];
  const optionIds = new Set(options.map(option => option?.id).filter(Boolean));

  if (['single-choice', 'multiple-choice'].includes(question.type)) {
    if (options.length < 2) {
      issues.push(error(`${loc}.options`, '選擇題至少需要 2 個選項。'));
    }
    for (const [index, option] of options.entries()) {
      if (!option || typeof option.id !== 'string' || typeof option.text !== 'string') {
        issues.push(error(`${loc}.options[${index}]`, '選項必須包含 id 與 text 字串。'));
      }
    }
  }

  if (!Array.isArray(question.answer) || question.answer.length === 0) {
    issues.push(error(`${loc}.answer`, 'answer 必須是非空陣列。'));
    return;
  }

  if (question.type === 'single-choice' && question.answer.length !== 1) {
    issues.push(error(`${loc}.answer`, '單選題只能有一個答案。'));
  }

  if (['single-choice', 'multiple-choice'].includes(question.type)) {
    question.answer.forEach(answer => {
      if (!optionIds.has(answer)) {
        issues.push(error(`${loc}.answer`, `答案 ${answer} 不存在於 options。`));
      }
    });
  }

  if (question.type === 'true-false' && typeof question.answer[0] !== 'boolean') {
    issues.push(error(`${loc}.answer`, '是非題答案必須是 boolean。'));
  }
}

function validateImageList(images, loc, issues) {
  if (images === undefined) return;
  if (!Array.isArray(images)) {
    issues.push(error(loc, 'images 必須是陣列。'));
    return;
  }

  images.forEach((path, index) => {
    if (typeof path !== 'string' || !path.trim()) {
      issues.push(error(`${loc}[${index}]`, '圖片路徑必須是非空字串。'));
      return;
    }
    if (path.includes('..') || path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) {
      issues.push(error(`${loc}[${index}]`, '圖片路徑必須是題庫內部的安全相對路徑。'));
    }
    const ext = path.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
    if (!SAFE_IMAGE_TYPES.has(ext)) {
      issues.push(error(`${loc}[${index}]`, `不支援的圖片類型：${ext || 'unknown'}`));
    }
  });
}

function validateAssets(questions, assetPaths, issues) {
  if (!Array.isArray(questions) || !Array.isArray(assetPaths)) return;
  const known = new Set(assetPaths);
  questions.forEach((question, index) => {
    (question.images || []).forEach(path => {
      if (!known.has(path)) {
        issues.push(warning(`questions[${index}].images`, `找不到引用圖片：${path}`));
      }
    });
  });
}

function error(location, message) {
  return { severity: 'error', location, message };
}

function warning(location, message) {
  return { severity: 'warning', location, message };
}

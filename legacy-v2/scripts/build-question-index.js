#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const questionsDir = path.join(rootDir, 'questions');
const outputPath = path.join(rootDir, 'question-banks.json');
const allowedTypes = new Set(['single_choice', 'multiple_choice', 'true_false', 'fill_blank']);
const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

function main() {
  if (!fs.existsSync(questionsDir)) {
    fail(`找不到 questions 資料夾：${questionsDir}`);
  }

  const files = fs.readdirSync(questionsDir)
    .filter(file => file.toLowerCase().endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    fail('questions 資料夾中沒有任何 .json 題庫檔案。');
  }

  const index = [];
  const bankIds = new Set();

  for (const file of files) {
    const fullPath = path.join(questionsDir, file);
    const relativeFile = `questions/${file}`;
    let data;

    try {
      data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (error) {
      fail(`${relativeFile} JSON 格式錯誤：${error.message}`);
    }

    const errors = validateQuestionBank(data, relativeFile);
    if (errors.length > 0) {
      fail(`${relativeFile} 題庫格式錯誤：\n- ${errors.join('\n- ')}`);
    }

    if (bankIds.has(data.bankId)) {
      fail(`bankId 重複：${data.bankId}。檔案：${relativeFile}`);
    }
    bankIds.add(data.bankId);

    index.push({
      id: data.bankId,
      title: data.title,
      description: data.description,
      file: relativeFile,
      category: data.category,
      version: data.version,
      questionCount: data.questions.length,
      createdDate: data.createdDate,
      enabled: true
    });
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.log(`已產生 question-banks.json，共 ${index.length} 個題庫。`);
}

function validateQuestionBank(bank, file) {
  const errors = [];
  if (!bank || typeof bank !== 'object' || Array.isArray(bank)) return ['根節點必須是 JSON 物件'];
  ['bankId', 'title', 'description', 'version', 'createdDate', 'category'].forEach(field => {
    if (!bank[field] || typeof bank[field] !== 'string') errors.push(`缺少或無效欄位：${field}`);
  });
  if (!Array.isArray(bank.questions)) errors.push('questions 必須是陣列');
  if (Array.isArray(bank.questions) && bank.questions.length === 0) errors.push('questions 不可為空');

  const ids = new Set();
  if (Array.isArray(bank.questions)) {
    bank.questions.forEach((question, index) => {
      validateQuestion(question, index, file).forEach(error => errors.push(error));
      if (question && question.id) {
        if (ids.has(question.id)) errors.push(`題目 id 重複：${question.id}`);
        ids.add(question.id);
      }
    });
  }

  return errors;
}

function validateQuestion(question, index, file) {
  const label = `第 ${index + 1} 題`;
  const errors = [];
  if (!question || typeof question !== 'object' || Array.isArray(question)) return [`${label} 必須是物件`];

  if (!question.id || typeof question.id !== 'string') errors.push(`${label} 缺少 id`);
  if (!question.type || typeof question.type !== 'string') errors.push(`${label} 缺少 type`);
  if (question.type && !allowedTypes.has(question.type)) errors.push(`${label} 不支援題型：${question.type}`);
  if (!question.question || typeof question.question !== 'string') errors.push(`${label} 缺少 question`);
  if (!Object.prototype.hasOwnProperty.call(question, 'answer')) errors.push(`${label} 缺少 answer`);
  if (!question.explanation || typeof question.explanation !== 'string') errors.push(`${label} 缺少 explanation`);
  if (!Array.isArray(question.tags) || question.tags.length === 0) errors.push(`${label} tags 必須是非空陣列`);
  if (!question.difficulty || !['easy', 'medium', 'hard'].includes(question.difficulty)) errors.push(`${label} difficulty 必須是 easy、medium 或 hard`);
  if (!question.chapter || typeof question.chapter !== 'string') errors.push(`${label} 缺少 chapter`);

  if (question.type === 'single_choice') {
    if (!isPlainObject(question.options) || Object.keys(question.options).length < 2) errors.push(`${label} 單選題 options 至少需要兩個選項`);
    if (typeof question.answer !== 'string') errors.push(`${label} 單選題 answer 必須是字串`);
  }

  if (question.type === 'multiple_choice') {
    if (!isPlainObject(question.options) || Object.keys(question.options).length < 2) errors.push(`${label} 複選題 options 至少需要兩個選項`);
    if (!Array.isArray(question.answer)) errors.push(`${label} 複選題 answer 必須是陣列`);
  }

  if (question.type === 'true_false' && typeof question.answer !== 'boolean') {
    errors.push(`${label} 是非題 answer 必須是 true 或 false`);
  }

  if (question.type === 'fill_blank') {
    if (!Array.isArray(question.answer) || question.answer.length === 0) errors.push(`${label} 填空題 answer 必須是非空陣列`);
    if (question.caseSensitive !== undefined && typeof question.caseSensitive !== 'boolean') errors.push(`${label} caseSensitive 必須是布林值`);
  }

  validateImages(question.images, `${label} images`, file).forEach(error => errors.push(error));
  validateImages(question.explanationImages, `${label} explanationImages`, file).forEach(error => errors.push(error));

  return errors;
}

function validateImages(images, fieldName, file) {
  const errors = [];
  if (images === undefined) return errors;
  if (!Array.isArray(images)) return [`${fieldName} 必須是陣列`];

  images.forEach((image, index) => {
    if (!image || typeof image !== 'object' || Array.isArray(image)) {
      errors.push(`${fieldName}[${index}] 必須是物件`);
      return;
    }
    ['src', 'alt', 'caption'].forEach(field => {
      if (!image[field] || typeof image[field] !== 'string') errors.push(`${fieldName}[${index}] 缺少 ${field}`);
    });
    if (image.src) {
      const ext = path.extname(image.src.split('?')[0].split('#')[0]).toLowerCase();
      if (!allowedExt.has(ext)) errors.push(`${fieldName}[${index}] 圖片副檔名不支援：${image.src}`);
    }
  });

  return errors;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main();

import assert from 'node:assert/strict';
import {
  BATCH_PARSE_STATUS,
  parseBatchQuestionText,
  parseQuestionBlock,
  selectBatchQuestions,
  splitQuestionBlocks,
} from '../src/studio/batch-parser.js';

// 1. Complete single-choice question.
{
  const result = parseBatchQuestionText(`
1. ERP 系統的核心目的是？
A. 整合企業流程與資訊
B. 只處理薪資
C. 只管理網頁
D. 只做圖表
答案：A
解析：ERP 用於跨部門資訊與流程整合。
章節：ERP 基礎
標籤：ERP, 基礎
難度：2
  `);

  assert.deepEqual(result.summary, { total: 1, ready: 1, review: 0, unparsed: 0 });
  const q = result.candidates[0].question;
  assert.equal(q.type, 'single-choice');
  assert.deepEqual(q.answer, ['A']);
  assert.equal(q.options.length, 4);
  assert.equal(q.chapter, 'ERP 基礎');
  assert.deepEqual(q.tags, ['ERP', '基礎']);
  assert.equal(q.difficulty, 2);
}

// 2. Multiple choice inferred only from explicit multiple option letters.
{
  const result = parseBatchQuestionText(`
第2題 下列哪些屬於 ERP 常見模組？
A、財務
B、採購
C、生產
D、人力資源
正解：A、B、C、D
  `);
  const candidate = result.candidates[0];
  assert.equal(candidate.status, BATCH_PARSE_STATUS.READY);
  assert.equal(candidate.question.type, 'multiple-choice');
  assert.deepEqual(candidate.question.answer, ['A', 'B', 'C', 'D']);
}

// 3. Missing answer must never be guessed.
{
  const result = parseBatchQuestionText(`
Q3 哪一項是資料庫？
A. MySQL
B. HTML
C. CSS
D. PNG
  `);
  const candidate = result.candidates[0];
  assert.equal(candidate.status, BATCH_PARSE_STATUS.REVIEW);
  assert.equal(candidate.question.type, 'single-choice');
  assert.deepEqual(candidate.question.answer, []);
  assert.ok(candidate.issues.some(item => item.code === 'draft:answer'));
}

// 4. Explicit true/false answer.
{
  const result = parseBatchQuestionText(`
題目：ERP 可以整合企業內不同部門資訊。
題型：是非
答案：正確
詳解：ERP 的核心價值之一就是資訊整合。
  `);
  const candidate = result.candidates[0];
  assert.equal(candidate.status, BATCH_PARSE_STATUS.READY);
  assert.equal(candidate.question.type, 'true-false');
  assert.deepEqual(candidate.question.answer, [true]);
}

// 5. Explicit false tokens are respected.
{
  const candidate = parseQuestionBlock(`
第5題 HTML 是資料庫管理系統。
題型：判斷題
答案：X
  `);
  assert.equal(candidate.status, BATCH_PARSE_STATUS.READY);
  assert.deepEqual(candidate.question.answer, [false]);
}

// 6. Explicit fill-in is ready.
{
  const result = parseBatchQuestionText(`
6、企業資源規劃的英文縮寫是？
題型：填空
答案：ERP
章節：名詞
  `);
  const candidate = result.candidates[0];
  assert.equal(candidate.status, BATCH_PARSE_STATUS.READY);
  assert.equal(candidate.question.type, 'fill-in');
  assert.deepEqual(candidate.question.answer, ['ERP']);
}

// 7. Fill-in without explicit type remains review; parser does not pretend certainty.
{
  const candidate = parseQuestionBlock(`
7. 企業資源規劃的英文縮寫是？
答案：ERP
  `);
  assert.equal(candidate.status, BATCH_PARSE_STATUS.REVIEW);
  assert.equal(candidate.question.type, 'fill-in');
  assert.deepEqual(candidate.question.answer, ['ERP']);
  assert.ok(candidate.issues.some(item => item.code === 'inferred-type'));
}

// 8. Invalid choice answer references do not become a valid draft.
{
  const candidate = parseQuestionBlock(`
8. 正確選項是哪一個？
A. 甲
B. 乙
答案：C
  `);
  assert.equal(candidate.status, BATCH_PARSE_STATUS.REVIEW);
  assert.deepEqual(candidate.question.answer, []);
  assert.ok(candidate.issues.some(item => item.code === 'choice-answer-missing-option'));
}

// 9. Explicit single-choice + multiple answers is a conflict and answer is cleared.
{
  const candidate = parseQuestionBlock(`
第9題 以下何者正確？
題型：單選
A. 甲
B. 乙
C. 丙
答案：A,C
  `);
  assert.equal(candidate.status, BATCH_PARSE_STATUS.REVIEW);
  assert.deepEqual(candidate.question.answer, []);
  assert.ok(candidate.issues.some(item => item.code === 'single-multiple-answer-conflict'));
}

// 10. Multiline question and explanation are preserved.
{
  const candidate = parseQuestionBlock(`
題目：某公司準備導入 ERP，
希望先完成流程盤點。
下列哪一項最適合先做？
A. 盤點現行流程
B. 直接上線
答案：A
詳解：導入前應先理解 As-Is 流程，
再規劃 To-Be 流程。
  `);
  assert.match(candidate.question.question, /希望先完成流程盤點/);
  assert.match(candidate.question.question, /下列哪一項最適合先做/);
  assert.match(candidate.question.explanation, /As-Is/);
  assert.match(candidate.question.explanation, /To-Be/);
}

// 11. Numbering variants split correctly.
{
  const { blocks } = splitQuestionBlocks(`
前言：以下為題目
1. 第一題？
A. 甲
B. 乙
答案：A

2、第二題？
A. 甲
B. 乙
答案：B

Q3 第三題？
A. 甲
B. 乙
答案：A

第4題 第四題？
A. 甲
B. 乙
答案：B
  `);
  assert.equal(blocks.length, 4);
}

// 12. Repeated 題目： blocks split correctly.
{
  const result = parseBatchQuestionText(`
題目：第一題？
A. 甲
B. 乙
答案：A

題目：第二題？
A. 甲
B. 乙
答案：B
  `);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.summary.ready, 2);
}

// 13. Unstructured text is preserved instead of discarded.
{
  const candidate = parseQuestionBlock('');
  assert.equal(candidate.status, BATCH_PARSE_STATUS.UNPARSED);
  assert.equal(candidate.question, null);
}

// 14. A plain sentence without enough type information becomes review, not invented answer.
{
  const candidate = parseQuestionBlock('請說明 ERP 的主要目的。');
  assert.equal(candidate.status, BATCH_PARSE_STATUS.REVIEW);
  assert.equal(candidate.question.type, 'fill-in');
  assert.deepEqual(candidate.question.answer, []);
}

// 15. Unknown explicit type is review.
{
  const candidate = parseQuestionBlock(`
題目：範例？
題型：申論
答案：測試
  `);
  assert.equal(candidate.status, BATCH_PARSE_STATUS.REVIEW);
  assert.ok(candidate.issues.some(item => item.code === 'unknown-explicit-type'));
}

// 16. Difficulty outside 1..5 becomes review and defaults to 3.
{
  const candidate = parseQuestionBlock(`
題目：範例？
A. 甲
B. 乙
答案：A
難度：9
  `);
  assert.equal(candidate.status, BATCH_PARSE_STATUS.REVIEW);
  assert.equal(candidate.question.difficulty, 3);
  assert.ok(candidate.issues.some(item => item.code === 'invalid-difficulty'));
}

// 17. Tags support Chinese separators.
{
  const candidate = parseQuestionBlock(`
題目：範例？
A. 甲
B. 乙
答案：A
標籤：ERP、導入；基礎
  `);
  assert.deepEqual(candidate.question.tags, ['ERP', '導入', '基礎']);
}

// 18. IDs are unique relative to existing Studio questions.
{
  const existing = [
    { id: 'Q001' },
    { id: 'Q002' },
  ];
  const result = parseBatchQuestionText(`
1. 第一題？
A. 甲
B. 乙
答案：A
2. 第二題？
A. 甲
B. 乙
答案：B
  `, { existingQuestions: existing });

  assert.deepEqual(result.candidates.map(item => item.question.id), ['Q003', 'Q004']);
}

// 19. selectBatchQuestions excludes review by default.
{
  const result = parseBatchQuestionText(`
1. 可建立？
A. 甲
B. 乙
答案：A

2. 需確認？
A. 甲
B. 乙
  `);

  const selected = selectBatchQuestions(result.candidates);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].question, '可建立?');
}

// 20. Review questions can be explicitly included after user confirmation.
{
  const result = parseBatchQuestionText(`
1. 可建立？
A. 甲
B. 乙
答案：A

2. 需確認？
A. 甲
B. 乙
  `);

  const selected = selectBatchQuestions(result.candidates, { includeReview: true });
  assert.equal(selected.length, 2);
  assert.deepEqual(selected[1].answer, []);
}

// 21. Existing question IDs are re-assigned safely when selected into a draft.
{
  const result = parseBatchQuestionText(`
1. 題目一？
A. 甲
B. 乙
答案：A
  `);

  const selected = selectBatchQuestions(result.candidates, {
    existingQuestions: [{ id: 'Q001' }, { id: 'Q002' }, { id: 'Q003' }],
  });
  assert.equal(selected[0].id, 'Q004');
}

// 22. Original raw text remains available for manual repair.
{
  const raw = `第22題 題目？\nA. 甲\nB. 乙\n答案：A`;
  const candidate = parseQuestionBlock(raw);
  assert.equal(candidate.raw, raw);
}

console.log('MoXin Quiz v4.0 P2B batch parser core: 22 regression cases passed.');

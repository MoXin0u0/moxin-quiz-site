import assert from 'node:assert/strict';
import {
  convertQuestionType,
  createQuestionDraft,
  planQuestionTypeChange,
  validateQuestionDraft,
} from '../src/studio/question-draft.js';

const TYPES = ['single-choice','multiple-choice','true-false','fill-in'];

for (const type of TYPES) {
  const q = createQuestionDraft(type, []);
  assert.equal(q.type, type);
  assert.deepEqual(q.answer, [], `${type} must not get an automatic answer`);
  if (type === 'single-choice' || type === 'multiple-choice') {
    assert.deepEqual(q.options.map(x => x.id), ['A','B']);
  } else {
    assert.deepEqual(q.options, []);
  }
  assert.equal(validateQuestionDraft(q).valid, false);
}

const samples = {
  'single-choice': {id:'Q001',type:'single-choice',question:'單選',options:[{id:'A',text:'甲'},{id:'B',text:'乙'}],answer:['A'],explanation:'詳解',images:[],explanationImages:[],chapter:'章',tags:['標'],difficulty:3},
  'multiple-choice': {id:'Q001',type:'multiple-choice',question:'複選',options:[{id:'A',text:'甲'},{id:'B',text:'乙'},{id:'C',text:'丙'}],answer:['A','C'],explanation:'詳解',images:[],explanationImages:[],chapter:'章',tags:['標'],difficulty:3},
  'true-false': {id:'Q001',type:'true-false',question:'是非',options:[],answer:[false],explanation:'詳解',images:[],explanationImages:[],chapter:'章',tags:['標'],difficulty:3},
  'fill-in': {id:'Q001',type:'fill-in',question:'填空',options:[],answer:['ERP'],explanation:'詳解',images:[],explanationImages:[],chapter:'章',tags:['標'],difficulty:3,caseSensitive:false},
};

let count = 0;
for (const from of TYPES) {
  for (const to of TYPES) {
    count++;
    const src = structuredClone(samples[from]);
    const out = convertQuestionType(src, to);
    assert.equal(out.type, to);
    assert.equal(out.question, src.question);
    assert.equal(out.explanation, src.explanation);
    assert.equal(out.chapter, src.chapter);
    assert.deepEqual(out.tags, src.tags);

    if (from === to) {
      assert.deepEqual(out.answer, src.answer);
    } else if (from === 'single-choice' && to === 'multiple-choice') {
      assert.deepEqual(out.answer, ['A']);
      assert.deepEqual(out.options, src.options);
    } else if (from === 'multiple-choice' && to === 'single-choice') {
      assert.deepEqual(out.answer, []);
      assert.deepEqual(out.options, src.options);
      assert.equal(planQuestionTypeChange(src, to).requiresConfirmation, true);
    } else {
      assert.deepEqual(out.answer, [], `${from}->${to} leaked an incompatible answer`);
      if (to === 'single-choice' || to === 'multiple-choice') {
        assert.equal(out.options.length >= 2, true);
      } else {
        assert.deepEqual(out.options, []);
      }
    }
  }
}
assert.equal(count, 16);

const multiOne = structuredClone(samples['multiple-choice']);
multiOne.answer = ['B'];
assert.deepEqual(convertQuestionType(multiOne, 'single-choice').answer, ['B']);

assert.equal(validateQuestionDraft(samples['single-choice']).valid, true);
console.log('MoXin Quiz v4.0 R1 question draft core: 16 transitions passed.');

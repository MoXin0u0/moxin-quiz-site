import assert from 'node:assert/strict';
import { migrateLegacyBank } from '../src/data/migration/legacy-v1-to-v2.js';
import { validatePackage } from '../src/question-bank/validator.js';
import { checkAnswer } from '../src/quiz/scoring.js';
import { createSeededRandom, shuffle } from '../src/quiz/shuffle.js';
import { normalizePackagePath } from '../src/utils/path.js';

const legacy = {
  bankId: 'demo', title: 'Demo', version: '1.0', category: 'test',
  questions: [
    { id: 'Q1', type: 'single_choice', question: 'x', options: { A: 'a', B: 'b' }, answer: 'A', explanation: 'e', tags: ['t'], difficulty: 'easy', chapter: 'c' },
    { id: 'Q2', type: 'true_false', question: 'x', answer: false, explanation: 'e', tags: ['t'], difficulty: 'medium', chapter: 'c' },
  ],
};
const migrated = migrateLegacyBank(legacy);
assert.equal(migrated.manifest.schemaVersion, '2.0');
assert.equal(migrated.manifest.version, '1.0.0');
assert.deepEqual(migrated.questions[0].answer, ['A']);
assert.deepEqual(migrated.questions[1].answer, [false]);

const report = validatePackage({ manifest: migrated.manifest, questions: migrated.questions, assetPaths: [] });
assert.equal(report.valid, true);
assert.equal(checkAnswer(migrated.questions[0], 'A'), true);
assert.equal(checkAnswer(migrated.questions[1], false), true);
assert.equal(checkAnswer(migrated.questions[1], true), false);

const randomA = createSeededRandom(1234);
const randomB = createSeededRandom(1234);
assert.deepEqual(shuffle([1,2,3,4,5], randomA), shuffle([1,2,3,4,5], randomB));
assert.equal(normalizePackagePath('assets\\images\\q1.png'), 'assets/images/q1.png');
assert.throws(() => normalizePackagePath('../evil.js'));

console.log('MoXin Quiz v3 P0/P1 unit tests passed.');

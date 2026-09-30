import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/app/main.js', 'utf8');
const library = fs.readFileSync('src/ui/library.js', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');

assert.match(main, /cleanupLegacyAnswerQuery\(\);/);
assert.match(main, /elements\.practiceArea\.addEventListener\('submit'/);
assert.match(main, /event\.preventDefault\(\);\s*await submitPracticeAnswer\(\);/s);
assert.match(main, /elements\.examArea\.addEventListener\('submit'/);
assert.match(main, /await saveCurrentExamAnswer\(\);/);
assert.match(main, /url\.searchParams\.delete\(key\)/);

assert.match(library, /dataset\.toastMessage/);
assert.match(library, /dataset\.toastKind/);
assert.match(library, /visibleNonSticky\.length > 4/);

assert.match(serviceWorker, /moxin-quiz-v3-[^'\"\s]+/);

console.log('MoXin Quiz v3 RC1 form/toast regression tests passed.');

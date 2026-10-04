import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/app/main.js', 'utf8');
const library = fs.readFileSync('src/ui/library.js', 'utf8');
const tools = fs.readFileSync('src/ui/tools.js', 'utf8');
const studio = fs.readFileSync('src/ui/studio-r1.js', 'utf8');
const css = fs.readFileSync('styles/v3.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(main, /createStudioDraftFromInspectedPackage/);
assert.match(main, /inspectStudioPackagePlan/);
assert.match(main, /saveStudioDraft/);
assert.match(main, /data-open-inspected-studio/);
assert.match(main, /openCurrentPackageInStudio/);
assert.match(main, /renderQuestionBankTools\(elements\.toolsArea,\s*\{\s*draftId:/);
assert.match(main, /showView\('tools'\)/);

assert.match(library, /data-open-inspected-studio/);
assert.match(library, /在題庫工作室中開啟/);
assert.match(library, /inspection-studio-note/);
assert.match(library, /工作室會建立可編輯副本/);
assert.match(library, /不會覆蓋目前本機題庫/);

assert.match(tools, /renderQuestionBankTools\(container, options = \{\}\)/);
assert.match(tools, /draftId: options\.draftId \|\| null/);

assert.match(studio, /mountStudioWorkspace\(mount, options = \{\}\)/);
assert.match(studio, /requestedDraftId/);
assert.match(studio, /await openDraftById\(requestedDraftId\)/);

assert.match(css, /\.inspection-studio-note/);
assert.match(css, /\.inspection-studio-note\.warning/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);

console.log('MoXin Quiz v4.0 P2C.1 import-to-Studio UI integration tests passed.');

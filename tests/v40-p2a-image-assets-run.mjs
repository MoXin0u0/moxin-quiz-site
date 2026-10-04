import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  addQuestionImages,
  collectReferencedAssetPaths,
  countAssetReferences,
  duplicateQuestionAssets,
  findUnusedAssets,
  getAssetUsageSummary,
  makeUniqueImagePath,
  pruneUnusedAssets,
  removeQuestionImage,
  replaceQuestionImage,
} from '../src/studio/asset-manager.js';

function namedBlob(name, content = 'img', type = 'image/png') {
  const blob = new Blob([content], { type });
  Object.defineProperty(blob, 'name', { value: name });
  return blob;
}

const draft = {
  questions: [{
    id: 'Q001',
    images: [],
    explanationImages: [],
  }],
  assets: [],
};

const first = namedBlob('diagram.png');
const second = namedBlob('diagram.png', 'second');

const paths = addQuestionImages({
  draft,
  questionId: 'Q001',
  field: 'images',
  files: [first, second],
});

assert.deepEqual(paths, [
  'assets/images/Q001/question/diagram.png',
  'assets/images/Q001/question/diagram-2.png',
]);
assert.equal(draft.assets.length, 2);
assert.deepEqual(draft.questions[0].images, paths);
assert.equal(countAssetReferences(draft.questions, paths[0]), 1);

const explanationPath = addQuestionImages({
  draft,
  questionId: 'Q001',
  field: 'explanationImages',
  files: [namedBlob('step.webp', 'webp', 'image/webp')],
})[0];

assert.equal(
  explanationPath,
  'assets/images/Q001/explanation/step.webp',
);

const replacement = replaceQuestionImage({
  draft,
  questionId: 'Q001',
  field: 'images',
  path: paths[0],
  file: namedBlob('replacement.jpg', 'jpg', 'image/jpeg'),
});
assert.equal(
  replacement,
  'assets/images/Q001/question/replacement.jpg',
);
assert.equal(draft.questions[0].images.includes(paths[0]), false);
assert.equal(draft.assets.some(asset => asset.path === paths[0]), false);

const source = draft.questions[0];
const duplicate = {
  ...structuredClone(source),
  id: 'Q002',
};

const clonedPaths = duplicateQuestionAssets({
  draft,
  sourceQuestion: source,
  targetQuestion: duplicate,
});

assert.equal(clonedPaths.length, source.images.length + source.explanationImages.length);
assert.equal(duplicate.images.every(path => path.includes('/Q002/question/')), true);
assert.equal(
  duplicate.explanationImages.every(path => path.includes('/Q002/explanation/')),
  true,
);
assert.equal(
  duplicate.images.some(path => source.images.includes(path)),
  false,
);

draft.questions.push(duplicate);

const sharedAsset = {
  path: 'assets/images/shared/shared.png',
  mimeType: 'image/png',
  size: 3,
  blob: namedBlob('shared.png'),
};
draft.assets.push(sharedAsset);
draft.questions[0].images.push(sharedAsset.path);
draft.questions[1].images.push(sharedAsset.path);

removeQuestionImage({
  draft,
  questionId: 'Q001',
  field: 'images',
  path: sharedAsset.path,
});
assert.equal(draft.assets.some(asset => asset.path === sharedAsset.path), true);

removeQuestionImage({
  draft,
  questionId: 'Q002',
  field: 'images',
  path: sharedAsset.path,
});
assert.equal(draft.assets.some(asset => asset.path === sharedAsset.path), false);

const orphan = {
  path: 'assets/images/orphan.png',
  mimeType: 'image/png',
  size: 1,
  blob: namedBlob('orphan.png'),
};
draft.assets.push(orphan);
assert.equal(findUnusedAssets(draft).some(asset => asset.path === orphan.path), true);

const removed = pruneUnusedAssets(draft);
assert.equal(removed.some(asset => asset.path === orphan.path), true);
assert.equal(findUnusedAssets(draft).length, 0);

const refs = collectReferencedAssetPaths(draft.questions);
assert.equal(refs.size > 0, true);

const summary = getAssetUsageSummary(draft);
assert.equal(summary.assetCount, draft.assets.length);
assert.equal(summary.unusedCount, 0);
assert.equal(summary.totalBytes > 0, true);

assert.equal(
  makeUniqueImagePath({
    questionId: 'Q001',
    field: 'images',
    filename: '圖 表.png',
    extension: 'png',
    existingPaths: new Set(),
  }),
  'assets/images/Q001/question/image.png',
);

assert.throws(() => addQuestionImages({
  draft,
  questionId: 'Q001',
  field: 'images',
  files: [namedBlob('danger.exe', 'x', 'application/octet-stream')],
}), /不支援的圖片類型/);

const studio = fs.readFileSync('src/ui/studio-r1.js', 'utf8');
const css = fs.readFileSync('styles/v4-studio-r1.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(studio, /data-studio-image-input/);
assert.match(studio, /data-studio-image-drop/);
assert.match(studio, /data-studio-replace-image/);
assert.match(studio, /data-studio-remove-image/);
assert.match(studio, /data-studio-clean-unused-assets/);
assert.match(studio, /renderPreviewImages/);
assert.match(studio, /duplicateQuestionAssets/);
assert.match(css, /\.studio-r1-media-drop/);
assert.match(css, /\.studio-r1-media-grid/);
assert.match(css, /\.studio-r1-asset-summary/);
assert.match(sw, /src\/studio\/asset-manager\.js/);
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v3-4\.\d+\.\d+-[^']+'/);

console.log('MoXin Quiz v4.0 P2A image asset tests passed.');

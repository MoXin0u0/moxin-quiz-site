
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildNoteMergeMessage,
  buildNoteMergeSeed,
  getConflictPresentation,
  renderConflictCards,
} from '../src/ui/conflicts.js';
import {
  CONFLICT_RESOLUTION_CHOICE,
} from '../src/sync/conflict-resolution.js';

const localRevision = {
  revisionId: 'rev-note-local',
  parentRevisionIds: ['rev-note-base'],
  changedAt: '2026-10-07T08:00:00.000Z',
  changedByDeviceId: 'device-local',
  clock: { physicalMs: 10, logical: 0, deviceId: 'device-local' },
};
const remoteRevision = {
  revisionId: 'rev-note-remote',
  parentRevisionIds: ['rev-note-base'],
  changedAt: '2026-10-07T08:01:00.000Z',
  changedByDeviceId: 'device-remote',
  clock: { physicalMs: 11, logical: 0, deviceId: 'device-remote' },
};
const conflict = {
  conflictId: 'conflict-note-merge',
  entityType: 'note',
  entityKey: 'bank::Q1',
  kind: 'concurrent-edit',
  localRevision,
  remoteRevision,
  localValue: {
    key: 'bank::Q1',
    text: '本機段落',
    revision: localRevision,
  },
  remoteValue: {
    key: 'bank::Q1',
    text: '雲端段落',
    revision: remoteRevision,
  },
  createdAt: '2026-10-07T08:02:00.000Z',
  status: 'open',
};

assert.equal(CONFLICT_RESOLUTION_CHOICE.MERGED, 'merged');

const presentation = getConflictPresentation(conflict);
assert.equal(presentation.directlyResolvable, true);
assert.equal(presentation.supportsManualMerge, true);

assert.match(buildNoteMergeSeed(conflict), /本機段落/);
assert.match(buildNoteMergeSeed(conflict), /雲端版本/);
assert.match(buildNoteMergeSeed(conflict), /雲端段落/);
assert.match(buildNoteMergeMessage(conflict), /合併後的筆記內容/);
assert.match(buildNoteMergeMessage(conflict), /同時承接/);

const deleteVsEdit = {
  ...conflict,
  conflictId: 'conflict-note-delete',
  kind: 'delete-vs-edit',
};
assert.equal(
  getConflictPresentation(deleteVsEdit).supportsManualMerge,
  false,
);

const html = renderConflictCards([conflict, deleteVsEdit]);
assert.match(
  html,
  /data-resolve-conflict-merge="conflict-note-merge"/,
);
assert.doesNotMatch(
  html.match(
    /data-conflict-id="conflict-note-delete"[\s\S]*?<\/article>/,
  )?.[0] || '',
  /data-resolve-conflict-merge/,
);

const resolution = fs.readFileSync('src/sync/conflict-resolution.js', 'utf8');
const dialogs = fs.readFileSync('src/ui/dialogs.js', 'utf8');
const syncUi = fs.readFileSync('src/app/sync-ui.js', 'utf8');
const dialogCss = fs.readFileSync('styles/v5-dialogs.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(resolution, /CONFLICT_RESOLUTION_CHOICE\.MERGED/);
assert.match(resolution, /buildMergedBranch/);
assert.match(resolution, /CONFLICT_MERGE_UNSUPPORTED/);
assert.match(resolution, /CONFLICT_MERGE_DELETE_EDIT/);
assert.match(resolution, /CONFLICT_MERGE_DELETED_BRANCH/);
assert.match(resolution, /CONFLICT_MERGE_REVISION_MISSING/);
assert.match(resolution, /status:\s*'refresh-required'/);
assert.match(resolution, /localSnapshotPreviousRevisionId/);
assert.match(resolution, /CONFLICT_MERGE_EMPTY/);
assert.match(resolution, /text:\s*normalizedText/);
assert.match(resolution, /delete value\.content/);
assert.match(dialogs, /showTextAreaDialog/);
assert.match(dialogs, /input\.multiline/);
assert.match(syncUi, /mergeNoteConflict/);
assert.match(syncUi, /showTextAreaDialog/);
assert.match(syncUi, /mergedValue:\s*\{ text: mergedContent \}/);
assert.match(dialogCss, /\.app-dialog-textarea/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b13d1-3'/);
assert.match(sw, /src\/ui\/conflicts\.js/);
assert.match(sw, /src\/sync\/conflict-resolution\.js/);

console.log('V5 B13C5.1 note conflict consistency contracts passed.');

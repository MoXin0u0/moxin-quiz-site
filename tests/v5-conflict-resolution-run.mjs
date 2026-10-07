
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildConflictResolutionMessage,
  getConflictPresentation,
  renderConflictCards,
} from '../src/ui/conflicts.js';

const revisionLocal = {
  revisionId: 'rev-local',
  parentRevisionIds: ['rev-base'],
  changedAt: '2026-10-07T06:00:00.000Z',
  changedByDeviceId: 'device-local',
  clock: { physicalMs: 1000, logical: 0, deviceId: 'device-local' },
};
const revisionRemote = {
  revisionId: 'rev-remote',
  parentRevisionIds: ['rev-base'],
  changedAt: '2026-10-07T06:01:00.000Z',
  changedByDeviceId: 'device-remote',
  clock: { physicalMs: 1001, logical: 0, deviceId: 'device-remote' },
};

const noteConflict = {
  conflictId: 'conflict-note',
  entityType: 'note',
  entityKey: 'bank::Q1',
  kind: 'concurrent-edit',
  localRevision: revisionLocal,
  remoteRevision: revisionRemote,
  localValue: {
    key: 'bank::Q1',
    content: '本機筆記內容',
    revision: revisionLocal,
  },
  remoteValue: {
    key: 'bank::Q1',
    content: '雲端筆記內容',
    revision: revisionRemote,
  },
  createdAt: '2026-10-07T06:02:00.000Z',
  status: 'open',
};

const notePresentation = getConflictPresentation(noteConflict);
assert.equal(notePresentation.entityLabel, '題目筆記');
assert.equal(notePresentation.kindLabel, '兩個裝置同時修改');
assert.equal(notePresentation.directlyResolvable, true);
assert.equal(notePresentation.preservesLosingBranch, false);
assert.match(notePresentation.local.detail, /本機筆記內容/);
assert.match(notePresentation.remote.detail, /雲端筆記內容/);

const message = buildConflictResolutionMessage(noteConflict, 'remote');
assert.match(message, /雲端版本/);
assert.match(message, /同時承接兩個 Revision/);

const practiceConflict = {
  ...noteConflict,
  conflictId: 'conflict-session',
  entityType: 'practice-session',
  entityKey: 'session-1',
  localValue: {
    id: 'session-1',
    sessionType: 'practice',
    status: 'active',
    revision: revisionLocal,
  },
  remoteValue: {
    id: 'session-1',
    sessionType: 'practice',
    status: 'abandoned',
    revision: revisionRemote,
  },
};
const practicePresentation = getConflictPresentation(practiceConflict);
assert.equal(practicePresentation.directlyResolvable, true);
assert.equal(practicePresentation.preservesLosingBranch, true);
assert.match(
  buildConflictResolutionMessage(practiceConflict, 'local'),
  /衝突副本/,
);

const immutableConflict = {
  ...noteConflict,
  conflictId: 'conflict-attempt',
  entityType: 'attempt',
  entityKey: 'attempt-1',
  kind: 'content-id-collision',
  localRevision: null,
  remoteRevision: null,
  localValue: { eventId: 'attempt-1', selectedOptionIds: ['A'] },
  remoteValue: { eventId: 'attempt-1', selectedOptionIds: ['B'] },
};
const immutablePresentation = getConflictPresentation(immutableConflict);
assert.equal(immutablePresentation.directlyResolvable, false);

const html = renderConflictCards([noteConflict, immutableConflict]);
assert.match(html, /data-resolve-conflict-local="conflict-note"/);
assert.match(html, /data-resolve-conflict-remote="conflict-note"/);
assert.match(html, /需要人工復原/);
assert.match(html, /不可變資料識別衝突/);

const resolution = fs.readFileSync('src/sync/conflict-resolution.js', 'utf8');
const syncUi = fs.readFileSync('src/app/sync-ui.js', 'utf8');
const center = fs.readFileSync('src/ui/sync-center.js', 'utf8');
const css = fs.readFileSync('styles/v5-sync.css', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(resolution, /resolveSyncConflict/);
assert.match(resolution, /parentRevisionIds:\s*parents/);
assert.match(resolution, /preserveLosingBranchIfRequired/);
assert.match(syncUi, /data-resolve-conflict-local/);
assert.match(syncUi, /data-resolve-conflict-remote/);
assert.match(syncUi, /resolveSyncConflict/);
assert.match(center, /renderConflictCards/);
assert.match(center, /Conflict Resolution/);
assert.match(css, /\.sync-conflict-branches/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b13d1-1'/);
assert.match(sw, /src\/sync\/conflict-resolution\.js/);
assert.match(sw, /src\/ui\/conflicts\.js/);

console.log('V5 B13C3 conflict resolution UI contracts passed.');

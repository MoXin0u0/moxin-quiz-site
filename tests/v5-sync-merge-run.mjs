import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  MERGE_ACTION,
  SYNC_CONFLICT_KIND,
  decideMutableMerge,
} from '../src/sync/merge-policy.js';
import {
  FIRST_SYNC_PLAN,
  planFirstSync,
} from '../src/sync/reconciliation.js';

function revision(id, parent = [], physicalMs = 1, logical = 0, deviceId = 'device-a') {
  return {
    revisionId: id,
    parentRevisionIds: parent,
    changedAt: new Date(physicalMs).toISOString(),
    changedByDeviceId: deviceId,
    clock: { physicalMs, logical, deviceId },
  };
}

const parent = revision('rev-parent', [], 100, 0, 'device-a');
const child = revision('rev-child', ['rev-parent'], 200, 0, 'device-b');

assert.deepEqual(
  await decideMutableMerge({
    entityType: 'note',
    localRevision: parent,
    remoteRevision: child,
    isAncestor: async (ancestorId, descendant) =>
      ancestorId === 'rev-parent' && descendant.revisionId === 'rev-child',
  }),
  { action: MERGE_ACTION.APPLY_REMOTE, reason: 'remote-descends-local' },
);

const concurrent = await decideMutableMerge({
  entityType: 'note',
  localRevision: revision('left', ['base'], 300, 0, 'a'),
  remoteRevision: revision('right', ['base'], 301, 0, 'b'),
  isAncestor: async () => false,
});
assert.equal(concurrent.action, MERGE_ACTION.CONFLICT);
assert.equal(concurrent.kind, SYNC_CONFLICT_KIND.CONCURRENT_EDIT);

const deleteConflict = await decideMutableMerge({
  entityType: 'learning-goal',
  localRevision: revision('left', ['base'], 300, 0, 'a'),
  remoteRevision: revision('right', ['base'], 301, 0, 'b'),
  localDeleted: false,
  remoteDeleted: true,
  isAncestor: async () => false,
});
assert.equal(deleteConflict.kind, SYNC_CONFLICT_KIND.DELETE_VS_EDIT);

const remoteSubmitted = await decideMutableMerge({
  entityType: 'exam-session',
  localRevision: revision('left', ['base'], 300, 0, 'a'),
  remoteRevision: revision('right', ['base'], 301, 0, 'b'),
  localValue: { status: 'active' },
  remoteValue: { status: 'submitted', submittedAt: '2026-10-06T08:00:00.000Z' },
  isAncestor: async () => false,
});
assert.equal(remoteSubmitted.action, MERGE_ACTION.APPLY_REMOTE);

const doubleSubmitted = await decideMutableMerge({
  entityType: 'exam-session',
  localRevision: revision('left', ['base'], 300, 0, 'a'),
  remoteRevision: revision('right', ['base'], 301, 0, 'b'),
  localValue: { status: 'submitted', submittedAt: '2026-10-06T08:00:00.000Z' },
  remoteValue: { status: 'submitted', submittedAt: '2026-10-06T08:01:00.000Z' },
  isAncestor: async () => false,
});
assert.equal(doubleSubmitted.kind, SYNC_CONFLICT_KIND.TERMINAL_STATE_CONFLICT);

const lww = await decideMutableMerge({
  entityType: 'favorite',
  localRevision: revision('left', [], 300, 0, 'a'),
  remoteRevision: revision('right', [], 301, 0, 'b'),
});
assert.equal(lww.action, MERGE_ACTION.APPLY_REMOTE);

assert.equal(
  planFirstSync({ isEmpty: true }, { isEmpty: true }).plan,
  FIRST_SYNC_PLAN.BOTH_EMPTY,
);
assert.equal(
  planFirstSync({ isEmpty: false }, { isEmpty: true }).plan,
  FIRST_SYNC_PLAN.UPLOAD_LOCAL,
);
assert.equal(
  planFirstSync({ isEmpty: true }, { isEmpty: false }).plan,
  FIRST_SYNC_PLAN.DOWNLOAD_CLOUD,
);
assert.equal(
  planFirstSync({ isEmpty: false }, { isEmpty: false }).plan,
  FIRST_SYNC_PLAN.MERGE_REQUIRED,
);

const sw = fs.readFileSync('service-worker.js', 'utf8');
assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-dev-b10-1'/);
assert.match(sw, /src\/sync\/remote-apply\.js/);
assert.match(sw, /src\/sync\/reconciliation\.js/);

console.log('V5 B10 deterministic merge/reconciliation contracts passed.');

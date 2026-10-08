import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  SYNC_DATA_REFRESH_EVENT,
  collectAppliedSyncEntities,
  dispatchSyncDataRefresh,
  notifyCycleDataRefresh,
} from '../src/app/sync-data-refresh.js';

const cycle = {
  pulled: [
    {
      skipped: false,
      results: [
        {
          action: 'apply-remote',
          entityType: 'favorite',
          entityKey: 'bank-a::Q1',
        },
        {
          action: 'keep-local',
          entityType: 'note',
          entityKey: 'bank-a::Q2',
        },
        {
          action: 'apply-remote',
          entityType: 'favorite',
          entityKey: 'bank-a::Q1',
        },
        {
          action: 'apply-remote',
          entityType: 'unfamiliar',
          entityKey: 'bank-a::Q1',
        },
      ],
    },
    {
      skipped: true,
      results: [
        {
          action: 'apply-remote',
          entityType: 'note',
          entityKey: 'bank-a::Q3',
        },
      ],
    },
  ],
};

assert.deepEqual(
  collectAppliedSyncEntities(cycle),
  [
    { entityType: 'favorite', entityKey: 'bank-a::Q1' },
    { entityType: 'unfamiliar', entityKey: 'bank-a::Q1' },
  ],
);

class FakeCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

const events = [];
const target = {
  CustomEvent: FakeCustomEvent,
  dispatchEvent(event) {
    events.push(event);
    return true;
  },
};

assert.equal(
  notifyCycleDataRefresh(cycle, {
    source: 'unit-cycle',
    target,
  }),
  true,
);
assert.equal(events.length, 1);
assert.equal(events[0].type, SYNC_DATA_REFRESH_EVENT);
assert.deepEqual(
  events[0].detail.entityTypes,
  ['favorite', 'unfamiliar'],
);
assert.deepEqual(
  events[0].detail.entityKeys,
  ['bank-a::Q1'],
);
assert.equal(events[0].detail.source, 'unit-cycle');

assert.equal(
  dispatchSyncDataRefresh({
    source: 'empty',
    entities: [],
  }, target),
  false,
);
assert.equal(events.length, 1);

const syncUi = fs.readFileSync('src/app/sync-ui.js', 'utf8');
const main = fs.readFileSync('src/app/main.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

assert.match(syncUi, /notifyCycleDataRefresh\(applied\.cycle/);
assert.match(syncUi, /source: 'automatic-sync'/);
assert.match(syncUi, /source: 'manual-sync'/);
assert.match(syncUi, /source: 'conflict-resolution'/);

assert.match(main, /SYNC_DATA_REFRESH_EVENT/);
assert.match(main, /refreshVisibleDataAfterSync/);
assert.match(main, /refreshCurrentPracticeLearningMetadata/);
assert.match(main, /refreshCurrentBankDetailAfterSync/);
assert.match(main, /practiceNoteDirty/);
assert.match(main, /openReviewCenter\(\{ show: false \}\)/);
assert.match(main, /openStats\(\{ show: false \}\)/);
assert.match(main, /openExamCenter\(\{ show: false \}\)/);

assert.match(sw, /CACHE_VERSION = 'moxin-quiz-v5-5.0.0-prod-1'/);
assert.match(sw, /src\/app\/sync-data-refresh\.js/);

console.log('V5 runtime sync data-refresh contracts passed.');

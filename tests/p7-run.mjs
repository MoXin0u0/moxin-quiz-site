import assert from 'node:assert/strict';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createBackupFilename,
  summarizeSnapshot,
  validateBackupSnapshot,
} from '../src/storage/backup.js';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
} from '../src/storage/settings.js';

const good = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: '2026-10-01T00:00:00.000Z',
  settings: { theme: 'dark' },
  stores: {
    banks: [{ id: 'a' }],
    questions: [{ key: 'a::q1' }, { key: 'a::q2' }],
    assets: [],
    attempts: [{ id: 1 }],
    progress: [],
    favorites: [],
    notes: [],
    mastery: [],
    reviewSchedule: [],
    sessions: [],
  },
};

assert.equal(validateBackupSnapshot(good).valid, true);
assert.equal(validateBackupSnapshot({}).valid, false);
assert.equal(validateBackupSnapshot({ ...good, version: 999 }).valid, false);

const summary = summarizeSnapshot(good);
assert.equal(summary.counts.banks, 1);
assert.equal(summary.counts.questions, 2);
assert.equal(summary.totalRecords, 4);

const normalized = normalizeSettings({
  theme: 'dark',
  fontScale: 'x-large',
  optionSpacing: 'comfortable',
  reduceMotion: true,
  studioTypeSwitchConfirm: false,
});
assert.deepEqual(normalized, {
  theme: 'dark',
  fontScale: 'x-large',
  optionSpacing: 'comfortable',
  reduceMotion: true,
  studioTypeSwitchConfirm: false,
});

assert.deepEqual(normalizeSettings({
  theme: 'invalid',
  fontScale: 'invalid',
  optionSpacing: 'invalid',
  reduceMotion: 'yes',
}), DEFAULT_SETTINGS);

assert.equal(normalizeSettings({}).studioTypeSwitchConfirm, true);

const filename = createBackupFilename(new Date('2026-10-01T01:02:03.000Z'));
assert.ok(filename.startsWith('moxin-quiz-backup-2026-10-01T01-02-03-000Z'));
assert.ok(filename.endsWith('.json'));

console.log('MoXin Quiz v3 P7 unit tests passed.');

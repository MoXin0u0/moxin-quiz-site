import assert from 'node:assert/strict';
import {
  BACKUP_FORMAT,
  BACKUP_STORE_NAMES,
  BACKUP_VERSION,
  LEGACY_BACKUP_VERSION,
  createBackupFilename,
  summarizeSnapshot,
  validateBackupSnapshot,
} from '../src/storage/backup.js';

assert.equal(BACKUP_FORMAT, 'moxin-quiz-backup');
assert.equal(BACKUP_VERSION, 2);
assert.equal(LEGACY_BACKUP_VERSION, 1);

for (const required of [
  'banks',
  'questions',
  'assets',
  'attempts',
  'favorites',
  'notes',
  'mastery',
  'sessions',
  'studioDrafts',
  'learningGoals',
  'accountSettings',
  'authorLibrary',
  'syncRevisions',
  'syncConflicts',
  'syncTombstones',
]) {
  assert.ok(BACKUP_STORE_NAMES.includes(required), `Backup v2 must include ${required}`);
}

for (const operational of [
  'devices',
  'syncMeta',
  'syncOutbox',
  'syncReceipts',
  'cloudObjects',
  'bankRegistry',
]) {
  assert.ok(!BACKUP_STORE_NAMES.includes(operational), `Backup v2 must exclude ${operational}`);
}

const v2 = {
  format: BACKUP_FORMAT,
  version: 2,
  exportedAt: '2026-10-05T00:00:00.000Z',
  app: {
    appVersion: '5.0.0-dev',
    questionBankSchemaVersion: '2.0',
    dbVersion: 4,
    backupVersion: 2,
  },
  deviceSettings: { theme: 'dark' },
  stores: Object.fromEntries(BACKUP_STORE_NAMES.map(name => [name, []])),
};
assert.deepEqual(validateBackupSnapshot(v2), { valid: true, errors: [], warnings: [] });
assert.equal(summarizeSnapshot(v2).version, 2);

const v1 = {
  format: BACKUP_FORMAT,
  version: 1,
  exportedAt: '2026-09-01T00:00:00.000Z',
  settings: { theme: 'light' },
  stores: {
    banks: [],
    questions: [],
    assets: [],
    attempts: [],
    progress: [],
    favorites: [],
    notes: [],
    mastery: [],
    reviewSchedule: [],
    sessions: [],
    studioDrafts: [],
    learningGoals: [],
  },
};
const v1Validation = validateBackupSnapshot(v1);
assert.equal(v1Validation.valid, true);
assert.equal(v1Validation.errors.length, 0);
assert.equal(v1Validation.warnings.length, 1);

const unsupported = validateBackupSnapshot({ ...v2, version: 99 });
assert.equal(unsupported.valid, false);
assert.match(unsupported.errors.join(' '), /不支援備份格式版本/);

const compatibleFilename = createBackupFilename(new Date('2026-10-05T12:34:56.789Z'));
assert.match(compatibleFilename, /^moxin-quiz-backup-2026-10-05T12-34-56-789Z\.json$/);
assert.ok(!compatibleFilename.includes('-v2-'), 'backup v2 keeps the legacy filename shape for user-facing compatibility');

console.log('V5 Backup v2 core contracts passed.');

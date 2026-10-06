import {
  getAllRecords,
} from '../storage/db.js';
import { sha256Canonical } from './hash.js';
import { CLOUD_OBJECT_TYPE } from './cloud-contract.js';

export const RECONCILIATION_KIND = Object.freeze({
  FIRST_SYNC: 'first-sync',
  RESTORE: 'restore',
  ACCOUNT_SWITCH: 'account-switch',
});

export const FIRST_SYNC_PLAN = Object.freeze({
  BOTH_EMPTY: 'both-empty',
  UPLOAD_LOCAL: 'upload-local',
  DOWNLOAD_CLOUD: 'download-cloud',
  MERGE_REQUIRED: 'merge-required',
});

export async function buildLocalSyncInventory() {
  const [
    attempts,
    favorites,
    unfamiliar,
    notes,
    goals,
    accountSettings,
    authorLibrary,
    devices,
    sessions,
    drafts,
    banks,
    tombstones,
    conflicts,
  ] = await Promise.all([
    getAllRecords('attempts'),
    getAllRecords('favorites'),
    getAllRecords('mastery'),
    getAllRecords('notes'),
    getAllRecords('learningGoals'),
    getAllRecords('accountSettings'),
    getAllRecords('authorLibrary'),
    getAllRecords('devices'),
    getAllRecords('sessions'),
    getAllRecords('studioDrafts'),
    getAllRecords('banks'),
    getAllRecords('syncTombstones'),
    getAllRecords('syncConflicts'),
  ]);

  const userBanks = (banks || []).filter(bank => bank?.sourceType !== 'author');
  const authorBanks = (banks || []).filter(bank => bank?.sourceType === 'author');
  const summary = {
    attempts: attempts.length,
    favorites: favorites.filter(item => item?.isFavorite !== false).length,
    unfamiliar: unfamiliar.filter(item =>
      item?.isUnfamiliar !== false && item?.status !== 'familiar'
    ).length,
    notes: notes.length,
    goals: goals.length,
    accountSettings: accountSettings.length,
    authorLibrary: authorLibrary.filter(item => item?.inLibrary !== false).length,
    devices: devices.length,
    sessions: sessions.length,
    drafts: drafts.length,
    userBanks: userBanks.length,
    authorBanksInstalled: authorBanks.length,
    tombstones: tombstones.length,
    openConflicts: conflicts.filter(item => item?.status === 'open').length,
  };

  const meaningfulCount =
    summary.attempts +
    summary.favorites +
    summary.unfamiliar +
    summary.notes +
    summary.goals +
    summary.accountSettings +
    summary.authorLibrary +
    summary.sessions +
    summary.drafts +
    summary.userBanks +
    summary.tombstones;

  return {
    inventoryVersion: 1,
    summary,
    meaningfulCount,
    isEmpty: meaningfulCount === 0,
    hash: await sha256Canonical(summary),
  };
}

export async function discoverRemoteSyncInventory(provider, {
  profileId,
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) throw new Error('profileId is required for remote inventory.');

  const files = [];
  let pageToken = null;
  do {
    const page = await provider.listFiles({
      appProperties: {
        moxinApp: 'moxin-quiz',
        profileId: profile,
      },
      pageToken,
    });
    files.push(...(page?.files || []));
    pageToken = page?.nextPageToken || null;
  } while (pageToken);

  const counts = {};
  for (const file of files) {
    const type = String(file?.appProperties?.objectType || 'unknown');
    counts[type] = (counts[type] || 0) + 1;
  }

  const meaningfulCount = Object.entries(counts)
    .filter(([type]) => type !== CLOUD_OBJECT_TYPE.PROFILE)
    .reduce((sum, [, count]) => sum + count, 0);

  return {
    inventoryVersion: 1,
    profileId: profile,
    fileCount: files.length,
    counts,
    meaningfulCount,
    isEmpty: meaningfulCount === 0,
    fileIds: files.map(file => file.id).filter(Boolean),
    hash: await sha256Canonical({
      counts,
      fileIds: files.map(file => file.id).filter(Boolean).sort(),
    }),
  };
}

export function planFirstSync(localInventory, remoteInventory) {
  const localEmpty = Boolean(localInventory?.isEmpty);
  const remoteEmpty = Boolean(remoteInventory?.isEmpty);

  if (localEmpty && remoteEmpty) {
    return {
      kind: RECONCILIATION_KIND.FIRST_SYNC,
      plan: FIRST_SYNC_PLAN.BOTH_EMPTY,
      requiresConflictScan: false,
    };
  }
  if (!localEmpty && remoteEmpty) {
    return {
      kind: RECONCILIATION_KIND.FIRST_SYNC,
      plan: FIRST_SYNC_PLAN.UPLOAD_LOCAL,
      requiresConflictScan: false,
    };
  }
  if (localEmpty && !remoteEmpty) {
    return {
      kind: RECONCILIATION_KIND.FIRST_SYNC,
      plan: FIRST_SYNC_PLAN.DOWNLOAD_CLOUD,
      requiresConflictScan: false,
    };
  }

  return {
    kind: RECONCILIATION_KIND.FIRST_SYNC,
    plan: FIRST_SYNC_PLAN.MERGE_REQUIRED,
    requiresConflictScan: true,
  };
}

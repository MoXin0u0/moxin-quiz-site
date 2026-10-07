import { createUuid } from '../utils/ids.js';
import { discoverCloudProfile } from '../sync/cloud-profile.js';
import {
  inspectFirstSync,
  confirmFirstSyncReconciliation,
  cancelFirstSyncReconciliation,
  runSyncCycle,
} from '../sync/sync-engine.js';
import {
  inspectAccountSwitch,
  confirmAccountSwitch,
  cancelAccountSwitch,
} from '../sync/account-lifecycle.js';

export async function planFirstCloudConnection(provider, {
  now = () => new Date(),
} = {}) {
  const stamp = now();
  const account = typeof provider?.getAccountProfile === 'function'
    ? await provider.getAccountProfile({ interactive: false })
    : null;
  const cloud = await discoverCloudProfile(provider);
  const profileId = cloud?.profile?.profileId || createUuid('profile');
  const inspection = await inspectFirstSync(provider, {
    profileId,
    now: stamp,
  });

  return {
    ...inspection,
    status: 'planning',
    account,
    cloudProfile: cloud?.profile || null,
    profileId,
  };
}

export async function applyFirstCloudConnection(provider, plan, {
  now = () => new Date(),
} = {}) {
  const reconciliation = plan?.reconciliation;
  if (!reconciliation?.reconciliationId) {
    throw new Error('A planned first-sync reconciliation is required.');
  }

  const confirmed = await confirmFirstSyncReconciliation(
    reconciliation.reconciliationId,
    { provider, now: now() },
  );
  const profileId = String(
    confirmed?.reconciliation?.targetProfileId ||
    reconciliation.targetProfileId ||
    plan.profileId ||
    '',
  );
  if (!profileId) throw new Error('First-sync target profile is missing.');

  const cycle = await runSyncCycle(provider, {
    profileId,
    force: true,
    now,
  });

  return {
    status: cycle.status,
    profileId,
    confirmed,
    cycle,
  };
}

export function cancelFirstCloudConnection(plan) {
  const reconciliationId = plan?.reconciliation?.reconciliationId;
  if (!reconciliationId) {
    throw new Error('A planned first-sync reconciliation is required.');
  }
  return cancelFirstSyncReconciliation(reconciliationId);
}

export function planCloudAccountSwitch(provider, {
  now = () => new Date(),
} = {}) {
  return inspectAccountSwitch(provider, { now: now() });
}

export async function applyCloudAccountSwitch(provider, plan, {
  now = () => new Date(),
} = {}) {
  const reconciliation = plan?.reconciliation;
  if (!reconciliation?.reconciliationId) {
    throw new Error('A planned account-switch reconciliation is required.');
  }

  const confirmed = await confirmAccountSwitch(
    provider,
    reconciliation.reconciliationId,
    { now: now() },
  );
  const profileId = String(
    confirmed?.reconciliation?.targetProfileId ||
    reconciliation.targetProfileId ||
    '',
  );
  if (!profileId) throw new Error('Account-switch target profile is missing.');

  const cycle = await runSyncCycle(provider, {
    profileId,
    force: true,
    now,
  });

  return {
    status: cycle.status,
    profileId,
    confirmed,
    cycle,
  };
}

export function cancelCloudAccountSwitch(plan) {
  const reconciliationId = plan?.reconciliation?.reconciliationId;
  if (!reconciliationId) {
    throw new Error('A planned account-switch reconciliation is required.');
  }
  return cancelAccountSwitch(reconciliationId);
}

export function runLinkedCloudSync(provider, profileId, {
  now = () => new Date(),
} = {}) {
  const profile = String(profileId || '').trim();
  if (!profile) throw new Error('profileId is required.');
  return runSyncCycle(provider, {
    profileId: profile,
    force: true,
    now,
  });
}

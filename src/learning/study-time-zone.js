import { getAccountSettings } from '../storage/repositories/account-settings.js';

export function runtimeStudyTimeZone() {
  try {
    return normalizeStudyTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  } catch {
    return null;
  }
}

export function normalizeStudyTimeZone(value) {
  const zone = String(value || '').trim();
  if (!zone) return null;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date(0));
    return zone;
  } catch {
    return null;
  }
}

export function resolveStudyTimeZone({
  accountSettings = null,
  runtimeTimeZone = runtimeStudyTimeZone(),
} = {}) {
  return (
    normalizeStudyTimeZone(accountSettings?.studyTimeZone) ||
    normalizeStudyTimeZone(runtimeTimeZone) ||
    null
  );
}

export async function getStudyTimeZone() {
  let accountSettings = null;
  try {
    accountSettings = await getAccountSettings();
  } catch {
    // Local-only operation must not fail because account settings are unavailable.
  }

  return resolveStudyTimeZone({
    accountSettings,
    runtimeTimeZone: runtimeStudyTimeZone(),
  });
}

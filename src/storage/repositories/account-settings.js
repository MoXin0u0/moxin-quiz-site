import { getRecord, putRecord } from '../db.js';

export const ACCOUNT_SETTINGS_ID = 'global';

export function getAccountSettings() {
  return getRecord('accountSettings', ACCOUNT_SETTINGS_ID);
}

export async function saveAccountSettings(settings) {
  if (!settings || settings.id !== ACCOUNT_SETTINGS_ID) {
    throw new Error('Account settings must use id "global".');
  }
  await putRecord('accountSettings', settings);
  return settings;
}

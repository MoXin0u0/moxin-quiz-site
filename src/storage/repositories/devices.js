import { getAllRecords, getRecord, putRecord } from '../db.js';

export function getDeviceProfile(deviceId) {
  return getRecord('devices', String(deviceId));
}

export function listDeviceProfiles() {
  return getAllRecords('devices');
}

export async function saveDeviceProfile(profile) {
  if (!profile?.deviceId) throw new Error('device profile requires deviceId.');
  await putRecord('devices', profile);
  return profile;
}

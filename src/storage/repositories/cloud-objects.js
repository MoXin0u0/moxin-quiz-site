import { getAllByIndex, getRecord, putRecord, deleteRecord } from '../db.js';

export function getCloudObjectMapping(objectKey) {
  return getRecord('cloudObjects', String(objectKey));
}

export function listCloudObjectsByHash(contentHash) {
  return getAllByIndex('cloudObjects', 'contentHash', String(contentHash));
}

export async function saveCloudObjectMapping(mapping) {
  if (!mapping?.objectKey) throw new Error('cloud object mapping requires objectKey.');
  await putRecord('cloudObjects', mapping);
  return mapping;
}

export function deleteCloudObjectMapping(objectKey) {
  return deleteRecord('cloudObjects', String(objectKey));
}

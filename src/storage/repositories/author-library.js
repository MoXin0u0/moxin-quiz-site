import { getAllRecords, getRecord, putRecord } from '../db.js';

export function getAuthorLibraryState(bankId) {
  return getRecord('authorLibrary', String(bankId));
}

export function listAuthorLibraryStates() {
  return getAllRecords('authorLibrary');
}

export async function saveAuthorLibraryState(state) {
  if (!state?.bankId) throw new Error('author library state requires bankId.');
  await putRecord('authorLibrary', state);
  return state;
}

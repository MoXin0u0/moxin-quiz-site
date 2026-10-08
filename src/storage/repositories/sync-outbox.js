import { deleteRecord, getAllByIndex, getAllRecords, getRecord, putRecord } from '../db.js';

export function getOutboxMutation(mutationId) {
  return getRecord('syncOutbox', String(mutationId));
}

export function listOutboxMutations() {
  return getAllRecords('syncOutbox');
}

export function listOutboxMutationsByStatus(status) {
  return getAllByIndex('syncOutbox', 'status', String(status));
}

export async function saveOutboxMutation(mutation) {
  if (!mutation?.mutationId) throw new Error('sync mutation requires mutationId.');
  await putRecord('syncOutbox', mutation);
  return mutation;
}

export function deleteOutboxMutation(mutationId) {
  return deleteRecord('syncOutbox', String(mutationId));
}

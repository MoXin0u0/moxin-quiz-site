import { getAllRecords, getRecord, putRecord, deleteRecord } from '../db.js';

export function getBankRegistryRecord(bankId) {
  return getRecord('bankRegistry', String(bankId));
}

export function listBankRegistryRecords() {
  return getAllRecords('bankRegistry');
}

export async function saveBankRegistryRecord(record) {
  if (!record?.bankId) throw new Error('bank registry record requires bankId.');
  await putRecord('bankRegistry', record);
  return record;
}

export function deleteBankRegistryRecord(bankId) {
  return deleteRecord('bankRegistry', String(bankId));
}

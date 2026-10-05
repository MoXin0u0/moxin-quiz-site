import {
  openDatabase,
  requestToPromise,
  transactionDone,
} from '../db.js';

export async function runReadwriteTransaction(storeNames, handler) {
  const db = await openDatabase();
  const names = [...new Set((storeNames || []).map(String).filter(Boolean))];
  if (!names.length) throw new Error('A write transaction requires at least one store.');

  const tx = db.transaction(names, 'readwrite');
  const done = transactionDone(tx);

  try {
    const result = await handler({
      tx,
      store: name => tx.objectStore(name),
      request: requestToPromise,
    });
    await done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction may already have completed/aborted.
    }
    await done.catch(() => {});
    throw error;
  }
}

const realmQueues = new Map();

export async function withSyncLock(callback, {
  name = 'moxin-quiz-v5-sync',
  navigatorRef = globalThis.navigator,
} = {}) {
  if (typeof callback !== 'function') {
    throw new TypeError('withSyncLock requires a callback.');
  }

  const locks = navigatorRef?.locks;
  if (locks?.request) {
    return locks.request(name, { mode: 'exclusive' }, callback);
  }

  const previous = realmQueues.get(name) || Promise.resolve();
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  realmQueues.set(name, previous.catch(() => {}).then(() => gate));

  await previous.catch(() => {});
  try {
    return await callback();
  } finally {
    release();
    if (realmQueues.get(name) === gate) {
      realmQueues.delete(name);
    }
  }
}

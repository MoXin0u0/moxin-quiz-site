export const SYNC_DATA_REFRESH_EVENT = 'moxin:v5-data-refresh';

const REMOTE_APPLY_ACTIONS = new Set([
  'apply-remote',
]);

export function collectAppliedSyncEntities(cycle) {
  const unique = new Map();

  for (const pulled of cycle?.pulled || []) {
    if (pulled?.skipped) continue;

    for (const result of pulled?.results || []) {
      if (!REMOTE_APPLY_ACTIONS.has(String(result?.action || ''))) continue;

      const entityType = String(result?.entityType || '').trim();
      const entityKey = String(result?.entityKey || '').trim();
      if (!entityType || !entityKey) continue;

      unique.set(entityType + '\u0000' + entityKey, {
        entityType,
        entityKey,
      });
    }
  }

  return [...unique.values()];
}

export function dispatchSyncDataRefresh({
  source = 'sync',
  entities = [],
} = {}, target = globalThis) {
  const normalized = [];
  const seen = new Set();

  for (const entity of entities || []) {
    const entityType = String(entity?.entityType || '').trim();
    const entityKey = String(entity?.entityKey || '').trim();
    if (!entityType || !entityKey) continue;

    const identity = entityType + '\u0000' + entityKey;
    if (seen.has(identity)) continue;
    seen.add(identity);
    normalized.push({ entityType, entityKey });
  }

  if (!normalized.length) return false;

  const EventCtor = target?.CustomEvent || globalThis.CustomEvent;
  if (
    typeof target?.dispatchEvent !== 'function' ||
    typeof EventCtor !== 'function'
  ) {
    return false;
  }

  target.dispatchEvent(new EventCtor(SYNC_DATA_REFRESH_EVENT, {
    detail: {
      source: String(source || 'sync'),
      entities: normalized,
      entityTypes: [...new Set(normalized.map(item => item.entityType))],
      entityKeys: [...new Set(normalized.map(item => item.entityKey))],
    },
  }));
  return true;
}

export function notifyCycleDataRefresh(cycle, {
  source = 'sync',
  target = globalThis,
} = {}) {
  return dispatchSyncDataRefresh({
    source,
    entities: collectAppliedSyncEntities(cycle),
  }, target);
}

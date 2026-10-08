import { compareHybridClocks, normalizeHybridClock } from './clock.js';
import { createRevisionId } from '../utils/ids.js';

export function normalizeParentRevisionIds(values = []) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort();
}

export function createRevisionMeta({
  revisionId = createRevisionId(),
  parentRevisionIds = [],
  changedAt = new Date().toISOString(),
  changedByDeviceId,
  clock,
} = {}) {
  const deviceId = String(changedByDeviceId || '');
  if (!deviceId) throw new Error('changedByDeviceId is required for revision metadata.');

  return {
    revisionId: String(revisionId),
    parentRevisionIds: normalizeParentRevisionIds(parentRevisionIds),
    changedAt: String(changedAt),
    changedByDeviceId: deviceId,
    clock: normalizeHybridClock(clock, deviceId),
  };
}

export function compareRevisionOrder(left, right) {
  const clockOrder = compareHybridClocks(left?.clock, right?.clock);
  if (clockOrder !== 0) return clockOrder;
  return String(left?.revisionId || '').localeCompare(String(right?.revisionId || ''));
}

export function isDirectRevisionParent(parentRevisionId, childRevision) {
  return normalizeParentRevisionIds(childRevision?.parentRevisionIds)
    .includes(String(parentRevisionId || ''));
}

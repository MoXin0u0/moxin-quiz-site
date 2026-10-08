function asSafeInteger(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export function normalizeHybridClock(clock, fallbackDeviceId = '') {
  return {
    physicalMs: asSafeInteger(clock?.physicalMs),
    logical: asSafeInteger(clock?.logical),
    deviceId: String(clock?.deviceId || fallbackDeviceId || ''),
  };
}

export function compareHybridClocks(left, right) {
  const a = normalizeHybridClock(left);
  const b = normalizeHybridClock(right);

  if (a.physicalMs !== b.physicalMs) return a.physicalMs < b.physicalMs ? -1 : 1;
  if (a.logical !== b.logical) return a.logical < b.logical ? -1 : 1;
  return a.deviceId.localeCompare(b.deviceId);
}

export function nextHybridClock({
  local = null,
  remote = null,
  deviceId,
  nowMs = Date.now(),
} = {}) {
  const id = String(deviceId || '');
  if (!id) throw new Error('deviceId is required to advance the hybrid clock.');

  const localClock = normalizeHybridClock(local, id);
  const remoteClock = normalizeHybridClock(remote);
  const physicalNow = asSafeInteger(nowMs);
  const physicalMs = Math.max(
    physicalNow,
    localClock.physicalMs,
    remoteClock.physicalMs,
  );

  let logical = 0;
  if (
    physicalMs === localClock.physicalMs &&
    physicalMs === remoteClock.physicalMs
  ) {
    logical = Math.max(localClock.logical, remoteClock.logical) + 1;
  } else if (physicalMs === localClock.physicalMs) {
    logical = localClock.logical + 1;
  } else if (physicalMs === remoteClock.physicalMs) {
    logical = remoteClock.logical + 1;
  }

  return { physicalMs, logical, deviceId: id };
}

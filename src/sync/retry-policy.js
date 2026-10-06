import { SYNC_RUNTIME_STATE } from './config.js';

export const SYNC_RETRY_CLASS = Object.freeze({
  RETRYABLE: 'retryable',
  BLOCKED: 'blocked',
  FATAL: 'fatal',
});

export function classifySyncFailure(error, {
  online = globalThis.navigator?.onLine !== false,
} = {}) {
  const code = String(error?.code || '');

  if (!online) {
    return {
      classification: SYNC_RETRY_CLASS.RETRYABLE,
      runtimeState: SYNC_RUNTIME_STATE.OFFLINE,
      retryable: true,
      code: code || 'OFFLINE',
    };
  }

  if (code === 'AUTH_REQUIRED' || code === 'CONFIG_REQUIRED') {
    return {
      classification: SYNC_RETRY_CLASS.BLOCKED,
      runtimeState: SYNC_RUNTIME_STATE.AUTH_REQUIRED,
      retryable: false,
      code,
    };
  }

  if (code === 'CLOUD_SCHEMA_NEWER' || code === 'PROFILE_MISMATCH') {
    return {
      classification: SYNC_RETRY_CLASS.BLOCKED,
      runtimeState: SYNC_RUNTIME_STATE.ERROR,
      retryable: false,
      code,
    };
  }

  if (['NETWORK', 'RATE_LIMIT', 'SERVER_ERROR'].includes(code) || error?.retryable === true) {
    return {
      classification: SYNC_RETRY_CLASS.RETRYABLE,
      runtimeState: code === 'NETWORK'
        ? SYNC_RUNTIME_STATE.OFFLINE
        : SYNC_RUNTIME_STATE.ERROR,
      retryable: true,
      code: code || 'RETRYABLE',
    };
  }

  return {
    classification: SYNC_RETRY_CLASS.FATAL,
    runtimeState: SYNC_RUNTIME_STATE.ERROR,
    retryable: false,
    code: code || 'SYNC_ERROR',
  };
}

export function computeRetryDelayMs(retryCount, {
  baseMs = 1000,
  maxMs = 5 * 60 * 1000,
  jitterRatio = 0.2,
  random = Math.random,
} = {}) {
  const attempt = Math.max(1, Number(retryCount) || 1);
  const base = Math.max(100, Number(baseMs) || 1000);
  const cap = Math.max(base, Number(maxMs) || base);
  const raw = Math.min(cap, base * (2 ** Math.min(16, attempt - 1)));
  const jitter = Math.max(0, Math.min(1, Number(jitterRatio) || 0));
  const sample = Math.max(0, Math.min(1, Number(random()) || 0));
  const factor = 1 + ((sample * 2) - 1) * jitter;
  return Math.max(0, Math.round(raw * factor));
}

export function nextRetryInstant(retryCount, {
  now = new Date(),
  ...options
} = {}) {
  const delay = computeRetryDelayMs(retryCount, options);
  return new Date(now.getTime() + delay).toISOString();
}

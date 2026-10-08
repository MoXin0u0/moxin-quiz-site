
import { APP_CONFIG } from '../app/config.js';

export const SYNC_PENDING_EVENT = 'moxin:v5-sync-pending';

export class SyncScheduler {
  constructor({
    getSnapshot,
    runSync,
    windowRef = globalThis.window,
    documentRef = globalThis.document,
    navigatorRef = globalThis.navigator,
    idleDebounceMs = APP_CONFIG.syncLimits.idleDebounceMs,
    activePendingMaxMs = APP_CONFIG.syncLimits.activePendingMaxMs,
    setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout?.bind(globalThis),
    now = () => Date.now(),
  } = {}) {
    if (typeof getSnapshot !== 'function') {
      throw new TypeError('SyncScheduler requires getSnapshot.');
    }
    if (typeof runSync !== 'function') {
      throw new TypeError('SyncScheduler requires runSync.');
    }
    if (typeof setTimeoutFn !== 'function' || typeof clearTimeoutFn !== 'function') {
      throw new TypeError('SyncScheduler requires timer functions.');
    }

    this.getSnapshot = getSnapshot;
    this.runSync = runSync;
    this.windowRef = windowRef;
    this.documentRef = documentRef;
    this.navigatorRef = navigatorRef;
    this.idleDebounceMs = Math.max(0, Number(idleDebounceMs) || 0);
    this.activePendingMaxMs = Math.max(
      this.idleDebounceMs,
      Number(activePendingMaxMs) || this.idleDebounceMs,
    );
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.now = now;

    this.started = false;
    this.running = false;
    this.rerunRequested = false;
    this.idleTimer = null;
    this.maxTimer = null;
    this.retryTimer = null;
    this.pendingBurstStartedAt = null;

    this.onPending = () => this.schedulePending('local-mutation');
    this.onOnline = () => this.scheduleSoon('reconnect');
    this.onPageShow = () => this.scheduleSoon('page-resume');
    this.onVisibility = () => {
      if (this.documentRef?.visibilityState === 'visible') {
        this.scheduleSoon('app-resume');
      }
    };
  }

  start() {
    if (this.started) return this;
    this.started = true;

    this.windowRef?.addEventListener?.(SYNC_PENDING_EVENT, this.onPending);
    this.windowRef?.addEventListener?.('online', this.onOnline);
    this.windowRef?.addEventListener?.('pageshow', this.onPageShow);
    this.documentRef?.addEventListener?.('visibilitychange', this.onVisibility);

    // Startup pull is delayed and completely gated by the current cloud
    // snapshot. Local-only startup therefore never requests authorization.
    this.scheduleSoon('startup', this.idleDebounceMs);
    return this;
  }

  stop() {
    if (!this.started) return;
    this.started = false;

    this.windowRef?.removeEventListener?.(SYNC_PENDING_EVENT, this.onPending);
    this.windowRef?.removeEventListener?.('online', this.onOnline);
    this.windowRef?.removeEventListener?.('pageshow', this.onPageShow);
    this.documentRef?.removeEventListener?.('visibilitychange', this.onVisibility);

    this.clearTimers();
  }

  schedulePending(reason = 'local-mutation') {
    if (!this.started) return;
    const nowMs = this.now();

    if (this.pendingBurstStartedAt === null) {
      this.pendingBurstStartedAt = nowMs;
      this.maxTimer = this.setTimeoutFn(() => {
        this.maxTimer = null;
        this.idleTimer = this.clearTimer(this.idleTimer);
        this.pendingBurstStartedAt = null;
        this.execute('active-pending-max').catch(() => {});
      }, this.activePendingMaxMs);
    }

    this.idleTimer = this.clearTimer(this.idleTimer);
    this.idleTimer = this.setTimeoutFn(() => {
      this.idleTimer = null;
      this.maxTimer = this.clearTimer(this.maxTimer);
      this.pendingBurstStartedAt = null;
      this.execute(reason).catch(() => {});
    }, this.idleDebounceMs);
  }

  scheduleSoon(reason, delayMs = 0) {
    if (!this.started) return;
    const delay = Math.max(0, Number(delayMs) || 0);

    this.retryTimer = this.clearTimer(this.retryTimer);
    this.retryTimer = this.setTimeoutFn(() => {
      this.retryTimer = null;
      this.execute(reason).catch(() => {});
    }, delay);
  }

  async execute(reason = 'scheduled') {
    if (!this.started) {
      return { status: 'skipped', reason: 'scheduler-stopped' };
    }

    if (this.running) {
      this.rerunRequested = true;
      return { status: 'deferred', reason: 'scheduler-busy' };
    }

    this.running = true;
    try {
      const snapshot = await this.getSnapshot();

      if (!isAutomaticSyncEligible(snapshot, this.navigatorRef)) {
        return {
          status: 'skipped',
          reason: automaticSkipReason(snapshot, this.navigatorRef),
        };
      }

      if (snapshot?.conflictCount > 0 || snapshot?.runtimeState === 'CONFLICT') {
        return { status: 'skipped', reason: 'conflict-required' };
      }

      const result = await this.runSync({
        reason,
        snapshot,
      });

      this.scheduleFollowUp(result);
      return result;
    } finally {
      this.running = false;
      if (this.rerunRequested && this.started) {
        this.rerunRequested = false;
        this.scheduleSoon('queued-after-active');
      }
    }
  }

  scheduleFollowUp(result) {
    if (!this.started || !result) return;

    if (result.status === 'pending') {
      this.schedulePending('remaining-pending');
      return;
    }

    if (result.status === 'deferred' && result.nextRetryAt) {
      const retryAt = new Date(result.nextRetryAt).getTime();
      const delay = Number.isFinite(retryAt)
        ? Math.max(0, retryAt - this.now())
        : this.activePendingMaxMs;
      this.scheduleSoon('retry-backoff', delay);
    }
  }

  clearTimers() {
    this.idleTimer = this.clearTimer(this.idleTimer);
    this.maxTimer = this.clearTimer(this.maxTimer);
    this.retryTimer = this.clearTimer(this.retryTimer);
    this.pendingBurstStartedAt = null;
  }

  clearTimer(timer) {
    if (timer !== null && timer !== undefined) {
      this.clearTimeoutFn(timer);
    }
    return null;
  }
}

export function isAutomaticSyncEligible(snapshot, navigatorRef = globalThis.navigator) {
  return Boolean(
    snapshot?.cloudRuntimeEnabled &&
    snapshot?.cloudConfigured &&
    snapshot?.connected &&
    snapshot?.linkedProfileId &&
    navigatorRef?.onLine !== false
  );
}

export function notifySyncPending(detail = null) {
  if (typeof globalThis.dispatchEvent !== 'function') return false;
  if (typeof globalThis.CustomEvent !== 'function') return false;

  try {
    globalThis.dispatchEvent(new CustomEvent(SYNC_PENDING_EVENT, {
      detail,
    }));
    return true;
  } catch {
    return false;
  }
}

function automaticSkipReason(snapshot, navigatorRef) {
  if (!snapshot?.cloudRuntimeEnabled) return 'cloud-runtime-disabled';
  if (!snapshot?.cloudConfigured) return 'cloud-not-configured';
  if (!snapshot?.connected || !snapshot?.linkedProfileId) return 'local-only';
  if (navigatorRef?.onLine === false) return 'offline';
  return 'not-eligible';
}

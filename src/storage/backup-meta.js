const BACKUP_META_KEY = 'moxin.v4.backup.meta';

export function getLastFullBackupAt() {
  try {
    const raw = localStorage.getItem(BACKUP_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const value = parsed?.lastFullBackupAt;
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toISOString()
      : null;
  } catch {
    return null;
  }
}

export function markFullBackupCompleted(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const normalized = Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();

  localStorage.setItem(BACKUP_META_KEY, JSON.stringify({
    lastFullBackupAt: normalized,
  }));

  return normalized;
}

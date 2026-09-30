export function questionKey(bankId, questionId) {
  return `${String(bankId)}::${String(questionId)}`;
}

export function assetKey(bankId, path) {
  return `${String(bankId)}::${String(path)}`;
}

export function learningKey(bankId, questionId) {
  return `${String(bankId)}::${String(questionId)}`;
}

export function createSessionId(prefix = 'session') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

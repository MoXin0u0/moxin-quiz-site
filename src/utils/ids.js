function randomToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createUuid(prefix = '') {
  const value = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : randomToken();
  return prefix ? `${prefix}-${value}` : value;
}

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
  return createUuid(prefix);
}

export function createDeviceId() {
  return createUuid('device');
}

export function createRevisionId() {
  return createUuid('rev');
}

export function createMutationId() {
  return createUuid('mutation');
}

export function createCommitId() {
  return createUuid('commit');
}

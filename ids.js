export function questionKey(bankId, questionId) {
  return `${bankId}::${questionId}`;
}

export function assetKey(bankId, path) {
  return `${bankId}::${path}`;
}

export function learningKey(bankId, questionId) {
  return `${bankId}::${questionId}`;
}

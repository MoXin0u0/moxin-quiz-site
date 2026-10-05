export const SYNC_ENTITY_TYPES = Object.freeze([
  'attempt',
  'favorite',
  'unfamiliar',
  'note',
  'learning-goal',
  'account-settings',
  'author-library',
  'device',
  'practice-session',
  'exam-session',
  'exam-answer',
  'studio-draft',
  'user-bank',
]);

const SYNC_ENTITY_TYPE_SET = new Set(SYNC_ENTITY_TYPES);

export function isSyncEntityType(value) {
  return SYNC_ENTITY_TYPE_SET.has(String(value || ''));
}

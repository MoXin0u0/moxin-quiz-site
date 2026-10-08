import { isSyncEntityType } from './entity-types.js';

export const MUTATION_POLICY = Object.freeze({
  IMMUTABLE: 'immutable',
  COALESCIBLE: 'coalescible',
  CONFLICT_SENSITIVE: 'conflict-sensitive',
});

export const ENTITY_MUTATION_POLICY = Object.freeze({
  attempt: MUTATION_POLICY.IMMUTABLE,
  favorite: MUTATION_POLICY.COALESCIBLE,
  unfamiliar: MUTATION_POLICY.COALESCIBLE,
  note: MUTATION_POLICY.CONFLICT_SENSITIVE,
  'learning-goal': MUTATION_POLICY.CONFLICT_SENSITIVE,
  'account-settings': MUTATION_POLICY.CONFLICT_SENSITIVE,
  'author-library': MUTATION_POLICY.COALESCIBLE,
  device: MUTATION_POLICY.COALESCIBLE,
  'practice-session': MUTATION_POLICY.CONFLICT_SENSITIVE,
  'exam-session': MUTATION_POLICY.CONFLICT_SENSITIVE,
  'exam-answer': MUTATION_POLICY.CONFLICT_SENSITIVE,
  'studio-draft': MUTATION_POLICY.CONFLICT_SENSITIVE,
  'user-bank': MUTATION_POLICY.CONFLICT_SENSITIVE,
});

export function getMutationPolicy(entityType) {
  if (!isSyncEntityType(entityType)) {
    throw new Error(`Unsupported sync entity type: ${entityType}`);
  }
  return ENTITY_MUTATION_POLICY[entityType];
}

import { compareRevisionOrder } from './revision.js';
import {
  getMutationPolicy,
  MUTATION_POLICY,
} from './mutation-policy.js';

export const MERGE_ACTION = Object.freeze({
  APPLY_REMOTE: 'apply-remote',
  KEEP_LOCAL: 'keep-local',
  SKIP_EQUAL: 'skip-equal',
  CONFLICT: 'conflict',
});

export const SYNC_CONFLICT_KIND = Object.freeze({
  CONCURRENT_EDIT: 'concurrent-edit',
  DELETE_VS_EDIT: 'delete-vs-edit',
  CONTENT_ID_COLLISION: 'content-id-collision',
  TERMINAL_STATE_CONFLICT: 'terminal-state-conflict',
});

export async function decideMutableMerge({
  entityType,
  localRevision = null,
  remoteRevision = null,
  localValue = null,
  remoteValue = null,
  localDeleted = false,
  remoteDeleted = false,
  isAncestor = async () => false,
} = {}) {
  const policy = getMutationPolicy(entityType);

  if (!remoteRevision?.revisionId) {
    throw new Error(`Remote mutable entity ${entityType} is missing revision metadata.`);
  }

  if (!localRevision?.revisionId) {
    return { action: MERGE_ACTION.APPLY_REMOTE, reason: 'no-local-revision' };
  }

  if (String(localRevision.revisionId) === String(remoteRevision.revisionId)) {
    return { action: MERGE_ACTION.SKIP_EQUAL, reason: 'same-revision' };
  }

  if (policy === MUTATION_POLICY.COALESCIBLE) {
    const order = compareRevisionOrder(localRevision, remoteRevision);
    return order < 0
      ? { action: MERGE_ACTION.APPLY_REMOTE, reason: 'deterministic-lww' }
      : { action: MERGE_ACTION.KEEP_LOCAL, reason: 'deterministic-lww' };
  }

  if (policy !== MUTATION_POLICY.CONFLICT_SENSITIVE) {
    throw new Error(`Mutable merge is not supported for policy: ${policy}`);
  }

  if (await isAncestor(localRevision.revisionId, remoteRevision)) {
    return { action: MERGE_ACTION.APPLY_REMOTE, reason: 'remote-descends-local' };
  }

  if (await isAncestor(remoteRevision.revisionId, localRevision)) {
    return { action: MERGE_ACTION.KEEP_LOCAL, reason: 'local-descends-remote' };
  }

  if (localDeleted !== remoteDeleted) {
    return {
      action: MERGE_ACTION.CONFLICT,
      kind: SYNC_CONFLICT_KIND.DELETE_VS_EDIT,
      reason: 'concurrent-delete-and-edit',
    };
  }

  if (localDeleted && remoteDeleted) {
    const order = compareRevisionOrder(localRevision, remoteRevision);
    return order < 0
      ? { action: MERGE_ACTION.APPLY_REMOTE, reason: 'concurrent-delete-lww' }
      : { action: MERGE_ACTION.KEEP_LOCAL, reason: 'concurrent-delete-lww' };
  }

  if (entityType === 'exam-session') {
    const localSubmitted = isSubmittedExam(localValue);
    const remoteSubmitted = isSubmittedExam(remoteValue);

    if (localSubmitted && remoteSubmitted) {
      return {
        action: MERGE_ACTION.CONFLICT,
        kind: SYNC_CONFLICT_KIND.TERMINAL_STATE_CONFLICT,
        reason: 'divergent-submissions',
      };
    }
    if (remoteSubmitted) {
      return { action: MERGE_ACTION.APPLY_REMOTE, reason: 'submitted-is-terminal' };
    }
    if (localSubmitted) {
      return { action: MERGE_ACTION.KEEP_LOCAL, reason: 'submitted-is-terminal' };
    }
  }

  return {
    action: MERGE_ACTION.CONFLICT,
    kind: SYNC_CONFLICT_KIND.CONCURRENT_EDIT,
    reason: 'divergent-revisions',
  };
}

function isSubmittedExam(value) {
  return Boolean(value?.submittedAt || value?.status === 'submitted');
}

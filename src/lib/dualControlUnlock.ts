/**
 * Dual-control FY unlock (ECR-07).
 *
 * Locking a financial year is a single-admin action (safe — it only restricts).
 * UNLOCKING is the sensitive one: it must be requested by one admin and approved
 * by a DIFFERENT admin (four-eyes / maker-checker). This module is the pure
 * decision — unit-tested by scripts/test-dual-control-unlock.mjs; the page wires
 * the buttons and persists the request fields.
 */
export interface UnlockState {
  locked: boolean;
  /** stable id (email) of the admin who requested unlock, if a request is open */
  requestedBy?: string;
}

export type UnlockAction =
  | 'none'      // not locked — nothing to unlock
  | 'request'   // locked, no open request — this admin may request unlock
  | 'awaiting'  // locked, request was made by THIS admin — needs a different admin to approve
  | 'approve';  // locked, request was made by ANOTHER admin — this admin may finalise unlock

/** What the given admin can do about the current lock/unlock state. */
export function unlockAction(state: UnlockState, currentUserId: string): UnlockAction {
  if (!state.locked) return 'none';
  if (!state.requestedBy) return 'request';
  if (state.requestedBy === currentUserId) return 'awaiting';
  return 'approve';
}

/** True only when `currentUserId` is allowed to finalise the unlock (a second, distinct admin). */
export function canApproveUnlock(state: UnlockState, currentUserId: string): boolean {
  return unlockAction(state, currentUserId) === 'approve'
    && !!currentUserId
    && state.requestedBy !== currentUserId;
}

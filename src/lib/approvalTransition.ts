/**
 * Approval state machine (ECR-11). The voucher approval status is a small, uniform state
 * machine: a voucher enters the workflow as `pending` and moves ONCE to a terminal state
 * (`approved` or `rejected`). Terminal states never transition again — to change an approved
 * or rejected voucher you cancel/reverse it (a separate flow), you do not silently re-approve.
 *
 * Why this matters: `approveVoucher`/`rejectVoucher` mirror the decision into `voucher_entries`
 * (approve → syncEntries posts it; reject → deleteEntries removes it). Without this guard a
 * rejected voucher could be flipped straight to approved and RE-POST to the ledger, or an
 * approved voucher be double-approved. A voucher with `undefined` status is not in the workflow
 * at all (auto/legacy) and is likewise not transitionable here.
 *
 * Pure module: no React, no I/O — unit-tested by scripts/test-approval-transition.mjs.
 */
export type ApprovalState = 'pending' | 'approved' | 'rejected';

/** Only a `pending` voucher may move to a terminal state (`approved` or `rejected`). */
export function canApprovalTransition(
  from: ApprovalState | undefined,
  to: 'approved' | 'rejected',
): boolean {
  return from === 'pending';
}

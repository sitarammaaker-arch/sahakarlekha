/**
 * Segregation of Duties — maker ≠ checker (ECR-06).
 *
 * Role-level SoD already exists (only an approve-capable role reaches approveVoucher, via
 * guardPermission('approve')). This adds IDENTITY-level SoD: the same person may not approve
 * a voucher they themselves created. Without it, a single dual-capability user (e.g. a
 * societyAdmin who can both create and approve) can create AND self-approve their own entry —
 * the classic maker-checker control failure.
 *
 * Lockout-safety: a voucher only enters the approval workflow when the society has OPTED IN to
 * maker-checker (society.approvalRequired, or an amount threshold — see requiresApproval in
 * DataContext). A society that never enabled approval never routes vouchers for approval, so
 * this block can never stall it. A society that DID enable it but has no second approver has
 * mis-configured maker-checker; the guard's toast tells them how to resolve it.
 *
 * System/auto/engine vouchers carry a non-user maker ('System', 'System (repair)', '') and are
 * NOT treated as self-approval — an admin must still be able to approve machine-generated
 * entries.
 *
 * Pure module: no React, no I/O — unit-tested by scripts/test-sod.mjs.
 */

/** Makers that are not a real person — never subject to the maker ≠ checker rule. */
const SYSTEM_MAKERS: ReadonlySet<string> = new Set(['', 'system', 'system (repair)']);

const norm = (s: string | undefined | null): string => (s ?? '').trim().toLowerCase();

/** True when `createdBy` identifies a real human maker (not a system/auto marker or blank). */
export function isRealMaker(createdBy: string | undefined | null): boolean {
  return !SYSTEM_MAKERS.has(norm(createdBy));
}

/**
 * True when approving user `approver` is the SAME person who created the voucher
 * (`createdBy`) — i.e. a maker ≠ checker (self-approval) violation that must be blocked.
 * Comparison is case- and whitespace-insensitive. System-made vouchers are never self-approval.
 */
export function isSelfApproval(createdBy: string | undefined | null, approver: string | undefined | null): boolean {
  if (!isRealMaker(createdBy)) return false;
  return norm(createdBy) === norm(approver);
}

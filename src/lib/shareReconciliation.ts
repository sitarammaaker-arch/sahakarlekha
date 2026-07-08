/**
 * Share-capital control-vs-subsidiary reconciliation (P0 #4 / ECR-05 / MS-03).
 *
 * Share capital lives in two places that must agree:
 *   • SUBSIDIARY — Σ member.shareCapital (per-member scalar).
 *   • CONTROL    — the Share-Capital ledger account balance (from vouchers).
 * Dividend reads the subsidiary; the Balance Sheet reads the control. If they drift,
 * members could be paid dividend on a figure that doesn't match the audited books.
 *
 * This module DETECTS drift (it does not change how share capital is stored or posted).
 * Pure & deterministic → unit-tested by scripts/test-share-reconciliation.mjs.
 */
import type { Member } from '@/types';

/**
 * Σ share capital across members whose shares are actually posted to the ledger:
 * approved (pending/rejected members have no posted share voucher) and not archived.
 */
export function sumActiveMemberShareCapital(
  members: Pick<Member, 'shareCapital' | 'approvalStatus' | 'isDeleted'>[],
): number {
  return (members || [])
    .filter((m) => !m.isDeleted && (!m.approvalStatus || m.approvalStatus === 'approved'))
    .reduce((sum, m) => sum + (m.shareCapital || 0), 0);
}

export interface ShareCapitalReconciliation {
  subsidiaryTotal: number;   // Σ member.shareCapital (approved, non-archived)
  controlBalance: number;    // Share-Capital ledger account (credit magnitude)
  difference: number;        // subsidiaryTotal − controlBalance (signed, 2dp)
  reconciled: boolean;       // |difference| < ₹1 (rounding tolerance)
}

/** Compare the two totals. Tolerance of < ₹1 matches the codebase's rounding convention. */
export function reconcileShareCapital(subsidiaryTotal: number, controlBalance: number): ShareCapitalReconciliation {
  const difference = +(subsidiaryTotal - controlBalance).toFixed(2);
  return {
    subsidiaryTotal: +subsidiaryTotal.toFixed(2),
    controlBalance: +controlBalance.toFixed(2),
    difference,
    reconciled: Math.abs(difference) < 1,
  };
}

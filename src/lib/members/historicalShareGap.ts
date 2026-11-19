/**
 * MEM-01 (product audit 2026-11-17) — old members' share capital that never reached the ledger. PURE.
 *
 * By the founder-approved rule (lib/members/joiningReceipts) a member who joined BEFORE the current financial year
 * gets no receipt voucher: that money belongs in the society's opening balances (Share Capital 1102). Nothing then
 * checked that the opening balance was ever entered — the practice society showed ₹32,550 in the register against
 * ₹500 in the ledger, and every dividend ran on a base the books did not have.
 *
 * gap = (share capital of live, approved members who joined before the FY start) − (the 1102 balance at FY start).
 * A positive gap is the amount still to be carried into the opening balance of 1102; 0 when the books already hold it.
 */
import { isHistoricalJoin } from './joiningReceipts';

export interface HistoricalShareGap {
  members: number;
  registerAmount: number;
  ledgerAtFyStart: number;
  gap: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function historicalShareGap(
  members: ReadonlyArray<{ joinDate?: string; admissionDate?: string; shareCapital?: number; status?: string; approvalStatus?: string; isDeleted?: boolean }>,
  financialYear: string,
  /** Credit balance of 1102 at the start of the FY (positive = credit), from the trial balance as of the day before. */
  ledgerAtFyStart: number,
): HistoricalShareGap {
  // The SAME member set as the share reconciliation (lib/shareReconciliation.sumActiveMemberShareCapital — RULE 2):
  // approved and not deleted, whatever the status (an exited member's capital leaves the register when refunded).
  const old = members.filter((m) => !m.isDeleted
    && (!m.approvalStatus || m.approvalStatus === 'approved')
    && (Number(m.shareCapital) || 0) > 0
    && isHistoricalJoin(m.admissionDate || m.joinDate, financialYear));
  const registerAmount = r2(old.reduce((t, m) => t + (Number(m.shareCapital) || 0), 0));
  const ledger = r2(Number(ledgerAtFyStart) || 0);
  const gap = r2(registerAmount - ledger);
  return { members: old.length, registerAmount, ledgerAtFyStart: ledger, gap: gap > 0.005 ? gap : 0 };
}

/**
 * Dairy member input recovery (pure, tested) — feed/medicine/AI outstanding is DERIVED, never
 * stored on the issue row: outstanding = Σ issues − Σ input-recovery deductions (deduction lines
 * crediting the Member Input Receivable account, across the member's non-deleted settlements).
 * This keeps report = state (RULE-2) and avoids mutating issue records on settlement.
 */
import type { DairyInputIssue, DairySettlement } from '@/types';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const memberInputIssued = (issues: ReadonlyArray<DairyInputIssue>, memberId: string): number =>
  round2(issues.filter(i => !i.isDeleted && i.memberId === memberId).reduce((s, i) => s + (i.amount || 0), 0));

/** Σ deduction amounts that credit the input-receivable account, across the member's settlements. */
export function memberInputRecovered(
  settlements: ReadonlyArray<DairySettlement>,
  memberId: string,
  inputReceivableAccountId: string,
): number {
  if (!inputReceivableAccountId) return 0;
  let r = 0;
  for (const s of settlements) {
    if (s.isDeleted || s.memberId !== memberId) continue;
    for (const l of s.deductionLines) if (l.accountId === inputReceivableAccountId) r += l.amount || 0;
  }
  return round2(r);
}

export interface InputBalance { issued: number; recovered: number; outstanding: number; }
export function memberInputOutstanding(
  issues: ReadonlyArray<DairyInputIssue>,
  settlements: ReadonlyArray<DairySettlement>,
  memberId: string,
  inputReceivableAccountId: string,
): InputBalance {
  const issued = memberInputIssued(issues, memberId);
  const recovered = memberInputRecovered(settlements, memberId, inputReceivableAccountId);
  return { issued, recovered, outstanding: round2(Math.max(0, issued - recovered)) };
}

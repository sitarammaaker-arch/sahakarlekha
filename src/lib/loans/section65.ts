/**
 * Haryana Co-operative Societies Act 1984, s.65 — "Limitation of interest":
 *   "Notwithstanding anything contained in this Act, rules, bye-laws or in any agreement in this
 *    behalf, a co-operative society shall not recover interest on short term loans given to members
 *    in excess of the principle amount of the loan advanced.
 *    Explanation:- For the purpose of this section, short term loan means a loan granted for a
 *    period upto fifteen months."
 * (Checked against the Act's text. Applies to Haryana societies only — other States' Acts are not
 * checked, so nothing is enforced for them.)
 *
 * PURE. The app enforces it where it CHARGES interest: an accrual is capped so the interest taken on
 * the loan (live accruals + interest received straight to income) never exceeds the principal
 * advanced.
 */
import type { LoanInterestAccrual } from './interestAccrual';
import { ACC_INTEREST_RECEIVABLE } from './interestAccrual';
import { isRepaymentOf } from '@/lib/registers/subsidiaryLedgers';
import type { VoucherLine } from '@/types';

export const S65_CITE = 'Haryana Co-operative Societies Act 1984, s.65 (Limitation of interest; short term = up to 15 months)';

/** s.65 is a Haryana provision. */
export const appliesSection65 = (state: string | null | undefined) => (state || '').trim().toLowerCase() === 'hr';

const addMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};

/**
 * "Granted for a period up to fifteen months": due date no later than 15 months after disbursement.
 * Without both dates, the loan's own term label decides (short-term ⇒ yes).
 */
export function isShortTermS65(loan: { disbursementDate?: string; dueDate?: string; loanType?: string }): boolean {
  if (loan.disbursementDate && loan.dueDate) return loan.dueDate <= addMonths(loan.disbursementDate, 15);
  return loan.loanType === 'short-term';
}

type VoucherLike = { id: string; voucherNo?: string; date?: string; amount: number; narration: string; debitAccountId: string; creditAccountId: string; lines?: VoucherLine[]; isDeleted?: boolean; refType?: string; refId?: string };

/**
 * Interest already taken on a loan: every live accrual (charged to the member) + interest received
 * straight to income on a repayment (never accrued first). Interest that cleared an accrual (Cr 3313)
 * is NOT added again — it is the same interest.
 */
export function interestTakenToDate(
  loan: { id: string; loanNo: string },
  accruals: readonly LoanInterestAccrual[],
  vouchers: readonly VoucherLike[],
  isIncomeAccount: (accountId: string) => boolean,
): number {
  const live = new Set(vouchers.filter((v) => !v.isDeleted).map((v) => v.id));
  const accrued = accruals.filter((a) => a.loanId === loan.id && !a.isDeleted && !!a.voucherId && live.has(a.voucherId)).reduce((t, a) => t + (Number(a.amount) || 0), 0);
  let direct = 0;
  for (const v of vouchers) {
    if (!isRepaymentOf(v as Parameters<typeof isRepaymentOf>[0], loan.id, loan.loanNo)) continue;
    const lines = v.lines && v.lines.length ? v.lines : [];
    for (const l of lines) if (l.type === 'Cr' && l.accountId !== ACC_INTEREST_RECEIVABLE && isIncomeAccount(l.accountId)) direct += Number(l.amount) || 0;
  }
  return Math.round((accrued + direct) * 100) / 100;
}

/** Interest that may still be charged under s.65 (never negative). */
export const section65Room = (principalAdvanced: number, taken: number) => Math.max(0, Math.round(((Number(principalAdvanced) || 0) - (Number(taken) || 0)) * 100) / 100);

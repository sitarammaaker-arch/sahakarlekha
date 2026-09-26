/**
 * Member-loan interest accrual (H2-1) — Haryana Co-operative Societies Act 1984, s.87 Explanation:
 *   (i)  net profits are calculated after deducting "all interest accrued and accruing in relation
 *        to amounts which are overdue";
 *   (ii) interest accrued in a preceding year but recovered in the current year may be added.
 * So interest on an OVERDUE loan is accrued (the member owes it) but NOT taken to income: it is
 * held in the Overdue Interest Reserve (a liability) until recovered (H2-2 moves it to income).
 *
 *   regular loans : Dr 3313 Member Loan Interest Rec. / Cr 4408 Interest on Member Loans
 *   overdue loans : Dr 3313 Member Loan Interest Rec. / Cr 2211 Overdue Interest Reserve
 *
 * Each loan's accrual is recorded (loan_interest_accruals, 069) so a repayment can later clear
 * exactly what was accrued for THAT loan. PURE.
 */
import { loanOutstanding, kccOutstanding } from '../memberSnapshot';

export const ACC_INTEREST_RECEIVABLE = '3313';
export const ACC_INTEREST_INCOME = '4408';
export const ACC_OVERDUE_INTEREST_RESERVE = '2211';

export interface AccruableLoan {
  id: string;
  loanNo: string;
  memberId: string;
  amount: number;
  repaidAmount: number;
  interestRate: number;
  dueDate?: string;
  status: string;
}

export interface AccrualRow {
  loanId: string;
  loanNo: string;
  memberId: string;
  principal: number;
  outstanding: number;
  ratePa: number;
  days: number;
  interest: number;
  overdue: boolean;
}

export interface LoanInterestAccrual {
  id: string;
  loanId: string;
  memberId: string;
  periodFrom: string;
  periodTo: string;
  days: number;
  outstanding: number;
  ratePa: number;
  amount: number;
  overdue: boolean;
  recovered: number;
  voucherId?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  isDeleted?: boolean;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Simple interest (unchanged formula): outstanding × rate × days / (365 × 100), rounded to paise. */
export const simpleInterest = (principal: number, ratePa: number, days: number): number =>
  Math.round(((principal * ratePa * days) / (365 * 100)) * 100) / 100;

/**
 * Overdue at the END of the period (founder decision D1, 2026-09-26): marked overdue by hand, OR
 * the due date fell before the period end while something is still outstanding.
 */
export function isOverdueAt(loan: AccruableLoan, periodTo: string): boolean {
  if (loan.status === 'overdue') return true;
  return !!loan.dueDate && loan.dueDate < periodTo && loanOutstanding(loan) > 0.005;
}

/** Loans that bear interest in a period: not cleared, something outstanding. */
export const accruableLoans = <L extends AccruableLoan>(loans: readonly L[]): L[] =>
  loans.filter((l) => l.status !== 'cleared' && loanOutstanding(l) > 0.005);

export function accrualRows(loans: readonly AccruableLoan[], periodTo: string, days: number): AccrualRow[] {
  return accruableLoans(loans).map((l) => {
    const outstanding = Math.max(0, loanOutstanding(l));   // shared formula; clamp only for interest
    return {
      loanId: l.id, loanNo: l.loanNo, memberId: l.memberId, principal: l.amount, outstanding,
      ratePa: l.interestRate, days, interest: simpleInterest(outstanding, l.interestRate, days),
      overdue: isOverdueAt(l, periodTo),
    };
  });
}

export interface AccrualSplit { total: number; regular: number; overdue: number }

export function splitAccrual(rows: readonly AccrualRow[]): AccrualSplit {
  const regular = r2(rows.filter((r) => !r.overdue).reduce((s, r) => s + r.interest, 0));
  const overdue = r2(rows.filter((r) => r.overdue).reduce((s, r) => s + r.interest, 0));
  return { total: r2(regular + overdue), regular, overdue };
}

/** The one balanced accrual journal: Dr 3313 total / Cr 4408 regular / Cr 2211 overdue. */
export function accrualVoucherLines(split: AccrualSplit, newId: () => string): { id: string; accountId: string; type: 'Dr' | 'Cr'; amount: number }[] {
  const lines: { id: string; accountId: string; type: 'Dr' | 'Cr'; amount: number }[] = [];
  if (split.total <= 0) return lines;
  lines.push({ id: newId(), accountId: ACC_INTEREST_RECEIVABLE, type: 'Dr', amount: split.total });
  if (split.regular > 0) lines.push({ id: newId(), accountId: ACC_INTEREST_INCOME, type: 'Cr', amount: split.regular });
  if (split.overdue > 0) lines.push({ id: newId(), accountId: ACC_OVERDUE_INTEREST_RESERVE, type: 'Cr', amount: split.overdue });
  return lines;
}

/** Per-loan records for the cloud — saved BEFORE the voucher (RULE 1), linked to it afterwards. */
export function accrualRecords(rows: readonly AccrualRow[], periodFrom: string, periodTo: string, createdBy: string, newId: () => string): LoanInterestAccrual[] {
  return rows.filter((r) => r.interest > 0).map((r) => ({
    id: newId(), loanId: r.loanId, memberId: r.memberId, periodFrom, periodTo, days: r.days,
    outstanding: r.outstanding, ratePa: r.ratePa, amount: r.interest, overdue: r.overdue,
    recovered: 0, voucherId: null, createdBy, isDeleted: false,
  }));
}

// ── H2-2: repayment against accrued interest ─────────────────────────────────────────────────
// What a repayment already cleared is DERIVED from the live repayment vouchers of the loan (refType
// + refId), never stored — so cancelling a repayment voucher automatically re-opens its interest.
export const REF_LOAN_REPAYMENT = 'loan.repayment';
export const REF_LOAN_INTEREST_RELEASE = 'loan.interest.release';

type VoucherForDue = {
  id: string; isDeleted?: boolean; refType?: string; refId?: string;
  debitAccountId?: string; creditAccountId?: string; amount: number;
  lines?: { accountId: string; type: 'Dr' | 'Cr'; amount: number }[];
};
const legs = (v: VoucherForDue) => (v.lines && v.lines.length > 0 ? v.lines
  : [{ accountId: v.debitAccountId ?? '', type: 'Dr' as const, amount: v.amount }, { accountId: v.creditAccountId ?? '', type: 'Cr' as const, amount: v.amount }]);
const sumLegs = (vs: readonly VoucherForDue[], acc: string, type: 'Dr' | 'Cr') =>
  vs.reduce((s, v) => s + legs(v).filter((l) => l.accountId === acc && l.type === type).reduce((t, l) => t + (Number(l.amount) || 0), 0), 0);

export interface LoanInterestDue {
  /** Accrued interest of this loan not yet received (still in 3313). */
  receivable: number;
  /** Overdue interest of this loan still held in the Overdue Interest Reserve (2211). */
  reserve: number;
}

/** Open accrued interest of one loan: its live accruals (069, journal live) minus live repayments. */
export function loanInterestDue(loanId: string, accruals: readonly LoanInterestAccrual[], vouchers: readonly VoucherForDue[]): LoanInterestDue {
  const live = new Set(vouchers.filter((v) => !v.isDeleted).map((v) => v.id));
  const mine = accruals.filter((a) => a.loanId === loanId && !a.isDeleted && !!a.voucherId && live.has(a.voucherId));
  const accrued = mine.reduce((s, a) => s + a.amount, 0);
  const accruedOverdue = mine.filter((a) => a.overdue).reduce((s, a) => s + a.amount, 0);
  const repayments = vouchers.filter((v) => !v.isDeleted && v.refId === loanId && v.refType === REF_LOAN_REPAYMENT);
  const releases = vouchers.filter((v) => !v.isDeleted && v.refId === loanId && v.refType === REF_LOAN_INTEREST_RELEASE);
  const cleared = sumLegs(repayments, ACC_INTEREST_RECEIVABLE, 'Cr');
  const released = sumLegs(releases, ACC_OVERDUE_INTEREST_RESERVE, 'Dr');
  return { receivable: Math.max(0, r2(accrued - cleared)), reserve: Math.max(0, r2(accruedOverdue - released)) };
}

export interface RepaymentInterestSplit {
  /** Clears accrued interest: Cr 3313. */
  toReceivable: number;
  /** Interest never accrued (e.g. the current, un-posted period): Cr income directly. */
  toIncome: number;
  /** Overdue interest now recovered: Dr 2211 / Cr income (s.87 Explanation (ii)) — its own journal. */
  releaseFromReserve: number;
}

/**
 * Split the interest received on a repayment. Accrued interest is cleared first (never booked to
 * income twice); within it, OVERDUE first (founder decision D4 — the older debt), so the reserve is
 * released as it is recovered.
 */
export function repaymentInterestSplit(interest: number, due: LoanInterestDue): RepaymentInterestSplit {
  const i = Math.max(0, r2(interest));
  const toReceivable = r2(Math.min(i, due.receivable));
  return { toReceivable, toIncome: r2(i - toReceivable), releaseFromReserve: r2(Math.min(toReceivable, due.reserve)) };
}

// ── KCC (KCC-1) ─────────────────────────────────────────────────────────────────────────────
// KCC loans accrue through the SAME rules, on the SAME outstanding the KCC page shows (RULE 2:
// kccOutstanding). Adapter: amount = repaid + outstanding, so loanOutstanding(adapted) equals it.
export interface KccLike {
  id: string; loanNo: string; memberId: string; drawnAmount: number; repaidAmount: number;
  outstandingAmount?: number; interestRate: number; dueDate: string; status: string; isDeleted?: boolean;
}
export function kccAsAccruable(k: KccLike): AccruableLoan {
  const repaid = Number(k.repaidAmount) || 0;
  const outstanding = kccOutstanding({ outstandingAmount: k.outstandingAmount as number, drawnAmount: Number(k.drawnAmount) || 0, repaidAmount: repaid });
  return {
    id: k.id, loanNo: k.loanNo, memberId: k.memberId, amount: Math.round((repaid + outstanding) * 100) / 100, repaidAmount: repaid,
    interestRate: Number(k.interestRate) || 0, dueDate: k.dueDate, status: k.status === 'repaid' ? 'cleared' : k.status,
  };
}
export const kccAccruables = (kcc: readonly KccLike[]): AccruableLoan[] => kcc.filter((k) => !k.isDeleted).map(kccAsAccruable);

/** Journal narration prefixes — the "already posted" check is per kind (a KCC journal never marks member loans posted). */
export const NARRATION_LOAN_ACCRUAL = 'Member Loan Interest Accrual';
export const NARRATION_KCC_ACCRUAL = 'KCC Interest Accrual';

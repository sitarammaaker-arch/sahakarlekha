/**
 * Subsidiary ledgers — Deposit Ledger, Loan Ledger (member loan / KCC) and Stock Register.
 *
 * PURE. Each is a READ of records the app already keeps; nothing new is stored:
 *  - Deposit Ledger  ← deposit_transactions (the same rows the "लेनदेन" dialog shows).
 *  - Loan Ledger     ← the disbursement voucher, live repayment vouchers and live interest
 *                      accruals (loan_interest_accruals with a live journal) — the SAME sources
 *                      loanInterestDue uses (RULE 2).
 *  - Stock Register  ← reconcileMovements (live purchase/sale records + other movements) and the
 *                      canonical quantity rule of computeStock (RULE 2).
 * Where a ledger cannot be made to agree with the figure the app stores (repaidAmount, a recorded
 * running balance), it says so via `mismatch` — never papered over.
 */
import type { DepositTransaction, StockMovement, Voucher, VoucherLine } from '@/types';
import { computeStockCostRate } from '@/lib/stockUtils';
import type { LoanInterestAccrual } from '@/lib/loans/interestAccrual';
import { ACC_INTEREST_RECEIVABLE, REF_LOAN_REPAYMENT } from '@/lib/loans/interestAccrual';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const q3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

type VoucherLike = Pick<Voucher, 'id' | 'voucherNo' | 'date' | 'amount' | 'narration' | 'debitAccountId' | 'creditAccountId'> & {
  lines?: VoucherLine[]; isDeleted?: boolean; refType?: string; refId?: string;
};
const linesOf = (v: VoucherLike): VoucherLine[] => (v.lines && v.lines.length > 0 ? v.lines
  : [{ id: `${v.id}-dr`, accountId: v.debitAccountId, type: 'Dr', amount: v.amount }, { id: `${v.id}-cr`, accountId: v.creditAccountId, type: 'Cr', amount: v.amount }]);

// ── Deposit Ledger ─────────────────────────────────────────────────────────────────────────
export interface DepositLedgerRow {
  date: string; particulars: string; particularsHi: string; voucherNo: string;
  credit: number; debit: number; balance: number;
}
export interface DepositLedger { rows: DepositLedgerRow[]; totalCredit: number; totalDebit: number; closing: number; mismatch: boolean }

const DEP_LABEL: Record<string, [string, string]> = {
  open: ['Account opened', 'खाता खुला'], deposit: ['Deposit', 'जमा'], interest: ['Interest credited', 'ब्याज जमा'],
  withdraw: ['Withdrawal', 'निकासी'], closure: ['Account closed — paid out', 'खाता बंद — भुगतान'],
};

export function depositLedger(txns: readonly DepositTransaction[], voucherNoOf: (id?: string) => string = () => ''): DepositLedger {
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''));
  let run = 0, cr = 0, dr = 0, mismatch = false;
  const rows = sorted.map((t) => {
    const out = t.txnType === 'withdraw' || t.txnType === 'closure';
    const amt = r2(Math.abs(Number(t.amount) || 0));
    run = r2(run + (out ? -amt : amt));
    if (out) dr = r2(dr + amt); else cr = r2(cr + amt);
    // The recorded balance is what the society's passbook shows — keep it; flag if the arithmetic disagrees.
    const recorded = Number(t.balanceAfter);
    if (Number.isFinite(recorded) && Math.abs(recorded - run) > 0.005) mismatch = true;
    const [en, hiL] = DEP_LABEL[t.txnType] ?? [t.txnType, t.txnType];
    return { date: t.date, particulars: `${en}${t.mode ? ` (${t.mode})` : ''}`, particularsHi: `${hiL}${t.mode ? ` (${t.mode === 'bank' ? 'बैंक' : 'नकद'})` : ''}`, voucherNo: voucherNoOf(t.voucherId), credit: out ? 0 : amt, debit: out ? amt : 0, balance: Number.isFinite(recorded) ? r2(recorded) : run };
  });
  return { rows, totalCredit: cr, totalDebit: dr, closing: rows.length ? rows[rows.length - 1].balance : 0, mismatch };
}

// ── Loan Ledger ────────────────────────────────────────────────────────────────────────────
export interface LoanLedgerInput {
  loanId: string;
  loanNo: string;
  disbursedAmount: number;
  disbursementDate: string;
  disbursementVoucherId?: string;
  /** The principal repaid the app has recorded on the loan (loan.repaidAmount). */
  recordedRepaid: number;
}
export interface LoanLedgerRow {
  date: string; particulars: string; particularsHi: string; voucherNo: string;
  disbursed: number; principalRecovered: number; principalBalance: number; interestCharged: number; interestReceived: number;
}
export interface LoanLedger {
  rows: LoanLedgerRow[];
  totals: { disbursed: number; principalRecovered: number; interestCharged: number; interestReceived: number };
  closingPrincipal: number;
  /** Principal recovered per the repayment vouchers ≠ repaidAmount recorded on the loan. */
  mismatch: boolean;
}

/**
 * Is this voucher a repayment of THIS loan? Tagged (refType/refId, since #511), or — for older
 * receipts posted before the tag existed — the app's own narration "…repayment — <name> (<loanNo>)".
 */
export function isRepaymentOf(v: VoucherLike, loanId: string, loanNo: string): boolean {
  if (v.isDeleted) return false;
  if (v.refType) return v.refType === REF_LOAN_REPAYMENT && v.refId === loanId;
  return /repayment/i.test(v.narration || '') && !!loanNo && (v.narration || '').includes(`(${loanNo})`);
}

export function loanLedger(
  input: LoanLedgerInput,
  vouchers: readonly VoucherLike[],
  accruals: readonly LoanInterestAccrual[],
  isIncomeAccount: (accountId: string) => boolean,
): LoanLedger {
  const live = new Map(vouchers.filter((v) => !v.isDeleted).map((v) => [v.id, v]));
  const rows: (LoanLedgerRow & { k: number })[] = [];
  const dv = input.disbursementVoucherId ? live.get(input.disbursementVoucherId) : undefined;
  rows.push({ k: 0, date: input.disbursementDate, particulars: 'Loan disbursed', particularsHi: 'ऋण वितरित', voucherNo: dv?.voucherNo ?? '',
    disbursed: r2(input.disbursedAmount), principalRecovered: 0, principalBalance: 0, interestCharged: 0, interestReceived: 0 });
  for (const a of accruals) {
    if (a.loanId !== input.loanId || a.isDeleted || !a.voucherId || !live.has(a.voucherId)) continue;
    rows.push({ k: 1, date: a.periodTo, particulars: `Interest ${a.periodFrom} – ${a.periodTo}${a.overdue ? ' (overdue)' : ''}`, particularsHi: `ब्याज ${a.periodFrom} – ${a.periodTo}${a.overdue ? ' (अतिदेय)' : ''}`,
      voucherNo: live.get(a.voucherId)?.voucherNo ?? '', disbursed: 0, principalRecovered: 0, principalBalance: 0, interestCharged: r2(a.amount), interestReceived: 0 });
  }
  for (const v of vouchers) {
    if (!isRepaymentOf(v, input.loanId, input.loanNo)) continue;
    const cr = linesOf(v).filter((l) => l.type === 'Cr');
    const interest = r2(cr.filter((l) => l.accountId === ACC_INTEREST_RECEIVABLE || isIncomeAccount(l.accountId)).reduce((t, l) => t + (Number(l.amount) || 0), 0));
    const principal = r2(cr.reduce((t, l) => t + (Number(l.amount) || 0), 0) - interest);
    rows.push({ k: 2, date: v.date, particulars: 'Repayment received', particularsHi: 'चुकौती प्राप्त', voucherNo: v.voucherNo,
      disbursed: 0, principalRecovered: principal, principalBalance: 0, interestCharged: 0, interestReceived: interest });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.k - b.k);
  let bal = 0;
  const totals = { disbursed: 0, principalRecovered: 0, interestCharged: 0, interestReceived: 0 };
  const out: LoanLedgerRow[] = rows.map(({ k: _k, ...r }) => {
    bal = r2(bal + r.disbursed - r.principalRecovered);
    totals.disbursed = r2(totals.disbursed + r.disbursed);
    totals.principalRecovered = r2(totals.principalRecovered + r.principalRecovered);
    totals.interestCharged = r2(totals.interestCharged + r.interestCharged);
    totals.interestReceived = r2(totals.interestReceived + r.interestReceived);
    return { ...r, principalBalance: bal };
  });
  return { rows: out, totals, closingPrincipal: bal, mismatch: Math.abs(totals.principalRecovered - r2(input.recordedRepaid)) > 0.005 };
}

/** Adapters — which recorded fields ARE the disbursement and the repaid principal. */
export const memberLoanLedgerInput = (l: { id: string; loanNo: string; amount: number; disbursementDate: string; voucherId?: string; repaidAmount: number }): LoanLedgerInput =>
  ({ loanId: l.id, loanNo: l.loanNo, disbursedAmount: Number(l.amount) || 0, disbursementDate: l.disbursementDate, disbursementVoucherId: l.voucherId, recordedRepaid: Number(l.repaidAmount) || 0 });
export const kccLedgerInput = (k: { id: string; loanNo: string; drawnAmount: number; disbursementDate: string; voucherId?: string; repaidAmount: number }): LoanLedgerInput =>
  ({ loanId: k.id, loanNo: k.loanNo, disbursedAmount: Number(k.drawnAmount) || 0, disbursementDate: k.disbursementDate, disbursementVoucherId: k.voucherId, recordedRepaid: Number(k.repaidAmount) || 0 });

// ── Stock Register ─────────────────────────────────────────────────────────────────────────
export interface StockRegisterRow {
  date: string; particulars: string; particularsHi: string; reference: string;
  inward: number; outward: number; balance: number; rate: number; amount: number;
}
export interface StockRegister {
  opening: number; rows: StockRegisterRow[]; totalIn: number; totalOut: number; closing: number; wentNegative: boolean;
  /** Opening valued at the item's genesis rate (purchaseRate) — the same basis computeStockCostRate starts from. */
  openingRate: number; openingValue: number;
  /** Closing at weighted-average COST (computeStockCostRate) — the Inventory / Stock Valuation / Trading A/c figure (RULE 2). */
  closingRate: number; closingValue: number;
}

const MOVE_LABEL = (m: StockMovement, inward: boolean): [string, string] =>
  m.type === 'purchase' ? ['Purchase', 'खरीद']
    : m.type === 'sale' ? ['Sale', 'बिक्री']
      : inward ? ['Adjustment (in)', 'समायोजन (आवक)'] : ['Adjustment (out)', 'समायोजन (जावक)'];

/**
 * One item's register. Feed it reconcileMovements(...) — the same list computeStock reads — so the
 * closing quantity equals the Inventory / Stock Valuation / Trading figure (RULE 2).
 */
export function stockRegister(item: { id: string; openingStock: number; purchaseRate?: number }, movements: readonly StockMovement[]): StockRegister {
  const mine = movements.filter((m) => m.itemId === item.id)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''));
  const opening = q3(Number(item.openingStock) || 0);
  let bal = opening, tin = 0, tout = 0, neg = false;
  const rows = mine.map((m) => {
    // THE canonical rule (computeStock): purchase or a positive adjustment is inward; else outward.
    const inward = m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0);
    // Same signs as computeStock: an inward adds qty AS RECORDED; an outward subtracts |qty|.
    const q = inward ? q3(Number(m.qty) || 0) : q3(Math.abs(Number(m.qty) || 0));
    bal = q3(bal + (inward ? q : -q));
    if (bal < -0.0005) neg = true;
    if (inward) tin = q3(tin + q); else tout = q3(tout + q);
    const [en, hiL] = MOVE_LABEL(m, inward);
    return { date: m.date, particulars: m.narration ? `${en} — ${m.narration}` : en, particularsHi: m.narration ? `${hiL} — ${m.narration}` : hiL, reference: m.referenceNo || '',
      inward: inward ? q : 0, outward: inward ? 0 : q, balance: bal, rate: r2(Number(m.rate) || 0), amount: r2(Math.abs(Number(m.amount) || q * (Number(m.rate) || 0))) };
  });
  // computeStock clamps the closing at 0 — the register shows the same closing and flags the dip.
  const closing = Math.max(0, bal);
  // Rates / values (2026-10-10 — the register printed no rate or amount for opening / closing, so an item with no
  // movement showed only quantities). Closing rate = THE weighted-average cost (computeStockCostRate).
  const openingRate = r2(Number(item.purchaseRate) || 0);
  const closingRate = r2(computeStockCostRate({ id: item.id, openingStock: item.openingStock, purchaseRate: item.purchaseRate || 0 }, mine as StockMovement[]));
  return { opening, rows, totalIn: tin, totalOut: tout, closing, wentNegative: neg,
    openingRate, openingValue: r2(opening * openingRate), closingRate, closingValue: r2(closing * closingRate) };
}

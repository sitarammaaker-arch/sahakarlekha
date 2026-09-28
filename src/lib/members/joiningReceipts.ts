/**
 * Member joining receipts (share capital + admission fee). PURE — no I/O.
 *
 * Adding / importing / approving a member used to ALWAYS post a CASH receipt dated the member's
 * join date. For a member who joined in an earlier year (e.g. an old register imported on
 * onboarding) that books money received decades ago as cash in hand today — the Rania demo
 * society's cash was overstated that way — and a cheque / online payment was booked to cash too.
 *
 * Rules (founder-approved 2026-09-28):
 *   • joined BEFORE the current FY starts → HISTORICAL: no receipt voucher. The member register
 *     keeps the share; that money belongs in the society's OPENING balances (1102 Individual Share
 *     Capital against wherever the money sits), not in this year's cash book.
 *   • joined in the current FY (or later) → one receipt per non-zero amount, Dr Cash for cash /
 *     unspecified payment, Dr the society's default bank for cheque / online.
 */

export const SHARE_CAPITAL_ACCOUNT = '1102';
export const ADMISSION_FEE_ACCOUNT = '4407';
export const CASH_ACCOUNT = '3301';

export interface JoiningMember {
  name: string;
  joinDate?: string;
  shareCapital?: number;
  admissionFee?: number;
  paymentMode?: 'cash' | 'cheque' | 'online';
}

export interface JoiningReceipt {
  kind: 'share' | 'admission';
  creditAccountId: string;
  amount: number;
  narration: string;
}

export interface JoiningReceiptPlan {
  /** 'post' → create `receipts`; 'historical' → none, amounts go to opening; 'none' → nothing to receive. */
  mode: 'post' | 'historical' | 'none';
  date: string;
  debitAccountId: string;
  receipts: JoiningReceipt[];
  /** Amounts a historical member brought — to be carried in the opening balances instead. */
  historicalShare: number;
  historicalAdmission: number;
  /** Cheque / online asked for, but the society has no bank account → fell back to cash. */
  bankFallbackToCash: boolean;
}

/** 1 April of the FY label 'YYYY-YY' ('' when the label is not a year). */
export function fyStartOf(financialYear: string): string {
  const y = parseInt(String(financialYear || '').slice(0, 4), 10);
  return Number.isFinite(y) && /^\d{4}/.test(String(financialYear || '')) ? `${y}-04-01` : '';
}

const money = (n: unknown) => Math.max(0, Number(n) || 0);

export function planJoiningReceipts(
  member: JoiningMember,
  opts: { financialYear: string; today: string; bankAccountId?: string | null },
): JoiningReceiptPlan {
  const share = money(member.shareCapital);
  const admission = money(member.admissionFee);
  const date = (member.joinDate || '').slice(0, 10) || opts.today;
  const wantsBank = member.paymentMode === 'cheque' || member.paymentMode === 'online';
  const bankFallbackToCash = wantsBank && !opts.bankAccountId;
  const debitAccountId = wantsBank && opts.bankAccountId ? opts.bankAccountId : CASH_ACCOUNT;
  const base = { date, debitAccountId, receipts: [] as JoiningReceipt[], historicalShare: 0, historicalAdmission: 0, bankFallbackToCash };

  if (share === 0 && admission === 0) return { ...base, mode: 'none' };

  const fyStart = fyStartOf(opts.financialYear);
  if (fyStart && date < fyStart) {
    return { ...base, mode: 'historical', historicalShare: share, historicalAdmission: admission, bankFallbackToCash: false };
  }

  const receipts: JoiningReceipt[] = [];
  if (share > 0) receipts.push({ kind: 'share', creditAccountId: SHARE_CAPITAL_ACCOUNT, amount: share, narration: `Share Capital received from ${member.name}` });
  if (admission > 0) receipts.push({ kind: 'admission', creditAccountId: ADMISSION_FEE_ACCOUNT, amount: admission, narration: `Admission Fee received from ${member.name}` });
  return { ...base, mode: 'post', receipts };
}

/** Totals for a batch (the importer's end-of-run summary) — same rule as each single add. */
export function summariseJoiningPlans(plans: readonly JoiningReceiptPlan[]) {
  const historical = plans.filter((p) => p.mode === 'historical');
  return {
    historicalMembers: historical.length,
    historicalShare: historical.reduce((s, p) => s + p.historicalShare, 0),
    historicalAdmission: historical.reduce((s, p) => s + p.historicalAdmission, 0),
    postedMembers: plans.filter((p) => p.mode === 'post').length,
  };
}

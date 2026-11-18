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

/** THE old/new rule: joined before the current FY starts → old (historical) member. Used by the receipt plan AND the importer's preview. */
export function isHistoricalJoin(joinDate: string | undefined, financialYear: string): boolean {
  const fyStart = fyStartOf(financialYear);
  const d = (joinDate || '').slice(0, 10);
  return !!fyStart && !!d && d < fyStart;
}

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

  if (isHistoricalJoin(date, opts.financialYear)) {
    return { ...base, mode: 'historical', historicalShare: share, historicalAdmission: admission, bankFallbackToCash: false };
  }

  const receipts: JoiningReceipt[] = [];
  if (share > 0) receipts.push({ kind: 'share', creditAccountId: SHARE_CAPITAL_ACCOUNT, amount: share, narration: `Share Capital received from ${member.name}` });
  if (admission > 0) receipts.push({ kind: 'admission', creditAccountId: ADMISSION_FEE_ACCOUNT, amount: admission, narration: `Admission Fee received from ${member.name}` });
  return { ...base, mode: 'post', receipts };
}

/**
 * UX-03 — the live line under the add-member form's admission date. Built from the SAME plan the
 * save posts, so the form can never promise a receipt the save will not make (RULE 2). An empty
 * date says "choose it" — the form used to default to today, which silently booked a cash receipt
 * for every old member copied from the register.
 */
export function joiningPreviewLine(
  member: JoiningMember,
  opts: { financialYear: string; today: string; bankAccountId?: string | null },
  hi = true,
): { tone: 'warn' | 'info' | 'muted'; text: string } {
  const rs = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  if (!(member.joinDate || '').slice(0, 10)) {
    return { tone: 'warn', text: hi
      ? 'दाख़िला तिथि चुनें — इसी से तय होगा कि इस वर्ष की रसीद बनेगी (नया सदस्य) या नहीं (पुराना सदस्य)।'
      : 'Choose the admission date — it decides whether a receipt is made this year (new member) or not (old member).' };
  }
  const plan = planJoiningReceipts(member, opts);
  if (plan.mode === 'historical') {
    return { tone: 'info', text: hi
      ? `पुराना सदस्य (इस वित्तीय वर्ष से पहले) — कोई रसीद नहीं बनेगी; ${rs(plan.historicalShare + plan.historicalAdmission)} opening balance में रखें।`
      : `Old member (before this financial year) — no receipt will be made; carry ${rs(plan.historicalShare + plan.historicalAdmission)} in the opening balances.` };
  }
  if (plan.mode === 'post') {
    const amt = plan.receipts.reduce((t, r) => t + r.amount, 0);
    const where = plan.debitAccountId === CASH_ACCOUNT ? (hi ? 'नकद' : 'cash') : (hi ? 'बैंक' : 'bank');
    return { tone: 'warn', text: hi
      ? `इस वर्ष की रसीद बनेगी: ${rs(amt)} (${where}), तिथि ${plan.date}। पुराना सदस्य हो तो असली दाख़िला तिथि भरें।`
      : `A receipt will be made this year: ${rs(amt)} (${where}), dated ${plan.date}. For an old member, enter the real admission date.` };
  }
  return { tone: 'muted', text: hi ? 'शेयर / प्रवेश शुल्क नहीं — कोई रसीद नहीं बनेगी।' : 'No share or admission fee — no receipt will be made.' };
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

/**
 * One-line Hindi label for an import preview row — from the SAME plan the import posts, so the preview
 * can never promise a receipt the import will not make (RULE 2).
 */
export function joiningKindLabel(plan: JoiningReceiptPlan, joinDate: string | undefined, financialYear: string): string {
  const rs = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  if (plan.mode === 'historical') return `पुराना — रसीद नहीं (${rs(plan.historicalShare + plan.historicalAdmission)} opening में)`;
  if (plan.mode === 'post') {
    const amt = plan.receipts.reduce((t, r) => t + r.amount, 0);
    return `नया — रसीद ${rs(amt)} (${plan.debitAccountId === CASH_ACCOUNT ? 'नकद' : 'बैंक'})`;
  }
  return isHistoricalJoin(joinDate, financialYear) ? 'पुराना — राशि नहीं' : 'नया — राशि नहीं';
}

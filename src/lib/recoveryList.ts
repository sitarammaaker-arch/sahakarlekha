/**
 * Monthly recovery list — what each member owes the society for a month, in one sheet.
 *
 * An employees' (salary earners') thrift & credit society sends its members' employer a list every month and the
 * employer deducts the amounts from salary. The list is a DEMAND: it posts nothing. Money is recorded when it comes
 * in — one member at a time (collection sheet, Loan Register), or all at once from this list's "record recovery"
 * step, which posts through those same two routines (recoveryPostPlan below decides what; the screen posts it).
 *
 * Per member, as of the last day of the month:
 *   compulsory deposit  months fallen due × monthly contribution − contributions paid (lib/compulsoryDeposit.ts)
 *   loan principal      what should have been repaid by now − what was repaid, never more than the outstanding
 *   loan interest       interest already accrued on the loan and not yet received (lib/loans/interestAccrual.ts)
 *
 * The principal instalment is the one the society fixed on the loan (Loan.monthlyInstallment, column 170). A loan
 * without one — every loan made before that field existed — has it DERIVED: equal monthly instalments from the
 * month after disbursement to the due date. That fallback is a product rule, not a statutory one — the list says
 * so in a note. After the due date the whole outstanding is due either way.
 *
 * PURE — unit-tested by scripts/test-recovery-list.mjs.
 */
import type { DepositAccount, DepositTransaction, Loan } from '@/types';
import { compulsoryAccounts, compulsoryArrears } from '@/lib/compulsoryDeposit';
import { monthsBetween } from '@/lib/rdSchedule';
import type { LedgerTable } from '@/lib/registers/ledgerTables';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Last day ('YYYY-MM-DD') of a 'YYYY-MM' month. */
export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

type LoanIn = Pick<Loan, 'id' | 'loanNo' | 'memberId' | 'amount' | 'repaidAmount' | 'disbursementDate' | 'dueDate' | 'status' | 'isDeleted' | 'monthlyInstallment'>;

/** Number of monthly instalments the loan is repayable in: one a month from the month after disbursement to the due date. */
export function loanInstalmentCount(loan: Pick<Loan, 'disbursementDate' | 'dueDate'>): number {
  if (!loan.disbursementDate || !loan.dueDate) return 1;
  return Math.max(1, monthsBetween(loan.disbursementDate, loan.dueDate));
}

/** The derived equal monthly principal instalment. */
export function derivedLoanInstalment(loan: Pick<Loan, 'amount' | 'disbursementDate' | 'dueDate'>): number {
  return r2(loan.amount / loanInstalmentCount(loan));
}

/** Whether the society fixed a monthly instalment on this loan (a positive amount). */
export function hasFixedInstalment(loan: Pick<Loan, 'monthlyInstallment'>): boolean {
  return Number(loan.monthlyInstallment) > 0;
}

/** The monthly principal instalment: the one fixed on the loan when there is one, otherwise the derived one. */
export function loanInstalment(loan: Pick<Loan, 'amount' | 'disbursementDate' | 'dueDate' | 'monthlyInstallment'>): number {
  return hasFixedInstalment(loan) ? r2(Math.min(Number(loan.monthlyInstallment), loan.amount)) : derivedLoanInstalment(loan);
}

/**
 * Principal due on a loan as of the end of `month`: instalments fallen due so far minus principal repaid, capped at
 * the outstanding. Nothing is due in the month of disbursement; from the due date's month on, everything is.
 */
export function loanPrincipalDue(loan: LoanIn, month: string): number {
  if (loan.isDeleted || loan.status === 'cleared') return 0;
  const outstanding = r2(loan.amount - (loan.repaidAmount || 0));
  if (outstanding <= 0.005 || !loan.disbursementDate) return 0;
  const asOf = monthEnd(month);
  if (asOf < loan.disbursementDate) return 0;                       // not disbursed yet in that month
  if (loan.dueDate && loan.dueDate.slice(0, 7) <= month) return outstanding;   // term over → all of it
  const elapsed = Math.max(0, monthsBetween(loan.disbursementDate, asOf));
  const shouldHaveRepaid = Math.min(loan.amount, r2(loanInstalment(loan) * elapsed));
  return Math.min(outstanding, Math.max(0, r2(shouldHaveRepaid - (loan.repaidAmount || 0))));
}

export interface RecoveryRow {
  memberId: string;          // members.id
  compulsoryDeposit: number;
  loanPrincipal: number;
  loanInterest: number;
  total: number;
  loanNos: string[];
}

export interface RecoveryInput {
  month: string;   // 'YYYY-MM'
  depositAccounts: (Pick<DepositAccount, 'id' | 'memberId' | 'depositType' | 'status' | 'openDate' | 'installmentAmount'> & { accountNo?: string })[];
  depositTransactions: Pick<DepositTransaction, 'depositAccountId' | 'date' | 'txnType' | 'amount'>[];
  loans: LoanIn[];
  /** Accrued, not yet received interest of a loan (loanInterestDue(...).receivable). */
  interestDueOf: (loanId: string) => number;
}

/** One thing a member owes: a compulsory deposit account, or a loan. The unit the recovery is posted in. */
export type RecoveryItem =
  | { key: string; kind: 'cd'; memberId: string; depositAccountId: string; label: string; due: number }
  | { key: string; kind: 'loan'; memberId: string; loanId: string; label: string; principalDue: number; interestDue: number };

/** Every compulsory deposit account and loan with something due for the month. */
export function recoveryItems({ month, depositAccounts, depositTransactions, loans, interestDueOf }: RecoveryInput): RecoveryItem[] {
  const asOf = monthEnd(month);
  const items: RecoveryItem[] = [];
  for (const a of compulsoryAccounts(depositAccounts)) {
    const due = compulsoryArrears(a, depositTransactions, asOf).arrears;
    if (due > 0) items.push({ key: `cd:${a.id}`, kind: 'cd', memberId: a.memberId, depositAccountId: a.id, label: a.accountNo ?? '', due });
  }
  for (const l of loans) {
    if (l.isDeleted || l.status === 'cleared') continue;
    const principalDue = loanPrincipalDue(l, month);
    const interestDue = r2(Math.max(0, interestDueOf(l.id)));
    if (principalDue <= 0 && interestDue <= 0) continue;
    items.push({ key: `loan:${l.id}`, kind: 'loan', memberId: l.memberId, loanId: l.id, label: l.loanNo, principalDue, interestDue });
  }
  return items;
}

/** One row per member who owes anything for the month; members who owe nothing are left out. Built from the items. */
export function recoveryRows(input: RecoveryInput): RecoveryRow[] {
  const rows = new Map<string, RecoveryRow>();
  const row = (memberId: string) => {
    let r = rows.get(memberId);
    if (!r) { r = { memberId, compulsoryDeposit: 0, loanPrincipal: 0, loanInterest: 0, total: 0, loanNos: [] }; rows.set(memberId, r); }
    return r;
  };
  for (const it of recoveryItems(input)) {
    const r = row(it.memberId);
    if (it.kind === 'cd') r.compulsoryDeposit = r2(r.compulsoryDeposit + it.due);
    else { r.loanPrincipal = r2(r.loanPrincipal + it.principalDue); r.loanInterest = r2(r.loanInterest + it.interestDue); r.loanNos.push(it.label); }
  }
  return [...rows.values()].map((r) => ({ ...r, total: r2(r.compulsoryDeposit + r.loanPrincipal + r.loanInterest) })).filter((r) => r.total > 0);
}

/** What the user typed against an item when recording the money received. Blank / invalid counts as 0. */
export interface RecoveryEntry { deposit?: number | string; principal?: number | string; interest?: number | string }

export type RecoveryAction =
  | { kind: 'cd'; key: string; depositAccountId: string; amount: number }
  | { kind: 'loan'; key: string; loanId: string; total: number; interest: number };

const amt = (v: number | string | undefined) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? r2(n) : 0; };

/**
 * Entries that cannot be posted as typed: loan principal above the loan's outstanding (the repayment routine refuses
 * it). Checked BEFORE anything is posted, so a wrong figure stops the whole batch with its loan named instead of
 * leaving half of it posted. Returns the labels of the offending loans.
 */
export function recoveryEntryProblems(items: readonly RecoveryItem[], entries: Readonly<Record<string, RecoveryEntry>>, outstandingOf: (loanId: string) => number): string[] {
  const bad: string[] = [];
  for (const it of items) {
    if (it.kind !== 'loan') continue;
    if (amt(entries[it.key]?.principal) > outstandingOf(it.loanId) + 0.005) bad.push(it.label);
  }
  return bad;
}

/** The amounts the recording step starts with: exactly what is due. */
export function defaultRecoveryEntries(items: readonly RecoveryItem[]): Record<string, RecoveryEntry> {
  const out: Record<string, RecoveryEntry> = {};
  for (const it of items) out[it.key] = it.kind === 'cd' ? { deposit: it.due } : { principal: it.principalDue, interest: it.interestDue };
  return out;
}

/**
 * What to post for the amounts entered: one deposit per compulsory deposit account, one repayment per loan
 * (total = principal + interest). Items with nothing entered are skipped — they post nothing. PURE: the screen
 * runs these through postDepositTransaction and the shared loan repayment routine.
 */
export function recoveryPostPlan(items: readonly RecoveryItem[], entries: Readonly<Record<string, RecoveryEntry>>): { actions: RecoveryAction[]; total: number } {
  const actions: RecoveryAction[] = [];
  for (const it of items) {
    const e = entries[it.key] ?? {};
    if (it.kind === 'cd') {
      const a = amt(e.deposit);
      if (a > 0) actions.push({ kind: 'cd', key: it.key, depositAccountId: it.depositAccountId, amount: a });
    } else {
      const principal = amt(e.principal), interest = amt(e.interest);
      if (principal + interest > 0) actions.push({ kind: 'loan', key: it.key, loanId: it.loanId, total: r2(principal + interest), interest });
    }
  }
  return { actions, total: r2(actions.reduce((s, a) => s + (a.kind === 'cd' ? a.amount : a.total), 0)) };
}

export interface RecoveryTotals { compulsoryDeposit: number; loanPrincipal: number; loanInterest: number; total: number }
export function recoveryTotals(rows: readonly RecoveryRow[]): RecoveryTotals {
  const t = rows.reduce((s, r) => ({
    compulsoryDeposit: s.compulsoryDeposit + r.compulsoryDeposit, loanPrincipal: s.loanPrincipal + r.loanPrincipal,
    loanInterest: s.loanInterest + r.loanInterest, total: s.total + r.total,
  }), { compulsoryDeposit: 0, loanPrincipal: 0, loanInterest: 0, total: 0 });
  return { compulsoryDeposit: r2(t.compulsoryDeposit), loanPrincipal: r2(t.loanPrincipal), loanInterest: r2(t.loanInterest), total: r2(t.total) };
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
export function monthLabel(month: string, hi: boolean): string {
  const [y, m] = month.split('-').map(Number);
  return `${(hi ? MONTHS_HI : MONTHS_EN)[m - 1] ?? month} ${y}`;
}

/** The list as a table — the same rows on screen, in the PDF and in Excel. Sorted by member number. */
export function recoveryListTable(rows: readonly RecoveryRow[], month: string, memberOf: (id: string) => { memberNo: string; name: string }): LedgerTable {
  const sorted = [...rows].map((r) => ({ r, m: memberOf(r.memberId) })).sort((a, b) => a.m.memberNo.localeCompare(b.m.memberNo, undefined, { numeric: true }));
  const body = sorted.map(({ r, m }, i) => [i + 1, m.memberNo, m.name, r.loanNos.join(', '), r.compulsoryDeposit, r.loanPrincipal, r.loanInterest, r.total]);
  const t = recoveryTotals(rows);
  return {
    title: 'Monthly Recovery List', titleHi: 'मासिक वसूली सूची',
    subtitle: `For ${monthLabel(month, false)} — dues as on ${monthEnd(month)} · ${rows.length} member(s)`,
    columns: [
      { en: 'S.No.', hi: 'क्र.' },
      { en: 'Member No.', hi: 'सदस्य सं.' },
      { en: 'Member', hi: 'सदस्य' },
      { en: 'Loan No.', hi: 'ऋण सं.' },
      { en: 'Compulsory Deposit', hi: 'अनिवार्य जमा', num: true },
      { en: 'Loan Instalment', hi: 'ऋण किस्त', num: true },
      { en: 'Loan Interest', hi: 'ऋण ब्याज', num: true },
      { en: 'Total', hi: 'कुल', num: true },
    ],
    rowsEn: body, rowsHi: body,
    totals: ['', '', 'Total', '', t.compulsoryDeposit, t.loanPrincipal, t.loanInterest, t.total],
    notes: [
      { en: 'Compulsory deposit: monthly contributions fallen due up to this month, less contributions paid.', hi: 'अनिवार्य जमा: इस माह तक देय हुए मासिक अंशदान, घटाकर जमा हुए अंशदान।' },
      { en: 'Loan instalment: the monthly instalment entered on the loan, falling due from the month after disbursement. Where a loan has none entered, it is taken as repayable in equal monthly instalments up to its due date. Shown here is what has fallen due less principal repaid; after the due date the whole outstanding is shown.', hi: 'ऋण किस्त: ऋण पर दर्ज मासिक किस्त, जो वितरण के अगले माह से देय होती है। जिस ऋण पर किस्त दर्ज नहीं है उसे देय तिथि तक बराबर मासिक किस्तों में चुकाने योग्य माना गया है। यहाँ अब तक देय हुई किस्तें, घटाकर चुकाया मूलधन, दिखाया है; देय तिथि के बाद पूरा बकाया दिखता है।' },
      { en: 'Loan interest: interest already accrued in the books and not yet received. Interest not yet accrued is not included.', hi: 'ऋण ब्याज: बही में दर्ज हो चुका और अब तक न मिला ब्याज। जो ब्याज अभी दर्ज नहीं हुआ वह इसमें शामिल नहीं है।' },
      { en: 'This list is a demand only. No entry is made in the books until the money is received.', hi: 'यह सूची केवल माँग है। रकम मिलने तक बही में कोई एंट्री नहीं होती।' },
    ],
  };
}

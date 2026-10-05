/**
 * Payroll run → ledger legs (P1 of the payroll consolidation). PURE — no I/O, integers (paise) only.
 *
 * ONE place that decides how a locked payroll run is booked, used by the pay-post / pay-pay Edge
 * Functions (bundled into _shared/pay-core.mjs) and by the Node tests. It books the same shape the
 * Salary page books (lib/payroll/accrualLines.ts) so a society sees one kind of salary voucher:
 *
 *   accrual    Dr Salary expense                 earnings − loss-of-pay
 *              Cr Salary payable                 net pay
 *              Cr PF / ESI / PT / TDS payable    each deduction, to its own head
 *              Cr Employee advance               loan / advance recovered from pay
 *   payment    Dr Salary payable / Cr Bank|Cash  net pay
 *
 * Heads are NEVER account ids chosen here — the caller resolves them per society from account_roles
 * (salary.expense, salary.payable, pf.payable, esi.payable, professional_tax.payable, tds.payable,
 * employee.advance) and passes them in. A deduction with no head, or a deduction this module does not
 * know, REFUSES the posting: a silent mis-booking is worse than an error (same rule as Salary's PT head).
 *
 * LOSS OF PAY: the run has five LOP components (LOP, LOP_NOHRA, LOP_DEP, LOP_CONSOL, LOP_STIPEND). The
 * old direct-DB pay-post counted only code 'LOP', so for the other four types the expense was overstated
 * by the unpaid days. Every LOP* code is a loss of pay here.
 */

export interface RunLine {
  /** component code, e.g. 'BASIC', 'PF', 'LOP_CONSOL', 'LOAN_RECOVERY'. */
  code: string;
  /** component kind: 'earning' | 'deduction' | 'loan_recovery' | … (info / employer_contrib are ignored). */
  kind: string;
  /** the run's total for this component, in paise (≥ 0). */
  amountMinor: number;
}

export interface PostingHeads {
  salaryExpense: string;
  salaryPayable: string;
  pfPayable?: string;
  esiPayable?: string;
  ptPayable?: string;
  tdsPayable?: string;
  employeeAdvance?: string;
}

export interface PostingLeg { id: string; accountId: string; drCr: 'Dr' | 'Cr'; amountMinor: number; narration: string }

export type PostingResult =
  | { ok: true; legs: PostingLeg[]; expenseMinor: number; netMinor: number; deductionsMinor: number }
  | { ok: false; code: 'PAY-POST-NOTHING' | 'PAY-POST-IMBALANCE' | 'PAY-POST-HEAD' | 'PAY-POST-UNKNOWN-DEDUCTION' | 'PAY-POST-INPUT'; message: string; missingHeads?: string[]; unknown?: string[] };

type Bucket = 'earning' | 'lop' | 'pf' | 'esi' | 'pt' | 'tds' | 'loan' | 'other_deduction' | 'ignore';

/** PURE — which bucket a component falls in. Exported for tests. */
export function bucketOf(code: string, kind: string): Bucket {
  const c = code.toUpperCase();
  if (kind === 'earning') return 'earning';
  if (kind === 'loan_recovery' || c === 'LOAN_RECOVERY') return 'loan';
  if (kind === 'deduction') {
    if (c === 'LOP' || c.startsWith('LOP_')) return 'lop';
    if (c === 'PF' || c === 'EPF') return 'pf';
    if (c === 'ESI') return 'esi';
    if (c === 'PT' || c === 'PROFESSIONAL_TAX') return 'pt';
    if (c === 'TDS' || c === 'TDS_192') return 'tds';
    return 'other_deduction';
  }
  return 'ignore'; // info / employer_contrib / anything that is not on the payslip money
}

const isMinor = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

/**
 * PURE — the accrual voucher legs for a payroll run.
 * `netMinor` is the run's total net pay as stored on the payslips; it must equal earnings − all deductions
 * (the function re-derives it and refuses on any difference, so a corrupt run can never be booked).
 */
export function buildRunAccrual(
  lines: readonly RunLine[], netMinor: number, heads: PostingHeads, newId: () => string = () => crypto.randomUUID(),
): PostingResult {
  if (!isMinor(netMinor) || lines.some((l) => !isMinor(l.amountMinor))) {
    return { ok: false, code: 'PAY-POST-INPUT', message: 'amounts must be whole paise ≥ 0' };
  }
  const sum: Record<Bucket, number> = { earning: 0, lop: 0, pf: 0, esi: 0, pt: 0, tds: 0, loan: 0, other_deduction: 0, ignore: 0 };
  const unknown = new Set<string>();
  for (const l of lines) {
    const b = bucketOf(l.code, l.kind);
    sum[b] += l.amountMinor;
    if (b === 'other_deduction' && l.amountMinor > 0) unknown.add(l.code);
  }
  if (unknown.size) {
    return { ok: false, code: 'PAY-POST-UNKNOWN-DEDUCTION', unknown: [...unknown],
      message: `deduction(s) ${[...unknown].join(', ')} have no ledger head — refusing to book (add the mapping first)` };
  }

  const expenseMinor = sum.earning - sum.lop;                      // days not worked are not an expense
  const deductionsMinor = sum.lop + sum.pf + sum.esi + sum.pt + sum.tds + sum.loan;
  if (expenseMinor <= 0) return { ok: false, code: 'PAY-POST-NOTHING', message: 'nothing to post (zero expense)' };
  if (sum.earning - deductionsMinor !== netMinor) {
    return { ok: false, code: 'PAY-POST-IMBALANCE',
      message: `net ${netMinor} ≠ earnings ${sum.earning} − deductions ${deductionsMinor} — refusing to book` };
  }

  const missing: string[] = [];
  if (sum.pf > 0 && !heads.pfPayable) missing.push('pf.payable');
  if (sum.esi > 0 && !heads.esiPayable) missing.push('esi.payable');
  if (sum.pt > 0 && !heads.ptPayable) missing.push('professional_tax.payable');
  if (sum.tds > 0 && !heads.tdsPayable) missing.push('tds.payable');
  if (sum.loan > 0 && !heads.employeeAdvance) missing.push('employee.advance');
  if (missing.length) {
    return { ok: false, code: 'PAY-POST-HEAD', missingHeads: missing,
      message: `no ledger head for ${missing.join(', ')} — refusing to book (map the head in Ledger Heads first)` };
  }

  const legs: PostingLeg[] = [
    { id: newId(), accountId: heads.salaryExpense, drCr: 'Dr', amountMinor: expenseMinor, narration: 'Salary & wages (net of loss of pay)' },
    { id: newId(), accountId: heads.salaryPayable, drCr: 'Cr', amountMinor: netMinor, narration: 'Net salary payable' },
  ];
  const credit = (acc: string | undefined, amt: number, narration: string) => {
    if (amt > 0 && acc) legs.push({ id: newId(), accountId: acc, drCr: 'Cr', amountMinor: amt, narration });
  };
  credit(heads.pfPayable, sum.pf, 'PF withheld');
  credit(heads.esiPayable, sum.esi, 'ESI withheld');
  credit(heads.ptPayable, sum.pt, 'Professional tax withheld');
  credit(heads.tdsPayable, sum.tds, 'TDS on salary withheld');
  credit(heads.employeeAdvance, sum.loan, 'Staff advance recovered from pay');

  let dr = 0, cr = 0;
  for (const g of legs) { if (g.drCr === 'Dr') dr += g.amountMinor; else cr += g.amountMinor; }
  if (dr !== cr) return { ok: false, code: 'PAY-POST-IMBALANCE', message: `legs do not balance: Dr ${dr} ≠ Cr ${cr}` };

  return { ok: true, legs, expenseMinor, netMinor, deductionsMinor };
}

/** PURE — the payment voucher legs: Dr Salary payable / Cr the bank or cash account the user paid from. */
export function buildRunPayment(
  netMinor: number, salaryPayable: string, paidFrom: string, newId: () => string = () => crypto.randomUUID(),
): PostingResult {
  if (!isMinor(netMinor)) return { ok: false, code: 'PAY-POST-INPUT', message: 'amount must be whole paise ≥ 0' };
  if (netMinor <= 0) return { ok: false, code: 'PAY-POST-NOTHING', message: 'nothing to pay (zero net)' };
  return {
    ok: true, expenseMinor: netMinor, netMinor, deductionsMinor: 0,
    legs: [
      { id: newId(), accountId: salaryPayable, drCr: 'Dr', amountMinor: netMinor, narration: 'Clear salaries payable' },
      { id: newId(), accountId: paidFrom, drCr: 'Cr', amountMinor: netMinor, narration: 'Net salaries paid' },
    ],
  };
}

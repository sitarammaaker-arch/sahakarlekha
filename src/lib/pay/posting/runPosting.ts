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
    if (c === 'ESI' || c.startsWith('ESI_')) return 'esi';   // ESI_NOHRA / ESI_DEP / ESI_CONSOL / ESI_STIPEND (lib/pay/statutory/esiWage.ts)
    if (c === 'PT' || c === 'PROFESSIONAL_TAX') return 'pt';
    if (c === 'TDS' || c === 'TDS_192' || c.startsWith('TDS_')) return 'tds';   // TDS_NOHRA / TDS_DEP / TDS_CONSOL / TDS_STIPEND (lib/pay/tax/salaryTds.ts)
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
      // Hindi first. There is NO screen that maps a role (Ledger Heads does not) — it is added to account_roles by support, so do not say otherwise.
      message: `बही में नहीं लिखा गया — इन खातों का role इस सोसाइटी में तय नहीं है: ${missing.join(', ')}। सहायता से संपर्क करें। ` +
        `(no ledger head for ${missing.join(', ')} — refusing to book; the role must be added by support, it cannot be set from the Ledger Heads screen)` };
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

// ── hand-off to the posting service (public.post_voucher, migration 077) ────────────────────────────

/** The account_roles a payroll posting needs (heads are resolved per society from account_roles). */
export const PAYROLL_ROLES = {
  salaryExpense: 'salary.expense',
  salaryPayable: 'salary.payable',
  pfPayable: 'pf.payable',
  esiPayable: 'esi.payable',
  ptPayable: 'professional_tax.payable',
  tdsPayable: 'tds.payable',
  employeeAdvance: 'employee.advance',
} as const;

/** PURE — account_roles rows ({role, account_id}) → the heads buildRunAccrual wants (missing ones stay undefined). */
export function headsFromRoles(rows: readonly { role: string; account_id: string }[]): Partial<PostingHeads> {
  const by = new Map(rows.map((r) => [r.role, r.account_id]));
  const h: Partial<PostingHeads> = {};
  const set = (k: keyof PostingHeads, role: string) => { const v = by.get(role); if (v) h[k] = v; };
  set('salaryExpense', PAYROLL_ROLES.salaryExpense); set('salaryPayable', PAYROLL_ROLES.salaryPayable);
  set('pfPayable', PAYROLL_ROLES.pfPayable); set('esiPayable', PAYROLL_ROLES.esiPayable);
  set('ptPayable', PAYROLL_ROLES.ptPayable); set('tdsPayable', PAYROLL_ROLES.tdsPayable);
  set('employeeAdvance', PAYROLL_ROLES.employeeAdvance);
  return h;
}

/**
 * PURE — the ids of a run's vouchers and journal events. DETERMINISTIC (derived from the run id) so a retry
 * after a dropped connection posts the SAME voucher again: post_voucher is idempotent on the voucher id and
 * answers 'exists' instead of creating a second salary voucher.
 */
export function payrollDocIds(runId: string) {
  return {
    accrualVoucherId: `payrun-${runId}-accrual`, accrualEventId: `payrun-${runId}-accrual-posted`,
    paymentVoucherId: `payrun-${runId}-payment`, paymentEventId: `payrun-${runId}-payment-posted`,
  };
}

export interface PostVoucherPayloadInput {
  id: string; eventId: string; voucherNo: string; type: 'journal' | 'payment';
  /** YYYY-MM-DD — must fall in an OPEN financial year of the society (checked by post_voucher). */
  date: string; narration: string; createdBy: string; occurredAt: string;
  legs: readonly PostingLeg[];
}

const rupees = (minor: number) => minor / 100;

/**
 * PURE — the exact `{p_voucher, p_lines, p_event}` that public.post_voucher takes, in the same shape the app's
 * buildPostVoucherPayload (lib/ledger/postVoucherClient.ts) produces: the voucher with its legs as `lines`
 * (rupees), the legs in paise, and the `voucher.posted` event (sequence 1) carrying the SAME legs. The society
 * is never in the payload — the server takes it from the JWT.
 */
export function makePostVoucherPayload(i: PostVoucherPayloadInput) {
  const drLegs = i.legs.filter((l) => l.drCr === 'Dr');
  const crLegs = i.legs.filter((l) => l.drCr === 'Cr');
  const totalMinor = drLegs.reduce((s, l) => s + l.amountMinor, 0);
  const p_voucher = {
    id: i.id, voucherNo: i.voucherNo, type: i.type, date: i.date,
    debitAccountId: drLegs[0]?.accountId ?? '', creditAccountId: crLegs[0]?.accountId ?? '',
    amount: rupees(totalMinor), narration: i.narration, createdBy: i.createdBy, createdAt: i.occurredAt,
    approvalStatus: 'approved', memberId: '', branchId: '',
    lines: i.legs.map((l) => ({ id: l.id, accountId: l.accountId, type: l.drCr, amount: rupees(l.amountMinor) })),
  };
  const p_lines = i.legs.map((l) => ({ id: l.id, accountId: l.accountId, drCr: l.drCr, amountMinor: l.amountMinor, narration: l.narration }));
  const p_event = {
    event_id: i.eventId, event_type: 'voucher.posted', schema_version: 1, aggregate_type: 'voucher', aggregate_id: i.id,
    sequence: 1, occurred_at: i.occurredAt, producer_kind: 'human', producer_id: i.createdBy, on_behalf_of: null,
    payload: {
      lines: i.legs.map((l) => ({ accountId: l.accountId, drCr: l.drCr, amountMinor: l.amountMinor })),
      voucherNo: i.voucherNo, type: i.type, amount: rupees(totalMinor), date: i.date, narration: i.narration,
      createdAt: i.occurredAt, memberId: '', branchId: '', createdBy: i.createdBy,
    },
  };
  return { p_voucher, p_lines, p_event };
}

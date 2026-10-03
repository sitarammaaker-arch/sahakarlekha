/**
 * Salary accrual journal lines. PURE — no React, no I/O.
 *
 * ONE place that decides how a salary slip is booked, used by BOTH addSalaryRecord and updateSalaryRecord.
 * updateSalaryRecord used to rewrite the accrual voucher as plain `Dr 5201 / Cr 2103` (net only), which
 * silently dropped the EPF / ESI / PT / TDS credits and the employer contributions that addSalaryRecord books
 * for a slip with a statutory breakdown — so the statutory payables disagreed with the payroll register.
 *
 *   statutory breakdown present:
 *     Dr Salary Expense 5201        gross + employer PF + employer ESI
 *     Cr Salary Payable (2103)      net salary
 *     Cr EPF Payable 2203           employee PF + employer PF
 *     Cr ESI Payable 2204           employee ESI + employer ESI
 *     Cr Professional Tax 2207      PT
 *     Cr TDS Payable 2202           TDS u/s 192
 *   otherwise (legacy slip): Dr 5201 / Cr Salary Payable, net basis — old salary flows are unchanged.
 */
import { toMinor, toRupees } from '@/lib/money';
import type { SalaryRecord, VoucherLine } from '@/types';

export const ACC_SALARY_EXPENSE = '5201';
export const ACC_EPF_PAYABLE = '2203';
export const ACC_ESI_PAYABLE = '2204';
export const ACC_PT_PAYABLE = '2207';
export const ACC_TDS_PAYABLE = '2202';

export type SalaryAccrualInput = Pick<
  SalaryRecord,
  'basicSalary' | 'allowances' | 'netSalary' | 'pfEmployee' | 'pfEmployer' | 'esiEmployee' | 'esiEmployer' | 'pt' | 'tds'
>;

/** Every field that changes what the accrual voucher must contain. */
export const SALARY_ACCRUAL_FIELDS = [
  'basicSalary', 'allowances', 'netSalary', 'pfEmployee', 'pfEmployer', 'esiEmployee', 'esiEmployer', 'pt', 'tds',
] as const;

export interface SalaryAccrual {
  lines: VoucherLine[];
  /** The Dr side (and the voucher `amount`). */
  drTotal: number;
  hasStatutory: boolean;
  /** Dr equals Cr to the paisa. A statutory slip whose net does not reconcile with its deductions is NOT balanced. */
  balanced: boolean;
}

const r2 = (n: number) => toRupees(toMinor(n));

export function salaryAccrualLines(
  rec: SalaryAccrualInput,
  payableAccountId: string,
  newId: () => string = () => crypto.randomUUID(),
): SalaryAccrual {
  const pfEmp = rec.pfEmployee || 0, pfEr = rec.pfEmployer || 0;
  const esiEmp = rec.esiEmployee || 0, esiEr = rec.esiEmployer || 0;
  const ptAmt = rec.pt || 0, tdsAmt = rec.tds || 0;
  const hasStatutory = (pfEmp + pfEr + esiEmp + esiEr + ptAmt + tdsAmt) > 0;

  let lines: VoucherLine[];
  let drTotal: number;
  if (hasStatutory) {
    const gross = r2((rec.basicSalary || 0) + (rec.allowances || 0));
    drTotal = r2(gross + pfEr + esiEr);   // employer contributions add to the expense
    lines = [
      { id: newId(), accountId: ACC_SALARY_EXPENSE, type: 'Dr', amount: drTotal },
      { id: newId(), accountId: payableAccountId, type: 'Cr', amount: rec.netSalary },
    ];
    if (pfEmp + pfEr > 0) lines.push({ id: newId(), accountId: ACC_EPF_PAYABLE, type: 'Cr', amount: r2(pfEmp + pfEr) });
    if (esiEmp + esiEr > 0) lines.push({ id: newId(), accountId: ACC_ESI_PAYABLE, type: 'Cr', amount: r2(esiEmp + esiEr) });
    if (ptAmt > 0) lines.push({ id: newId(), accountId: ACC_PT_PAYABLE, type: 'Cr', amount: r2(ptAmt) });
    if (tdsAmt > 0) lines.push({ id: newId(), accountId: ACC_TDS_PAYABLE, type: 'Cr', amount: r2(tdsAmt) });
  } else {
    drTotal = rec.netSalary;
    lines = [
      { id: newId(), accountId: ACC_SALARY_EXPENSE, type: 'Dr', amount: rec.netSalary },
      { id: newId(), accountId: payableAccountId, type: 'Cr', amount: rec.netSalary },
    ];
  }

  let dr = 0, cr = 0;
  for (const l of lines) {
    const m = Number(toMinor(l.amount));
    if (l.type === 'Dr') dr += m; else cr += m;
  }
  return { lines, drTotal, hasStatutory, balanced: dr === cr };
}

/** True when any accrual-relevant field differs between the stored slip and the edited one. */
export function salaryAccrualChanged(before: SalaryAccrualInput, after: SalaryAccrualInput): boolean {
  return SALARY_ACCRUAL_FIELDS.some((k) => (before[k] || 0) !== (after[k] || 0));
}

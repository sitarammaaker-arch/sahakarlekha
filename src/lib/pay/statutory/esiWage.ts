/**
 * ESI (employee share) for the Payroll engine — the whitelisted `esi_employee` function and its five formulas. PURE.
 *
 *     formula "ESI" :: Money let w = BASIC + DA + HRA - LOP in esi_employee(w, attendance.paidDays)
 *
 * The wage is what the employee EARNED in the month (full pay less loss of pay) — the same base the Salary page uses
 * (`computeStatutory` works on the pro-rated gross). The rules, from the dated parameter table (lib/rules/epfEsi.ts), read for the
 * month being paid — never today:
 *   - no contribution when the wage is above the ESI wage limit (₹21,000 from 2017-01-01);
 *   - the employee's share is WAIVED when the average daily wage is at or below the exemption (₹176/day) — the employer still
 *     pays his share (that is the employer-share work, not this function);
 *   - otherwise  wage × employee rate (0.75%), rounded like the Salary page (money.applyPercent).
 * The rows behind these numbers are `verified: false` until a person has read the ESIC notification text; this function applies
 * them, it does not claim them. ESI is OFF for everyone until an admin turns it on for an employee (`esi-set`): no component is
 * bound, so no payslip line, no deduction — the same switch pattern as salary TDS.
 */
import { resolveParam } from '@/lib/rules/epfEsi';
import { applyPercent } from '@/lib/money';
import { makeMoney, type MoneyValue } from '../formula/evaluator.ts';

/** The formula-language signature of the whitelisted function (TypeEnv.fns). */
export const ESI_EMPLOYEE_SIG = { params: ['Money', 'Number'], ret: 'Money' } as const;
export const ESI_EMPLOYEE_NAME = 'esi_employee';

/**
 * One ESI component per structure family — each reads the earnings of THAT structure and its own loss-of-pay line (mirrors the TDS
 * family in lib/pay/tax/salaryTds.ts). Daily-wage types have no stable monthly wage, so they have none.
 */
export const ESI_FORMULAS: Record<string, string> = {
  ESI:         'formula "ESI" :: Money let w = BASIC + DA + HRA - LOP in esi_employee(w, attendance.paidDays)',
  ESI_NOHRA:   'formula "ESI_NOHRA" :: Money let w = BASIC + DA - LOP_NOHRA in esi_employee(w, attendance.paidDays)',
  ESI_DEP:     'formula "ESI_DEP" :: Money let w = BASIC + DA + DEP_ALLOW - LOP_DEP in esi_employee(w, attendance.paidDays)',
  ESI_CONSOL:  'formula "ESI_CONSOL" :: Money let w = CONSOLIDATED - LOP_CONSOL in esi_employee(w, attendance.paidDays)',
  ESI_STIPEND: 'formula "ESI_STIPEND" :: Money let w = STIPEND - LOP_STIPEND in esi_employee(w, attendance.paidDays)',
};

/** Which ESI component fits an employment type (the family of its TDS / loss-of-pay components). Daily-wage types: none. */
export const ESI_CODE_BY_TYPE: Record<string, string> = {
  permanent: 'ESI', probation: 'ESI',
  seasonal: 'ESI_NOHRA', fixedterm: 'ESI_NOHRA',
  deputation: 'ESI_DEP',
  contract: 'ESI_CONSOL', honorary: 'ESI_CONSOL', parttime: 'ESI_CONSOL', consultant: 'ESI_CONSOL',
  apprentice: 'ESI_STIPEND',
};

export const isEsiCode = (code: string): boolean => { const c = code.toUpperCase(); return c === 'ESI' || c.startsWith('ESI_'); };

export interface EsiContext {
  /** first day of the period's month, YYYY-MM-01 — the month being paid, never today */
  asOf: string;
  currency: string;
}

function refuse(code: string, msg: string): never {
  throw Object.assign(new RangeError(`${code}: ${msg}`), { code });
}

export function makeEsiEmployee(ctx: EsiContext): (wage: unknown, paidDays: unknown) => MoneyValue {
  const limitMinor = Math.round(resolveParam('esi.wageLimit', ctx.asOf).value * 100);
  const ratePct = resolveParam('esi.employeeRate', ctx.asOf).value;
  const dailyExempt = resolveParam('esi.dailyWageExempt', ctx.asOf).value;
  return (wage, paidDays) => {
    const w = wage as MoneyValue | null;
    if (!w || w.kind !== 'money') refuse('PAY-DSL-TYPE-015', 'esi_employee: the wage must be Money');
    if (w.currency !== ctx.currency) refuse('PAY-DSL-TYPE-011', `esi_employee: currency mismatch (${w.currency} vs ${ctx.currency})`);
    if (typeof paidDays !== 'number' || !Number.isFinite(paidDays)) refuse('PAY-DSL-TYPE-015', 'esi_employee: paid days must be a Number');
    if (w.minor <= 0 || w.minor > limitMinor) return makeMoney(0, ctx.currency);
    if (paidDays > 0 && w.minor / 100 / paidDays <= dailyExempt) return makeMoney(0, ctx.currency);   // average daily wage at or below the exemption
    return makeMoney(applyPercent(w.minor, ratePct).minor, ctx.currency);
  };
}

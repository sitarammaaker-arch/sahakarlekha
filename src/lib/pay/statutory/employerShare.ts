/**
 * The EMPLOYER's PF and ESI share for the Payroll engine — formulas and the whitelisted `esi_employer` function. PURE.
 *
 *     formula "ER_PF" :: Money let w = pf_wage(BASIC * 120%) in w * (employer_pf_total_rate / 100) * ((30 - attendance.lopDays) / 30)
 *     formula "ER_ESI" :: Money let w = BASIC + DA + HRA - LOP in esi_employer(w, attendance.paidDays)
 *
 * What it is: a COST of the society (Dr 5203 PF / 5204 ESI) and a LIABILITY (Cr the same payable heads as the employee's share, one
 * challan) — it is NOT on the payslip money, so the employee's net never changes. The component kind is 'employer_contrib'
 * (lib/pay/orchestrator/mapCatalog.ts maps that to 'info' for the payslip) and runPosting.bucketOf books it by CODE.
 *
 * Codes start ER_ on purpose: the employee's ESI family is matched by the prefix 'ESI_' (isEsiCode / bucketOf), so an employer line
 * named ESI_ER would silently be booked as a DEDUCTION from the employee.
 *
 * Rates are DATED parameters (lib/rules/epfEsi.ts), read for the month being paid, never today:
 *   PF  `pf.employerRate` 13  = 12% + 1% admin/EDLI — exactly what the Salary page books, one line, so both paths agree;
 *   ESI `esi.employerRate` 3.25.
 * Every one of those rows is `verified: false` until a person has read the notification text; this module applies them, it does not
 * claim them. The ESI wage limit applies to the employer's share too, but the daily-wage exemption does NOT — the employee's share is
 * waived for an average daily wage up to ₹176, the employer still pays his (ESIC Employers' Guide, section 6; epfEsi.ts 'esi.dailyWageExempt').
 *
 * Nothing here is switched on by itself: a component only appears on a payslip when it is BOUND to an employee's structure.
 */
import { resolveParam } from '@/lib/rules/epfEsi';
import { applyPercent } from '@/lib/money';
import { makeMoney, type MoneyValue } from '../formula/evaluator.ts';
import { ESI_CODE_BY_TYPE } from './esiWage.ts';

export const ER_PF_CODE = 'ER_PF';
/** The scalar the PF formula reads; seeded per run from the dated `pf.employerRate` unless the society has set its own. */
export const ER_PF_RATE_VAR = 'employer_pf_total_rate';

export const ESI_EMPLOYER_SIG = { params: ['Money', 'Number'], ret: 'Money' } as const;
export const ESI_EMPLOYER_NAME = 'esi_employer';

/** Same wage bases as the employee's PF / ESI components (pf: lib/pay/statutory/pfWage.ts; esi: esiWage.ts ESI_FORMULAS). */
export const ER_FORMULAS: Record<string, string> = {
  ER_PF:          'formula "ER_PF" :: Money let w = pf_wage(BASIC * 120%) in w * (employer_pf_total_rate / 100) * ((30 - attendance.lopDays) / 30)',
  ER_ESI:         'formula "ER_ESI" :: Money let w = BASIC + DA + HRA - LOP in esi_employer(w, attendance.paidDays)',
  ER_ESI_NOHRA:   'formula "ER_ESI_NOHRA" :: Money let w = BASIC + DA - LOP_NOHRA in esi_employer(w, attendance.paidDays)',
  ER_ESI_DEP:     'formula "ER_ESI_DEP" :: Money let w = BASIC + DA + DEP_ALLOW - LOP_DEP in esi_employer(w, attendance.paidDays)',
  ER_ESI_CONSOL:  'formula "ER_ESI_CONSOL" :: Money let w = CONSOLIDATED - LOP_CONSOL in esi_employer(w, attendance.paidDays)',
  ER_ESI_STIPEND: 'formula "ER_ESI_STIPEND" :: Money let w = STIPEND - LOP_STIPEND in esi_employer(w, attendance.paidDays)',
};

/** The employer ESI component that goes with an employment type — the family of its employee ESI component. Daily-wage types: none. */
export const ER_ESI_CODE_BY_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ESI_CODE_BY_TYPE).map(([type, code]) => [type, 'ER_' + code]),
);

export const isErCode = (code: string): boolean => { const c = code.toUpperCase(); return c === 'ER_PF' || c === 'ER_ESI' || c.startsWith('ER_ESI_'); };

export interface EsiEmployerContext { asOf: string; currency: string }

function refuse(code: string, msg: string): never {
  throw Object.assign(new RangeError(`${code}: ${msg}`), { code });
}

export function makeEsiEmployer(ctx: EsiEmployerContext): (wage: unknown, paidDays: unknown) => MoneyValue {
  const limitMinor = Math.round(resolveParam('esi.wageLimit', ctx.asOf).value * 100);
  const ratePct = resolveParam('esi.employerRate', ctx.asOf).value;
  return (wage, paidDays) => {
    const w = wage as MoneyValue | null;
    if (!w || w.kind !== 'money') refuse('PAY-DSL-TYPE-015', 'esi_employer: the wage must be Money');
    if (w.currency !== ctx.currency) refuse('PAY-DSL-TYPE-011', `esi_employer: currency mismatch (${w.currency} vs ${ctx.currency})`);
    if (typeof paidDays !== 'number' || !Number.isFinite(paidDays)) refuse('PAY-DSL-TYPE-015', 'esi_employer: paid days must be a Number');
    if (w.minor <= 0 || w.minor > limitMinor) return makeMoney(0, ctx.currency);   // above the wage limit: no ESI at all
    return makeMoney(applyPercent(w.minor, ratePct).minor, ctx.currency);          // no daily-wage exemption for the employer
  };
}

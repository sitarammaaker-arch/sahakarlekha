/**
 * Salary TDS (s.192 / Income-tax Act 2025 s.392) for the Payroll engine — P2.1. PURE.
 *
 * ONE source of truth. The CUMULATIVE rule — monthly TDS = (annual tax − TDS already deducted this FY) ÷ months
 * remaining, never negative — and the slab law are the ones the Salary page already uses and the society's CA
 * confirmed (lib/payroll/cumulativeTds.ts, lib/rules/incomeTax.ts). This module does NOT re-implement them: it
 * only gives the Payroll formula engine a whitelisted function, `tds_192`, that calls them. So Salary and Payroll
 * cannot drift apart, and a golden test (scripts/test-pay-tds.mjs) compares them month by month.
 *
 *     formula "TDS" :: Money let g = (BASIC + DA + HRA) * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)
 *
 * The annual projection is the month's full pay × 12 (before loss of pay) — exactly what Salary does
 * ((basic + allowances) × 12). The function closes over the employee's regime and the period being processed
 * (`asOf` = the month, never today).
 *
 * REFUSE OVER GUESS. A figure on law that is not verified is not an answer, it is a guess:
 *   PAY-TAX-501  the slab set covering the period is `verified: false` (e.g. FY 2025-26 — carried over, unsourced)
 *   PAY-TAX-502  the OLD regime — its slabs are not verified in any year
 *   PAY-TAX-503  no slab set covers the period at all (the newest one would be a wrong year's law)
 * The run refuses with that message; the admin enters that employee's TDS by hand (a per-employee fixed amount
 * overrides the formula). Salary shows the same facts as a note a clerk may ignore — Payroll deducts
 * automatically, so it must not.
 */
import { cumulativeMonthlyTds } from '@/lib/payroll/cumulativeTds';
import { resolveTaxBasis, type TaxRegime } from '@/lib/rules/incomeTax';
import { makeMoney, type MoneyValue } from '../formula/evaluator.ts';

/** The formula-language signature of the whitelisted function (TypeEnv.fns). */
export const TDS_192_SIG = { params: ['Money', 'Money', 'Number'], ret: 'Money' } as const;
export const TDS_192_NAME = 'tds_192';

/** The head under which every TDS component's deduction is summed as year-to-date (`tax.ytd.TDS`). */
export const TDS_YTD_HEAD = 'TDS';

/**
 * One TDS component per salary structure, mirroring the loss-of-pay variants: each projects the pay THAT structure
 * actually earns. Daily-wage types (DAILY_WAGE) have no stable monthly pay to project, so they have none.
 */
export const TDS_FORMULAS: Record<string, string> = {
  TDS:         'formula "TDS" :: Money let g = (BASIC + DA + HRA) * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)',
  TDS_NOHRA:   'formula "TDS_NOHRA" :: Money let g = (BASIC + DA) * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)',
  TDS_DEP:     'formula "TDS_DEP" :: Money let g = (BASIC + DA + DEP_ALLOW) * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)',
  TDS_CONSOL:  'formula "TDS_CONSOL" :: Money let g = CONSOLIDATED * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)',
  TDS_STIPEND: 'formula "TDS_STIPEND" :: Money let g = STIPEND * 12 in tds_192(g, tax.ytd.TDS, tax.monthsRemaining)',
};

/** PURE — is this component code a salary-TDS component (TDS, TDS_NOHRA, …)? */
export const isTdsCode = (code: string): boolean => { const c = code.toUpperCase(); return c === 'TDS' || c.startsWith('TDS_'); };

export interface Tds192Context {
  regime: TaxRegime;
  /** the first day of the month being processed — the law comes from HERE, never from today. */
  asOf: string;
  currency: string;
}

const refuse = (code: string, msg: string): never => { throw new RangeError(`${code}: ${msg}`); };
const isMoney = (v: unknown): v is MoneyValue => !!v && typeof v === 'object' && (v as { kind?: string }).kind === 'money';

/**
 * PURE — the law that governs this employee-month, or a refusal. Exported so the impure shell can ask the same
 * question BEFORE building a run (and say so in plain words) instead of failing deep inside the formula engine.
 */
export function assertVerifiedLaw(regime: TaxRegime, asOf: string): void {
  const basis = resolveTaxBasis(asOf);
  if (basis.stale) refuse('PAY-TAX-503', `no income-tax slab set covers ${asOf} — refusing (it would be computed on ${basis.set.fy}'s law); enter TDS by hand`);
  if (regime === 'old') refuse('PAY-TAX-502', 'the OLD-regime slabs are not verified — refusing; enter TDS by hand or use the new regime');
  if (!basis.set.verified) refuse('PAY-TAX-501', `${basis.set.fy} slabs are not verified (carried over, unsourced) — refusing; enter TDS by hand`);
}

/** What `tds_192` worked out for one employee-month — reported to the caller, which the formula language cannot do. */
export interface Tds192Outcome {
  tdsMinor: number;
  annualTaxMinor: number;
  ytdMinor: number;
  /**
   * > 0 ⇒ MORE has already been deducted this year than the year's tax. The month's TDS is then ₹0 (payroll cannot
   * refund) — but the CA's ruling (docs/CA-VERIFICATION-2026-07.md) is that this must never be a SILENT zero: the
   * employee only recovers it by filing their return, so a person has to be told. The Salary page surfaces this; the
   * caller of this function must too.
   */
  excessMinor: number;
}

/**
 * PURE — the `tds_192` function for ONE employee-month.
 *   tds_192(annualGross: Money, ytdDeducted: Money | null, monthsRemaining: Number) → Money
 * Whole rupees, never negative (payroll cannot refund). A missing year-to-date (no TDS head yet) is ₹0.
 * `onResult` (optional) receives the full outcome, including the over-deduction the Money result cannot carry.
 */
export function makeTds192(
  ctx: Tds192Context,
  onResult?: (o: Tds192Outcome) => void,
): (annual: unknown, ytd: unknown, months: unknown) => MoneyValue {
  return (annual, ytd, months) => {
    assertVerifiedLaw(ctx.regime, ctx.asOf);
    if (!isMoney(annual)) refuse('PAY-DSL-TYPE-015', 'tds_192: the annual gross must be Money');
    const a = annual as MoneyValue;
    if (a.currency !== ctx.currency) refuse('PAY-DSL-TYPE-011', `tds_192: currency mismatch (${a.currency} vs ${ctx.currency})`);
    if (ytd !== null && ytd !== undefined && !isMoney(ytd)) refuse('PAY-DSL-TYPE-015', 'tds_192: year-to-date must be Money');
    if (typeof months !== 'number' || !Number.isFinite(months)) refuse('PAY-DSL-TYPE-015', 'tds_192: months remaining must be a Number');

    const rupees = cumulativeMonthlyTds({
      annualGross: a.minor / 100,
      regime: ctx.regime,
      ytdDeducted: isMoney(ytd) ? (ytd as MoneyValue).minor / 100 : 0,
      monthsRemaining: months as number,
      asOf: ctx.asOf,
    });
    const tdsMinor = Math.round(rupees.tds * 100);
    if (onResult) {
      onResult({
        tdsMinor, annualTaxMinor: Math.round(rupees.annualTax * 100),
        ytdMinor: Math.round(rupees.ytdDeducted * 100), excessMinor: Math.round(rupees.excess * 100),
      });
    }
    return makeMoney(tdsMinor, ctx.currency);
  };
}

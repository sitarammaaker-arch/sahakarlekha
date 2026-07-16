/**
 * TDS u/s 192 projection (ECR-14 — salary TDS).
 *
 * Projects an employee's annual income to an annual income-tax and a monthly TDS, under
 * the new (115BAC) or old regime. Pure & deterministic → unit-tested by
 * scripts/test-tds-projection.mjs.
 *
 * THE SLABS ARE NO LONGER HARDCODED HERE. They live in rules/incomeTax.ts as dated data
 * (ADR-0008), because this file used to apply FY 2024-25 law in FY 2026-27 with no date
 * parameter and no way to know it was doing so. The figures are unchanged; what changed
 * is that a caller can now ask WHICH year's law produced them, and is TOLD when that law
 * does not cover the date in question (`stale`). The values still need verifying against
 * the current Finance Act — see rules/incomeTax.ts.
 *
 * Simplifications (documented): standard deduction only for new regime; old-regime Chapter
 * VI-A deductions taken as an input total; surcharge (very high income) not modelled.
 */
import { resolveTaxBasis, describeBasis, type TaxBasis, type Slabs, type TaxRegime } from './rules/incomeTax';

export type { TaxRegime };
export { describeBasis, type TaxBasis };

const r0 = (n: number) => Math.round(n);

/** Today, as an ISO date. Isolated so the pure functions can be given a date instead. */
const todayIso = () => new Date().toISOString().slice(0, 10);

// Cumulative slab tax: slabs are [upperLimit, rate] applied to the band above the previous limit.
function slabTax(taxable: number, slabs: Slabs): number {
  let tax = 0, prev = 0;
  for (const [limit, rate] of slabs) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, limit) - prev) * rate;
    prev = limit;
  }
  return tax;
}

/**
 * Annual income-tax incl. cess, after standard deduction + 87A rebate.
 *
 * `asOf` selects the year's law. It defaults to today — which is exactly what this
 * function did implicitly before, except now it is a choice that can be overridden, and
 * a wrong year is reportable rather than invisible. Use `annualIncomeTaxWithBasis` when
 * you intend to SHOW a figure to a human: they are entitled to know which law it used.
 */
export function annualIncomeTax(grossAnnual: number, regime: TaxRegime, otherDeductions = 0, asOf?: string): number {
  return annualIncomeTaxWithBasis(grossAnnual, regime, otherDeductions, asOf).tax;
}

/** The same computation, plus the provenance a UI must display (ADR-0008 auditability). */
export function annualIncomeTaxWithBasis(
  grossAnnual: number,
  regime: TaxRegime,
  otherDeductions = 0,
  asOf?: string,
): { tax: number; basis: TaxBasis } {
  const basis = resolveTaxBasis(asOf || todayIso());
  const s = basis.set;
  const gross = Math.max(0, grossAnnual || 0);
  const std = s.stdDeduction[regime];
  const deductions = regime === 'old' ? Math.max(0, otherDeductions || 0) : 0;
  const taxable = Math.max(0, gross - std - deductions);
  let tax = slabTax(taxable, s[regime]);
  // Section 87A rebate — nil tax up to the regime's taxable-income limit.
  if (taxable <= s.rebateLimit[regime]) tax = 0;
  return { tax: r0(tax * s.cess), basis };
}

/** Monthly TDS = annual tax spread over the remaining months of the year. */
export function monthlyTds(annualTax: number, monthsRemaining = 12): number {
  return r0(Math.max(0, annualTax) / Math.max(1, monthsRemaining));
}

/** Project a monthly gross to an annual figure. */
export function projectAnnualIncome(monthlyGross: number): number {
  return Math.max(0, monthlyGross || 0) * 12;
}

/** Convenience: monthly TDS suggestion from a monthly gross. */
export function suggestMonthlyTds(monthlyGross: number, regime: TaxRegime, otherDeductions = 0, monthsRemaining = 12, asOf?: string): number {
  return monthlyTds(annualIncomeTax(projectAnnualIncome(monthlyGross), regime, otherDeductions, asOf), monthsRemaining);
}

/** The provenance line for the salary screen — "which law is this number from?". */
export function tdsBasisNote(asOf?: string): string {
  return describeBasis(resolveTaxBasis(asOf || todayIso()));
}

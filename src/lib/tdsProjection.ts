/**
 * TDS u/s 192 projection (ECR-14 — salary TDS).
 *
 * Projects an employee's annual income to an annual income-tax and a monthly TDS, under
 * the new (115BAC) or old regime. FY 2024-25 slabs. Pure & deterministic → unit-tested by
 * scripts/test-tds-projection.mjs.
 *
 * Simplifications (documented): standard deduction only for new regime; old-regime Chapter
 * VI-A deductions taken as an input total; surcharge (very high income) not modelled.
 */
export type TaxRegime = 'new' | 'old';

const r0 = (n: number) => Math.round(n);

// Cumulative slab tax: slabs are [upperLimit, rate] applied to the band above the previous limit.
function slabTax(taxable: number, slabs: [number, number][]): number {
  let tax = 0, prev = 0;
  for (const [limit, rate] of slabs) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, limit) - prev) * rate;
    prev = limit;
  }
  return tax;
}

// FY 2024-25 new regime (115BAC).
const NEW_SLABS: [number, number][] = [[300000, 0], [700000, 0.05], [1000000, 0.10], [1200000, 0.15], [1500000, 0.20], [Infinity, 0.30]];
// Old regime.
const OLD_SLABS: [number, number][] = [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]];

/** Annual income-tax incl. 4% cess, after standard deduction + 87A rebate. */
export function annualIncomeTax(grossAnnual: number, regime: TaxRegime, otherDeductions = 0): number {
  const gross = Math.max(0, grossAnnual || 0);
  const std = regime === 'new' ? 75000 : 50000;
  const deductions = regime === 'old' ? Math.max(0, otherDeductions || 0) : 0;
  const taxable = Math.max(0, gross - std - deductions);
  let tax = slabTax(taxable, regime === 'new' ? NEW_SLABS : OLD_SLABS);
  // Section 87A rebate — nil tax up to ₹7L (new) / ₹5L (old) taxable income.
  const rebateLimit = regime === 'new' ? 700000 : 500000;
  if (taxable <= rebateLimit) tax = 0;
  return r0(tax * 1.04); // + 4% health & education cess
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
export function suggestMonthlyTds(monthlyGross: number, regime: TaxRegime, otherDeductions = 0, monthsRemaining = 12): number {
  return monthlyTds(annualIncomeTax(projectAnnualIncome(monthlyGross), regime, otherDeductions), monthsRemaining);
}

// TDS u/s 192 projection (ECR-14) — mirrors src/lib/tdsProjection.ts (FY 2024-25).
// Run: node scripts/test-tds-projection.mjs

const r0 = (n) => Math.round(n);
function slabTax(taxable, slabs) {
  let tax = 0, prev = 0;
  for (const [limit, rate] of slabs) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, limit) - prev) * rate;
    prev = limit;
  }
  return tax;
}
const NEW_SLABS = [[300000, 0], [700000, 0.05], [1000000, 0.10], [1200000, 0.15], [1500000, 0.20], [Infinity, 0.30]];
const OLD_SLABS = [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]];
function annualIncomeTax(grossAnnual, regime, otherDeductions = 0) {
  const gross = Math.max(0, grossAnnual || 0);
  const std = regime === 'new' ? 75000 : 50000;
  const deductions = regime === 'old' ? Math.max(0, otherDeductions || 0) : 0;
  const taxable = Math.max(0, gross - std - deductions);
  let tax = slabTax(taxable, regime === 'new' ? NEW_SLABS : OLD_SLABS);
  const rebateLimit = regime === 'new' ? 700000 : 500000;
  if (taxable <= rebateLimit) tax = 0;
  return r0(tax * 1.04);
}
const monthlyTds = (annualTax, m = 12) => r0(Math.max(0, annualTax) / Math.max(1, m));
const projectAnnualIncome = (mg) => Math.max(0, mg || 0) * 12;
const suggestMonthlyTds = (mg, regime, d = 0, m = 12) => monthlyTds(annualIncomeTax(projectAnnualIncome(mg), regime, d), m);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. New regime — 87A rebate: taxable ≤ 7L → nil tax.
ok(annualIncomeTax(700000, 'new') === 0, 'new: gross 7L → taxable 6.25L ≤ 7L → nil (87A)');
ok(annualIncomeTax(775000, 'new') === 0, 'new: gross 7.75L → taxable 7L → nil (at rebate limit)');

// 2. New regime — above rebate: gross 10L → taxable 9.25L.
// 3–7L @5% = 20000; 7–9.25L @10% = 22500; tax 42500; +4% cess = 44200.
ok(annualIncomeTax(1000000, 'new') === r0(42500 * 1.04), 'new: 10L gross → ₹44,200 (incl cess)');

// 3. Old regime — 87A: taxable ≤ 5L → nil.
ok(annualIncomeTax(550000, 'old') === 0, 'old: gross 5.5L → taxable 5L → nil (87A)');
// Old: gross 10L → taxable 9.5L. 2.5–5L @5% = 12500; 5–9.5L @20% = 90000; tax 102500; +cess = 106600.
ok(annualIncomeTax(1000000, 'old') === r0(102500 * 1.04), 'old: 10L gross → ₹1,06,600');
// Old with 80C deductions 1.5L: gross 10L → taxable 8L. 12500 + 60000 = 72500; +cess = 75400.
ok(annualIncomeTax(1000000, 'old', 150000) === r0(72500 * 1.04), 'old: deductions reduce taxable');

// 4. Monthly TDS spreads annual tax.
ok(monthlyTds(44200, 12) === r0(44200 / 12), 'monthly = annual / 12');
ok(monthlyTds(0) === 0, 'no tax → no TDS');

// 5. suggestMonthlyTds end-to-end from a monthly gross.
ok(suggestMonthlyTds(50000, 'new') === monthlyTds(annualIncomeTax(600000, 'new'), 12), 'suggest projects 12× then taxes');
ok(suggestMonthlyTds(30000, 'new') === 0, 'monthly 30k (annual 3.6L) → nil TDS');

// 6. Standard deduction 75k (new): gross 8.75L → taxable 8L > 7L rebate → taxed.
// 3–7L @5% = 20000; 7–8L @10% = 10000; tax 30000; +cess = 31200.
ok(annualIncomeTax(875000, 'new') === r0(30000 * 1.04), 'new: 8.75L gross → ₹31,200 (taxable 8L, no rebate)');

console.log(`\nTDS projection (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

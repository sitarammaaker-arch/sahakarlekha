// Payroll statutory engine (ECR-14 — PF/ESI/PT/TDS) — mirrors src/lib/payrollStatutory.ts.
// Run: node scripts/test-payroll-statutory.mjs

const r2 = (n) => Math.round(n * 100) / 100;
const PF_CEILING = 15000, ESI_THRESHOLD = 21000;
function computeStatutory(input) {
  const pfCeiling = input.pfCeiling ?? PF_CEILING;
  const esiThreshold = input.esiThreshold ?? ESI_THRESHOLD;
  const basic = Math.max(0, input.basic || 0);
  const allowances = Math.max(0, input.allowances || 0);
  const gross = r2(basic + allowances);
  const pfWage = Math.min(basic, pfCeiling);
  const pfEmployee = input.pfApplicable ? r2(0.12 * pfWage) : 0;
  const pfEmployer = input.pfApplicable ? r2(0.13 * pfWage) : 0;
  const esiEligible = !!input.esiApplicable && gross > 0 && gross <= esiThreshold;
  const esiEmployee = esiEligible ? r2(0.0075 * gross) : 0;
  const esiEmployer = esiEligible ? r2(0.0325 * gross) : 0;
  const pt = r2(Math.max(0, input.pt || 0));
  const tds = r2(Math.max(0, input.tds || 0));
  const totalEmployeeDeductions = r2(pfEmployee + esiEmployee + pt + tds);
  const employerContributions = r2(pfEmployer + esiEmployer);
  const netSalary = r2(gross - totalEmployeeDeductions);
  return { gross, pfEmployee, pfEmployer, esiEligible, esiEmployee, esiEmployer, pt, tds, totalEmployeeDeductions, employerContributions, netSalary };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. PF below ceiling: basic 10000 → employee 1200, employer 1300.
const a = computeStatutory({ basic: 10000, allowances: 2000, pfApplicable: true, esiApplicable: true });
ok(a.gross === 12000, 'gross = basic + allowances');
ok(a.pfEmployee === 1200 && a.pfEmployer === 1300, 'PF 12%/13% of basic below ceiling');
ok(a.esiEligible && a.esiEmployee === 90 && a.esiEmployer === 390, 'ESI 0.75%/3.25% of 12000 (eligible ≤ 21000)');
ok(a.totalEmployeeDeductions === 1290 && a.netSalary === 10710, 'total deductions + net');

// 2. PF wage ceiling: basic 30000 → PF on 15000 only → employee 1800, employer 1950.
const b = computeStatutory({ basic: 30000, allowances: 5000, pfApplicable: true, esiApplicable: true });
ok(b.pfEmployee === 1800 && b.pfEmployer === 1950, 'PF capped at ₹15,000 wage');

// 3. ESI threshold: gross 25000 > 21000 → no ESI.
ok(b.esiEligible === false && b.esiEmployee === 0 && b.esiEmployer === 0, 'ESI not applicable when gross > 21000');

// 4. Applicability off → zero PF/ESI.
const c = computeStatutory({ basic: 10000, allowances: 0, pfApplicable: false, esiApplicable: false });
ok(c.pfEmployee === 0 && c.pfEmployer === 0 && c.esiEmployee === 0, 'no PF/ESI when not applicable');
ok(c.netSalary === 10000, 'net = gross when nothing deducted');

// 5. PT + TDS inputs flow into deductions + net.
const d = computeStatutory({ basic: 12000, allowances: 0, pfApplicable: true, esiApplicable: true, pt: 200, tds: 500 });
ok(d.pt === 200 && d.tds === 500, 'PT/TDS passed through');
ok(d.totalEmployeeDeductions === r2(1440 + 90 + 200 + 500), 'deductions include PF + ESI + PT + TDS');
ok(d.netSalary === r2(12000 - d.totalEmployeeDeductions), 'net after all deductions');

// 6. Balance identity: gross + employerContributions === net + all credits.
const allCredits = d.netSalary + (d.pfEmployee + d.pfEmployer) + (d.esiEmployee + d.esiEmployer) + d.pt + d.tds;
ok(r2(d.gross + d.employerContributions) === r2(allCredits), 'accrual balances: Dr(gross+employer) = Cr(net+payables)');

// 7. Guards: negative inputs clamped.
const e = computeStatutory({ basic: -5000, allowances: -100, pfApplicable: true, esiApplicable: true });
ok(e.gross === 0 && e.pfEmployee === 0 && e.netSalary === 0, 'negative inputs clamped to 0');

console.log(`\nPayroll statutory (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

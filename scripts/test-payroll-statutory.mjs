// Payroll statutory engine (ECR-14 — PF/ESI/PT/TDS).
// Imports the REAL src/lib/payrollStatutory.ts (which imports @/lib/money) via an '@/'-resolving
// loader — this test guards the actual engine, not a mirror copy of it.
// Run: node scripts/test-payroll-statutory.mjs

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { computeStatutory } = await import(abs('../src/lib/payrollStatutory.ts'));
const r2 = (n) => Math.round(n * 100) / 100; // for assertion comparisons only

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

// 8. T-02 born-exact: PF/ESI via applyPercent + minor-unit sums — deductions & net reconcile
//    to the paisa (compared in integer paise to avoid float-equality noise).
const p = (r) => Math.round(r * 100);
const g = computeStatutory({ basic: 15007, allowances: 2000, pfApplicable: true, esiApplicable: true, pt: 200 });
ok(g.esiEligible, 'ESI eligible (gross ₹17007 ≤ 21000)');
ok(p(g.pfEmployee) + p(g.esiEmployee) + p(g.pt) + p(g.tds) === p(g.totalEmployeeDeductions), 'deductions = PF + ESI + PT + TDS exactly (integer paise)');
ok(p(g.gross) - p(g.totalEmployeeDeductions) === p(g.netSalary), 'netSalary = gross − deductions to the paisa');
ok(p(g.pfEmployer) + p(g.esiEmployer) === p(g.employerContributions), 'employer contributions sum exactly');

console.log(`\nPayroll statutory (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

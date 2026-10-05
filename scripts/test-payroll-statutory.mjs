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
const ASOF = '2026-10-01';   // asOf is REQUIRED now — the dated parameters (lib/rules/epfEsi.ts) are read by date; the figures below are unchanged
const r2 = (n) => Math.round(n * 100) / 100; // for assertion comparisons only

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. PF below ceiling: basic 10000 → employee 1200, employer 1300.
const a = computeStatutory({ asOf: ASOF, basic: 10000, allowances: 2000, pfApplicable: true, esiApplicable: true });
ok(a.gross === 12000, 'gross = basic + allowances');
ok(a.pfEmployee === 1200 && a.pfEmployer === 1300, 'PF 12%/13% of basic below ceiling');
ok(a.esiEligible && a.esiEmployee === 90 && a.esiEmployer === 390, 'ESI 0.75%/3.25% of 12000 (eligible ≤ 21000)');
ok(a.totalEmployeeDeductions === 1290 && a.netSalary === 10710, 'total deductions + net');

// 2. PF wage ceiling: basic 30000 → PF on 15000 only → employee 1800, employer 1950.
const b = computeStatutory({ asOf: ASOF, basic: 30000, allowances: 5000, pfApplicable: true, esiApplicable: true });
ok(b.pfEmployee === 1800 && b.pfEmployer === 1950, 'PF capped at ₹15,000 wage');

// 3. ESI threshold: gross 25000 > 21000 → no ESI.
ok(b.esiEligible === false && b.esiEmployee === 0 && b.esiEmployer === 0, 'ESI not applicable when gross > 21000');

// 4. Applicability off → zero PF/ESI.
const c = computeStatutory({ asOf: ASOF, basic: 10000, allowances: 0, pfApplicable: false, esiApplicable: false });
ok(c.pfEmployee === 0 && c.pfEmployer === 0 && c.esiEmployee === 0, 'no PF/ESI when not applicable');
ok(c.netSalary === 10000, 'net = gross when nothing deducted');

// 5. PT + TDS inputs flow into deductions + net.
const d = computeStatutory({ asOf: ASOF, basic: 12000, allowances: 0, pfApplicable: true, esiApplicable: true, pt: 200, tds: 500 });
ok(d.pt === 200 && d.tds === 500, 'PT/TDS passed through');
ok(d.totalEmployeeDeductions === r2(1440 + 90 + 200 + 500), 'deductions include PF + ESI + PT + TDS');
ok(d.netSalary === r2(12000 - d.totalEmployeeDeductions), 'net after all deductions');

// 6. Balance identity: gross + employerContributions === net + all credits.
const allCredits = d.netSalary + (d.pfEmployee + d.pfEmployer) + (d.esiEmployee + d.esiEmployer) + d.pt + d.tds;
ok(r2(d.gross + d.employerContributions) === r2(allCredits), 'accrual balances: Dr(gross+employer) = Cr(net+payables)');

// 7. Guards: negative inputs clamped.
const e = computeStatutory({ asOf: ASOF, basic: -5000, allowances: -100, pfApplicable: true, esiApplicable: true });
ok(e.gross === 0 && e.pfEmployee === 0 && e.netSalary === 0, 'negative inputs clamped to 0');

// 8. T-02 born-exact: PF/ESI via applyPercent + minor-unit sums — deductions & net reconcile
//    to the paisa (compared in integer paise to avoid float-equality noise).
const p = (r) => Math.round(r * 100);
const g = computeStatutory({ asOf: ASOF, basic: 15007, allowances: 2000, pfApplicable: true, esiApplicable: true, pt: 200 });
ok(g.esiEligible, 'ESI eligible (gross ₹17007 ≤ 21000)');
ok(p(g.pfEmployee) + p(g.esiEmployee) + p(g.pt) + p(g.tds) === p(g.totalEmployeeDeductions), 'deductions = PF + ESI + PT + TDS exactly (integer paise)');
ok(p(g.gross) - p(g.totalEmployeeDeductions) === p(g.netSalary), 'netSalary = gross − deductions to the paisa');
ok(p(g.pfEmployer) + p(g.esiEmployer) === p(g.employerContributions), 'employer contributions sum exactly');

// 9. Manual overrides — the society fine-tunes a statutory figure; the override REPLACES the auto
//    amount and flows into totals/net; a null override leaves auto untouched.
const base = computeStatutory({ asOf: ASOF, basic: 30000, allowances: 5000, pfApplicable: true, esiApplicable: true });
ok(base.pfEmployee === 1800 && base.pfEmployer === 1950, 'baseline PF (auto) before override');

// Override employee PF to 2000 and employer PF to 2200 — used as-is; net drops by the extra employee PF.
const ov = computeStatutory({ asOf: ASOF, basic: 30000, allowances: 5000, pfApplicable: true, esiApplicable: true,
  pfEmployeeOverride: 2000, pfEmployerOverride: 2200 });
ok(ov.pfEmployee === 2000 && ov.pfEmployer === 2200, 'PF overrides used verbatim (employee + employer)');
ok(ov.totalEmployeeDeductions === 2000, 'employee deductions follow the override (2000, no ESI, gross > 21000)');
ok(ov.netSalary === r2(35000 - 2000), 'net reflects the overridden employee PF');
ok(ov.employerContributions === 2200, 'employer contributions follow the employer override');

// Override wins even when auto-ineligible: ESI here is 0 (gross 35000 > 21000), but an override adds it.
const ovEsi = computeStatutory({ asOf: ASOF, basic: 30000, allowances: 5000, pfApplicable: true, esiApplicable: true,
  esiEmployeeOverride: 150, esiEmployerOverride: 650 });
ok(ovEsi.esiEmployee === 150 && ovEsi.esiEmployer === 650, 'ESI override applies even when auto-ineligible');
ok(ovEsi.totalEmployeeDeductions === r2(1800 + 150), 'overridden ESI joins the employee deductions');

// null / undefined override ⇒ identical to auto (no accidental zeroing).
const ovNull = computeStatutory({ asOf: ASOF, basic: 30000, allowances: 5000, pfApplicable: true, esiApplicable: true,
  pfEmployeeOverride: null, esiEmployeeOverride: undefined });
ok(ovNull.pfEmployee === base.pfEmployee && ovNull.totalEmployeeDeductions === base.totalEmployeeDeductions,
  'null/undefined override = auto (unchanged)');

// An explicit 0 override IS a value (not "auto") — e.g. waive employee PF for one payslip.
const ovZero = computeStatutory({ asOf: ASOF, basic: 30000, allowances: 5000, pfApplicable: true, esiApplicable: true, pfEmployeeOverride: 0 });
ok(ovZero.pfEmployee === 0 && ovZero.netSalary === 35000, 'a 0 override waives that deduction (0 ≠ auto)');

// ── PARITY with the constants this code used BEFORE the parameters became dated data ─────────────────────────────────
// An independent restatement of the old logic (15000 / 12 / 13 / 21000 / 0.75 / 3.25) against the new, date-driven one,
// over a grid of pay levels including both thresholds on either side. If moving the numbers had changed ANY slip, this fails.
{
  const money = await import(abs('../src/lib/money.ts'));
  const { toMinor, toRupees, applyPercent } = money;
  const old = (basic, allow, pf, esi) => {
    const bm = toMinor(basic), gm = bm + toMinor(allow);
    const pfWage = Math.min(bm, toMinor(15000));
    const pfEe = pf ? applyPercent(pfWage, 12).minor : 0, pfEr = pf ? applyPercent(pfWage, 13).minor : 0;
    const el = esi && gm > 0 && gm <= toMinor(21000);
    return { pfEe: toRupees(pfEe), pfEr: toRupees(pfEr), esiEe: toRupees(el ? applyPercent(gm, 0.75).minor : 0), esiEr: toRupees(el ? applyPercent(gm, 3.25).minor : 0), elig: el };
  };
  let n = 0, bad = 0;
  const basics = [0, 1, 4999.99, 8000, 12500, 14999.99, 15000, 15000.01, 15001, 18000, 20000, 20999.99, 21000, 21001, 24999, 25000, 25001, 40000, 90000];
  const allowances = [0, 500, 3000, 6000, 12000];
  for (const b of basics) for (const a of allowances) for (const pf of [true, false]) for (const esi of [true, false]) for (const asOf of ['2024-04-01', '2026-10-01', '2030-01-01']) {
    const r = computeStatutory({ asOf, basic: b, allowances: a, pfApplicable: pf, esiApplicable: esi });
    const o = old(b, a, pf, esi);
    n++;
    if (r.pfEmployee !== o.pfEe || r.pfEmployer !== o.pfEr || r.esiEmployee !== o.esiEe || r.esiEmployer !== o.esiEr || r.esiEligible !== o.elig) {
      bad++; if (bad < 4) console.error('  ✗ mismatch', { b, a, pf, esi, asOf, got: [r.pfEmployee, r.pfEmployer, r.esiEmployee, r.esiEmployer], want: o });
    }
  }
  ok(bad === 0, `date-driven result = the old hard-coded result for all ${n} combinations (pay levels × PF/ESI flags × 3 dates), thresholds included`);
  const r1 = computeStatutory({ asOf: '2026-10-01', basic: 25000, allowances: 15000, pfApplicable: true, esiApplicable: true });
  ok(r1.pfEmployee === 1800 && r1.pfEmployer === 1950, 'basic ₹25,000: PF ₹1,800 employee / ₹1,950 employer (₹15,000 ceiling) — unchanged');
  ok(r1.basis.unverified.length === 9 && r1.basis.stale.length === 0, 'the result says its PF/ESI parameters are unverified (9) and none stale');
  ok(computeStatutory({ asOf: '2016-06-01', basic: 10000, allowances: 0, pfApplicable: true, esiApplicable: true }).basis.stale.includes('esi.wageLimit'), 'a month before the ESI limit\'s established start is flagged stale in the result');
  let threw = false;
  try { computeStatutory({ basic: 10000, allowances: 0, pfApplicable: true, esiApplicable: true }); } catch { threw = true; }
  // asOf is required by the TYPE; at run time a missing one is an unreadable date → stale, never "today"
  ok(!threw && computeStatutory({ basic: 10000, allowances: 0, pfApplicable: true, esiApplicable: true }).basis.stale.length > 0, 'a MISSING asOf is flagged stale — it is never silently replaced by today');
}


console.log(`\nPayroll statutory (pure): ${pass} passed, ${fail} failed`);
process.exitCode = fail > 0 ? 1 : 0;

// Salary accrual lines (src/lib/payroll/accrualLines.ts) — the ONE builder behind addSalaryRecord AND
// updateSalaryRecord. Pins:
//   - the statutory booking is exactly what addSalaryRecord booked before the refactor (reference copy below);
//   - a slip with no statutory fields stays the legacy net-basis Dr 5201 / Cr Salary Payable;
//   - the booking balances to the paisa for a consistent slip and reports `balanced:false` for an inconsistent one;
//   - any accrual-relevant field change is detected (the old re-sync only looked at netSalary and dropped the split);
//   - DataContext uses the builder in BOTH places and no longer rewrites the accrual as net-only.
// Run: node scripts/test-salary-accrual-lines.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const A = await import(pathToFileURL(path.join(SRC, 'lib/payroll/accrualLines.ts')).href);
const M = await import(pathToFileURL(path.join(SRC, 'lib/money.ts')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const shape = (lines) => lines.map((l) => `${l.type} ${l.accountId} ${l.amount}`);

// Reference: the inline logic addSalaryRecord used BEFORE the refactor (kept verbatim to prove no behaviour change).
function reference(base, payableAcc) {
  const r2 = (n) => M.toRupees(M.toMinor(n));
  const pfEmp = base.pfEmployee || 0, pfEr = base.pfEmployer || 0;
  const esiEmp = base.esiEmployee || 0, esiEr = base.esiEmployer || 0;
  const ptAmt = base.pt || 0, tdsAmt = base.tds || 0;
  const hasStatutory = (pfEmp + pfEr + esiEmp + esiEr + ptAmt + tdsAmt) > 0;
  const id = () => 'x';
  if (hasStatutory) {
    const gross = r2((base.basicSalary || 0) + (base.allowances || 0));
    const drTotal = r2(gross + pfEr + esiEr);
    const lines = [
      { id: id(), accountId: '5201', type: 'Dr', amount: drTotal },
      { id: id(), accountId: payableAcc, type: 'Cr', amount: base.netSalary },
    ];
    if (pfEmp + pfEr > 0) lines.push({ id: id(), accountId: '2203', type: 'Cr', amount: r2(pfEmp + pfEr) });
    if (esiEmp + esiEr > 0) lines.push({ id: id(), accountId: '2204', type: 'Cr', amount: r2(esiEmp + esiEr) });
    if (ptAmt > 0) lines.push({ id: id(), accountId: '2207', type: 'Cr', amount: r2(ptAmt) });
    if (tdsAmt > 0) lines.push({ id: id(), accountId: '2202', type: 'Cr', amount: r2(tdsAmt) });
    return { lines, drTotal, hasStatutory };
  }
  return { lines: [{ id: id(), accountId: '5201', type: 'Dr', amount: base.netSalary }, { id: id(), accountId: payableAcc, type: 'Cr', amount: base.netSalary }], drTotal: base.netSalary, hasStatutory };
}

const cases = {
  'PF + PT + TDS': { basicSalary: 20000, allowances: 5000, pfEmployee: 1800, pfEmployer: 1800, esiEmployee: 0, esiEmployer: 0, pt: 200, tds: 500, netSalary: 22500 },
  'PF + ESI': { basicSalary: 15000, allowances: 3000, pfEmployee: 1800, pfEmployer: 1800, esiEmployee: 135, esiEmployer: 585, pt: 0, tds: 0, netSalary: 16065 },
  'ESI only': { basicSalary: 12000, allowances: 0, esiEmployee: 90, esiEmployer: 390, netSalary: 11910 },
  'TDS only': { basicSalary: 90000, allowances: 10000, tds: 4166.67, netSalary: 95833.33 },
  'paise amounts': { basicSalary: 10000.1, allowances: 0.2, pfEmployee: 1200.01, pfEmployer: 1200.01, pt: 0.29, netSalary: 8800.0 + 0.0 },
  'legacy net only': { basicSalary: 20000, allowances: 0, netSalary: 20000 },
  'legacy zero fields': { basicSalary: 18000, allowances: 2000, pfEmployee: 0, pfEmployer: 0, esiEmployee: 0, esiEmployer: 0, pt: 0, tds: 0, netSalary: 20000 },
};

for (const [name, rec] of Object.entries(cases)) {
  const got = A.salaryAccrualLines(rec, '2103', () => 'x');
  const want = reference(rec, '2103');
  ok(JSON.stringify(shape(got.lines)) === JSON.stringify(shape(want.lines)), `${name}: lines identical to the pre-refactor booking`);
  ok(got.drTotal === want.drTotal && got.hasStatutory === want.hasStatutory, `${name}: drTotal / hasStatutory identical`);
}

// Balanced for consistent slips; not balanced when the net does not reconcile.
ok(A.salaryAccrualLines(cases['PF + PT + TDS'], '2103').balanced, 'consistent statutory slip balances to the paisa');
ok(A.salaryAccrualLines(cases['PF + ESI'], '2103').balanced, 'consistent PF + ESI slip balances');
ok(A.salaryAccrualLines(cases['legacy net only'], '2103').balanced, 'legacy net-only slip balances');
ok(!A.salaryAccrualLines({ ...cases['PF + PT + TDS'], netSalary: 23000 }, '2103').balanced, 'a slip whose net disagrees with its deductions is reported NOT balanced');
ok(!A.salaryAccrualLines({ ...cases['PF + PT + TDS'], pt: 300 }, '2103').balanced, 'changing PT without changing net is reported NOT balanced');

// Structure of the statutory booking.
const st = A.salaryAccrualLines(cases['PF + PT + TDS'], '2103');
ok(st.lines.length === 5, 'statutory slip with PF + PT + TDS → 5 lines (expense, net payable, EPF, PT, TDS)');
ok(st.lines[0].accountId === '5201' && st.lines[0].type === 'Dr' && st.lines[0].amount === 26800, 'Dr 5201 = gross 25,000 + employer PF 1,800');
ok(st.lines.some((l) => l.accountId === '2203' && l.amount === 3600), 'Cr 2203 = employee PF + employer PF');
ok(st.lines.some((l) => l.accountId === '2207' && l.amount === 200) && st.lines.some((l) => l.accountId === '2202' && l.amount === 500), 'Cr 2207 PT and Cr 2202 TDS present');
ok(!st.lines.some((l) => l.accountId === '2204'), 'no ESI line when ESI is zero');
const leg = A.salaryAccrualLines(cases['legacy net only'], '2103');
ok(leg.lines.length === 2 && !leg.hasStatutory, 'legacy slip → exactly Dr 5201 / Cr payable');
ok(A.salaryAccrualLines(cases['legacy net only'], 'SAL-PAY-X').lines[1].accountId === 'SAL-PAY-X', 'the payable account passed in is the one credited');
ok(new Set(st.lines.map((l) => l.id)).size === st.lines.length, 'every line gets a distinct id by default');

// Change detection (the old re-sync only looked at netSalary).
const base = cases['PF + PT + TDS'];
ok(!A.salaryAccrualChanged(base, { ...base }), 'identical slips → no change');
for (const k of ['basicSalary', 'allowances', 'netSalary', 'pfEmployee', 'pfEmployer', 'esiEmployee', 'esiEmployer', 'pt', 'tds']) {
  ok(A.salaryAccrualChanged(base, { ...base, [k]: (base[k] || 0) + 1 }), `a change in ${k} is detected`);
}
ok(!A.salaryAccrualChanged({ basicSalary: 1, allowances: 0, netSalary: 1 }, { basicSalary: 1, allowances: 0, netSalary: 1, pt: 0, tds: undefined }), 'undefined and 0 are the same value');

// DataContext wiring: both paths use the builder; the net-only rewrite is gone.
const dc = readFileSync(path.join(SRC, 'contexts/DataContext.tsx'), 'utf8');
ok((dc.match(/salaryAccrualLines\(/g) || []).length >= 3, 'DataContext calls salaryAccrualLines in add + update (pre-check and re-sync)');
ok(!/accountId: '5201', type: 'Dr', amount: merged\.netSalary/.test(dc), 'updateSalaryRecord no longer rewrites the accrual as Dr 5201 / Cr 2103 net-only');
ok(/salaryAccrualChanged\(oldRecord, merged\)/.test(dc), 'updateSalaryRecord re-syncs on any accrual-relevant change, not only netSalary');

console.log(`salary accrual lines: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

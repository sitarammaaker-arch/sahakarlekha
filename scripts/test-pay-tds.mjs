// Payroll salary-TDS (P2.1). The claim to prove: the NEW formula engine and the Salary page's cumulative rule give
// the SAME TDS, paisa for paisa, month by month, over a whole financial year — because `tds_192` calls the very
// code the Salary page calls (lib/payroll/cumulativeTds.ts). Also proves the refusals: an employee-month on law that
// is not verified (FY 2025-26, old regime, a period no slab set covers) is REFUSED, never guessed.
//
// Run: node scripts/test-pay-tds.mjs   (npm run test:pay-tds)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

// '@/'-resolving loader — the same one test-payroll-statutory.mjs uses.
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

let T, CT, CC, CP, EV, RP;
try {
  T = await import(abs('../src/lib/pay/tax/salaryTds.ts'));
  CT = await import(abs('../src/lib/payroll/cumulativeTds.ts'));
  CC = await import(abs('../src/lib/pay/formula/compile.ts'));
  CP = await import(abs('../src/lib/pay/calc/components.ts'));
  EV = await import(abs('../src/lib/pay/formula/evaluator.ts'));
  RP = await import(abs('../src/lib/pay/posting/runPosting.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗ FAIL:', m); } };
const throws = (fn, re, m) => { try { fn(); fail++; console.error('  ✗ FAIL (did not throw):', m); } catch (e) { if (re.test(e.message)) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗ FAIL (wrong error):', m, '→', e.message); } } };

const money = (rupees) => EV.makeMoney(Math.round(rupees * 100), 'INR');
const FY_2026_27 = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'];

// ── the real engine, set up the way pay-run sets it up ────────────────────────────────────────────────────────
const typeBase = {
  vars: { BASIC: 'Money', DA: 'Money', HRA: 'Money', DEP_ALLOW: 'Money', CONSOLIDATED: 'Money', STIPEND: 'Money', tax: 'Map', attendance: 'Map' },
  fns: { [T.TDS_192_NAME]: T.TDS_192_SIG },
};
const catalog = [
  { code: 'DA', source: 'formula "DA" :: Money let b = BASIC in b * 20%' },
  { code: 'HRA', source: 'formula "HRA" :: Money let b = BASIC in b * 40%' },
  { code: 'TDS', source: T.TDS_FORMULAS.TDS },
];
let set;
try { set = CC.compileFormulaCatalog(catalog, typeBase); } catch (e) { console.error('the TDS formula does not compile:', e.message); process.exit(1); }

/** Payroll: run the formula engine for ONE employee-month. */
function payrollTds({ basicRupees, regime, month, ytdRupees, monthsRemaining }) {
  const facts = {
    attendance: { paidDays: 30, lopDays: 0, otHours: 0 }, leave: [], loan: [],
    tax: { ytdByHead: { [T.TDS_YTD_HEAD]: Math.round(ytdRupees * 100) }, monthsRemaining, regime },
  };
  const out = CP.runComponents(set, {
    facts, currency: 'INR', fixedComponents: { BASIC: money(basicRupees) },
    fns: { [T.TDS_192_NAME]: T.makeTds192({ regime, asOf: `${month}-01`, currency: 'INR' }) },
  });
  return out;
}
const tdsOf = (res) => res.values.TDS;   // PlanResult = { values: { [code]: Value } }

console.log('\n0. the formula compiles with the whitelisted function and runs');
{
  const r = payrollTds({ basicRupees: 80000, regime: 'new', month: '2026-04', ytdRupees: 0, monthsRemaining: 12 });
  const v = tdsOf(r);
  ok(v && v.kind === 'money' && v.minor > 0, `TDS for basic ₹80,000 in April 2026 is a positive Money (${v && v.minor / 100} ₹)`);
}

console.log('\n1. GOLDEN PARITY — Salary rule vs the Payroll engine, every month of FY 2026-27 (new regime, verified law)');
for (const basic of [25000, 45000, 80000, 150000, 400000]) {
  let ytdSalary = 0, ytdPayroll = 0, mismatches = 0, total = 0;
  for (const month of FY_2026_27) {
    const monthsRemaining = CT.monthsLeftInFy(month);
    // Salary page: (basic + allowances) × 12, ytd of prior months
    const salary = CT.cumulativeMonthlyTds({ annualGross: (basic + basic * 0.2 + basic * 0.4) * 12, regime: 'new', ytdDeducted: ytdSalary, monthsRemaining, asOf: `${month}-01` }).tds;
    // Payroll: the real engine
    const pay = tdsOf(payrollTds({ basicRupees: basic, regime: 'new', month, ytdRupees: ytdPayroll, monthsRemaining })).minor / 100;
    if (salary !== pay) { mismatches++; console.error(`    ${month} basic ${basic}: salary ${salary} ≠ payroll ${pay}`); }
    ytdSalary += salary; ytdPayroll += pay; total += pay;
  }
  ok(mismatches === 0, `basic ₹${basic}: all 12 months equal (year's TDS ₹${total})`);
  ok(ytdSalary === ytdPayroll, `basic ₹${basic}: year-to-date ends equal (₹${ytdPayroll})`);
}

console.log('\n2. under-/over-deduction is ABSORBED by the remaining months (the CA-confirmed behaviour)');
{
  // started the year ₹40,000 short: both must still agree and finish the year at the full liability
  const basic = 150000; let ys = 40000, yp = 40000, bad = 0;
  for (const month of FY_2026_27) {
    const mr = CT.monthsLeftInFy(month);
    const s = CT.cumulativeMonthlyTds({ annualGross: basic * 1.6 * 12, regime: 'new', ytdDeducted: ys, monthsRemaining: mr, asOf: `${month}-01` }).tds;
    const p = tdsOf(payrollTds({ basicRupees: basic, regime: 'new', month, ytdRupees: yp, monthsRemaining: mr })).minor / 100;
    if (s !== p) bad++; ys += s; yp += p;
  }
  ok(bad === 0 && ys === yp, 'carry-in ₹40,000 already deducted: Salary and Payroll still agree every month');
  // over-deducted already: ytd beyond the year's liability → 0, never negative
  const over = tdsOf(payrollTds({ basicRupees: 80000, regime: 'new', month: '2026-10', ytdRupees: 9999999, monthsRemaining: 6 }));
  ok(over.minor === 0, 'already over-deducted ⇒ ₹0 (payroll cannot refund; never negative)');
}

console.log('\n3. low pay ⇒ nil (87A rebate), no spurious deduction');
{
  const v = tdsOf(payrollTds({ basicRupees: 25000, regime: 'new', month: '2026-04', ytdRupees: 0, monthsRemaining: 12 }));
  ok(v.minor === 0, 'basic ₹25,000 (₹4.8 lakh a year) ⇒ ₹0');
}

console.log('\n4. REFUSALS — law that is not verified is never guessed');
{
  const base = { basicRupees: 80000, ytdRupees: 0, monthsRemaining: 6 };
  throws(() => payrollTds({ ...base, regime: 'new', month: '2025-12' }), /PAY-TAX-501/, 'FY 2025-26 (slabs carried over, unsourced) ⇒ PAY-TAX-501');
  throws(() => payrollTds({ ...base, regime: 'old', month: '2026-10' }), /PAY-TAX-502/, 'OLD regime ⇒ PAY-TAX-502 (never verified)');
  throws(() => payrollTds({ ...base, regime: 'new', month: '2031-06' }), /PAY-TAX-503/, 'a period no slab set covers ⇒ PAY-TAX-503 (not the newest year\'s law)');
  throws(() => payrollTds({ ...base, regime: 'new', month: '2023-06' }), /PAY-TAX-503/, 'before the oldest slab set ⇒ PAY-TAX-503');
  let msg = ''; try { T.assertVerifiedLaw('new', '2025-12-01'); } catch (e) { msg = e.message; }
  ok(/enter TDS by hand/.test(msg), 'the refusal tells the admin what to do (enter TDS by hand)');
  let noThrow = true; try { T.assertVerifiedLaw('new', '2026-10-01'); } catch { noThrow = false; }
  ok(noThrow, 'FY 2026-27, new regime: law is verified — no refusal');
}

console.log('\n5. type / input guards');
{
  const f = T.makeTds192({ regime: 'new', asOf: '2026-10-01', currency: 'INR' });
  throws(() => f(5000, null, 6), /PAY-DSL-TYPE-015/, 'annual gross must be Money');
  throws(() => f(EV.makeMoney(100, 'USD'), null, 6), /PAY-DSL-TYPE-011/, 'a Money in another currency is refused');
  throws(() => f(money(1000000), 'x', 6), /PAY-DSL-TYPE-015/, 'year-to-date must be Money (or absent)');
  throws(() => f(money(1000000), null, 'six'), /PAY-DSL-TYPE-015/, 'months remaining must be a Number');
  ok(f(money(2000000), null, 6).minor > 0, 'a missing year-to-date counts as ₹0');
  ok(f(money(2000000), undefined, 6).minor === f(money(2000000), money(0), 6).minor, 'undefined ≡ ₹0 year-to-date');
}

console.log('\n6. the five structure formulas all compile against the engine');
for (const [code, src] of Object.entries(T.TDS_FORMULAS)) {
  let good = true; try { CC.compileFormulaCatalog([{ code, source: src }], typeBase); } catch (e) { good = false; console.error('   ', code, e.message); }
  ok(good, `${code} compiles`);
}
ok(T.isTdsCode('TDS_CONSOL') && T.isTdsCode('tds') && !T.isTdsCode('PF') && !T.isTdsCode('LOAN_RECOVERY'), 'isTdsCode: TDS family yes, PF / loan no');

console.log('\n7. the ledger builder books EVERY TDS variant to the TDS payable head (not "unknown deduction")');
{
  const heads = { salaryExpense: '5201', salaryPayable: '2103', tdsPayable: '2202' };
  for (const code of ['TDS', 'TDS_NOHRA', 'TDS_DEP', 'TDS_CONSOL', 'TDS_STIPEND']) {
    ok(RP.bucketOf(code, 'deduction') === 'tds', `${code} is a tds bucket`);
    const r = RP.buildRunAccrual([{ code: 'BASIC', kind: 'earning', amountMinor: 5000000 }, { code, kind: 'deduction', amountMinor: 250000 }], 4750000, heads, () => 'x');
    ok(r.ok && r.legs.some((l) => l.accountId === '2202' && l.drCr === 'Cr' && l.amountMinor === 250000), `${code}: Cr TDS payable 2202 ₹2,500`);
  }
}

console.log('\n8. over-deduction is REPORTED, never a silent zero (the CA ruling)');
{
  // basic ₹80,000 → the year's tax is ₹1,03,116 (hand-derived). Already ₹1,50,000 deducted ⇒ ₹46,884 too much.
  let got = null;
  const f = T.makeTds192({ regime: 'new', asOf: '2026-10-01', currency: 'INR' }, (o) => { got = o; });
  const out = f(money(80000 * 1.6 * 12), money(150000), 6);
  ok(out.minor === 0, 'over-deducted ⇒ this month is ₹0');
  ok(got && got.excessMinor === (150000 - 103116) * 100, 'the outcome reports the excess: ₹' + (got && got.excessMinor / 100) + ' (want ₹46,884)');
  ok(got && got.annualTaxMinor === 103116 * 100, "the outcome reports the year's tax ₹1,03,116");
  ok(got && got.ytdMinor === 150000 * 100 && got.tdsMinor === 0, 'and the year-to-date and the TDS it returned');
  // not over-deducted: excess is 0 and the callback agrees with the returned Money
  let g2 = null;
  const f2 = T.makeTds192({ regime: 'new', asOf: '2026-10-01', currency: 'INR' }, (o) => { g2 = o; });
  const m2 = f2(money(80000 * 1.6 * 12), money(20000), 6);
  ok(g2 && g2.excessMinor === 0, 'a normal month reports no excess');
  ok(g2 && g2.tdsMinor === m2.minor && m2.minor > 0, 'the reported TDS equals the Money the formula gets (' + (m2.minor / 100) + ' ₹)');
  // no callback is still fine (pay-run passes one only for employees who have TDS)
  ok(T.makeTds192({ regime: 'new', asOf: '2026-10-01', currency: 'INR' })(money(2000000), null, 6).minor > 0, 'works without a callback');
  // a refusal never calls it (nothing was computed)
  let called = false;
  try { T.makeTds192({ regime: 'new', asOf: '2025-12-01', currency: 'INR' }, () => { called = true; })(money(2000000), null, 6); } catch { /* PAY-TAX-501 */ }
  ok(called === false, 'a refused month reports nothing');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

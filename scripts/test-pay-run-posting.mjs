// Payroll run -> ledger legs (P1). Proves the parts that are easy to get wrong when money is booked:
// the voucher balances to the paisa, every loss-of-pay variant is taken out of the expense (the old
// direct-DB pay-post counted only 'LOP'), the legs equal what the Salary page books for the same pay
// (RULE 2 — one booking shape), and a deduction with no head is REFUSED rather than mis-booked.
//
// Run: node scripts/test-pay-run-posting.mjs   (npm run test:pay-run-posting)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

// '@/'-resolving loader (accrualLines.ts imports @/lib/money) — same one test-payroll-statutory.mjs uses.
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

let P, S;
try {
  P = await import(abs('../src/lib/pay/posting/runPosting.ts'));
  S = await import(abs('../src/lib/payroll/accrualLines.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗ FAIL:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}${JSON.stringify(a) === JSON.stringify(b) ? '' : `  got ${JSON.stringify(a)} want ${JSON.stringify(b)}`}`);

const HEADS = { salaryExpense: '5201', salaryPayable: '2103', pfPayable: '2203', esiPayable: '2204', ptPayable: '2207', tdsPayable: '2202', employeeAdvance: '3315' };
let n = 0; const id = () => `id${++n}`;
const sumSide = (legs, side) => legs.filter((l) => l.drCr === side).reduce((s, l) => s + l.amountMinor, 0);
const strip = (legs) => legs.map(({ accountId, drCr, amountMinor }) => ({ accountId, drCr, amountMinor }));

console.log('\n1. the figures from the real staging run (basic 25,000 / 30,000 / 18,000; PF 12% of basic+DA)');
{
  // earnings 40,000 + 48,000 + 28,800 = 116,800 ; PF 3,600 + 4,320 + 2,592 = 10,512 ; net 106,288 (rupees)
  const lines = [
    { code: 'BASIC', kind: 'earning', amountMinor: 7300000 }, { code: 'DA', kind: 'earning', amountMinor: 1460000 }, { code: 'HRA', kind: 'earning', amountMinor: 2920000 },
    { code: 'PF', kind: 'deduction', amountMinor: 1051200 },
  ];
  const r = P.buildRunAccrual(lines, 11680000 - 1051200, HEADS, id);
  ok(r.ok, 'a plain run (earnings + PF) books');
  eq(strip(r.legs), [
    { accountId: '5201', drCr: 'Dr', amountMinor: 11680000 },
    { accountId: '2103', drCr: 'Cr', amountMinor: 10628800 },
    { accountId: '2203', drCr: 'Cr', amountMinor: 1051200 },
  ], 'Dr expense = gross; Cr payable = net; Cr PF payable');
  ok(sumSide(r.legs, 'Dr') === sumSide(r.legs, 'Cr'), 'Dr = Cr to the paisa');
}

console.log('\n2. loss of pay — EVERY variant comes out of the expense');
for (const lop of ['LOP', 'LOP_NOHRA', 'LOP_DEP', 'LOP_CONSOL', 'LOP_STIPEND']) {
  const lines = [{ code: 'BASIC', kind: 'earning', amountMinor: 3000000 }, { code: lop, kind: 'deduction', amountMinor: 300000 }];
  const r = P.buildRunAccrual(lines, 2700000, HEADS, id);
  ok(r.ok && r.expenseMinor === 2700000, `${lop}: expense = earnings − LOP (2,700,000 paise)`);
  ok(r.ok && sumSide(r.legs, 'Dr') === sumSide(r.legs, 'Cr'), `${lop}: balanced`);
}

console.log('\n3. same booking shape as the Salary page (RULE 2 parity)');
{
  // One pay slip, no employer share: Salary books Dr 5201 gross-after-LOP / Cr 2103 net / Cr 2203 PF.
  const salary = S.salaryAccrualLines({ basicSalary: 25000, allowances: 15000, netSalary: 36400, pfEmployee: 3600, pfEmployer: 0, esiEmployee: 0, esiEmployer: 0, pt: 0, tds: 0 }, '2103', id);
  const payroll = P.buildRunAccrual([
    { code: 'BASIC', kind: 'earning', amountMinor: 2500000 }, { code: 'DA', kind: 'earning', amountMinor: 500000 }, { code: 'HRA', kind: 'earning', amountMinor: 1000000 },
    { code: 'PF', kind: 'deduction', amountMinor: 360000 },
  ], 3640000, HEADS, id);
  ok(payroll.ok, 'payroll books');
  eq(strip(payroll.legs).map((l) => [l.accountId, l.drCr, l.amountMinor]), salary.lines.map((l) => [l.accountId, l.type, Math.round(l.amount * 100)]), 'legs equal Salary\'s legs (account, side, amount)');
}

console.log('\n4. every statutory head, each to its own account');
{
  const lines = [
    { code: 'BASIC', kind: 'earning', amountMinor: 5000000 },
    { code: 'PF', kind: 'deduction', amountMinor: 600000 }, { code: 'ESI', kind: 'deduction', amountMinor: 37500 },
    { code: 'PT', kind: 'deduction', amountMinor: 20000 }, { code: 'TDS', kind: 'deduction', amountMinor: 250000 },
    { code: 'LOAN_RECOVERY', kind: 'loan_recovery', amountMinor: 500000 },
  ];
  const net = 5000000 - 600000 - 37500 - 20000 - 250000 - 500000;
  const r = P.buildRunAccrual(lines, net, HEADS, id);
  ok(r.ok, 'books');
  eq(strip(r.legs).map((l) => l.accountId), ['5201', '2103', '2203', '2204', '2207', '2202', '3315'], 'accounts');
  ok(r.ok && sumSide(r.legs, 'Dr') === sumSide(r.legs, 'Cr'), 'balanced');
}

console.log('\n5. REFUSALS (a mis-booking is worse than an error)');
{
  const base = [{ code: 'BASIC', kind: 'earning', amountMinor: 1000000 }];
  let r = P.buildRunAccrual([...base, { code: 'LOAN_RECOVERY', kind: 'loan_recovery', amountMinor: 100000 }], 900000, { ...HEADS, employeeAdvance: undefined }, id);
  ok(!r.ok && r.code === 'PAY-POST-HEAD' && r.missingHeads.includes('employee.advance'), 'loan recovery with no employee.advance head is refused');
  r = P.buildRunAccrual([...base, { code: 'PT', kind: 'deduction', amountMinor: 20000 }], 980000, { ...HEADS, ptPayable: undefined }, id);
  ok(!r.ok && r.code === 'PAY-POST-HEAD' && r.missingHeads.includes('professional_tax.payable'), 'PT with no professional_tax.payable head is refused');
  r = P.buildRunAccrual([...base, { code: 'UNION_FEE', kind: 'deduction', amountMinor: 5000 }], 995000, HEADS, id);
  ok(!r.ok && r.code === 'PAY-POST-UNKNOWN-DEDUCTION' && r.unknown[0] === 'UNION_FEE', 'an unknown deduction is refused, not dropped');
  r = P.buildRunAccrual([...base, { code: 'PF', kind: 'deduction', amountMinor: 120000 }], 999999, HEADS, id);
  ok(!r.ok && r.code === 'PAY-POST-IMBALANCE', 'stored net ≠ earnings − deductions is refused');
  r = P.buildRunAccrual([{ code: 'BASIC', kind: 'earning', amountMinor: 100 }, { code: 'LOP', kind: 'deduction', amountMinor: 100 }], 0, HEADS, id);
  ok(!r.ok && r.code === 'PAY-POST-NOTHING', 'zero expense is refused');
  r = P.buildRunAccrual(base, 1000000.5, HEADS, id);
  ok(!r.ok && r.code === 'PAY-POST-INPUT', 'a fractional paisa is refused');
}

console.log('\n6. payment voucher');
{
  const r = P.buildRunPayment(10628800, '2103', '1202', id);
  ok(r.ok && strip(r.legs)[0].drCr === 'Dr' && strip(r.legs)[0].accountId === '2103' && strip(r.legs)[1].accountId === '1202', 'Dr salary payable / Cr the chosen bank');
  ok(r.ok && sumSide(r.legs, 'Dr') === sumSide(r.legs, 'Cr'), 'balanced');
  ok(!P.buildRunPayment(0, '2103', '1202', id).ok, 'zero net is refused');
}

console.log('\n7. bucketOf');
eq(['LOP', 'LOP_DEP', 'PF', 'EPF', 'ESI', 'PT', 'TDS', 'LOAN_RECOVERY', 'ODD'].map((c) => P.bucketOf(c, c === 'LOAN_RECOVERY' ? 'loan_recovery' : 'deduction')), ['lop', 'lop', 'pf', 'pf', 'esi', 'pt', 'tds', 'loan', 'other_deduction'], 'deduction buckets');
ok(P.bucketOf('DAILY_RATE', 'employer_contrib') === 'ignore', 'a hidden input component is ignored');
ok(P.bucketOf('DAILY_WAGE', 'earning') === 'earning', 'daily wage is an earning');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

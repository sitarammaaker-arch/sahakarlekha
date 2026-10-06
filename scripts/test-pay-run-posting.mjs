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

let P, S, C, M;
try {
  P = await import(abs('../src/lib/pay/posting/runPosting.ts'));
  S = await import(abs('../src/lib/payroll/accrualLines.ts'));
  C = await import(abs('../src/lib/ledger/postVoucherClient.ts'));
  M = await import(abs('../src/lib/ledger/postVoucherMessages.ts'));
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
  ok(!r.ok && /बही में नहीं लिखा गया/.test(r.message) && /employee\.advance/.test(r.message) && /सहायता से संपर्क/.test(r.message), 'the refusal is Hindi-first and names the missing role');
  ok(!r.ok && !/map the head in Ledger Heads first/.test(r.message) && /cannot be set from the Ledger Heads screen/.test(r.message), 'the refusal no longer sends the user to a Ledger Heads screen that cannot map roles');
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

console.log('\n8. the post_voucher payload — same shape as the app builds (lib/ledger/postVoucherClient.ts)');
{
  const acc = P.buildRunAccrual([
    { code: 'BASIC', kind: 'earning', amountMinor: 2500000 }, { code: 'DA', kind: 'earning', amountMinor: 500000 }, { code: 'HRA', kind: 'earning', amountMinor: 1000000 },
    { code: 'PF', kind: 'deduction', amountMinor: 360000 }, { code: 'LOAN_RECOVERY', kind: 'loan_recovery', amountMinor: 100000 },
  ], 3540000, HEADS, id);
  ok(acc.ok, 'accrual builds');
  const at = '2026-09-30T10:00:00.000Z';
  const mine = P.makePostVoucherPayload({ id: 'payrun-R1-accrual', eventId: 'payrun-R1-accrual-posted', voucherNo: 'PAY-PR-2026-09-000001', type: 'journal', date: '2026-09-30', narration: 'Payroll PR-2026-09-000001', createdBy: 'u@x', occurredAt: at, legs: acc.legs });

  // The server's own invariants, re-checked here exactly as migration 077 does them.
  const dr = mine.p_lines.filter((l) => l.drCr === 'Dr').reduce((s, l) => s + l.amountMinor, 0);
  const cr = mine.p_lines.filter((l) => l.drCr === 'Cr').reduce((s, l) => s + l.amountMinor, 0);
  ok(dr === cr && dr > 0, '077: ΣDr = ΣCr > 0');
  ok(Math.round(mine.p_voucher.amount * 100) === dr, "077: the voucher's own total = ΣDr");
  const vTotal = mine.p_voucher.lines.filter((l) => l.type === 'Dr').reduce((s, l) => s + Math.round(l.amount * 100), 0);
  ok(vTotal === dr, "077: sum of the voucher's Dr 'lines' (rupees) = ΣDr (paise)");
  eq(mine.p_event.payload.lines, mine.p_lines.map((l) => ({ accountId: l.accountId, drCr: l.drCr, amountMinor: l.amountMinor })), "077: the event's legs equal p_lines, in order");
  ok(mine.p_event.event_type === 'voucher.posted' && mine.p_event.sequence === 1 && mine.p_event.aggregate_id === mine.p_voucher.id, '077: voucher.posted, sequence 1, this voucher');
  ok(!('society_id' in mine.p_voucher), 'no society in the payload (the server takes it from the JWT)');

  // Same shape as the real client builder for a voucher with the same legs.
  const voucher = { ...mine.p_voucher };
  const event = { eventId: mine.p_event.event_id, eventType: 'voucher.posted', schemaVersion: 1, tenantId: 'T', jurisdiction: '', aggregateType: 'voucher', aggregateId: mine.p_voucher.id, sequence: 1, occurredAt: at, producer: { kind: 'human', id: 'u@x', onBehalfOf: null }, payload: mine.p_event.payload };
  const real = C.buildPostVoucherPayload(voucher, event);
  eq(real.p_lines.map((l) => [l.id, l.accountId, l.drCr, l.amountMinor]), mine.p_lines.map((l) => [l.id, l.accountId, l.drCr, l.amountMinor]), 'p_lines equal what buildPostVoucherPayload produces');
  eq(Object.keys(real.p_event).sort(), Object.keys(mine.p_event).sort(), 'p_event has the same keys as the app builds');
  eq(real.p_event.payload.lines, mine.p_event.payload.lines, 'event legs equal');
}

console.log('\n9. account_roles -> heads; deterministic ids; shared refusal messages');
{
  const h = P.headsFromRoles([{ role: 'salary.expense', account_id: '5201' }, { role: 'salary.payable', account_id: '2103' }, { role: 'pf.payable', account_id: '2203' }, { role: 'unrelated', account_id: '9' }]);
  eq(h, { salaryExpense: '5201', salaryPayable: '2103', pfPayable: '2203' }, 'only the payroll roles are picked up; missing ones stay undefined');
  const a = P.payrollDocIds('abc'), b = P.payrollDocIds('abc');
  ok(JSON.stringify(a) === JSON.stringify(b) && a.accrualVoucherId !== a.paymentVoucherId, 'ids are deterministic per run, and accrual ≠ payment');
  ok(P.payrollDocIds('x').accrualVoucherId !== P.payrollDocIds('y').accrualVoucherId, 'different runs get different ids');
  ok(M.postVoucherErrorCode('x post_voucher:fy_locked y') === 'fy_locked', 'refusal code is parsed');
  ok(M.postVoucherMessage('fy_locked').includes('audit-locked'), 'Hindi-first message for fy_locked');
  ok(C.postVoucherMessage === M.postVoucherMessage, 'postVoucherClient re-exports the SAME function (one home for the messages)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

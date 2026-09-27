// Haryana Co-operative Societies Act 1984, s.65 — interest on a short-term loan (≤ 15 months) to a
// member may not exceed the principal advanced. The app caps the accrual at what is still allowed.
// Run: node scripts/test-section65.mjs
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const S = await imp('src/lib/loans/section65.ts');
const I = await imp('src/lib/loans/interestAccrual.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// Who it applies to.
ok(S.appliesSection65('hr') && S.appliesSection65('HR') && !S.appliesSection65('pb') && !S.appliesSection65(undefined), 'Haryana only (other States\' Acts not checked)');
ok(S.isShortTermS65({ disbursementDate: '2026-04-01', dueDate: '2027-07-01' }), '15 months exactly ⇒ short term');
ok(!S.isShortTermS65({ disbursementDate: '2026-04-01', dueDate: '2027-07-02' }), 'a day past 15 months ⇒ not short term');
ok(S.isShortTermS65({ disbursementDate: '2026-01-31', dueDate: '2027-04-30' }) && !S.isShortTermS65({ disbursementDate: '2026-01-31', dueDate: '2027-05-01' }), 'month-end arithmetic (31 Jan + 15 months = 30 Apr)');
ok(S.isShortTermS65({ loanType: 'short-term' }) && !S.isShortTermS65({ loanType: 'medium-term' }), 'no dates ⇒ the loan\'s term label');

// Interest already taken.
{
  const loan = { id: 'L1', loanNo: 'L-1' };
  const vouchers = [
    { id: 'acc', amount: 300, narration: 'Member Loan Interest Accrual', debitAccountId: '3313', creditAccountId: '4408', lines: [{ id: 'a', accountId: '3313', type: 'Dr', amount: 300 }, { id: 'b', accountId: '4408', type: 'Cr', amount: 300 }] },
    { id: 'rep', amount: 1250, narration: 'Loan repayment — Ram (L-1)', debitAccountId: '3301', creditAccountId: '3304', refType: 'loan.repayment', refId: 'L1',
      lines: [{ id: 'c', accountId: '3301', type: 'Dr', amount: 1250 }, { id: 'd', accountId: '3304', type: 'Cr', amount: 1000 }, { id: 'e', accountId: '3313', type: 'Cr', amount: 200 }, { id: 'f', accountId: '4408', type: 'Cr', amount: 50 }] },
  ];
  const accruals = [
    { id: 'x1', loanId: 'L1', amount: 300, voucherId: 'acc' },
    { id: 'x2', loanId: 'L1', amount: 99, voucherId: 'gone' },                    // journal cancelled
    { id: 'x3', loanId: 'L1', amount: 88, voucherId: 'acc', isDeleted: true },
  ];
  const taken = S.interestTakenToDate(loan, accruals, vouchers, (id) => id === '4408');
  ok(taken === 350, `taken = live accruals 300 + interest straight to income 50; clearing the accrual (Cr 3313 200) not counted twice (${taken})`);
  ok(S.section65Room(1000, taken) === 650 && S.section65Room(1000, 1200) === 0, 'room = principal − taken, never negative');
}

// The accrual is capped and flagged.
{
  const loan = { id: 'L1', loanNo: 'L-1', memberId: 'm', amount: 1000, repaidAmount: 0, interestRate: 12, dueDate: '2030-01-01', status: 'active' };
  const full = I.accrualRows([loan], '2027-03-31', 365)[0];
  ok(full.interest === 120 && !full.cappedBySection65, 'no limit ⇒ unchanged (120)');
  const capped = I.accrualRows([loan], '2027-03-31', 365, '365', () => 50)[0];
  ok(capped.interest === 50 && capped.cappedBySection65 === true, 'room 50 ⇒ interest 50, flagged');
  const none = I.accrualRows([loan], '2027-03-31', 365, '365', () => 0)[0];
  ok(none.interest === 0 && none.cappedBySection65, 'room used up ⇒ no more interest');
  const notApplicable = I.accrualRows([loan], '2027-03-31', 365, '365', () => null)[0];
  ok(notApplicable.interest === 120 && !notApplicable.cappedBySection65, 'not a short-term loan (room null) ⇒ unchanged');
  const kcc = I.kccAsAccruable({ id: 'K', loanNo: 'K', memberId: 'm', drawnAmount: 5000, repaidAmount: 0, interestRate: 7, dueDate: '2027-03-31', disbursementDate: '2026-04-01', status: 'active' });
  ok(kcc.disbursementDate === '2026-04-01' && S.isShortTermS65(kcc), 'KCC carries its disbursement date ⇒ s.65 test works for crop loans');
}

// Wiring.
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const li = read('src/pages/LoanInterest.tsx');
ok(/appliesSection65\(society\.state\)/.test(li) && /isShortTermS65\(l\) \? section65Room\(l\.amount, interestTakenToDate\(l, postedAccruals, vouchers, isIncome\)\) : null/.test(li), 'page: Haryana + short-term ⇒ room from interest already taken');
ok(/accrualRows\(activeLoans, toDate, days, basis, interestRoom\)/.test(li) && /accrualRows\(kccAccruables\(kccLoans\), toDate, days, basis, interestRoom\)/.test(li), 'member loans and KCC both capped');
ok((li.match(/r\.cappedBySection65 &&/g) || []).length === 2, 'the cap is shown on the row (both tables), with the Act cited');
ok(/shall not recover interest on short term loans/.test(read('src/lib/loans/section65.ts')), 'the Act text is quoted at the rule');

console.log(`Section 65: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

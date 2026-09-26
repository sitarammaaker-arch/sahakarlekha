// H2-2 — a loan repayment clears the interest accrued for THAT loan (never income twice), and
// recovered overdue interest leaves the Overdue Interest Reserve for income (Haryana Act s.87
// Explanation (ii)). What was cleared is DERIVED from live vouchers, so a cancelled repayment
// re-opens its interest automatically. Overdue first (founder decision D4).
// Run: node scripts/test-loan-repayment-accrual.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const A = await import(pathToFileURL(pathResolve(ROOT, 'src/lib/loans/interestAccrual.ts')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const acc = (id, loanId, amount, overdue, voucherId, extra = {}) => ({ id, loanId, memberId: 'm', periodFrom: '2026-08-01', periodTo: '2026-08-31', days: 30, outstanding: 1000, ratePa: 12, amount, overdue, recovered: 0, voucherId, ...extra });
const accrualJV = (id, extra = {}) => ({ id, amount: 1, lines: [], debitAccountId: '3313', creditAccountId: '4408', ...extra });
const receipt = (id, loanId, toRec, extra = {}) => ({ id, refType: 'loan.repayment', refId: loanId, amount: 999, lines: [{ accountId: '3301', type: 'Dr', amount: 999 }, { accountId: '3313', type: 'Cr', amount: toRec }], ...extra });
const release = (id, loanId, amt, extra = {}) => ({ id, refType: 'loan.interest.release', refId: loanId, amount: amt, debitAccountId: '2211', creditAccountId: '4408', lines: [], ...extra });

// ── 1. Due derivation ──
const accruals = [acc('a1', 'L1', 100, false, 'J1'), acc('a2', 'L1', 40, true, 'J1'), acc('a3', 'L2', 50, false, 'J1'), acc('a4', 'L1', 30, false, 'J2'), acc('a5', 'L1', 20, false, null), acc('a6', 'L1', 10, false, 'J1', { isDeleted: true })];
const vouchers = [accrualJV('J1'), accrualJV('J2', { isDeleted: true })];
ok(same(A.loanInterestDue('L1', accruals, vouchers), { receivable: 140, reserve: 40 }), 'L1: only rows with a LIVE journal count (J2 deleted, unlinked, deleted row ignored) → 140, overdue 40');
ok(same(A.loanInterestDue('L2', accruals, vouchers), { receivable: 50, reserve: 0 }), 'L2 independent of L1');
ok(same(A.loanInterestDue('L9', accruals, vouchers), { receivable: 0, reserve: 0 }), 'loan without accruals → 0');

const afterPay = [...vouchers, receipt('R1', 'L1', 60), release('X1', 'L1', 40)];
ok(same(A.loanInterestDue('L1', accruals, afterPay), { receivable: 80, reserve: 0 }), 'live repayment cleared 60, released 40 → 80 / 0');
const cancelled = [...vouchers, receipt('R1', 'L1', 60, { isDeleted: true }), release('X1', 'L1', 40, { isDeleted: true })];
ok(same(A.loanInterestDue('L1', accruals, cancelled), { receivable: 140, reserve: 40 }), 'cancelled repayment ⇒ its interest re-opens (derived, nothing stored)');
ok(same(A.loanInterestDue('L1', accruals, [...vouchers, receipt('R2', 'L2', 60)]), { receivable: 140, reserve: 40 }), "another loan's repayment never clears this loan");
ok(A.loanInterestDue('L1', accruals, [...vouchers, receipt('R3', 'L1', 500)]).receivable === 0, 'never negative');

// ── 2. Split (overdue first, D4) ──
const due = { receivable: 140, reserve: 40 };
ok(same(A.repaymentInterestSplit(0, due), { toReceivable: 0, toIncome: 0, releaseFromReserve: 0 }), 'no interest → nothing');
ok(same(A.repaymentInterestSplit(25, due), { toReceivable: 25, toIncome: 0, releaseFromReserve: 25 }), 'partial: all to receivable, and all of it releases overdue first');
ok(same(A.repaymentInterestSplit(100, due), { toReceivable: 100, toIncome: 0, releaseFromReserve: 40 }), 'beyond the overdue part: reserve released 40 only');
ok(same(A.repaymentInterestSplit(200, due), { toReceivable: 140, toIncome: 60, releaseFromReserve: 40 }), 'more than accrued: the un-accrued 60 goes to income directly');
ok(same(A.repaymentInterestSplit(80, { receivable: 0, reserve: 0 }), { toReceivable: 0, toIncome: 80, releaseFromReserve: 0 }), 'no accrual (e.g. pre-H2 or KCC-style) → all income, as before');

// ── 3. Income is recognised exactly once, over a full lifecycle (random) ──
let seed = 9; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let bad = 0;
for (let t = 0; t < 300; t++) {
  const acs = []; const vs = [accrualJV('J')];
  let accruedIncome = 0, accruedReserve = 0;
  for (let k = 0; k < 1 + Math.floor(rnd() * 5); k++) {
    const amt = Math.round(rnd() * 20000) / 100, od = rnd() < 0.4;
    acs.push(acc(`a${k}`, 'L', amt, od, 'J'));
    if (od) accruedReserve += amt; else accruedIncome += amt;
  }
  let income = accruedIncome, reserve = accruedReserve, receivable = accruedIncome + accruedReserve, direct = 0;
  for (let p = 0; p < 1 + Math.floor(rnd() * 4); p++) {
    const i = Math.round(rnd() * 15000) / 100;
    const sp = A.repaymentInterestSplit(i, A.loanInterestDue('L', acs, vs));
    vs.push(receipt(`R${p}`, 'L', sp.toReceivable));
    if (sp.releaseFromReserve > 0) vs.push(release(`X${p}`, 'L', sp.releaseFromReserve));
    receivable -= sp.toReceivable; direct += sp.toIncome; income += sp.toIncome + sp.releaseFromReserve; reserve -= sp.releaseFromReserve;
    if (Math.abs(sp.toReceivable + sp.toIncome - i) > 0.011) bad++;            // every rupee paid is placed
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  if (r2(receivable) < -0.01 || r2(reserve) < -0.01) bad++;                   // never below zero
  if (Math.abs(r2(income + reserve) - r2(accruedIncome + accruedReserve + direct)) > 0.02) bad++;   // each rupee once
  if (r2(reserve) > r2(receivable) + 0.01) bad++;                             // reserve never exceeds what is still owed
}
ok(bad === 0, `300 random loan lifecycles: every rupee of interest reaches income or reserve exactly once (${bad} bad)`);

// ── 4. Wiring on the Loan Register ──
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const lr = strip('src/pages/LoanRegister.tsx');
const rep = lr.slice(lr.indexOf('const recordRepayment'), lr.indexOf('updateLoan(loan.id'));
ok(/repaymentInterestSplit\(interest, dueOf\(loan\.id\)\)/.test(rep), 'repayment uses the shared split for this loan');
ok(/accountId: ACC_INTEREST_RECEIVABLE, type: 'Cr', amount: split\.toReceivable/.test(rep) && /accountId: incomeAccId, type: 'Cr', amount: split\.toIncome/.test(rep), 'receipt: Cr 3313 accrued + Cr income un-accrued only');
ok(/refType: REF_LOAN_REPAYMENT, refId: loan\.id/.test(rep), 'receipt tagged with the loan (the derivation key)');
ok(/debitAccountId: ACC_OVERDUE_INTEREST_RESERVE, creditAccountId: incomeAccId, amount: split\.releaseFromReserve/.test(rep) && /refType: REF_LOAN_INTEREST_RELEASE, refId: loan\.id/.test(rep), 'reserve release: own journal Dr 2211 / Cr income, tagged');
ok(/if \(!released\) \{[\s\S]*?cancelVoucher\(receiptId,[\s\S]*?return;/.test(rep), 'release refused ⇒ receipt cancelled, loan unchanged (RULE 1)');
ok(rep.indexOf('releaseFromReserve > 0') < rep.length && /if \(!posted\)[\s\S]*?return;/.test(rep), 'receipt refused ⇒ nothing else happens');
ok(/due=\{dueOf\(l\.id\)\}/.test(lr) && /प्राप्य ब्याज भरें/.test(lr) && /setInterest\(String\(due\.receivable\)\)/.test(lr), 'repay dialog shows accrued interest + fill button');

console.log(`loan repayment vs accrual (H2-2): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

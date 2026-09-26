// KCC-1 — KCC loans accrue interest by the SAME rules as member loans (Haryana Act s.87: overdue
// interest to the Overdue Interest Reserve), on the SAME outstanding the KCC page shows, in their
// OWN journal; a KCC repayment clears that loan's accrued interest (same split as H2-2).
// Run: node scripts/test-kcc-interest-accrual.mjs
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
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const A = await imp('src/lib/loans/interestAccrual.ts');
const { kccOutstanding } = await imp('src/lib/memberSnapshot.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const K = (id, o) => ({ id, loanNo: `KCC-${id}`, memberId: `m-${id}`, drawnAmount: 50000, repaidAmount: 10000, outstandingAmount: 40000, interestRate: 7, dueDate: '2027-03-31', status: 'active', ...o });
const TO = '2026-09-30';

// ── 1. Adapter: the SAME outstanding the KCC page shows (RULE 2) ──
let seed = 5; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let bad = 0;
for (let t = 0; t < 300; t++) {
  const k = K('r', { drawnAmount: Math.round(rnd() * 1e7) / 100, repaidAmount: Math.round(rnd() * 5e6) / 100, outstandingAmount: rnd() < 0.2 ? undefined : Math.round(rnd() * 5e6) / 100 });
  const a = A.kccAsAccruable(k);
  const row = A.accrualRows([a], TO, 30)[0];
  const want = Math.max(0, kccOutstanding(k));
  if (want > 0.005 ? (!row || Math.abs(row.outstanding - want) > 0.005) : !!row) bad++;
}
ok(bad === 0, `300 random KCC loans: accrued on exactly kccOutstanding (${bad} bad)`);
ok(A.kccAsAccruable(K('x', { status: 'repaid' })).status === 'cleared', 'repaid ⇒ cleared (no interest)');
ok(A.kccAccruables([K('a'), K('b', { isDeleted: true })]).length === 1, 'soft-deleted KCC loans excluded (RULE 5)');

// ── 2. Overdue by due date (same rule as the KCC page), split to reserve ──
const rows = A.accrualRows(A.kccAccruables([K('a'), K('b', { dueDate: '2026-06-30' }), K('c', { outstandingAmount: 0, repaidAmount: 50000, status: 'repaid' })]), TO, 30);
ok(rows.map((r) => r.loanId).join() === 'a,b', 'repaid KCC excluded');
ok(rows.find((r) => r.loanId === 'b').overdue && !rows.find((r) => r.loanId === 'a').overdue, 'due date passed ⇒ overdue');
const sp = A.splitAccrual(rows);
ok(sp.regular === A.simpleInterest(40000, 7, 30) && sp.overdue === A.simpleInterest(40000, 7, 30), 'regular to income, overdue to reserve');
let n = 0; const lines = A.accrualVoucherLines(sp, () => `i${n++}`);
ok(lines.some((l) => l.accountId === '2211' && l.type === 'Cr') && lines.some((l) => l.accountId === '3313' && l.type === 'Dr'), 'journal: Dr 3313 / Cr 4408 + Cr 2211');

// ── 3. Repayment clears THIS KCC loan's accrual ──
const accr = [{ id: 'x1', loanId: 'b', memberId: 'm-b', periodFrom: '2026-09-01', periodTo: TO, days: 30, outstanding: 40000, ratePa: 7, amount: 230.14, overdue: true, recovered: 0, voucherId: 'J' }];
const due = A.loanInterestDue('b', accr, [{ id: 'J', amount: 1 }]);
ok(due.receivable === 230.14 && due.reserve === 230.14, 'KCC due derived like member loans');
const s = A.repaymentInterestSplit(300, due);
ok(s.toReceivable === 230.14 && s.toIncome === 69.86 && s.releaseFromReserve === 230.14, 'KCC repayment: clears accrued, releases reserve, rest to income');

// ── 4. Page wiring ──
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const li = strip('src/pages/LoanInterest.tsx');
ok(/accrualRows\(kccAccruables\(kccLoans\), toDate, days\)/.test(li), 'Loan Interest accrues KCC via the shared adapter');
ok(/kccLoanSelect\(user\.societyId\)/.test(li) && /freshKcc \?\? ctxKccLoans/.test(li), 'KCC read fresh from the table (never a stale balance)');
ok(/postedFor\(NARRATION_LOAN_ACCRUAL\)/.test(li) && /postedFor\(NARRATION_KCC_ACCRUAL\)/.test(li) && /\.startsWith\(prefix\)/.test(li), '"already posted" is per kind (KCC journal never marks member loans posted)');
ok(/narration: `\$\{label\} \$\{fromDate\}/.test(li), 'journal narration carries its kind prefix');
const post = li.slice(li.indexOf('const handlePost'), li.indexOf('const csvHeaders'));
ok(post.indexOf('saveAccruals(records)') < post.indexOf('addVoucher('), 'KCC rows saved BEFORE the journal too (same handler)');
const kc = strip('src/pages/KccLoan.tsx');
const rep = kc.slice(kc.indexOf('const handleRepayment'), kc.indexOf('const kccHeaders'));
ok(/repaymentInterestSplit\(interest, dueOf\(loan\.id\)\)/.test(rep), 'KCC repayment uses the shared split');
ok(/refType: REF_LOAN_REPAYMENT, refId: loan\.id/.test(rep) && /refType: REF_LOAN_INTEREST_RELEASE, refId: loan\.id/.test(rep), 'receipt + reserve release tagged with the KCC loan');
ok(/if \(!releaseId\) \{[\s\S]*?cancelVoucher\(voucherId,[\s\S]*?return;/.test(rep), 'release refused ⇒ receipt cancelled');
ok(/if \(releaseId\) cancelVoucher\(releaseId,/.test(rep), 'loan save failure ⇒ receipt AND release cancelled (RULE 1)');
ok(/if \(principal > loan\.outstandingAmount \+ 0\.005\)/.test(rep), 'KCC principal can\'t exceed outstanding');
ok(/due=\{dueOf\(l\.id\)\}/.test(kc) && /प्राप्य ब्याज भरें/.test(kc), 'KCC repay dialog shows accrued interest + fill');

console.log(`KCC interest accrual (KCC-1): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

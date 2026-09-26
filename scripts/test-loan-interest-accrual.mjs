// H2-1 — member-loan interest accrual per Haryana Co-operative Societies Act 1984, s.87 Explanation:
// overdue interest is accrued but credited to the Overdue Interest Reserve (2211), not income; each
// loan's accrual is recorded (069) BEFORE the journal (RULE 1).
// Run: node scripts/test-loan-interest-accrual.mjs
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
const S = await imp('src/lib/storage.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const L = (id, o) => ({ id, loanNo: `L-${id}`, memberId: `m-${id}`, amount: 10000, repaidAmount: 0, interestRate: 12, dueDate: '2027-03-31', status: 'active', ...o });
const TO = '2026-09-30';

// ── 1. Overdue definition (D1): manual status OR due date before period end with balance ──
ok(!A.isOverdueAt(L('a'), TO), 'active, due later → not overdue');
ok(A.isOverdueAt(L('b', { status: 'overdue' }), TO), 'marked overdue → overdue');
ok(A.isOverdueAt(L('c', { dueDate: '2026-09-15' }), TO), 'due date passed inside the period → overdue');
ok(!A.isOverdueAt(L('d', { dueDate: '2026-09-30' }), TO), 'due ON the period end → not yet overdue');
ok(!A.isOverdueAt(L('e', { dueDate: '2026-01-01', repaidAmount: 10000 }), TO), 'due passed but fully repaid → not overdue');
ok(!A.isOverdueAt(L('f', { dueDate: '' }), TO), 'no due date → not overdue (unless marked)');

// ── 2. Which loans bear interest ──
const loans = [L('a'), L('b', { status: 'overdue' }), L('c', { dueDate: '2026-09-15', repaidAmount: 4000 }), L('x', { status: 'cleared' }), L('y', { repaidAmount: 10000 })];
ok(A.accruableLoans(loans).map((l) => l.id).join() === 'a,b,c', 'active + overdue with balance; cleared and fully-repaid excluded');

// ── 3. Rows + split ──
const rows = A.accrualRows(loans, TO, 30);
ok(rows.find((r) => r.loanId === 'a').interest === A.simpleInterest(10000, 12, 30) && A.simpleInterest(10000, 12, 30) === 98.63, 'simple interest formula unchanged (10000 × 12% × 30/365 = 98.63)');
ok(rows.find((r) => r.loanId === 'c').outstanding === 6000 && rows.find((r) => r.loanId === 'c').interest === 59.18, 'interest on the outstanding (6000)');
const split = A.splitAccrual(rows);
ok(split.regular === 98.63 && split.overdue === Math.round((98.63 + 59.18) * 100) / 100 && split.total === Math.round((split.regular + split.overdue) * 100) / 100, `split: income ${split.regular} / reserve ${split.overdue} / total ${split.total}`);

// ── 4. The journal ──
let n = 0; const id = () => `id${n++}`;
const lines = A.accrualVoucherLines(split, id);
const dr = lines.filter((l) => l.type === 'Dr'), cr = lines.filter((l) => l.type === 'Cr');
ok(dr.length === 1 && dr[0].accountId === '3313' && dr[0].amount === split.total, 'Dr 3313 Member Loan Interest Rec. = total');
ok(cr.find((l) => l.accountId === '4408').amount === split.regular, 'Cr 4408 income = regular only');
ok(cr.find((l) => l.accountId === '2211').amount === split.overdue, 'Cr 2211 Overdue Interest Reserve = overdue');
ok(Math.abs(dr[0].amount - cr.reduce((s, l) => s + l.amount, 0)) < 0.005, 'balanced');
ok(A.accrualVoucherLines({ total: 50, regular: 50, overdue: 0 }, id).every((l) => l.accountId !== '2211'), 'no overdue → no reserve line');
ok(A.accrualVoucherLines({ total: 0, regular: 0, overdue: 0 }, id).length === 0, 'nothing to accrue → no lines');

// Random: always balanced, reserve = exactly the overdue rows
let seed = 3; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let bad = 0;
for (let t = 0; t < 400; t++) {
  const ls = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) => L(`r${i}`, {
    amount: Math.round(rnd() * 100000) / 100, repaidAmount: Math.round(rnd() * 50000) / 100, interestRate: Math.round(rnd() * 1800) / 100,
    dueDate: rnd() < 0.5 ? '2026-06-01' : '2027-06-01', status: rnd() < 0.2 ? 'overdue' : rnd() < 0.1 ? 'cleared' : 'active',
  }));
  const rs = A.accrualRows(ls, TO, 1 + Math.floor(rnd() * 365)); const sp = A.splitAccrual(rs);
  const ln = A.accrualVoucherLines(sp, id);
  const d = ln.filter((l) => l.type === 'Dr').reduce((s, l) => s + l.amount, 0), c = ln.filter((l) => l.type === 'Cr').reduce((s, l) => s + l.amount, 0);
  const res = ln.find((l) => l.accountId === '2211')?.amount ?? 0;
  const want = Math.round(rs.filter((r) => r.overdue).reduce((s, r) => s + r.interest, 0) * 100) / 100;
  if (Math.abs(d - c) > 0.005 || Math.abs(res - want) > 0.005) bad++;
}
ok(bad === 0, `400 random loan books: balanced, reserve = overdue interest exactly (${bad} bad)`);

// ── 5. Per-loan records ──
const recs = A.accrualRecords(rows, '2026-09-01', TO, 'tester', id);
ok(recs.length === 3 && recs.every((r) => r.recovered === 0 && r.voucherId === null && !r.isDeleted), 'one record per loan with interest, recovered 0, unlinked');
ok(recs.find((r) => r.loanId === 'c').overdue === true && recs.find((r) => r.loanId === 'a').overdue === false, 'records carry the overdue flag');

// ── 6. Chart: 2211 reaches every society ──
const add = readFileSync(pathResolve(ROOT, 'src/lib/storage.ts'), 'utf8');
const toAdd = add.slice(add.indexOf('const ACCOUNTS_TO_ADD'), add.indexOf('];', add.indexOf('const ACCOUNTS_TO_ADD')));
ok(/id: '2211', name: 'Overdue Interest Reserve'[^\n]*type: 'liability'[^\n]*parentId: '2100'/.test(toAdd), '2211 Overdue Interest Reserve (liability, 2100) in ACCOUNTS_TO_ADD');
ok(/id: '3313'/.test(toAdd) && /id: '4408'/.test(toAdd), '3313 and 4408 also auto-added');
for (const k of ['CMS_SOCIETY_ACCOUNTS', 'PACS_SOCIETY_ACCOUNTS', 'CONSUMER_SOCIETY_ACCOUNTS']) {
  ok(!S[k].some((a) => a.id === '2211'), `${k}: 2211 not taken by another head`);
  const { accounts } = S.migrateAccounts(S[k]);
  ok(accounts.some((a) => a.id === '2211'), `${k}: migrateAccounts adds 2211`);
}

// ── 7. Page wiring (RULE 1 order) + migration ──
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const page = strip('src/pages/LoanInterest.tsx');
const post = page.slice(page.indexOf('const handlePost'), page.indexOf('const csvHeaders'));
ok(/accruableLoans\(loans\)/.test(page) && !/l\.status === 'active'/.test(page), 'page accrues active AND overdue loans');
ok(post.indexOf('saveAccruals(records)') > 0 && post.indexOf('saveAccruals(records)') < post.indexOf('addVoucher('), 'per-loan rows saved BEFORE the journal');
ok(/if \(!saved\.ok\)[\s\S]*?return;/.test(post) && /migration 069/.test(post), 'save failure ⇒ no journal (with the migration hint)');
ok(/lines,/.test(post) && /accrualVoucherLines\(split, newId\)/.test(post), 'journal carries the split lines');
ok(/if \(!v\?\.id\) \{[\s\S]*?isDeleted: true/.test(post), 'refused journal ⇒ its rows retired');
ok(/voucherId: v\.id/.test(post), 'rows linked to the journal');
ok(/l\.accountId === ACC_INTEREST_INC \|\| l\.accountId === ACC_OIR/.test(page), '"already posted" recognises an overdue-only journal too');
const mig = readFileSync(pathResolve(ROOT, 'supabase/migrations/069_loan_interest_accruals.sql'), 'utf8');
ok(/enable row level security/.test(mig) && (mig.match(/create policy loan_interest_accruals_tenant_\w+/g) || []).length === 4, '069: RLS on + 4 tenant policies');
ok(!/using \(true\)|with check \(true\)/i.test(mig), '069: no permissive policy');
ok(/loan_interest_accruals_one_live[\s\S]*?where not "isDeleted"/.test(mig), '069: one live accrual per loan per period');
const master = readFileSync(pathResolve(ROOT, 'supabase-tables.sql'), 'utf8');
ok(/create table if not exists loan_interest_accruals/.test(master) && !/create policy[^\n]*loan_interest_accruals/.test(master), 'master schema declares the table without policies');
ok(/table: 'loan_interest_accruals'/.test(strip('src/lib/export/entities/core.ts')), 'backed up (export registry)');

console.log(`loan interest accrual (H2-1): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

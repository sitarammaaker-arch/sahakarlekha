// One "overdue" rule for member loans on every screen (RULE 2): due date passed with a balance, or
// marked overdue — the SAME isOverdueAt the interest accrual (H2-1) uses. Before, the accrual sent a
// past-due loan's interest to the Overdue Interest Reserve while Dashboard / Header / Loan Register /
// role dashboards / the member badge still called it "active" (they read only the hand-set status).
// Run: node scripts/test-overdue-one-rule.mjs
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
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const A = await imp('src/lib/loans/interestAccrual.ts');
const { buildPortalView } = await imp('src/lib/memberPortalView.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const L = (o) => ({ id: 'x', loanNo: 'L', memberId: 'm', amount: 1000, repaidAmount: 0, interestRate: 12, dueDate: '2026-12-31', status: 'active', ...o });
const AS = '2026-09-26';

// ── 1. The rule ──
ok(A.effectiveLoanStatus(L(), AS) === 'active', 'due later → active');
ok(A.effectiveLoanStatus(L({ dueDate: '2026-09-01' }), AS) === 'overdue', 'due date passed, balance left → overdue (though stored "active")');
ok(A.effectiveLoanStatus(L({ dueDate: '2026-09-26' }), AS) === 'active', 'due today → not yet overdue');
ok(A.effectiveLoanStatus(L({ status: 'overdue' }), AS) === 'overdue', 'marked overdue → overdue');
ok(A.effectiveLoanStatus(L({ status: 'cleared', dueDate: '2020-01-01' }), AS) === 'cleared', 'cleared stays cleared');
ok(A.effectiveLoanStatus(L({ dueDate: '2020-01-01', repaidAmount: 1000 }), AS) === 'active', 'past due but nothing outstanding → not overdue');
// Same answer as the accrual's own test, for random loans
let seed = 4; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let bad = 0;
for (let t = 0; t < 500; t++) {
  const l = L({ dueDate: rnd() < 0.5 ? '2026-06-01' : '2027-06-01', status: rnd() < 0.2 ? 'overdue' : 'active', repaidAmount: rnd() < 0.2 ? 1000 : 0 });
  if ((A.effectiveLoanStatus(l, AS) === 'overdue') !== A.isOverdueAt(l, AS)) bad++;
}
ok(bad === 0, `500 random loans: screen status === accrual overdue decision (${bad} bad)`);

// ── 2. Member-360 / portal badge ──
const snap = { ok: true, society: null, member: { id: 'm', memberId: 'M', name: 'A', joinDate: '2024-04-01', status: 'active', shareCapital: 0 }, shareVouchers: [], deposits: [], depositTransactions: [], kccLoans: [],
  loans: [L({ id: 'p', dueDate: '2026-09-01' }), L({ id: 'q' })] };
const v = buildPortalView(snap, AS);
ok(v.loans.find((l) => l.id === 'p').status === 'overdue' && v.loans.find((l) => l.id === 'q').status === 'active', 'member badge uses the same rule');

// ── 3. Sweep: no member-loan screen reads only the stored status for "overdue" ──
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
walk(path.join(SRC, 'pages')); walk(path.join(SRC, 'components'));
const offenders = [];
for (const f of files) {
  if (/Kcc|Compliance|Dairy|Bill|Housing|Maintenance/i.test(f)) continue;
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/loans?\.filter\(\s*\w+\s*=>\s*\w+\.status === 'overdue'\)/.test(line)) offenders.push(`${path.relative(ROOT, f)}:${i + 1}`);
  });
}
ok(offenders.length === 0, `no loans.filter(l => l.status === 'overdue') left (${offenders.join(', ') || 'none'})`);
for (const f of ['src/pages/Dashboard.tsx', 'src/pages/LoanRegister.tsx', 'src/pages/RoleDashboard.tsx', 'src/components/layout/Header.tsx']) {
  ok(/effectiveLoanStatus\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), `${f} uses effectiveLoanStatus`);
}
const lr = fs.readFileSync(path.join(ROOT, 'src/pages/LoanRegister.tsx'), 'utf8');
ok(/statusBadge\(statusOf\(l\)\)/.test(lr) && /statusOf\(l\) === statusFilter/.test(lr) && /status: statusOf\(l\)/.test(lr), 'Loan Register: badge, filter and PDF use the rule');
ok(/loans\.filter\(l => l\.status !== 'cleared'\)\.reduce\(\(s, l\) => s \+ loanOutstandingOf\(l\), 0\)/.test(fs.readFileSync(path.join(ROOT, 'src/pages/RoleDashboard.tsx'), 'utf8')), 'RoleDashboard outstanding = the shared formula and scope');

console.log(`one overdue rule: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

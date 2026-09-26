// C — the member's accrued loan interest on Member-360 and the portal (070). One rule everywhere:
// loanInterestDue (Loan Register repay dialog = KCC page = Member-360 = portal). Other members'
// loans never leave; society-level accrual journals leave as an id only. 070 is additive over 067.
// Run: node scripts/test-member-loan-interest.mjs
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
const { buildMember360 } = await imp('src/lib/member360.ts');
const { buildPortalView } = await imp('src/lib/memberPortalView.ts');
const A = await imp('src/lib/loans/interestAccrual.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── 1. Staff 360 == Loan Register rule; other members' loans never leave ──
const member = { id: 'm1', memberId: 'M-1', name: 'A', joinDate: '2024-04-01', status: 'active', shareCapital: 0, nominees: [] };
const loans = [
  { id: 'L1', loanNo: 'L-1', memberId: 'm1', amount: 10000, repaidAmount: 0, interestRate: 12, dueDate: '2026-01-01', status: 'overdue' },
  { id: 'L2', loanNo: 'L-2', memberId: 'm2', amount: 5000, repaidAmount: 0, interestRate: 12, dueDate: '2027-01-01', status: 'active' },
];
const kcc = [{ id: 'kcc_1', loanNo: 'KCC-1', memberId: 'm1', drawnAmount: 20000, repaidAmount: 0, outstandingAmount: 20000, interestRate: 7, dueDate: '2027-03-31', status: 'active' }];
const accr = [
  { id: 'a1', loanId: 'L1', memberId: 'm1', amount: 100, overdue: true, voucherId: 'J1', periodFrom: '', periodTo: '2026-08-31', days: 30, outstanding: 0, ratePa: 0, recovered: 0 },
  { id: 'a2', loanId: 'L2', memberId: 'm2', amount: 50, overdue: false, voucherId: 'J1', periodFrom: '', periodTo: '2026-08-31', days: 30, outstanding: 0, ratePa: 0, recovered: 0 },
  { id: 'a3', loanId: 'kcc_1', memberId: 'm1', amount: 80, overdue: false, voucherId: 'J2', periodFrom: '', periodTo: '2026-08-31', days: 30, outstanding: 0, ratePa: 0, recovered: 0 },
];
const V = (o) => ({ type: 'journal', date: '2026-09-01', createdAt: '2026-09-01T00:00:00Z', narration: '', debitAccountId: '', creditAccountId: '', amount: 0, ...o });
const vouchers = [
  V({ id: 'J1', narration: 'Member Loan Interest Accrual', amount: 150, lines: [{ id: 'x', accountId: '3313', type: 'Dr', amount: 150 }] }),
  V({ id: 'J2', narration: 'KCC Interest Accrual', amount: 80, lines: [{ id: 'y', accountId: '3313', type: 'Dr', amount: 80 }] }),
  V({ id: 'R1', type: 'receipt', refType: 'loan.repayment', refId: 'L1', amount: 1040, lines: [{ id: 'r1', accountId: '3301', type: 'Dr', amount: 1040 }, { id: 'r2', accountId: '3304', type: 'Cr', amount: 1000 }, { id: 'r3', accountId: '3313', type: 'Cr', amount: 40 }] }),
  V({ id: 'X1', refType: 'loan.interest.release', refId: 'L1', debitAccountId: '2211', creditAccountId: '4408', amount: 40 }),
  V({ id: 'R9', type: 'receipt', refType: 'loan.repayment', refId: 'L2', amount: 10, lines: [{ id: 'q', accountId: '3313', type: 'Cr', amount: 10 }] }),
];
const src = { vouchers, loans, depositAccounts: [], depositTransactions: [], kccLoans: kcc, accounts: [], loanAccruals: accr };
const m = buildMember360(member, src, '2026-09-30');
const l1 = m.view.loans.find((l) => l.id === 'L1');
const want = A.loanInterestDue('L1', accr, vouchers);
ok(l1.interestDue === want.receivable && want.receivable === 60, `L1 interest due = Loan Register rule (${l1.interestDue})`);
ok(l1.interestOverdue === 60, 'L1: overdue part 60 (100 accrued overdue − 40 released)');
ok(m.view.kccLoans[0].interestDue === 80 && m.view.kccLoans[0].interestOverdue === 0, 'KCC: 80 due, not overdue');
ok(m.view.interestDueTotal === 140, 'total interest due 140 (summary card)');
ok(m.snapshot.loanAccruals.every((a) => a.loanId !== 'L2'), "another member's accrual rows never included");
ok(!m.snapshot.loanInterestVouchers.some((v) => v.id === 'R9'), "another member's repayment never included");
const j1 = m.snapshot.loanInterestVouchers.find((v) => v.id === 'J1');
ok(j1 && j1.amount === 0 && j1.lines.length === 0 && !('narration' in j1), 'society-level accrual journal leaves as an id only');
const portal = buildPortalView(JSON.parse(JSON.stringify(m.snapshot)));
ok(same(portal.loans.map((l) => [l.interestDue, l.interestOverdue]), m.view.loans.map((l) => [l.interestDue, l.interestOverdue])) && portal.interestDueTotal === 140, 'portal (same payload over JSON) = staff 360');
const bare = buildPortalView({ ...JSON.parse(JSON.stringify(m.snapshot)), loanAccruals: undefined, loanInterestVouchers: undefined });
ok(bare.interestDueTotal === 0 && bare.loans.every((l) => l.interestDue === 0), '067-only payload (no interest keys) → no interest shown, no crash');
const cancelled = buildMember360(member, { ...src, vouchers: vouchers.map((v) => (v.id === 'R1' || v.id === 'X1' ? { ...v, isDeleted: true } : v)) }, '2026-09-30');
ok(cancelled.view.loans.find((l) => l.id === 'L1').interestDue === 100, 'cancelled repayment ⇒ interest re-opens on Member-360 too');

// ── 2. 070 SQL: additive over 067, scoped, id-only journals ──
const stripSql = (s) => s.replace(/--[^\n]*/g, '');
const fnOf = (sql) => sql.slice(sql.indexOf('create or replace function public.member_portal_snapshot()'), sql.indexOf('$$;', sql.indexOf('create or replace function public.member_portal_snapshot()')) + 3);
const raw067 = readFileSync(pathResolve(ROOT, 'supabase/migrations/067_member_portal_dividend.sql'), 'utf8');
const up = stripSql(readFileSync(pathResolve(ROOT, 'supabase/migrations/070_member_portal_loan_interest.sql'), 'utf8'));
const down = readFileSync(pathResolve(ROOT, 'supabase/migrations/070_member_portal_loan_interest_down.sql'), 'utf8');
const f067 = stripSql(fnOf(raw067));
const pre = f067.slice(f067.indexOf("'ok', true"), f067.lastIndexOf("), '[]'::jsonb)"));
ok(pre.length > 8000 && fnOf(up).includes(pre), 'the whole 067 payload is byte-identical in 070');
ok(/security definer/.test(up) && /set search_path = ''/.test(up) && /v_uid\s+uuid := auth\.uid\(\)/.test(up), 'SECURITY DEFINER, empty search_path, auth.uid() identity');
ok(/revoke all on function public\.member_portal_snapshot\(\) from public, anon/.test(up) && /grant execute on function public\.member_portal_snapshot\(\) to authenticated/.test(up), 'grants unchanged');
ok(!/create policy|create table|alter table/i.test(up), 'function-only change');
const acc = up.slice(up.indexOf("'loanAccruals'"), up.indexOf("'loanInterestVouchers'"));
ok(/a\.society_id = v_link\.society_id/.test(acc) && /l\."memberId" = v_member\.id/.test(acc) && /k\."memberId" = v_member\.id/.test(acc), 'accrual rows: this society + THIS member\'s loans/KCC only');
ok(/coalesce\(a\."isDeleted", false\) = false/.test(acc), 'deleted accrual rows excluded');
const iv = up.slice(up.indexOf("'loanInterestVouchers'"), up.indexOf('end;'));
ok(/jsonb_build_object\('id', v\.id, 'amount', 0, 'lines', '\[\]'::jsonb\)/.test(iv), 'accrual journals: id only');
ok(/v\."refType" in \('loan\.repayment', 'loan\.interest\.release'\)/.test(iv) && /v\."refId" in \(/.test(iv), 'repayments/releases: only this member\'s loans');
ok(/coalesce\(v\."isDeleted", false\) = false/.test(iv), 'deleted vouchers excluded');
ok(fnOf(down) === fnOf(raw067), 'down restores the 067 function byte-for-byte');

// ── 3. UI + staff page ──
const ui = readFileSync(pathResolve(ROOT, 'src/components/member-portal/MemberAccountView.tsx'), 'utf8');
ok(/'ऋण पर प्राप्य ब्याज'/.test(ui) && /show: v\.interestDueTotal > 0/.test(ui), 'summary card when interest is due');
ok((ui.match(/'प्राप्य ब्याज'/g) || []).length >= 2, 'interest-due column on loans AND KCC');
const p360 = readFileSync(pathResolve(ROOT, 'src/pages/Member360.tsx'), 'utf8');
ok(/useLoanAccruals\(\)/.test(p360) && /distributionRuns, loanAccruals,/.test(p360), 'Member-360 feeds the accruals');

console.log(`member loan interest (C): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

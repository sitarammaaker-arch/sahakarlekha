#!/usr/bin/env node
// S2 · migration 076 (voucher_lines + historical FYs) and the backfill planner. CI-safe (no DB).
// The end-to-end run on a restored backup is scripts/db-harness/tests/s2-voucher-lines.mjs.
//
// Run: node scripts/test-s2-voucher-lines.mjs

import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));
const { getVoucherLines } = await import(pathToFileURL(pathResolve(SRC, 'lib/voucherUtils.ts')).href);
const { toMinor } = await import(pathToFileURL(pathResolve(SRC, 'lib/money.ts')).href);
const { buildLines, buildBackfillSql, buildBackfillUndoSql } = await import(pathToFileURL(pathResolve(HERE, 's2-backfill-voucher-lines.mjs')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const rules = { getVoucherLines, toMinor };
const FYS = [
  { id: 'fy-cur', start_date: '2026-04-01', end_date: '2027-03-31' },
  { id: 'fy-old', start_date: '2024-04-01', end_date: '2025-03-31' },
];

console.log('buildLines');
const legacy = { id: 'v1', voucherNo: 'RV/1', society_id: 'S1', date: '2026-05-10', debitAccountId: '3301', creditAccountId: '1102', amount: 100.1, branchId: 'B1' };
const multi = { id: 'v2', voucherNo: 'JV/2', society_id: 'S1', date: '2024-12-01', lines: [
  { id: 'a', accountId: '5201', type: 'Dr', amount: 60.05, narration: 'n' }, { id: 'b', accountId: '5202', type: 'Dr', amount: 40 },
  { id: 'c', accountId: '3301', type: 'Cr', amount: 100.05 }] };
const r = buildLines([legacy, multi], FYS, rules);
ok('no problems for balanced vouchers inside an FY', r.problems.length === 0, r.problems.join('; '));
ok('legacy two-leg → 2 lines, multi-line → one per leg', r.lines.length === 5);
const l1 = r.lines.filter((l) => l.voucher_id === 'v1');
ok('amounts in paise (₹100.10 → 10010)', l1[0].dr_minor === 10010 && l1[1].cr_minor === 10010 && l1[0].cr_minor === 0);
ok('ids follow voucher_entries (<voucherId>-<lineId>) and line_no is 1-based', l1[0].id === 'v1-v1-dr' && l1[0].line_no === 1 && l1[1].line_no === 2);
ok('each line gets the FY that contains the voucher date', l1.every((l) => l.fy_id === 'fy-cur') && r.lines.filter((l) => l.voucher_id === 'v2').every((l) => l.fy_id === 'fy-old'));
ok('branch and narration carried', l1[0].branch_id === 'B1' && r.lines.find((l) => l.id === 'v2-a').narration === 'n');
const skip = buildLines([{ ...legacy, id: 'd', isDeleted: true }, { ...legacy, id: 'p', approvalStatus: 'pending' }], FYS, rules);
ok('cancelled and pending vouchers get no lines', skip.lines.length === 0 && skip.problems.length === 0);
const noFy = buildLines([{ ...legacy, id: 'x', date: '2025-06-01' }], FYS, rules);
ok('a date in no FY is a problem, no lines', noFy.lines.length === 0 && /no financial year contains 2025-06-01/.test(noFy.problems[0]));
const unbal = buildLines([{ ...multi, id: 'u', date: '2026-06-01', lines: [{ id: 'a', accountId: '1', type: 'Dr', amount: 10 }, { id: 'b', accountId: '2', type: 'Cr', amount: 9.99 }] }], FYS, rules);
ok('an unbalanced voucher is a problem, no lines', unbal.lines.length === 0 && /unbalanced/.test(unbal.problems[0]));

console.log('Backfill SQL');
const sql = buildBackfillSql({ runAt: 'x', lines: r.lines, scopeLabel: 'test' });
const pos = (s) => sql.indexOf(s);
ok('one transaction', /\nbegin;\n[\s\S]*\ncommit;\n$/.test(sql));
ok('refuses if lines already exist, before inserting', pos('already exist') > 0 && pos('already exist') < pos('insert into public.voucher_lines'));
ok('post-check: count, per-voucher balance and FY dates', /if n <> 5 or unbalanced > 0 or outside > 0 then/.test(sql));
ok('never updates or deletes', !/\bupdate\s+public\.|\bdelete\s+from\b/i.test(sql));
ok('status posted, source backfill', (sql.match(/'posted', 'backfill'\)/g) || []).length === 5);
ok('undo removes only backfilled lines', /delete from public\.voucher_lines where source = 'backfill';/.test(buildBackfillUndoSql({ runAt: 'x' })));

console.log('Migration 076');
const raw = readFileSync(pathResolve(HERE, '../supabase/migrations/076_voucher_lines.sql'), 'utf8');
const code = raw.replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''").toLowerCase();
const noPriv = code.replace(/\b(revoke|grant)\b[^;]*;/g, ' ');
ok('wrapped in begin … commit', /^\s*begin;[\s\S]*commit;\s*$/.test(code));
ok('refuses before any change if a voucher is after its OPEN FY (checked on financial_years)', code.indexOf('raise exception') < code.indexOf('insert into public.financial_years') && /cur\.status = ''/.test(code) && /> cur\.end_date::text/.test(code));
ok('historical FYs are inserted closed, never open', /'closed',\s*now\(\),\s*'backfill \(S2\): pre-M1 history'/.test(raw) && /on conflict \(society_id, fy_label\) do nothing/.test(code));
ok('no UPDATE / DELETE / DROP of existing data', !/\bupdate\s+(public\.)?\w+\s+set\b|\bdelete\s+from\b|\bdrop\s+table\b/.test(noPriv));
ok('voucher_lines: FKs to vouchers, financial_years and accounts (id, society_id)', /references public\.vouchers \(id\)/.test(code) && /references public\.financial_years \(id\)/.test(code) && /foreign key \(account_id, society_id\) references public\.accounts \(id, society_id\)/.test(code));
ok('amounts in paise, never both sides', /dr_minor\s+bigint/.test(code) && /not \(dr_minor > 0 and cr_minor > 0\)/.test(code));
ok('one SELECT policy, tenant-scoped; writes revoked', (noPriv.match(/create policy/g) || []).length === 1 && /for select using \(society_id::text = get_current_society_id\(\)\)/.test(noPriv) && /revoke insert, update, delete, truncate on public\.voucher_lines from anon, authenticated/.test(code));
ok('table created empty (no insert into voucher_lines)', !/insert into public\.voucher_lines/.test(code));
ok("records '076' last", /values \('076', 'voucher_lines'\)\s*on conflict \(version\) do nothing;\s*commit;\s*$/.test(raw));
const down = readFileSync(pathResolve(HERE, '../supabase/migrations/076_voucher_lines_down.sql'), 'utf8');
ok('down drops voucher_lines, removes only the backfilled historical FYs and 076', /drop table if exists public\.voucher_lines/.test(down) && /delete from public\.financial_years where close_authority = 'backfill \(S2\): pre-M1 history'/.test(down) && /version = '076'/.test(down));

console.log(`\nS2 voucher_lines (unit/static): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

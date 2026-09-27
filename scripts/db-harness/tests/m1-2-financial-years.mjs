#!/usr/bin/env node
// M1-2 · migrations 072 (app_migrations) + 073 (financial_years) against the restored backup.
//
// Needs a running harness (`harness.mjs up --dump <file>`) that 072/073 have NOT been applied to.
// Applies the ups exactly as the SQL Editor would (whole file, stop on error), checks the
// invariants, RLS, idempotency and that no existing table changed, then runs the downs.
//
// Run: node scripts/db-harness/tests/m1-2-financial-years.mjs

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { inRollback } from '../lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '../../..');
const MIG = (f) => pathResolve(ROOT, 'supabase/migrations', f);
const apply = (...files) => execFileSync(process.execPath, [pathResolve(HERE, '../harness.mjs'), 'apply', ...files.map(MIG)], { stdio: 'pipe' });

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const tableCounts = () => inRollback(async (tx) => {
  const { rows } = await tx.query(`
    select table_schema || '.' || table_name as t,
           (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as n
    from information_schema.tables
    where table_schema in ('public', 'auth', 'storage') and table_type = 'BASE TABLE'
      and table_name not in ('app_migrations', 'financial_years')`);
  return Object.fromEntries(rows.map((r) => [r.t, String(r.n)]));
});

const before = await tableCounts();
const pre = await inRollback((tx) => tx.query("select to_regclass('public.financial_years') as fy, to_regclass('public.app_migrations') as am"));
if (pre.rows[0].fy || pre.rows[0].am) throw new Error('m1-2: 072/073 already applied — bring the harness down and up again');

console.log('Apply 072 + 073');
apply('072_app_migrations.sql', '073_financial_years.sql');
ok('both migrations applied without error', true);

await inRollback(async (tx) => {
  const settings = (await tx.query(`
    select society_id::text as sid, "financialYear" as fy, "periodLockDate" as plock from public.society_settings`)).rows;
  const valid = settings.filter((s) => /^\d{4}-\d{2}$/.test(s.fy || '') && Number(s.fy.slice(5)) === (Number(s.fy.slice(0, 4)) + 1) % 100);
  const fys = (await tx.query('select society_id, fy_label, start_date::text as s, end_date::text as e, status, period_lock_date::text as pl from public.financial_years')).rows;
  const bySid = Object.fromEntries(fys.map((f) => [f.society_id, f]));

  console.log('Backfill');
  const mig = (await tx.query('select version from public.app_migrations order by 1')).rows.map((r) => r.version);
  ok('app_migrations records 072 and 073', mig.join(',') === '072,073', mig.join(','));
  ok(`one FY per society with a valid label (${valid.length} of ${settings.length})`, fys.length === valid.length, `got ${fys.length}`);
  ok('every FY label equals the society_settings label (decision A)', valid.every((s) => bySid[s.sid]?.fy_label === s.fy));
  ok('dates are 1 Apr – 31 Mar of the label', fys.every((f) => f.s === `${f.fy_label.slice(0, 4)}-04-01` && f.e === `${Number(f.fy_label.slice(0, 4)) + 1}-03-31`));
  ok('all backfilled FYs are open', fys.every((f) => f.status === 'open'));
  const outOfRange = settings.filter((s) => s.plock && bySid[s.sid] && !(s.plock >= bySid[s.sid].s && s.plock <= bySid[s.sid].e));
  ok(`period lock outside the FY is NOT copied (${outOfRange.length} such)`, outOfRange.every((s) => bySid[s.sid].pl === null));
  ok('stale labels are kept as-is (2025-26 / 2021-22 societies)', fys.some((f) => f.fy_label !== '2026-27'));

  console.log('Constraints (as owner)');
  const A = fys[0];
  const ins = (vals) => tx.attempt(
    `insert into public.financial_years (society_id, fy_label, start_date, end_date, status, audited_at, period_lock_date)
     values ($1, $2, $3, $4, $5, $6, $7)`, vals);
  const y = Number(A.fy_label.slice(0, 4));
  const next = `${y + 1}-${String((y + 2) % 100).padStart(2, '0')}`;
  // Each refusal must come from the intended constraint, not an incidental one.
  const refusedBy = async (vals, code, constraint) => {
    const r = await ins(vals);
    return !r.ok && r.error.code === code && (!constraint || String(r.error.constraint || r.error.message).includes(constraint));
  };
  ok('duplicate label refused (unique)', await refusedBy([A.society_id, A.fy_label, A.s, A.e, 'closed', null, null], '23505', 'financial_years_label_unique'));
  ok('overlapping dates refused (exclusion)', await refusedBy([A.society_id, next, `${y + 1}-01-01`, `${y + 1}-12-31`, 'closed', null, null], '23P01', 'financial_years_no_overlap'));
  ok('second open FY refused (one open per society)', await refusedBy([A.society_id, next, `${y + 1}-04-01`, `${y + 2}-03-31`, 'open', null, null], '23505', 'financial_years_one_open'));
  ok('inconsistent label refused (label format)', await refusedBy([A.society_id, `${y + 5}-${String((y + 7) % 100).padStart(2, '0')}`, `${y + 5}-04-01`, `${y + 6}-03-31`, 'closed', null, null], '23514', 'financial_years_label_format'));
  ok('label year ≠ start year refused (label format)', await refusedBy([A.society_id, next, `${y + 5}-04-01`, `${y + 6}-03-31`, 'closed', null, null], '23514', 'financial_years_label_format'));
  ok('audited without audited_at refused', await refusedBy([A.society_id, next, `${y + 1}-04-01`, `${y + 2}-03-31`, 'audited', null, null], '23514', 'financial_years_audited_has_date'));
  ok('period lock outside the FY refused', await refusedBy([A.society_id, next, `${y + 1}-04-01`, `${y + 2}-03-31`, 'closed', null, `${y + 3}-01-01`], '23514', 'financial_years_period_lock_in_year'));
  ok('a valid non-overlapping closed FY is accepted', (await ins([A.society_id, next, `${y + 1}-04-01`, `${y + 2}-03-31`, 'closed', null, null])).ok);

  console.log('RLS');
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active)
                  values (gen_random_uuid(), $1, 'harness-fy-admin@harness.test', 'admin', 'db-harness', true)`, [A.society_id]);
  await tx.as({ email: 'harness-fy-admin@harness.test', user_role: 'admin' });
  const mine = (await tx.query('select society_id from public.financial_years')).rows;
  ok("admin sees only its own society's FYs", mine.length >= 1 && mine.every((r) => r.society_id === A.society_id), `saw ${mine.length}`);
  ok('admin may NOT insert an FY', !(await tx.attempt(`insert into public.financial_years (society_id, fy_label, start_date, end_date, status)
     values ($1, '2040-41', '2040-04-01', '2041-03-31', 'closed')`, [A.society_id])).ok);
  const upd = await tx.attempt("update public.financial_years set status = 'closing' where society_id = $1", [A.society_id]);
  ok('admin may NOT update an FY', !upd.ok || upd.rowCount === 0);
  const del = await tx.attempt('delete from public.financial_years where society_id = $1', [A.society_id]);
  ok('admin may NOT delete an FY', !del.ok || del.rowCount === 0);
  ok('admin may NOT read app_migrations', !(await tx.attempt('select * from public.app_migrations')).ok);
  await tx.asAnon();
  const anon = await tx.attempt('select count(*)::int as n from public.financial_years');
  ok('anon sees no FYs', !anon.ok || anon.rows[0].n === 0);
});

console.log('Idempotency');
const n1 = (await inRollback((tx) => tx.query('select count(*)::int as n from public.financial_years'))).rows[0].n;
apply('072_app_migrations.sql', '073_financial_years.sql');
const n2 = (await inRollback((tx) => tx.query('select count(*)::int as n from public.financial_years'))).rows[0].n;
ok('re-running 072 + 073 is harmless (same row count)', n1 === n2, `${n1} → ${n2}`);

console.log('No existing table changed');
const after = await tableCounts();
const changed = Object.keys(before).filter((t) => before[t] !== after[t]);
ok(`all ${Object.keys(before).length} existing tables have the same row count`, changed.length === 0, changed.join(', '));

console.log('Down');
apply('073_financial_years_down.sql', '072_app_migrations_down.sql');
const gone = (await inRollback((tx) => tx.query("select to_regclass('public.financial_years') as fy, to_regclass('public.app_migrations') as am"))).rows[0];
ok('downs remove both tables', !gone.fy && !gone.am);
const afterDown = await tableCounts();
ok('existing tables still unchanged after the downs', Object.keys(before).every((t) => before[t] === afterDown[t]));

console.log(`\nM1-2 financial_years: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
// M1-3 · migration 074 (account_roles + accounts.report_class) against the restored backup.
//
// Needs a running harness that 072–074 have NOT been applied to. Applies 072 + 074 as the SQL
// Editor would, checks FK/constraints/RLS, proves no existing value changed (accounts compared by
// checksum with report_class excluded), idempotency, and the downs.
//
// Run: node scripts/db-harness/tests/m1-3-account-roles.mjs

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { inRollback } from '../lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIG = (f) => pathResolve(HERE, '../../..', 'supabase/migrations', f);
const apply = (...files) => execFileSync(process.execPath, [pathResolve(HERE, '../harness.mjs'), 'apply', ...files.map(MIG)], { stdio: 'pipe' });

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const snapshot = () => inRollback(async (tx) => {
  const counts = (await tx.query(`
    select table_schema || '.' || table_name as t,
           (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as n
    from information_schema.tables
    where table_schema in ('public', 'auth', 'storage') and table_type = 'BASE TABLE'
      and table_name not in ('app_migrations', 'financial_years', 'account_roles')`)).rows;
  const acc = (await tx.query(`
    select md5(string_agg((to_jsonb(a) - 'report_class')::text, '|' order by a.society_id, a.id)) as h from public.accounts a`)).rows[0].h;
  return { counts: Object.fromEntries(counts.map((r) => [r.t, String(r.n)])), acc };
});

const pre = (await inRollback((tx) => tx.query(
  "select to_regclass('public.account_roles') as ar, to_regclass('public.app_migrations') as am, exists (select 1 from information_schema.columns where table_name = 'accounts' and column_name = 'report_class') as rc"))).rows[0];
if (pre.ar || pre.am || pre.rc) throw new Error('m1-3: 072/074 already applied — bring the harness down and up again');
const before = await snapshot();

console.log('Apply 072 + 074');
apply('072_app_migrations.sql', '074_account_roles.sql');
ok('migrations applied without error', true);

await inRollback(async (tx) => {
  console.log('Shape');
  ok('account_roles is empty', (await tx.query('select count(*)::int as n from public.account_roles')).rows[0].n === 0);
  ok('every accounts.report_class is NULL', (await tx.query('select count(*)::int as n from public.accounts where report_class is not null')).rows[0].n === 0);
  ok("app_migrations records '074'", (await tx.query("select 1 from public.app_migrations where version = '074'")).rowCount === 1);

  // Two societies that both have account '3301' (template id) — the composite FK must keep them apart.
  const [A, B] = (await tx.query(`
    select society_id from public.accounts where id = '3301' group by society_id order by society_id limit 2`)).rows.map((r) => r.society_id);
  const onlyB = (await tx.query(`
    select b.id from public.accounts b
    where b.society_id = $1 and not exists (select 1 from public.accounts a where a.society_id = $2 and a.id = b.id) limit 1`, [B, A])).rows[0]?.id;

  const map = (sid, role, acc) => tx.attempt('insert into public.account_roles (society_id, role, account_id) values ($1, $2, $3)', [sid, role, acc]);
  const refusedWith = (r, code) => !r.ok && r.error.code === code;

  console.log('FK and constraints (as owner)');
  ok("A → A's own 3301 accepted", (await map(A, 'cash', '3301')).ok);
  ok('duplicate role for A refused', refusedWith(await map(A, 'cash', '3301'), '23505'));
  ok('non-existent account refused (FK)', refusedWith(await map(A, 'bank.default', 'NO-SUCH-ACCOUNT'), '23503'));
  if (onlyB) ok("A → an account that exists only in B refused (FK is per society)", refusedWith(await map(A, 'bank.default', onlyB), '23503'));
  ok('malformed role key refused', refusedWith(await map(A, 'Cash-In-Hand', '3301'), '23514'));
  ok('an account a role points at cannot be deleted', refusedWith(await tx.attempt('delete from public.accounts where society_id = $1 and id = $2', [A, '3301']), '23503'));
  ok('a valid report_class is accepted', (await tx.attempt("update public.accounts set report_class = 'trading_income' where society_id = $1 and id = '3301'", [A])).ok);
  ok('an unknown report_class is refused', refusedWith(await tx.attempt("update public.accounts set report_class = 'sales' where society_id = $1 and id = '3301'", [A]), '23514'));

  console.log('RLS');
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active)
                  values (gen_random_uuid(), $1, 'harness-roles-admin@harness.test', 'admin', 'db-harness', true)`, [A]);
  await map(B, 'cash', '3301');
  await tx.as({ email: 'harness-roles-admin@harness.test', user_role: 'admin' });
  const seen = (await tx.query('select society_id from public.account_roles')).rows;
  ok("admin sees only its own society's roles", seen.length === 1 && seen[0].society_id === A, JSON.stringify(seen));
  ok('admin may NOT insert a role', !(await tx.attempt("insert into public.account_roles (society_id, role, account_id) values ($1, 'rounding', '3301')", [A])).ok);
  const upd = await tx.attempt("update public.account_roles set account_id = '3302' where society_id = $1", [A]);
  ok('admin may NOT update a role', !upd.ok || upd.rowCount === 0);
  const del = await tx.attempt('delete from public.account_roles where society_id = $1', [A]);
  ok('admin may NOT delete a role', !del.ok || del.rowCount === 0);
  await tx.asAnon();
  const anon = await tx.attempt('select count(*)::int as n from public.account_roles');
  ok('anon sees no roles', !anon.ok || anon.rows[0].n === 0);
});

console.log('Idempotency');
apply('072_app_migrations.sql', '074_account_roles.sql');
ok('re-running 072 + 074 is harmless', true);

console.log('No existing value changed');
const after = await snapshot();
const changed = Object.keys(before.counts).filter((t) => before.counts[t] !== after.counts[t]);
ok(`all ${Object.keys(before.counts).length} existing tables have the same row count`, changed.length === 0, changed.join(', '));
ok('accounts rows are byte-identical apart from the new column (checksum)', before.acc === after.acc);

console.log('Down');
apply('074_account_roles_down.sql', '072_app_migrations_down.sql');
const gone = (await inRollback((tx) => tx.query(
  "select to_regclass('public.account_roles') as ar, exists (select 1 from information_schema.columns where table_name = 'accounts' and column_name = 'report_class') as rc"))).rows[0];
ok('downs remove account_roles and accounts.report_class', !gone.ar && !gone.rc);
const afterDown = await snapshot();
ok('accounts checksum unchanged after the downs', afterDown.acc === before.acc);

console.log(`\nM1-3 account_roles: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

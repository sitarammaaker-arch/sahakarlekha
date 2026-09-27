#!/usr/bin/env node
// M1-4a · the database behaviours the app's account-delete rollback relies on, proven against the
// restored backup with 072 + 074 applied:
//   1. deleting an account a role points at fails with 23503 (→ "linked to an accounting role");
//   2. a delete RLS forbids returns ZERO rows and NO error (→ the app must count deleted rows);
//   3. the COA reset's "delete every account of the society" is all-or-nothing when one is linked.
// Everything runs inside a rolled-back transaction.
//
// Run (harness up, 072/074 not yet applied): node scripts/db-harness/tests/m1-4a-account-delete.mjs

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

apply('072_app_migrations.sql', '074_account_roles.sql');

await inRollback(async (tx) => {
  const [{ society_id: A }] = (await tx.query(`
    select society_id from public.accounts where id = '3301' group by society_id order by count(*) desc, society_id limit 1`)).rows;
  const nAcc = async () => (await tx.query('select count(*)::int as n from public.accounts where society_id = $1', [A])).rows[0].n;
  const before = await nAcc();

  await tx.query("insert into public.account_roles (society_id, role, account_id) values ($1, 'cash', '3301')", [A]);
  for (const [email, role] of [['harness-del-admin@harness.test', 'admin'], ['harness-del-viewer@harness.test', 'viewer']]) {
    await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active)
                    values (gen_random_uuid(), $1, $2, $3, 'db-harness', true)`, [A, email, role]);
  }

  console.log('1 · mapped account');
  await tx.as({ email: 'harness-del-admin@harness.test', user_role: 'admin' });
  const mapped = await tx.attempt("delete from public.accounts where id = '3301' and society_id = $1 returning id", [A]);
  ok('admin deleting an account a role points at fails with 23503', !mapped.ok && mapped.error.code === '23503', mapped.ok ? 'deleted' : mapped.error.code);

  console.log('2 · RLS-forbidden delete');
  await tx.as({ email: 'harness-del-viewer@harness.test', user_role: 'viewer' });
  const probeId = (await (async () => { await tx.asOwner(); return (await tx.query(
    "select id from public.accounts a where society_id = $1 and id <> '3301' and not exists (select 1 from public.account_roles r where r.society_id = a.society_id and r.account_id = a.id) limit 1", [A])).rows[0].id; })());
  await tx.as({ email: 'harness-del-viewer@harness.test', user_role: 'viewer' });
  const forbidden = await tx.attempt('delete from public.accounts where id = $1 and society_id = $2 returning id', [probeId, A]);
  ok('viewer delete returns NO error …', forbidden.ok, forbidden.ok ? '' : forbidden.error.message);
  ok('… and ZERO rows (so the app must count what was deleted)', forbidden.ok && forbidden.rowCount === 0);
  await tx.asOwner();
  ok('the row is still there', (await tx.query('select 1 from public.accounts where id = $1 and society_id = $2', [probeId, A])).rowCount === 1);

  console.log('3 · COA reset delete-all');
  await tx.as({ email: 'harness-del-admin@harness.test', user_role: 'admin' });
  const all = await tx.attempt('delete from public.accounts where society_id = $1', [A]);
  ok('deleting every account of the society fails when one is role-linked (23503)', !all.ok && all.error.code === '23503');
  await tx.asOwner();
  ok('… and deletes NOTHING (all-or-nothing)', (await nAcc()) === before, `${before} → ${await nAcc()}`);
});

apply('074_account_roles_down.sql', '072_app_migrations_down.sql');
console.log(`\nM1-4a DB behaviour: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

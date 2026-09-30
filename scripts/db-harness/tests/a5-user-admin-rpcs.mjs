#!/usr/bin/env node
// Phase-2 A5 · anon / cross-tenant calls to app_add_society_user and app_reset_society_user_password.
// Their guard was `if v_caller is not null and not <manager check>` — a caller with NO JWT email
// (anon) skipped authorization entirely. Precondition: harness up (086 applied for the fixed result).
// Everything runs inside one rolled-back transaction.
//
// Run: node scripts/db-harness/tests/a5-user-admin-rpcs.mjs

import { inRollback } from '../lib.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

await inRollback(async (tx) => {
  const socs = (await tx.query(`select distinct society_id::text s from public.society_users where society_id::text ~ '^[0-9a-f-]{36}$' limit 2`)).rows.map((x) => x.s);
  const [S1, S2] = socs;
  await tx.query(`delete from public.subscriptions where society_id in ($1, $2)`, [S1, S2]);   // no seat cap in the way
  const A = 'a5-admin@harness.test', X = 'a5-evil@harness.test';
  await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, 'admin', 'A5', true), (gen_random_uuid(), $3, $4, 'admin', 'A5x', true)`, [S1, A, S2, X]);
  const [{ victim }] = (await tx.query(`select su.id::text victim from public.society_users su join auth.users u on lower(u.email) = lower(su.email)
     where su.society_id::text = $1 and lower(su.email) <> $2 and not exists (select 1 from public.platform_admins p where lower(p.email) = lower(su.email))
       and not exists (select 1 from public.society_users o where lower(o.email) = lower(su.email) and o.society_id <> su.society_id) limit 1`, [S1, A])).rows;
  const added = async (email) => { await tx.asOwner(); return Number((await tx.query('select count(*) n from public.society_users where email = $1', [email])).rows[0].n); };
  const pwOf = async () => { await tx.asOwner(); return (await tx.query(`select u.encrypted_password p from auth.users u join public.society_users su on lower(su.email) = lower(u.email) where su.id::text = $1`, [victim])).rows[0].p; };
  const before = await pwOf();

  console.log('Anonymous (no JWT)');
  await tx.asAnon();
  const r1 = await tx.attempt(`select public.app_add_society_user('a5-anon@harness.test', 'Passw0rd!', 'Anon', 'admin', $1, true) as r`, [S1]);
  ok('anon cannot add an admin to a society', !r1.ok && (await added('a5-anon@harness.test')) === 0, r1.ok ? 'ADDED' : '');
  await tx.asAnon();
  const r2 = await tx.attempt(`select public.app_reset_society_user_password($1, 'Hijack123!') as r`, [victim]);
  ok('anon cannot reset a society user\'s password', !r2.ok && (await pwOf()) === before, r2.ok ? 'RESET' : '');

  console.log('Authenticated, other society');
  await tx.as({ email: X, user_role: 'admin' });
  ok('an admin of S2 cannot add a user to S1', !(await tx.attempt(`select public.app_add_society_user('a5-x@harness.test', 'Passw0rd!', 'X', 'accountant', $1, true) as r`, [S1])).ok);
  await tx.as({ email: X, user_role: 'admin' });
  ok('an admin of S2 cannot reset an S1 password', !(await tx.attempt(`select public.app_reset_society_user_password($1, 'Hijack123!') as r`, [victim])).ok && (await pwOf()) === before);
  await tx.as({ user_role: 'admin' });
  ok('a JWT with no email is refused (add)', !(await tx.attempt(`select public.app_add_society_user('a5-ne@harness.test', 'Passw0rd!', 'N', 'accountant', $1, true) as r`, [S1])).ok);

  console.log('Allowed');
  await tx.as({ email: A, user_role: 'admin' });
  const r3 = await tx.attempt(`select public.app_add_society_user('a5-new@harness.test', 'Passw0rd!', 'New', 'accountant', $1, true) as r`, [S1]);
  ok('S1\'s admin adds a user to S1', r3.ok && (await added('a5-new@harness.test')) === 1, r3.ok ? '' : r3.error.message);
  await tx.as({ email: A, user_role: 'admin' });
  const r4 = await tx.attempt(`select public.app_reset_society_user_password($1, 'NewPass123!') as r`, [victim]);
  ok('S1\'s admin resets an S1 user\'s password', r4.ok && (await pwOf()) !== before, r4.ok ? '' : r4.error.message);
});

console.log(`\nA5 user-admin RPCs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
// 094 · anon EXECUTE on SECURITY DEFINER functions + raw-password writes into society_users.
// Before 094, anon could call app_register_admin / society_has_users / app_set_my_password /
// pay_payslip_lines directly, and the anon policy society_users_bootstrap let anyone insert an
// 'admin' row into a society that had no users. The user RPCs also passed the raw password into
// society_users.password (blanked only by the 012 trigger).
// After 094: those calls are refused, while signup (register_society), password reset and
// add-user keep working and never hand the password to society_users.
// Precondition: harness up (094 applied for the fixed result). Everything is rolled back.
//
// Run: node scripts/db-harness/tests/a7-definer-exec-grants.mjs

import { inRollback } from '../lib.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const denied = (r) => !r.ok && r.error?.code === '42501';
const why = (r) => (r.ok ? 'ALLOWED' : `${r.error.code} ${r.error.message}`);

await inRollback(async (tx) => {
  const S = crypto.randomUUID();
  const ADMIN = 'a7-admin@harness.test';

  // Measure the 012 trigger's job away: with it disabled, society_users.password shows exactly
  // what each function writes.
  await tx.asOwner();
  await tx.query('alter table public.society_users disable trigger trg_force_blank_su_password');
  const suPw = async (email) => {
    await tx.asOwner();
    return (await tx.query('select password from public.society_users where email = $1', [email])).rows[0]?.password;
  };
  const authPw = async (email) => {
    await tx.asOwner();
    return (await tx.query('select encrypted_password p from auth.users where email = $1', [email])).rows[0]?.p;
  };

  console.log('Anonymous (no JWT) — refused');
  await tx.asAnon();
  const r1 = await tx.attempt(`select public.app_register_admin('a7-anon@harness.test', 'Passw0rd!', 'Anon', $1)`, [S]);
  ok('anon cannot call app_register_admin directly', denied(r1), why(r1));
  await tx.asAnon();
  const r2 = await tx.attempt(`select public.society_has_users($1)`, [S]);
  ok('anon cannot call society_has_users', denied(r2), why(r2));
  await tx.asAnon();
  const r3 = await tx.attempt(`select public.app_set_my_password('Passw0rd!')`);
  ok('anon cannot call app_set_my_password', denied(r3), why(r3));
  await tx.asAnon();
  const r4 = await tx.attempt(`select * from public.pay_payslip_lines(gen_random_uuid())`);
  ok('anon cannot call pay_payslip_lines', denied(r4), why(r4));

  // A society with no users: the case the old bootstrap policy / app_register_admin left open.
  await tx.asOwner();
  const E = crypto.randomUUID();
  await tx.query(`insert into public.societies (id, name, registration_no, district, state) values ($1, 'A7 Empty', $2, 'X', 'Haryana')`, [E, `A7-${E}`]);
  await tx.asAnon();
  const r5 = await tx.attempt(`insert into public.society_users (society_id, email, name, role, is_active, password) values ($1, 'a7-squat@harness.test', 'Squat', 'admin', true, '')`, [E]);
  ok('anon cannot insert itself as admin of a society with no users', !r5.ok, why(r5));

  console.log('Anonymous — public flows still work');
  await tx.asAnon();
  const reg = await tx.attempt(`select public.register_society($1, $2, 'Passw0rd!', 'A7 Admin', $3::jsonb, $4::jsonb, '[]'::jsonb) as r`, [
    S, ADMIN,
    JSON.stringify({ id: S, name: 'A7 Society', registration_no: `A7-${S}`, district: 'Karnal', state: 'Haryana', financial_year: '2026-27' }),
    JSON.stringify({ id: S, society_id: S, name: 'A7 Society', registrationNo: `A7-${S}`, financialYear: '2026-27', financialYearStart: '2026-04-01', district: 'Karnal', state: 'Haryana', email: ADMIN }),
  ]);
  const regRes = reg.ok ? reg.rows[0].r : null;
  ok('signup: anon register_society succeeds', regRes?.ok === true, reg.ok ? JSON.stringify(regRes) : why(reg));
  ok('signup: admin login created with a bcrypt credential', /^\$2[aby]\$/.test((await authPw(ADMIN)) ?? ''));
  ok('signup: society_users.password left blank (no raw password)', (await suPw(ADMIN)) === '', `got ${JSON.stringify(await suPw(ADMIN))}`);
  await tx.asOwner();
  ok('signup: new-society trial trigger still fires', Number((await tx.query('select count(*) n from public.subscriptions where society_id::text = $1', [S])).rows[0].n) === 1);
  for (const sql of [`select public.increment_blog_view('a7-harness-slug')`, `select * from public.public_reviews()`, `select * from public.verify_certificate('SL-NONE', 'Nobody')`]) {
    await tx.asAnon();
    const r = await tx.attempt(sql);
    ok(`anon still allowed: ${sql.match(/public\.(\w+)/)[1]}`, r.ok, why(r));
  }

  console.log('Authenticated');
  const before = await authPw(ADMIN);
  await tx.as({ email: ADMIN, user_role: 'admin' });
  const r6 = await tx.attempt(`select public.app_set_my_password('NewPass123!') as r`);
  ok('reset: app_set_my_password works for the signed-in user', r6.ok && r6.rows[0].r === true, why(r6));
  ok('reset: auth.users credential changed', (await authPw(ADMIN)) !== before);
  ok('reset: society_users.password still blank', (await suPw(ADMIN)) === '');

  await tx.asOwner();
  await tx.query('update public.subscriptions set seats_limit = null where society_id::text = $1', [S]);   // trial seat cap out of the way
  await tx.as({ email: ADMIN, user_role: 'admin' });
  const r7 = await tx.attempt(`select public.app_add_society_user('a7-acct@harness.test', 'Passw0rd!', 'Acct', 'accountant', $1, true) as r`, [S]);
  ok('add-user: admin adds a user', r7.ok, why(r7));
  ok('add-user: society_users.password blank', (await suPw('a7-acct@harness.test')) === '');

  await tx.as({ email: ADMIN, user_role: 'admin' });
  const r8 = await tx.attempt(`select public.app_register_admin('a7-auth@harness.test', 'Passw0rd!', 'X', $1)`, [E]);
  ok('a signed-in user cannot call app_register_admin directly', denied(r8), why(r8));
  await tx.as({ email: ADMIN, user_role: 'admin' });
  const r9 = await tx.attempt(`select * from public.pay_payslip_lines(gen_random_uuid())`);
  // The harness dump holds public/auth/storage only (no pay_calc), so the body may fail with 42P01 —
  // what matters is that EXECUTE itself is not refused.
  ok('a signed-in user can still call pay_payslip_lines', !denied(r9), why(r9));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

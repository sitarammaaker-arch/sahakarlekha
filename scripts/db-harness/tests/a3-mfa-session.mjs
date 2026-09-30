#!/usr/bin/env node
// Phase-2 A3 (SEC-03) + A4 · migration 085 on the restored backup: 2FA bound to the session.
// The token hook stamps mfa_pending for an enrolled, unverified session; every tenant / privilege
// helper then yields nothing; a correct code (or recovery code) verifies the session; 5 wrong codes
// in 15 minutes freeze the checks. Precondition: harness up with 084 + 085 applied.
// Everything runs inside one rolled-back transaction.
//
// Run: node scripts/db-harness/tests/a3-mfa-session.mjs

import { createHmac, randomUUID } from 'node:crypto';
import { inRollback } from '../lib.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32decode(s) {
  let bits = 0, val = 0; const out = [];
  for (const ch of s.toUpperCase()) { const i = B32.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { bits -= 8; out.push((val >> bits) & 255); } }
  return Buffer.from(out);
}
function totp(secret, at = Date.now() / 1000) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(at / 30)));
  const h = createHmac('sha1', b32decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}
const wrong = (secret) => String((Number(totp(secret)) + 500000) % 1000000).padStart(6, '0');
const SEC_U = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const SEC_P = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const denied = (r) => !r.ok && r.error.code === '42501';
const val = (r) => (r.ok ? r.rows[0].r : `ERR ${r.error?.message}`);

await inRollback(async (tx) => {
  const [{ sid }] = (await tx.query(`select society_id::text sid from public.vouchers where society_id::text ~ '^[0-9a-f-]{36}$' group by 1 order by count(*) desc limit 1`)).rows;
  const U = 'a3-user@harness.test', A = 'a3-admin@harness.test', N = 'a3-plain@harness.test', P = 'a3-platform@harness.test';
  for (const [email, role] of [[U, 'accountant'], [A, 'admin'], [N, 'accountant']]) {
    await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, $3, 'A3', true)`, [sid, email, role]);
  }
  await tx.query(`insert into public.platform_admins (email, name, is_active, mfa_enabled) values ($1, 'A3 PA', true, true)`, [P]);
  await tx.query(`insert into public.user_mfa (email, secret) values ($1, $2)`, [P, SEC_P]);

  // What GoTrue would stamp for (email, session): run the hook as the owner.
  const hook = async (email, session) => {
    await tx.asOwner();
    const r = await tx.query(`select public.custom_access_token_hook($1::jsonb) -> 'claims' as c`,
      [JSON.stringify({ user_id: randomUUID(), claims: { email, session_id: session, role: 'authenticated', aal: 'aal1' } })]);
    return r.rows[0].c;
  };
  // Sign in as (email, session) with exactly the claims the hook produces.
  const login = async (email, session) => { const c = await hook(email, session); await tx.as(c); return c; };
  const one = async (sql, params) => (await tx.query(sql, params)).rows[0];

  console.log('Non-enrolled users are unaffected');
  let c = await login(N, 'sN');
  ok('hook: not enrolled → mfa_pending false, user_role still stamped', c.mfa_pending === false && c.user_role === 'accountant', JSON.stringify(c));
  const seen = Number((await one('select count(*) n from public.vouchers')).n);
  ok('a normal session sees its society\'s vouchers', seen > 0, String(seen));
  await tx.as({ email: N, role: 'authenticated' });   // a token minted before 085 (no claim)
  ok('a pre-085 token (no claim) is not pending', Number((await one('select count(*) n from public.vouchers')).n) === seen);

  console.log('Enrol marks the enrolling session verified');
  await login(U, 's1');
  ok('U enrols in session s1', val(await tx.attempt('select public.app_mfa_enroll(null, $1, $2) as r', [SEC_U, totp(SEC_U)])) === true);
  ok('hook: s1 (enrolled in it) → not pending', (await hook(U, 's1')).mfa_pending === false);
  ok('hook: a NEW session s2 → pending', (await hook(U, 's2')).mfa_pending === true);
  ok('hook: enrolled + no session_id claim → pending', (await hook(U, null)).mfa_pending === true);

  console.log('A pending token sees nothing (the SEC-03 bypass is closed)');
  await login(U, 's2');
  ok('no vouchers', Number((await one('select count(*) n from public.vouchers')).n) === 0);
  ok('no members / accounts', Number((await one('select (select count(*) from public.members) + (select count(*) from public.accounts) n')).n) === 0);
  ok('current_user_society_ids() is empty and get_current_society_id() is null',
    Number((await one('select count(*) n from public.current_user_society_ids()')).n) === 0 && (await one('select public.get_current_society_id() s')).s === null);
  ok('get_current_user_role() is null; is_society_admin() false', (await one('select public.get_current_user_role() r')).r === null && (await one('select public.is_society_admin($1) a', [sid])).a === false);
  const ownRows = (await tx.query('select email, mfa_enabled from public.society_users')).rows;
  ok('reads ONLY its own society_users row (login needs mfa_enabled)', ownRows.length === 1 && ownRows[0].email === U && ownRows[0].mfa_enabled === true, JSON.stringify(ownRows));
  const ins = await tx.attempt(`insert into public.vouchers (id, society_id, "voucherNo", type, date, "debitAccountId", "creditAccountId", amount, narration) values ($1, $2, 'X/1', 'journal', '2026-06-01', '5301', '3301', 1, 'a3')`, [randomUUID(), sid]);
  ok('cannot insert a voucher', !ins.ok, ins.ok ? 'inserted' : '');
  ok('post_voucher refuses', !(await tx.attempt(`select public.post_voucher('{}'::jsonb) as r`)).ok);
  ok('cannot re-enrol (overwrite the secret) without passing 2FA', denied(await tx.attempt('select public.app_mfa_enroll(null, $1, $2) as r', [SEC_P, totp(SEC_P)])));

  console.log('Passing the challenge verifies the session');
  ok('a wrong code → false, still pending', val(await tx.attempt('select public.app_verify_mfa(null, $1) as r', [wrong(SEC_U)])) === false && (await hook(U, 's2')).mfa_pending === true);
  await login(U, 's2');
  ok('the right code → true', val(await tx.attempt('select public.app_verify_mfa(null, $1) as r', [totp(SEC_U)])) === true);
  c = await login(U, 's2');   // = client refreshSession()
  ok('refreshed token is not pending and sees the vouchers', c.mfa_pending === false && Number((await one('select count(*) n from public.vouchers')).n) === seen);

  console.log('A4 throttle');
  await login(U, 's3');
  for (let i = 0; i < 5; i++) await tx.attempt('select public.app_verify_mfa(null, $1) as r', [wrong(SEC_U)]);
  ok('after 5 wrong codes the RIGHT code is refused', val(await tx.attempt('select public.app_verify_mfa(null, $1) as r', [totp(SEC_U)])) === false);
  ok('… recovery is frozen too', val(await tx.attempt('select public.app_verify_recovery(null, $1) as r', ['abcdefghij'])) === false);
  ok('… and s3 stays pending', (await hook(U, 's3')).mfa_pending === true);
  await tx.asOwner();
  await tx.query(`update public.mfa_failures set at = now() - interval '16 minutes' where email = $1`, [U]);
  await login(U, 's3');
  ok('after the 15-minute window the right code works', val(await tx.attempt('select public.app_verify_mfa(null, $1) as r', [totp(SEC_U)])) === true);
  await tx.asOwner();
  ok('a correct code clears the failure counter', Number((await one('select count(*) n from public.mfa_failures where email = $1', [U])).n) === 0);

  console.log('Recovery code verifies a session');
  await login(U, 's1');
  const codes = val(await tx.attempt('select public.app_mfa_gen_recovery(null, $1) as r', [totp(SEC_U)]));
  ok('verified session generates recovery codes', Array.isArray(codes) && codes.length === 8);
  await login(U, 's4');
  ok('pending s4 spends a recovery code', val(await tx.attempt('select public.app_verify_recovery(null, $1) as r', [codes[1]])) === true);
  ok('s4 is verified', (await hook(U, 's4')).mfa_pending === false);

  console.log('Platform admin');
  c = await login(P, 's5');
  ok('hook: enrolled platform admin, new session → pending', c.mfa_pending === true);
  ok('pending: is_platform_admin() is false (no super-admin RPCs)', (await one('select public.is_platform_admin() a')).a === false);
  ok('pending: platform_admin_identity() and mfa_status() still answer (login needs them)',
    (await one('select public.platform_admin_identity() a')).a === true && (await one('select public.platform_admin_mfa_status() a')).a === true);
  ok('pending: cannot generate recovery codes', denied(await tx.attempt('select public.platform_admin_mfa_gen_recovery($1) as r', [totp(SEC_P)])));
  ok('pending: cannot disable 2FA', denied(await tx.attempt('select public.platform_admin_mfa_disable($1) as r', [totp(SEC_P)])));
  ok('platform_admin_mfa_verify with the right code → true', val(await tx.attempt('select public.platform_admin_mfa_verify($1) as r', [totp(SEC_P)])) === true);
  c = await login(P, 's5');
  ok('refreshed: not pending, is_platform_admin() true', c.mfa_pending === false && (await one('select public.is_platform_admin() a')).a === true);
  await login(N, 'sN2');
  ok('a society user is not a platform admin by identity', (await one('select public.platform_admin_identity() a')).a === false);
  ok('platform_admin_mfa_verify refuses a non-admin', denied(await tx.attempt('select public.platform_admin_mfa_verify($1) as r', [totp(SEC_P)])));
  await login(P, 's6');
  for (let i = 0; i < 5; i++) await tx.attempt('select public.platform_admin_mfa_verify($1) as r', [wrong(SEC_P)]);
  ok('platform admin throttle: right code refused after 5 wrong', val(await tx.attempt('select public.platform_admin_mfa_verify($1) as r', [totp(SEC_P)])) === false);

  console.log('Internals are not client-callable');
  await login(N, 'sN3');
  for (const f of ['_mfa_enrolled($1)', '_mfa_mark_session($1)', '_mfa_throttled($1)', '_mfa_note($1, true)']) {
    ok(`${f.split('(')[0]} denied`, !(await tx.attempt(`select public.${f}`, [N])).ok);
  }
  await tx.asOwner();
  ok('mfa tables have no client grants', Number((await one(`select count(*) n from information_schema.role_table_grants where table_name in ('mfa_verified_sessions','mfa_failures') and grantee in ('anon','authenticated')`)).n) === 0);
});

console.log(`\nA3/A4 MFA session binding (085): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

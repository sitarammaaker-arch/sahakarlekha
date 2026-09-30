#!/usr/bin/env node
// Phase-2 A1/A2 (SEC-01/SEC-02) · migration 084 on the restored backup: the society-user MFA RPCs
// take identity from the JWT, refuse anon, and refuse a caller-supplied email that is not the caller's.
// Precondition: harness up with 084 applied. Everything runs inside one rolled-back transaction.
//
// Run: node scripts/db-harness/tests/a1-mfa-identity.mjs

import { createHmac } from 'node:crypto';
import { inRollback } from '../lib.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

// RFC 6238 (SHA-1, 30 s, 6 digits) — the same algorithm app_totp_matches implements.
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
const SEC_U = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const SEC_EVIL = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const denied = (r) => !r.ok && r.error.code === '42501';
const val = (r) => (r.ok ? r.rows[0].r : undefined);

await inRollback(async (tx) => {
  const socs = (await tx.query(`select distinct society_id::text s from public.society_users where society_id::text ~ '^[0-9a-f-]{36}$' limit 2`)).rows.map((x) => x.s);
  ok('fixture: two real societies', socs.length === 2);
  const [S1, S2] = socs;
  const U = 'a1-user@harness.test', A = 'a1-admin@harness.test', X = 'a1-evil@harness.test', P = 'a1-platform@harness.test';
  for (const [email, soc, role] of [['A1-User@Harness.test', S1, 'accountant'], [A, S1, 'admin'], [X, S2, 'admin']]) {
    await tx.query(`insert into public.society_users (id, society_id, email, role, name, is_active) values (gen_random_uuid(), $1, $2, $3, 'A1', true)`, [soc, email, role]);
  }
  const as = (email) => tx.as({ email, user_role: 'admin' });
  const secretOf = async (email) => { await tx.asOwner(); return (await tx.query('select secret from public.user_mfa where email = $1', [email])).rows[0]?.secret ?? null; };

  console.log('Anon and claim-less callers');
  await tx.asAnon();
  for (const [fn, args] of [['app_mfa_enroll', [U, SEC_EVIL, totp(SEC_EVIL)]], ['app_verify_mfa', [U, '000000']], ['app_mfa_disable', [U, '000000']],
    ['app_mfa_admin_reset', [A, U]], ['app_mfa_gen_recovery', [U, '000000']], ['app_verify_recovery', [U, 'abcdefghij']]]) {
    const r = await tx.attempt(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args);
    ok(`anon cannot execute ${fn}`, !r.ok && /permission denied/.test(r.error.message), r.ok ? 'executed' : r.error.message);
  }
  await tx.as({ user_role: 'admin' });   // authenticated but no email claim
  ok('a JWT without an email is refused', denied(await tx.attempt('select public.app_mfa_enroll(null, $1, $2) as r', [SEC_U, totp(SEC_U)])));
  ok('app_totp_matches is not callable by clients', !(await tx.attempt('select public.app_totp_matches($1, $2, 0, 1) as r', [SEC_U, '000000'])).ok);

  console.log('Enrol (SEC-01)');
  await as(X);
  ok('X cannot enrol a secret on U by naming U', denied(await tx.attempt('select public.app_mfa_enroll($1, $2, $3) as r', [U, SEC_EVIL, totp(SEC_EVIL)])));
  ok('… and U has no secret afterwards', (await secretOf(U)) === null);
  await as(U);
  ok('U enrols with the legacy email arg in any case', val(await tx.attempt('select public.app_mfa_enroll($1, $2, $3) as r', ['A1-USER@harness.test', SEC_U, totp(SEC_U)])) === true);
  ok('U\'s secret is stored under the lower-case JWT email', (await secretOf(U)) === SEC_U);
  await tx.asOwner();
  ok('U\'s society_users row is flagged enrolled (mixed-case row)', (await tx.query(`select mfa_enabled from public.society_users where lower(email) = $1`, [U])).rows[0].mfa_enabled === true);
  await as(U);
  ok('a wrong first code does not enrol', val(await tx.attempt('select public.app_mfa_enroll(null, $1, $2) as r', [SEC_EVIL, '000000'])) === false);
  ok('… and U\'s secret is unchanged', (await secretOf(U)) === SEC_U);
  await as(X);
  ok('X cannot overwrite U\'s secret either', denied(await tx.attempt('select public.app_mfa_enroll($1, $2, $3) as r', [U, SEC_EVIL, totp(SEC_EVIL)])) && (await secretOf(U)) === SEC_U);
  await tx.as({ email: P, user_role: 'admin' });
  ok('a user with no society_users row (platform admin) cannot use app_mfa_enroll', denied(await tx.attempt('select public.app_mfa_enroll(null, $1, $2) as r', [SEC_U, totp(SEC_U)])));

  console.log('Verify / recovery / disable');
  await as(U);
  ok('U verifies with the right code', val(await tx.attempt('select public.app_verify_mfa($1, $2) as r', [U, totp(SEC_U)])) === true);
  ok('U with a wrong code → false', val(await tx.attempt('select public.app_verify_mfa(null, $1) as r', ['000000'])) === false);
  await as(X);
  ok('X cannot verify against U', denied(await tx.attempt('select public.app_verify_mfa($1, $2) as r', [U, totp(SEC_U)])));
  ok('X cannot generate U\'s recovery codes', denied(await tx.attempt('select public.app_mfa_gen_recovery($1, $2) as r', [U, totp(SEC_U)])));
  await as(U);
  const codes = val(await tx.attempt('select public.app_mfa_gen_recovery(null, $1) as r', [totp(SEC_U)]));
  ok('U generates 8 recovery codes', Array.isArray(codes) && codes.length === 8);
  await as(X);
  ok('X cannot spend U\'s recovery code', denied(await tx.attempt('select public.app_verify_recovery($1, $2) as r', [U, codes[0]])));
  await as(U);
  ok('U spends a recovery code once', val(await tx.attempt('select public.app_verify_recovery(null, $1) as r', [codes[0]])) === true);
  ok('… and not twice', val(await tx.attempt('select public.app_verify_recovery(null, $1) as r', [codes[0]])) === false);
  await as(X);
  ok('X cannot disable U\'s 2FA', denied(await tx.attempt('select public.app_mfa_disable($1, $2) as r', [U, totp(SEC_U)])) && (await secretOf(U)) === SEC_U);

  console.log('Admin reset (SEC-02)');
  await as(X);
  ok('X cannot reset by naming S1\'s admin', denied(await tx.attempt('select public.app_mfa_admin_reset($1, $2) as r', [A, U])));
  ok('X (admin of another society) resetting U → false', val(await tx.attempt('select public.app_mfa_admin_reset(null, $1) as r', [U])) === false);
  ok('… U still enrolled', (await secretOf(U)) === SEC_U);
  await as(U);
  ok('a non-admin of the same society cannot reset', val(await tx.attempt('select public.app_mfa_admin_reset(null, $1) as r', [A])) === false);
  await as(A);
  ok('S1\'s admin resets U (target email in any case)', val(await tx.attempt('select public.app_mfa_admin_reset($1, $2) as r', [A, 'A1-User@Harness.test'])) === true);
  await tx.asOwner();
  const after = (await tx.query(`select (select count(*) from public.user_mfa where email = $1)::int m, (select count(*) from public.user_mfa_recovery where email = $1)::int r,
    (select mfa_enabled from public.society_users where lower(email) = $1) f`, [U])).rows[0];
  ok('reset removes the secret, the recovery codes and the flag', after.m === 0 && after.r === 0 && after.f === false, JSON.stringify(after));

  console.log('Disable');
  await as(U);
  await tx.attempt('select public.app_mfa_enroll(null, $1, $2) as r', [SEC_U, totp(SEC_U)]);
  ok('U disables with a current code', val(await tx.attempt('select public.app_mfa_disable(null, $1) as r', [totp(SEC_U)])) === true && (await secretOf(U)) === null);
});

console.log(`\nA1/A2 MFA identity (084): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

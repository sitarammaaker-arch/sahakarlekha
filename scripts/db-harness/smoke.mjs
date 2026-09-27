// RM-31 · harness self-test: proves the local cluster enforces the same tenant isolation and
// role-gated writes as production, using synthetic logins (rolled back, nothing persists).
//
// Run after `harness.mjs up`:  node scripts/db-harness/harness.mjs smoke

import { inRollback } from './lib.mjs';

const EMAIL_A = 'harness-admin-a@harness.test';
const EMAIL_A_RO = 'harness-viewer-a@harness.test';

export async function smoke() {
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = '') => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
  };

  await inRollback(async (tx) => {
    // Two real tenants with the most vouchers (ground truth read as owner, RLS bypassed).
    const top = (await tx.query(
      `select society_id::text as sid, count(*)::int as n from public.vouchers
        group by 1 order by 2 desc limit 2`)).rows;
    if (top.length < 2) throw new Error('smoke: the restored dump needs vouchers in at least two societies');
    const [A, B] = top;

    // Synthetic logins for society A (removed by the rollback).
    for (const [email, role] of [[EMAIL_A, 'admin'], [EMAIL_A_RO, 'viewer']]) {
      await tx.query(
        `insert into public.society_users (id, society_id, email, role, name, is_active)
         values (gen_random_uuid(), $1, $2, $3, 'db-harness', true)`, [A.sid, email, role]);
    }

    console.log('Tenant isolation');
    await tx.as({ email: EMAIL_A, user_role: 'admin' });
    const cur = (await tx.query('select public.get_current_society_id() as sid')).rows[0].sid;
    ok('get_current_society_id() resolves the JWT email to its society', cur === A.sid, `got ${cur}`);
    const seeA = (await tx.query('select count(*)::int as n from public.vouchers where society_id::text = $1', [A.sid])).rows[0].n;
    ok(`admin of A sees all of A's vouchers (${A.n})`, seeA === A.n, `saw ${seeA}`);
    const seeB = (await tx.query('select count(*)::int as n from public.vouchers where society_id::text = $1', [B.sid])).rows[0].n;
    ok("admin of A sees none of B's vouchers", seeB === 0, `saw ${seeB}`);
    const seeAccB = (await tx.query('select count(*)::int as n from public.accounts where society_id::text = $1', [B.sid])).rows[0].n;
    ok("admin of A sees none of B's accounts", seeAccB === 0, `saw ${seeAccB}`);

    console.log('Role-gated writes');
    const probe = (sid, label) => tx.attempt(
      `insert into public.accounts (id, society_id, name, type, "openingBalance", "openingBalanceType", "isGroup", "isSystem")
       values ($1, $2, $3, 'expense', 0, 'debit', false, false)`, [`HARNESS-${label}`, sid, `db-harness probe ${label}`]);
    const own = await probe(A.sid, 'own');
    ok('admin of A may insert an account into A', own.ok, own.error?.message);
    const cross = await probe(B.sid, 'cross');
    ok('admin of A may NOT insert an account into B', !cross.ok, 'insert succeeded');

    await tx.as({ email: EMAIL_A_RO, user_role: 'viewer' });
    const ro = await probe(A.sid, 'viewer');
    ok('viewer of A may NOT insert an account', !ro.ok, 'insert succeeded');

    console.log('Anonymous');
    await tx.asAnon();
    const anon = await tx.attempt('select count(*)::int as n from public.vouchers');
    ok('anon sees no vouchers', !anon.ok || anon.rows[0].n === 0, anon.ok ? `saw ${anon.rows[0].n}` : '');
  });

  console.log(`\ndb-harness smoke: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

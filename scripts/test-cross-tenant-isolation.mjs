// P1-SEC-1b · Cross-tenant isolation test (LIVE) — proves 007 leaves NO
// cross-tenant access path. Run against STAGING after applying 007, with two
// real test societies. Uses @supabase/supabase-js (existing dep) as an ordinary
// authenticated client (real JWT) — exactly how the app talks to the DB.
//
// Required env (skips cleanly if absent):
//   SUPABASE_URL, SUPABASE_ANON_KEY
//   RLS_TEST_A_EMAIL, RLS_TEST_A_PASSWORD, RLS_TEST_A_SOCIETY_ID
//   RLS_TEST_B_EMAIL, RLS_TEST_B_PASSWORD, RLS_TEST_B_SOCIETY_ID
//
// Run: node scripts/test-cross-tenant-isolation.mjs   (npm run test:cross-tenant-isolation)

const env = process.env;
const NEED = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'RLS_TEST_A_EMAIL', 'RLS_TEST_A_PASSWORD', 'RLS_TEST_A_SOCIETY_ID',
  'RLS_TEST_B_EMAIL', 'RLS_TEST_B_PASSWORD', 'RLS_TEST_B_SOCIETY_ID',
];
const missing = NEED.filter((k) => !env[k]);
if (missing.length) {
  console.log('SKIP  cross-tenant isolation — live test, needs staging credentials.');
  console.log('      Set these env vars and run against STAGING after applying 007:');
  for (const k of NEED) console.log('        ' + k);
  console.log('      (Two real test societies A and B, each with a Supabase Auth admin.)');
  process.exit(0);
}

const { createClient } = await import('@supabase/supabase-js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

async function signIn(email, password) {
  const c = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

const A_SID = env.RLS_TEST_A_SOCIETY_ID;
const B_SID = env.RLS_TEST_B_SOCIETY_ID;

const A = await signIn(env.RLS_TEST_A_EMAIL, env.RLS_TEST_A_PASSWORD);
const B = await signIn(env.RLS_TEST_B_EMAIL, env.RLS_TEST_B_PASSWORD);

// ── READ isolation (both directions) — accounts exist for both (seeded at signup)
async function assertReadIsolation(client, ownSid, otherSid, who) {
  // explicitly filter for the OTHER tenant → RLS must still return nothing
  const { data: cross } = await client.from('accounts').select('id, society_id').eq('society_id', otherSid).limit(5);
  ok((cross ?? []).length === 0, `${who} cannot read the other society's accounts even when filtering for it`);
  // own data is visible and ONLY own
  const { data: own } = await client.from('accounts').select('society_id').limit(500);
  ok((own ?? []).length > 0, `${who} can read its OWN accounts`);
  ok((own ?? []).every((r) => r.society_id === ownSid), `${who} sees ONLY its own society_id`);
  // a member read leaks nothing cross-tenant either
  const { data: crossMembers } = await client.from('members').select('id').eq('society_id', otherSid).limit(5);
  ok((crossMembers ?? []).length === 0, `${who} cannot read the other society's members`);
}
await assertReadIsolation(A, A_SID, B_SID, 'A');
await assertReadIsolation(B, B_SID, A_SID, 'B');

// ── WRITE isolation (WITH CHECK) — stamping another tenant's id must be denied
const probeId = `rls-probe-${Date.now()}`;
const { error: aWriteB } = await A.from('accounts').insert({ id: probeId, society_id: B_SID, name: 'RLS PROBE — should be denied', type: 'asset' });
ok(!!aWriteB, "A cannot INSERT an account stamped with B's society_id (WITH CHECK denies)");
// safety net: if it somehow succeeded, remove it (and that's a FAIL already).
if (!aWriteB) { await A.from('accounts').delete().eq('id', probeId); }

// ── WORM: ledger_events/audit_log are append-only (no UPDATE/DELETE reaches a row)
const { data: aEvents } = await A.from('ledger_events').select('event_id').limit(1);
if ((aEvents ?? []).length > 0) {
  const eid = aEvents[0].event_id;
  const { data: upd } = await A.from('ledger_events').update({ event_type: 'tamper' }).eq('event_id', eid).select('event_id');
  ok((upd ?? []).length === 0, 'ledger_events UPDATE affects 0 rows (append-only WORM)');
  const { data: del } = await A.from('ledger_events').delete().eq('event_id', eid).select('event_id');
  ok((del ?? []).length === 0, 'ledger_events DELETE affects 0 rows (append-only WORM)');
} else {
  console.log('  (note: no ledger_events rows for A — WORM update/delete assertion skipped; coverage SQL (b) still guarantees no UPDATE/DELETE policy exists)');
}

await A.auth.signOut();
await B.auth.signOut();

console.log(`\nCross-tenant isolation (live): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

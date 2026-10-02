// 094 · SECURITY DEFINER EXECUTE grants + plain-text password writes — STATIC guard.
//
// Supabase's default privileges grant EXECUTE on every new public function to anon. A SECURITY
// DEFINER function runs with its owner's rights (RLS bypassed), so an anon-callable one is a public
// API. Audit 2026-10-02 found 16 such functions in prod; 094 revoked anon from the ones anon never
// needs and stopped the user RPCs writing raw passwords into society_users.password.
//
// This test guards both, without a database:
//   1. 094 revokes exactly the intended functions and drops the anon bootstrap policy; the public
//      flows (signup, blog, reviews, certificates) keep anon EXECUTE.
//   2. The LATEST migration definition of each user RPC never writes p_password into society_users.
//   3. Every migration after 094 that creates a SECURITY DEFINER function in public either revokes
//      EXECUTE from anon for it, or carries an explicit `-- anon-exec: <name> — <reason>` line.
//   4. 094's down file restores what it removed (faithful rollback).
// The LIVE check (prod / harness) is printed at the end — run it read-only.
//
// Run: node scripts/test-definer-exec-grants.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const MIG = pathResolve(ROOT, 'supabase/migrations');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.error('  ✗', msg); } };

const BASELINE = 94;
const migrations = readdirSync(MIG)
  .filter((f) => /^\d{3}_.*\.sql$/.test(f) && !f.endsWith('_down.sql'))
  .sort()
  .map((f) => ({ file: f, n: Number(f.slice(0, 3)), sql: read(pathResolve(MIG, f)) }));

const up = migrations.find((m) => m.file === '094_definer_exec_and_password_writes.sql');
const down = read(pathResolve(MIG, '094_definer_exec_and_password_writes_down.sql'));

// Strip `--` comments so prose never satisfies (or trips) a code assertion.
const code = (sql) => sql.replace(/--[^\n]*/g, '');

/** Roles a `revoke execute on function public.<fn>(...) from ...;` statement names, or null. */
function revokedFrom(sql, fn) {
  const re = new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s+from\\s+([^;]+);`, 'i');
  const m = code(sql).match(re);
  return m ? m[1].split(',').map((r) => r.trim().toLowerCase()) : null;
}

// ── 1. 094 revokes ──────────────────────────────────────────────────────────
console.log('094 revokes');
ok(!!up, '094_definer_exec_and_password_writes.sql exists');
const REVOKE = {
  app_register_admin: ['public', 'anon', 'authenticated'], // only caller is register_society (runs as owner)
  app_set_my_password: ['public', 'anon'],                 // reset runs in an authenticated recovery session
  pay_payslip_lines: ['public', 'anon'],                   // signed-in Payroll page only
  tg_new_society_trial: ['public', 'anon', 'authenticated'], // trigger function
  society_has_users: ['public', 'anon'],                   // only anon use was society_users_bootstrap
};
for (const [fn, roles] of Object.entries(REVOKE)) {
  const got = revokedFrom(up.sql, fn);
  ok(!!got && roles.every((r) => got.includes(r)), `${fn}: EXECUTE revoked from ${roles.join(', ')}`);
}
ok(/drop\s+policy\s+if\s+exists\s+society_users_bootstrap\s+on\s+public\.society_users/i.test(code(up.sql)),
  'anon INSERT policy society_users_bootstrap is dropped (signup goes through register_society)');

// Public flows that MUST stay anon-callable — revoking any of these breaks a public page.
const ANON_REQUIRED = {
  register_society: 'Register.tsx — signup before any login',
  increment_blog_view: 'public blog view counter',
  public_reviews: 'Testimonials on the marketing site',
  issue_certificate: '/guide/certificate (public route)',
  verify_certificate: '/guide/verify (public route)',
};
for (const [fn, why] of Object.entries(ANON_REQUIRED)) {
  const got = migrations.filter((m) => m.n >= BASELINE).map((m) => revokedFrom(m.sql, fn)).filter(Boolean).flat();
  ok(!got.includes('anon') && !got.includes('public'), `${fn} keeps anon EXECUTE (${why})`);
}

// ── 2. No raw password into society_users ───────────────────────────────────
console.log('society_users.password writes');
function latestBody(fn) {
  let body = null;
  const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\([\\s\\S]*?\\$function\\$([\\s\\S]*?)\\$function\\$`, 'gi');
  for (const m of migrations) for (const x of m.sql.matchAll(re)) body = { file: m.file, text: x[1] };
  return body;
}
const RAW_WRITE = [
  /update\s+public\.society_users\s+set\s+[^;]*\bpassword\s*=\s*p_password/i,
  /insert\s+into\s+public\.society_users\s*\([^)]*\bpassword\b[^)]*\)\s*values\s*\([^;]*\bp_password\b/i,
];
for (const fn of ['app_register_admin', 'app_add_society_user', 'app_set_my_password']) {
  const b = latestBody(fn);
  ok(!!b && b.file >= '094', `${fn}: latest definition is 094 or later (${b?.file ?? 'none'})`);
  ok(!!b && !RAW_WRITE.some((re) => re.test(code(b.text))), `${fn}: never writes p_password into society_users`);
  ok(!!b && /crypt\(p_password,\s*gen_salt\('bf'\)\)/.test(b.text), `${fn}: still sets the bcrypt credential in auth.users`);
}
for (const m of migrations.filter((x) => x.n >= BASELINE)) {
  ok(!RAW_WRITE.some((re) => re.test(code(m.sql))), `${m.file}: no raw password write into society_users`);
}

// ── 3. Future definer functions must decide on anon explicitly ─────────────
console.log('new SECURITY DEFINER functions (after 094)');
const fnDef = /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(([\s\S]*?)\$(\w*)\$[\s\S]*?\$\3\$/gi;
let checked = 0;
for (const m of migrations.filter((x) => x.n > BASELINE)) {
  for (const x of m.sql.matchAll(fnDef)) {
    if (!/security\s+definer/i.test(x[2])) continue;
    const fn = x[1];
    checked++;
    const revoked = revokedFrom(m.sql, fn);
    const annotated = new RegExp(`--\\s*anon-exec:\\s*${fn}\\b\\s*\\S`).test(m.sql);
    ok((revoked && revoked.includes('anon')) || annotated,
      `${m.file}: definer ${fn}() revokes anon EXECUTE or carries "-- anon-exec: ${fn} — <reason>"`);
  }
}
ok(true, `scanned ${checked} definer function(s) created after 094`);

// ── 4. Faithful rollback ────────────────────────────────────────────────────
console.log('094 down');
for (const fn of Object.keys(REVOKE)) {
  ok(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s+to\\s+[^;]*\\banon\\b`, 'i').test(down),
    `down re-grants anon EXECUTE on ${fn}`);
}
ok(/create\s+policy\s+society_users_bootstrap\s+on\s+public\.society_users[\s\S]*?for\s+insert\s+to\s+anon/i.test(down),
  'down recreates the society_users_bootstrap anon INSERT policy');
ok(/set\s+password\s*=\s*p_password/i.test(down), 'down restores the pre-094 app_set_my_password body');

// ── LIVE check (manual, read-only) ──────────────────────────────────────────
console.log(`
LIVE check — run read-only against prod (or the db-harness) after applying 094:
  begin transaction read only;
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')
   order by 1;   -- expect only: ${Object.keys(ANON_REQUIRED).sort().join(', ')} + the RLS helpers
  select count(*) from pg_policies where policyname = 'society_users_bootstrap';   -- expect 0
  select count(*) filter (where password is distinct from '') from public.society_users;   -- expect 0
  rollback;
`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

// P1-SEC-1b · RLS coverage test — STATIC (always) + LIVE (when a DB is available).
//
// STATIC: verifies 007_rls_tenant_isolation.sql is complete and correct against the
// real schema, without a database — dynamic coverage of every society_id table,
// CRUD scoped by get_current_society_id(), permissive policies snapshotted+dropped,
// WORM append-only, hardened helpers, societies-by-id, and a faithful snapshot-based
// down-migration.
//
// LIVE (W-5): if DATABASE_URL is set AND the optional `pg` package is installed, it
// connects and asserts the real pg_policies end-state (RLS enabled + scoped + no
// permissive; WORM has no UPDATE/DELETE). If `pg` is absent it prints the assertion
// SQL to run manually and continues (no forced dependency).
//
// Run: node scripts/test-rls-coverage.mjs            (static)
//      DATABASE_URL=postgres://… node scripts/test-rls-coverage.mjs   (static + live)

import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const WORM = ['ledger_events', 'audit_log'];

// ── Extract every tenant table (society_id column) from the schema ───────────
const schema = read('supabase-tables.sql');
const tenantTables = [];
for (const m of schema.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)) {
  const [, name, body] = m;
  if (/\bsociety_id\b/.test(body)) tenantTables.push(name);
}
ok(tenantTables.length >= 30, `discovered the tenant tables from the schema (${tenantTables.length})`);
ok(WORM.every((t) => tenantTables.includes(t)), 'ledger_events + audit_log are tenant tables (society_id)');
ok(!tenantTables.includes('societies'), 'societies is NOT a society_id table (handled separately, scoped by id)');
ok(!['feedback', 'reviews', 'leads'].some((t) => tenantTables.includes(t)), 'public tables (feedback/reviews/leads) are not tenant tables');

// ── Verify 007 (up) ──────────────────────────────────────────────────────────
const up = read('supabase/migrations/007_rls_tenant_isolation.sql');

// (2) automatic coverage
ok(/a\.attname = 'society_id'/.test(up), '007 discovers tenant tables dynamically by the society_id column (automatic coverage)');
ok(/enable row level security/.test(up), '007 enables RLS on every discovered table');

// (3) CRUD scoped via get_current_society_id()
ok(/for select using \(society_id = get_current_society_id\(\)\)/.test(up), '007 scopes SELECT by get_current_society_id()');
ok(/for insert with check \(society_id = get_current_society_id\(\)\)/.test(up), '007 scopes INSERT by get_current_society_id()');
ok(/for update using \(society_id = get_current_society_id\(\)\) with check \(society_id = get_current_society_id\(\)\)/.test(up), '007 scopes UPDATE by get_current_society_id() (USING + WITH CHECK)');
ok(/for delete using \(society_id = get_current_society_id\(\)\)/.test(up), '007 scopes DELETE by get_current_society_id()');

// (6) removes permissive policies AND snapshots them first (W-3)
ok(/coalesce\(qual, ?''\) = 'true' or coalesce\(with_check, ?''\) = 'true'/.test(up) && /drop policy/.test(up),
  '007 drops the permissive (unconditionally-true) policies');
ok(/create table if not exists rls_policy_backup/.test(up) && /insert into rls_policy_backup/.test(up),
  '007 snapshots each dropped permissive policy into rls_policy_backup (W-3 faithful rollback)');

// (5) WORM append-only
ok(/worm\s+text\[\]\s*:=\s*array\['ledger_events', ?'audit_log'\]/.test(up), '007 declares exactly ledger_events + audit_log as WORM');
ok(/if is_worm then[\s\S]*?cmd in \('UPDATE','DELETE'\)[\s\S]*?drop policy/.test(up), '007 drops any UPDATE/DELETE policy on WORM tables');
ok(/else\s+if not exists[\s\S]*?for update[\s\S]*?for delete/.test(up), '007 creates UPDATE/DELETE ONLY for non-WORM tables (else branch)');

// (1)/(4)/(W-6) helpers — extend 001, hardened
ok(/create or replace function get_current_society_id\(\)/.test(up), '007 (re)declares get_current_society_id() — extends the 001 model');
ok(/security definer/.test(up), 'helpers are SECURITY DEFINER (preserves the 001 model)');
ok(/set search_path = ''/.test(up), 'helpers pin search_path = \'\' (W-6 hardening)');
ok(/from public\.society_users/.test(up), 'helpers schema-qualify public.society_users (W-6)');

// societies scoped by id; no client insert/delete
ok(/societies_tenant_select on public\.societies for select using \(id = get_current_society_id\(\)\)/.test(up), 'societies SELECT scoped by id');
ok(/societies_tenant_update on public\.societies for update using \(id = get_current_society_id\(\)\)/.test(up), 'societies UPDATE scoped by id');
ok(!/create policy societies_tenant_(insert|delete)/.test(up), 'no client INSERT/DELETE policy on societies (provisioning via RPC only)');

// (7)/(8) no permissive CREATE; transactional
ok(!/create policy[\s\S]*?for (select|insert|update|delete)[\s\S]*?using \(true\)/.test(
     up.replace(/coalesce\([^)]*\) = 'true'/g, '')),
  '007 creates NO permissive (true) policy — every created policy is tenant-scoped');
ok(/begin;[\s\S]*commit;/.test(up), '007 is wrapped in a transaction (atomic apply)');

// ── Verify the down-migration (faithful snapshot restore — W-3) ──────────────
const down = read('supabase/migrations/007_rls_tenant_isolation_down.sql');
ok(/drop policy if exists .*_tenant_select/.test(down) && /drop policy if exists .*_tenant_insert/.test(down),
  'down drops the 007 tenant policies');
ok(/from rls_policy_backup/.test(down) && /distinct on \(table_name, policy_name\)/.test(down),
  'down restores EXACTLY the snapshotted policies (faithful — not a blanket re-open)');
ok(!/for select using \(true\)/.test(down) && !/for insert with check \(true\)/.test(down),
  'down does NOT blanket-open every table (W-3 fixed — over-opening removed)');
ok(/WORM stays append-only/i.test(down), 'down preserves WORM append-only on rollback (snapshot held no UPDATE/DELETE)');
ok(/begin;[\s\S]*commit;/.test(down), 'down is transactional');

console.log(`\nRLS coverage (static): ${pass} passed, ${fail} failed`);
console.log(`Tenant tables 007 will cover (via society_id): ${tenantTables.length}`);

// ── LIVE verification (W-5) ──────────────────────────────────────────────────
async function runLive(connStr) {
  let pg;
  try { pg = await import('pg'); } catch { return 'no-pg'; }
  const { Client } = pg.default ?? pg;
  const client = new Client({ connectionString: connStr });
  await client.connect();
  try {
    const a = await client.query(`
      select c.relname,
             c.relrowsecurity as rls,
             count(p.policyname)::int as policies,
             bool_or(coalesce(p.qual,'')='true' or coalesce(p.with_check,'')='true') as permissive
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      left join pg_policies p on p.schemaname='public' and p.tablename=c.relname
      where n.nspname='public' and c.relkind='r'
        and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='society_id' and a.attnum>0 and not a.attisdropped)
      group by c.relname, c.relrowsecurity`);
    const bad = a.rows.filter((r) => !r.rls || r.policies < 1 || r.permissive);
    ok(bad.length === 0, `LIVE: every society_id table is RLS-enabled + scoped + non-permissive (${a.rows.length} tables; bad=${bad.map((r) => r.relname).join(',') || 'none'})`);
    const b = await client.query(`select count(*)::int n from pg_policies where schemaname='public' and tablename in ('ledger_events','audit_log') and cmd in ('UPDATE','DELETE')`);
    ok(b.rows[0].n === 0, 'LIVE: WORM tables (ledger_events, audit_log) have NO UPDATE/DELETE policy');
    const c = await client.query(`select count(*)::int n from pg_policies where schemaname='public' and (coalesce(qual,'')='true' or coalesce(with_check,'')='true')`);
    ok(c.rows[0].n === 0, 'LIVE: no permissive policy remains anywhere in public');
  } finally {
    await client.end();
  }
  return 'ran';
}

if (process.env.DATABASE_URL) {
  const r = await runLive(process.env.DATABASE_URL).catch((e) => { fail++; console.error('  ✗ LIVE verification errored:', e.message); return 'error'; });
  if (r === 'no-pg') console.log("\n(LIVE skipped — the optional 'pg' package is not installed; run the emitted SQL manually, or `npm i -D pg`.)");
  else if (r === 'ran') console.log('\nLIVE verification ran against DATABASE_URL.');
} else {
  console.log(`
── LIVE VERIFICATION SQL (run AFTER applying 007, in the SQL Editor) ──────────
-- (a) every society_id table: RLS enabled, >=1 policy, no permissive:
select c.relname, c.relrowsecurity as rls_enabled, count(p.policyname) as policies,
       bool_or(coalesce(p.qual,'')='true' or coalesce(p.with_check,'')='true') as has_permissive
from pg_class c join pg_namespace n on n.oid=c.relnamespace
left join pg_policies p on p.schemaname='public' and p.tablename=c.relname
where n.nspname='public' and c.relkind='r'
  and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='society_id' and a.attnum>0 and not a.attisdropped)
group by c.relname, c.relrowsecurity order by c.relname;   -- expect rls=true, policies>=1, permissive=false
-- (b) WORM: 0 rows.   select tablename,cmd from pg_policies where schemaname='public' and tablename in ('ledger_events','audit_log') and cmd in ('UPDATE','DELETE');
-- (c) no permissive: 0 rows.   select tablename,policyname from pg_policies where schemaname='public' and (coalesce(qual,'')='true' or coalesce(with_check,'')='true');
────────────────────────────────────────────────────────────────────────────────`);
}

console.log(`\nRLS coverage total: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

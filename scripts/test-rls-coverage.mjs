// P1-SEC-1b · RLS coverage test (STATIC) — verifies 007_rls_tenant_isolation.sql
// is complete and correct against the real schema, WITHOUT a live database.
//
// It asserts the MIGRATION guarantees the required end state:
//   • every tenant table (any table with a society_id column) is covered — 007
//     discovers them dynamically, so coverage is automatic;
//   • CRUD is scoped by get_current_society_id();
//   • all permissive USING(true)/WITH CHECK(true) policies are dropped;
//   • ledger_events + audit_log stay append-only (no UPDATE/DELETE policy);
//   • societies is scoped by id; no client INSERT/DELETE policy;
//   • a paired down-migration restores access and keeps WORM append-only.
//
// The LIVE state (pg_policies) is verified by scripts/test-cross-tenant-isolation.mjs
// and the runbook's SQL (printed at the end here). Run: node scripts/test-rls-coverage.mjs
//   (npm run test:rls-coverage)

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

// ── Verify 007 ───────────────────────────────────────────────────────────────
const up = read('supabase/migrations/007_rls_tenant_isolation.sql');

// (2) automatic coverage — discovers tables by the society_id column
ok(/a\.attname = 'society_id'/.test(up), '007 discovers tenant tables dynamically by the society_id column (automatic coverage)');
ok(/enable row level security/.test(up), '007 enables RLS on every discovered table');

// (3) CRUD scoped via get_current_society_id()
ok(/for select using \(society_id = get_current_society_id\(\)\)/.test(up), '007 scopes SELECT by get_current_society_id()');
ok(/for insert with check \(society_id = get_current_society_id\(\)\)/.test(up), '007 scopes INSERT by get_current_society_id()');
ok(/for update using \(society_id = get_current_society_id\(\)\) with check \(society_id = get_current_society_id\(\)\)/.test(up), '007 scopes UPDATE by get_current_society_id() (both USING and WITH CHECK)');
ok(/for delete using \(society_id = get_current_society_id\(\)\)/.test(up), '007 scopes DELETE by get_current_society_id()');

// (6) removes permissive policies
ok(/coalesce\(qual, ?''\) = 'true' or coalesce\(with_check, ?''\) = 'true'/.test(up) && /drop policy/.test(up),
  '007 drops the permissive (unconditionally-true) policies');

// (5) WORM append-only
ok(new RegExp(`worm\\s*text\\[\\]\\s*:=\\s*array\\['ledger_events',\\s*'audit_log'\\]`).test(up),
  '007 declares exactly ledger_events + audit_log as WORM');
// UPDATE/DELETE creation is guarded by "not is_worm" (never created for WORM), and any existing UPDATE/DELETE on WORM is dropped.
ok(/if is_worm then[\s\S]*?cmd in \('UPDATE','DELETE'\)[\s\S]*?drop policy/.test(up), '007 drops any UPDATE/DELETE policy on WORM tables');
ok(/else\s+if not exists[\s\S]*?for update[\s\S]*?for delete/.test(up), '007 creates UPDATE/DELETE ONLY for non-WORM tables (else branch)');

// (1)/(4) helpers preserved (extends 001; RPCs unaffected — they bypass RLS)
ok(/create or replace function get_current_society_id\(\)/.test(up), '007 (re)declares get_current_society_id() — extends the 001 model');
ok(/security definer/.test(up), 'helpers are SECURITY DEFINER (preserves the 001 model)');

// societies scoped by id; no client insert/delete
ok(/societies_tenant_select on public\.societies for select using \(id = get_current_society_id\(\)\)/.test(up), 'societies SELECT scoped by id');
ok(/societies_tenant_update on public\.societies for update using \(id = get_current_society_id\(\)\)/.test(up), 'societies UPDATE scoped by id');
ok(!/create policy societies_tenant_(insert|delete)/.test(up), 'no client INSERT/DELETE policy on societies (provisioning via RPC only)');

// (7)/(8) no permissive CREATE anywhere in 007; no app/business logic
ok(!/create policy[\s\S]*?for (select|insert|update|delete)[\s\S]*?\((true|using \(true\)|with check \(true\))/.test(
     up.replace(/coalesce\([^)]*\) = 'true'/g, '')),
  '007 creates NO permissive (true) policy — every created policy is tenant-scoped');
ok(/begin;[\s\S]*commit;/.test(up), '007 is wrapped in a transaction (atomic apply)');

// ── Verify the down-migration ────────────────────────────────────────────────
const down = read('supabase/migrations/007_rls_tenant_isolation_down.sql');
ok(/drop policy if exists .*_tenant_select/.test(down) && /drop policy if exists .*_tenant_insert/.test(down),
  'down-migration drops the 007 tenant policies');
ok(/for select using \(true\)/.test(down) && /for insert with check \(true\)/.test(down), 'down-migration restores permissive access');
ok(/WORM: intentionally NO update\/delete policy recreated/i.test(down), 'down-migration preserves WORM append-only on rollback');
ok(/begin;[\s\S]*commit;/.test(down), 'down-migration is transactional');

console.log(`\nRLS coverage (static): ${pass} passed, ${fail} failed`);
console.log(`Tenant tables 007 will cover (via society_id): ${tenantTables.length}`);

// ── Emit the LIVE post-apply assertion SQL (run in staging/prod after 007) ────
console.log(`
── LIVE VERIFICATION SQL (run AFTER applying 007, in the SQL Editor) ──────────
-- (a) every society_id table has RLS enabled and at least one scoped policy:
select c.relname,
       c.relrowsecurity                                as rls_enabled,
       count(p.policyname)                             as policies,
       bool_or(coalesce(p.qual,'')='true' or coalesce(p.with_check,'')='true') as has_permissive
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
left join pg_policies p on p.schemaname='public' and p.tablename=c.relname
where n.nspname='public' and c.relkind='r'
  and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='society_id' and a.attnum>0 and not a.attisdropped)
group by c.relname, c.relrowsecurity
order by c.relname;
--   expect: rls_enabled=true, policies>=1, has_permissive=false  for EVERY row.

-- (b) WORM tables must have NO update/delete policy:
select tablename, cmd from pg_policies
where schemaname='public' and tablename in ('ledger_events','audit_log') and cmd in ('UPDATE','DELETE');
--   expect: 0 rows.

-- (c) no permissive policy remains anywhere in public:
select tablename, policyname, cmd from pg_policies
where schemaname='public' and (coalesce(qual,'')='true' or coalesce(with_check,'')='true');
--   expect: 0 rows.
────────────────────────────────────────────────────────────────────────────────`);

process.exit(fail > 0 ? 1 : 0);

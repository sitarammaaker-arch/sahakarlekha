// DB-04 (product audit 2026-11-17): 85 tables defaulted society_id to the pseudo-tenant 'SOC001', so a server insert
// that forgot society_id landed silently in a tenant no society owns. Migration 197 drops every such default (PGlite:
// scratchpad pg/t197.mjs — up drops them, an insert without society_id is refused, re-run is safe, down restores).
// Run: node scripts/test-db04-no-soc001-default.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const up = read('supabase/migrations/197_no_soc001_default.sql');
const down = read('supabase/migrations/197_no_soc001_default_down.sql');

// ── the migration ──
ok(/where c\.table_schema = 'public' and c\.column_name = 'society_id' and c\.column_default ilike '%SOC001%'/.test(up), 'up finds every public society_id column whose default is SOC001 (no hand list to go stale)');
ok(up.includes("execute format('alter table public.%I alter column society_id drop default', r.table_name);"), 'and drops that default (quoted identifier)');
ok(!/\b(delete|update|truncate|drop table)\b/i.test(up.replace(/--.*$/gm, '')), 'up removes no rows and no table (the orphan SOC001 rows are a separate decision)');
ok(up.includes("insert into public.app_migrations (version, name) values ('197', 'no_soc001_default')"), 'up registers itself (OPS-02)');
ok(down.includes("delete from public.app_migrations where version = '197';") && down.includes("execute format('alter table public.%I alter column society_id set default %L', t, 'SOC001');"), 'down restores the defaults and forgets the row');

// ── the down list is exactly the tables production had (DB-01 snapshot taken before 197) ──
{
  const snap = read('supabase/schema/production-schema.txt').split('\n');
  const defaulted = snap.filter((l) => /^column [a-z_0-9]+\.society_id .*default 'SOC001'/.test(l)).map((l) => l.split(' ')[1].split('.')[0]).sort();
  const listed = [...down.matchAll(/'([a-z_0-9]+)'(?=[,\s])/g)].map((m) => m[1]).filter((t) => t !== 'SOC001').sort();
  const missing = defaulted.filter((t) => !listed.includes(t));
  const extra = listed.filter((t) => !defaulted.includes(t));
  if (defaulted.length === 0) {
    ok(listed.length === 85, 'after 197 (snapshot refreshed): no table defaults to SOC001 any more; down still lists the 85 it restores');
  } else {
    ok(defaulted.length === 85, `before 197: the snapshot shows the 85 defaulted tables (${defaulted.length})`);
    ok(missing.length === 0 && extra.length === 0, `down lists exactly those tables (missing: ${missing.join(',')}; extra: ${extra.join(',')})`);
  }
}

// ── nothing in the repo relies on the default ──
{
  const fns = ['post_voucher', 'save_pending_voucher', 'register_society'];
  ok(fns.every((f) => up.includes(f)), 'the migration records which inserting functions were checked (they set society_id themselves)');
  for (const f of ['supabase/functions/scheduled-backup/index.ts', 'supabase/functions/scheduled-rehearsal/index.ts', 'supabase/functions/member-portal-admin/index.ts']) {
    const s = read(f);
    // the first few lines after each insert( call (objects nest, so look at a fixed window, not to the closing brace)
    const at = [...s.matchAll(/\.from\('audit_log'\)\.insert\(/g)].map((m) => s.slice(m.index, m.index + 300));
    ok(at.length > 0 && at.every((w) => /society_id:/.test(w)), `${f.split('/')[2]}: every audit_log insert names society_id`);
  }
}

console.log(`DB-04 no SOC001 default: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

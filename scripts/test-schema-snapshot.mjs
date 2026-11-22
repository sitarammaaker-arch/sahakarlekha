// DB-01 (product audit 2026-11-17): the repo must describe the database that production actually runs.
// supabase/schema/production-schema.txt is production's public schema, read with scripts/schema-snapshot.mjs
// (read-only). This test holds the repo to it, offline, on every PR:
//   • every table and column the backup registry exports exists in production (no phantom backup columns);
//   • every table a numbered migration creates exists in production (no migration that never ran);
//   • every production table is either exported or listed below WITH its reason — a new table cannot silently stay
//     out of the backup;
//   • the snapshot is sorted, unique and carries no secret.
// When you run a migration, refresh the snapshot in the same PR: node scripts/schema-snapshot.mjs
// Run: node scripts/test-schema-snapshot.mjs
import { register } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as r } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('./') && ctx.parentURL && ctx.parentURL.includes('/src/')) { const u = new URL(spec + '.ts', ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; }
    if (spec.startsWith('@/')) { const b = r(SRC, spec.slice(2)); for (const c of [b + '.ts', b + '.tsx', b + '/index.ts']) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }; }
    return next(spec, ctx);
  }
`));
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

const S = await import('./schema-snapshot.mjs');
const lines = S.readSnapshot();
const tables = new Set(lines.filter((l) => l.startsWith('table ')).map((l) => l.split(' ')[1]));
const columns = new Set(lines.filter((l) => l.startsWith('column ')).map((l) => l.split(' ')[1]));

// ── 1. the file itself ──
ok(lines.length > 2000 && tables.size > 100, `the snapshot holds the whole schema (${lines.length} lines, ${tables.size} tables)`);
ok(lines.every((l, i) => i === 0 || lines[i - 1] < l), 'sorted and unique (a regenerated file diffs cleanly)');
ok(S.findSecrets(lines).length === 0, 'no line looks like a key, token or password value');
for (const kind of ['column', 'constraint', 'index', 'policy', 'trigger', 'function', 'grant']) ok(lines.some((l) => l.startsWith(kind + ' ')), `it records ${kind}s`);

// ── 2. the pure helpers ──
{
  const out = 'Initialising login role...\n{"rows":[{"r":{"lines":["b x","a  y","b x"]}}],"warning":"…"}';
  ok(JSON.stringify(S.parseQueryOutput(out)) === '["a y","b x"]', 'parseQueryOutput skips the CLI banner, normalises spaces, sorts, dedupes');
  const d = S.diffLines(['a', 'b'], ['b', 'c']);
  ok(d.removed.join() === 'a' && d.added.join() === 'c', 'diffLines reports removed and added lines');
  ok(S.findSecrets(["column x.k text default 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abc'"]).length === 1 && S.findSecrets(['column society_users.password text not null']).length === 0, 'a JWT in a default is caught; a column merely NAMED password is not');
  const sql = readFileSync(join(ROOT, 'scripts/schema-snapshot.sql'), 'utf8');
  ok(/^begin transaction read only;/m.test(sql) && /^rollback;/m.test(sql) && !/\b(insert|update|delete|alter|drop|create)\s/i.test(sql.replace(/--.*$/gm, '')), 'the snapshot query is read-only (transaction read only, no DML / DDL)');
}

// ── 3. the backup registry against production ──
const { REGISTRY } = await import(pathToFileURL(join(SRC, 'lib/export/registry.ts')).href);
{
  const missingTables = REGISTRY.filter((e) => !tables.has(e.table)).map((e) => e.table);
  ok(missingTables.length === 0, `every exported table exists in production (${missingTables.join(', ')})`);
  const missingCols = [];
  for (const e of REGISTRY) for (const c of e.columns ?? []) if (tables.has(e.table) && !columns.has(`${e.table}.${c.key}`)) missingCols.push(`${e.table}.${c.key}`);
  ok(missingCols.length === 0, `every exported column exists in production — a phantom column exports blank (${missingCols.length}: ${missingCols.slice(0, 12).join(', ')})`);
}

// ── 4. migrations against production ──
{
  const created = new Set();
  // A migration production has not run yet (merge comes first, the SQL after) is pending, not missing: only check the
  // ones the snapshot records as applied. A snapshot without these lines records none → every migration is checked.
  const applied = new Set(lines.filter((l) => l.startsWith('applied_migration ')).map((l) => l.split(' ')[1]));
  for (const f of readdirSync(join(ROOT, 'supabase/migrations')).filter((n) => /^\d{3}_.*\.sql$/.test(n) && !n.endsWith('_down.sql') && (applied.size === 0 || applied.has(n.slice(0, 3))))) {
    for (const m of readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8').matchAll(/^\s*create table if not exists\s+(?:public\.)?"?(\w+)"?/gim)) created.add(m[1]);
  }
  const never = [...created].filter((t) => !tables.has(t));
  ok(never.length === 0, `every table a migration creates exists in production — refresh the snapshot after running it (${never.join(', ')})`);
}

// ── 5. production tables outside the backup — each one with a reason ──
// Platform tables are not one society's books; system tables are logs / queues / caches that are rebuilt or expire.
const NOT_EXPORTED = {
  // platform: billing, partners, referrals, leads, blog (not a society's data)
  billing_seller: 'platform', invoices: 'platform', invoice_counters: 'platform', orders: 'platform', subscriptions: 'platform',
  partners: 'platform', partner_clawbacks: 'platform', partner_commission_rules: 'platform', partner_commissions: 'platform',
  partner_detail_requests: 'platform', partner_login_codes: 'platform', partner_payment_details: 'platform',
  partner_payout_items: 'platform', partner_payouts: 'platform', partner_sessions: 'platform', partner_tds_rules: 'platform',
  referral_attributions: 'platform', referral_attribution_events: 'platform', leads: 'platform', feedback: 'platform',
  blog_post_views: 'platform', catalog_versions: 'platform', email_preferences: 'platform', email_suppression: 'platform',
  email_verifications: 'platform', email_health_alerts: 'platform', notification_outbox: 'platform', signup_attempts: 'platform',
  // security / sessions (never leave the server)
  member_portal_users: 'security', member_portal_login_attempts: 'security', mfa_failures: 'security', mfa_verified_sessions: 'security',
  // system: migration bookkeeping, logs, restore machinery, one-off backups
  app_migrations: 'system', restore_tables: 'system', restore_staging: 'system', change_log: 'system', error_log: 'system',
  data_fix_log: 'system', account_reclass_log: 'system', account_seed_log: 'system', rls_policy_backup: 'system', _rls_182_backup: 'system',
  society_flags: 'system',
  // derived: rebuilt from the exported rows on restore / load
  financial_years: 'derived (restore re-derives FY rows, BKP-06A)', voucher_lines: 'derived (journal legs; vouchers + voucher_entries carry them)',
  account_roles: 'derived (role map seeded per chart)',
};
{
  const exported = new Set(REGISTRY.map((e) => e.table));
  // `_`-prefixed tables are private one-off backups (RLS on, no policy) — never society data, never exported.
  const unexplained = [...tables].filter((t) => !exported.has(t) && !(t in NOT_EXPORTED) && !t.startsWith('_'));
  ok(unexplained.length === 0, `every production table is exported or listed in NOT_EXPORTED with a reason (${unexplained.join(', ')})`);
  const stale = Object.keys(NOT_EXPORTED).filter((t) => !tables.has(t) || exported.has(t));
  ok(stale.length === 0, `NOT_EXPORTED lists only real, non-exported tables (${stale.join(', ')})`);
}

console.log(`DB-01 schema snapshot: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

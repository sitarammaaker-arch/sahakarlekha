// OPS-02 (product audit 2026-11-17) — the platform admins are alerted when the live build expects a migration that
// production has not run (2 h after the deploy). /migrations.json (scripts/migration-manifest.mjs) → email-health
// pendingMigrations() → claim_email_health_alert(p_site.missing_migrations) (migration 194; PGlite: scratchpad t194.mjs).
// Run: node scripts/test-ops0102-migrations.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const E = await import(pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/email-health.mjs')).href);
const MM = await import(pathToFileURL(resolve(ROOT, 'scripts/migration-manifest.mjs')).href + '?test');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const HOUR = 3600 * 1000;
const NOW = Date.parse('2026-11-21T12:00:00Z');
const manifestFetch = (body) => async (url) => (url.endsWith('/migrations.json') ? { status: 200, json: async () => body } : { status: 200 });
const supaWith = (versions, error = null) => ({ from: (t) => ({ select: async () => (t === 'app_migrations' ? { data: error ? null : versions.map((version) => ({ version })), error } : { data: [], error: null }) }) });

// ── pendingMigrations ──
{
  const man = { builtAt: new Date(NOW - 3 * HOUR).toISOString(), expected: ['192', '193', '194'] };
  ok(JSON.stringify(await E.pendingMigrations(supaWith(['192', '193']), 'https://x.test', manifestFetch(man), { now: NOW })) === '["194"]', 'a 3-hour-old build expecting 194 on a DB without it → ["194"]');
  ok((await E.pendingMigrations(supaWith(['192', '193', '194']), 'https://x.test', manifestFetch(man), { now: NOW })).length === 0, 'all run → nothing missing');
  const fresh = { builtAt: new Date(NOW - 30 * 60 * 1000).toISOString(), expected: ['194'] };
  ok((await E.pendingMigrations(supaWith([]), 'https://x.test', manifestFetch(fresh), { now: NOW })).length === 0, 'within the 2-hour grace after a deploy → no alert yet (time to run it)');
  ok((await E.pendingMigrations(supaWith([], { message: 'x' }), 'https://x.test', manifestFetch(man), { now: NOW })).length === 0, 'unreadable app_migrations → [] (no guess)');
  ok((await E.pendingMigrations(supaWith([]), 'https://x.test', async () => ({ status: 404 }), { now: NOW })).length === 0, 'no /migrations.json (older build) → []');
  ok((await E.pendingMigrations(supaWith([]), 'https://x.test', async () => { throw new Error('net'); }, { now: NOW })).length === 0, 'network failure → [], never throws');
}

// ── runHealthCheck carries it to the claim; the email names the file ──
{
  const calls = [];
  const supa = { ...supaWith(['192']), rpc: async (name, args) => { calls.push(args); return { data: { action: 'none' }, error: null }; } };
  const man = { builtAt: new Date(NOW - 5 * HOUR).toISOString(), expected: ['192', '193'] };
  await E.runHealthCheck(supa, { appUrl: 'https://x.test', fetch: manifestFetch(man), probe: true, now: NOW });
  ok(calls[0]?.p_site?.ok === true && JSON.stringify(calls[0].p_site.missing_migrations) === '["193"]', 'probe: true → p_site carries missing_migrations ["193"]');
  const lines = E.appProblems({ site: { ok: true, missing_migrations: ['193', '194'] } });
  ok(lines.length === 1 && lines[0].includes('193, 194') && lines[0].includes('SQL Editor'), 'the alert line names the migrations and where to run them');
  ok(E.buildHealthEmail('alert', { site: { ok: true, missing_migrations: ['193'] } }, { appUrl: 'https://x.test' }).subject.includes('Platform errors'), 'subject: platform problem (not "website down")');
}

// ── manifest + wiring ──
{
  const { expected, unregistered } = MM.manifest();
  ok(unregistered.length === 0 && expected.includes('194') && expected[0] === '072', 'the manifest lists every registered migration 072..194, none unregistered');
  ok(MM.UNTRACKED.length === 10, 'the untracked list is frozen at the 10 pre-convention files');
  const pkg = JSON.parse(read('package.json'));
  ok(pkg.scripts['build:cloudflare'].endsWith('&& node scripts/migration-manifest.mjs --write'), 'build:cloudflare (local and the GitHub deploy) writes dist/migrations.json');
  const m = read('supabase/migrations/194_migration_pending_alert.sql');
  ok(m.includes("if jsonb_typeof(p_site -> 'missing_migrations') = 'array' and jsonb_array_length(p_site -> 'missing_migrations') > 0 then") && /values \('194', /.test(m), '194: a non-empty missing_migrations forces an alert; registers itself');
  ok(m.includes('grant execute on function public.claim_email_health_alert(jsonb) to service_role;') && m.includes('revoke execute on function public.claim_email_health_alert(jsonb) from public, anon, authenticated;'), '194 keeps the claim service-role only');
  ok(read('supabase/migrations/194_migration_pending_alert_down.sql').includes("delete from public.app_migrations where version = '194'"), 'down restores 192');
}

console.log(`OPS-02 migrations alert: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

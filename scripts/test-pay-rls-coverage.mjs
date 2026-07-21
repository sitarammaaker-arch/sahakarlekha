// test-pay-rls-coverage.mjs — LIVE assertion that the payroll schema's RLS is complete.
// Proves, against a real DB with the payroll schema applied:
//   1. every pay_* base/partitioned table has RLS ENABLED + FORCED,
//   2. no tenant table (one with a society_id column) has a permissive (true) SELECT policy,
//   3. WORM tables (pay_event/run_snapshot/change_log/config_history/employment_event) have
//      zero UPDATE and zero DELETE policies.
//
// Connection: DATABASE_URL from the environment, or a gitignored .env.staging.local.
// Skips cleanly (exit 0) when no DATABASE_URL is set — so CI without staging creds stays green.
//
// Run: node scripts/test-pay-rls-coverage.mjs   (npm run test:pay-rls-coverage)

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

function loadDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.resolve(process.cwd(), '.env.staging.local');
  if (fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim();
  }
  return '';
}

const url = loadDbUrl();
if (!url) {
  console.log('SKIP  pay RLS-coverage — live test, needs a DATABASE_URL (staging with the payroll schema applied).');
  process.exit(0);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
let fail = 0;
const ok = (cond, msg) => { if (cond) { console.log('  ✓', msg); } else { fail++; console.error('  ✗', msg); } };

try {
  await client.connect();

  // guard: is the payroll schema even here?
  const present = (await client.query("select count(*)::int c from information_schema.schemata where schema_name like 'pay\\_%'")).rows[0].c;
  if (present === 0) {
    console.log('SKIP  pay RLS-coverage — no pay_* schemas on this DB (apply the payroll migrations first).');
    await client.end();
    process.exit(0);
  }

  // 1. RLS enabled + forced on every pay_* base/partitioned table
  const noRls = (await client.query(
    `select n.nspname||'.'||c.relname t
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname like 'pay\\_%' and c.relkind in ('r','p')
        and (not c.relrowsecurity or not c.relforcerowsecurity)`)).rows.map((r) => r.t);
  ok(noRls.length === 0, `every pay_* table has RLS enabled+forced${noRls.length ? ' — MISSING: ' + noRls.join(', ') : ''}`);

  // 2. tenant tables must NOT have a permissive (true) SELECT policy
  const permissiveTenant = (await client.query(
    `select p.schemaname||'.'||p.tablename||':'||p.policyname pol
       from pg_policies p
       join pg_class c on c.relname = p.tablename
       join pg_namespace n on n.oid = c.relnamespace and n.nspname = p.schemaname
      where p.schemaname like 'pay\\_%' and p.cmd = 'SELECT' and (p.qual = 'true' or p.qual is null)
        and exists (select 1 from pg_attribute a
                    where a.attrelid = c.oid and a.attname = 'society_id' and not a.attisdropped)`)).rows.map((r) => r.pol);
  ok(permissiveTenant.length === 0, `no tenant table has a permissive (true) SELECT policy${permissiveTenant.length ? ' — ' + permissiveTenant.join(', ') : ''}`);

  // 3. WORM tables: zero UPDATE and zero DELETE policies
  const worm = ['pay_event', 'run_snapshot', 'change_log', 'config_history', 'employment_event'];
  const wormPol = (await client.query(
    `select tablename, cmd, count(*)::int c from pg_policies
      where schemaname like 'pay\\_%' and tablename = any($1) and cmd in ('UPDATE','DELETE')
      group by 1,2`, [worm])).rows;
  ok(wormPol.length === 0, `WORM tables have 0 UPDATE/DELETE policies${wormPol.length ? ' — ' + JSON.stringify(wormPol) : ''}`);

  const totalPay = (await client.query("select count(*)::int c from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname like 'pay\\_%' and c.relkind in ('r','p')")).rows[0].c;
  const totalPol = (await client.query("select count(*)::int c from pg_policies where schemaname like 'pay\\_%'")).rows[0].c;
  console.log(`  · pay_* tables: ${totalPay} | policies: ${totalPol}`);

  await client.end();
  console.log(fail === 0 ? 'PASS  pay RLS-coverage' : `FAIL  pay RLS-coverage (${fail})`);
  process.exit(fail === 0 ? 0 : 1);
} catch (e) {
  console.error('ERROR pay RLS-coverage:', e.message);
  process.exit(2);
}

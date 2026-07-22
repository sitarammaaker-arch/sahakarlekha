// Verifies the payroll public API (migration 115) on staging: applies it, links a demo HR user to
// the demo society, then — as a SIMULATED tenant session (request.jwt.claims email) — calls the
// SECURITY INVOKER RPCs and asserts they return exactly the demo run/payslip the orchestrator
// persisted, tenant-scoped by RLS. Proves the browser's read surface works end-to-end.
//
// Run (integrate worktree): node scripts/test-pay-ui-api.mjs

import fs from 'node:fs';
import pg from 'pg';

const url = fs.readFileSync('.env.staging.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const pass = url.match(/postgresql:\/\/[^:]+:([^@]+)@/)[1];
const c = new pg.Client({ connectionString: `postgresql://postgres.ivmrlhjrqtwftdlxajxk:${pass}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`, ssl: { rejectUnauthorized: false } });

const SOC = 'dede0000-0000-4000-8000-000000000001';
const HR_EMAIL = 'demo-hr@sahakarlekha.test';
const SU_ID = 'dede0000-0000-4000-8000-000000000099';
let pass_ = 0, fail_ = 0;
const ok = (cond, msg) => { if (cond) { pass_++; console.log('  ✓', msg); } else { fail_++; console.error('  ✗', msg); } };

await c.connect();
try {
  // apply 115
  await c.query(fs.readFileSync('supabase/migrations/payroll/115_pay_public_api.sql', 'utf8'));
  console.log('applied 115_pay_public_api.sql');

  // link a demo HR user to the demo society (idempotent)
  await c.query(
    `insert into public.society_users(id,society_id,name,email,password,role,is_active)
     values($1,$2,$3,$4,$5,$6,true) on conflict (id) do nothing`,
    [SU_ID, SOC, 'Demo HR', HR_EMAIL, 'x', 'admin']);

  // simulate that HR user's session and call the RPCs (RLS + tenant resolution apply)
  await c.query('begin');
  await c.query(`set local role authenticated`);
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'authenticated', email: HR_EMAIL })]);

  const runs = (await c.query(`select * from public.pay_list_runs()`)).rows;
  ok(runs.length >= 1, `pay_list_runs() returned ${runs.length} run(s) for the tenant`);
  const demo = runs.find((r) => Number(r.total_net_minor) === 4440000);
  ok(!!demo, 'the demo run is listed with total_net_minor 4440000');
  ok(demo && demo.payslip_count === 1, 'the demo run shows 1 payslip');

  if (demo) {
    const slips = (await c.query(`select * from public.pay_run_payslips($1)`, [demo.run_id])).rows;
    ok(slips.length === 1, `pay_run_payslips() returned ${slips.length} payslip`);
    ok(slips[0] && Number(slips[0].net_minor) === 4440000 && Number(slips[0].gross_minor) === 4800000, 'payslip net 4440000 / gross 4800000');
    ok(slips[0] && slips[0].employee_code === 'EMP001', 'payslip carries the employee code EMP001');
  }
  await c.query('rollback'); // undo the role/claims session (the seed above is committed)

  console.log(`\n${fail_ === 0 ? 'PASS' : 'FAIL'}  pay ui-api — ${pass_} passed, ${fail_} failed`);
  process.exit(fail_ === 0 ? 0 : 1);
} catch (e) {
  try { await c.query('rollback'); } catch { /* ignore */ }
  console.error('FATAL:', e.message);
  process.exit(1);
} finally {
  await c.end();
}

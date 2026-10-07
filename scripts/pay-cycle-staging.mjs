// Full payroll cycle against the deployed pay-* Edge Functions on STAGING ONLY.
//   add employees -> pay-run -> verify -> approve -> lock -> post -> pay -> rollback
// and checks the money invariants at every step (ledger balanced, net-zero after rollback,
// double-post refused, invalid transitions refused).
//
// WHO RUNS IT: the human. The script signs in as a staging society admin, so it asks for the
// email + password at the prompt (the password is typed hidden and never written to disk/logs).
//
// SAFETY: refuses to run unless BOTH SUPABASE_URL and DATABASE_URL in .env.staging.local point at the
// staging project ref. It only ever writes through the Edge Functions (the same path the UI uses);
// the database connection is used for READ-ONLY checks.
//
// Run:  node scripts/pay-cycle-staging.mjs            (optional: PERIOD=2026-03 node ...)

import fs from 'node:fs';
import pg from 'pg';

const STAGING_REF = 'ivmrlhjrqtwftdlxajxk';
const PROD_REF = 'rwffxupenwdtrmyabytk';
const WITH_TDS = process.env.WITH_TDS === '1';   // also exercise salary TDS (P2): $env:WITH_TDS='1'
const WITH_ER = process.env.WITH_ER === '1';     // also exercise the EMPLOYER PF/ESI share (er-set): $env:WITH_ER='1'

// ── env + staging guard ───────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs.readFileSync('.env.staging.local', 'utf8').split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]),
);
const SUPABASE_URL = env.SUPABASE_URL, ANON = env.SUPABASE_ANON_KEY, DB_URL = env.DATABASE_URL;
if (!SUPABASE_URL || !ANON || !DB_URL) { console.error('STOP: .env.staging.local needs SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL'); process.exit(2); }
for (const [k, v] of [['SUPABASE_URL', SUPABASE_URL], ['DATABASE_URL', DB_URL]]) {
  if (v.includes(PROD_REF) || !v.includes(STAGING_REF)) {
    console.error(`STOP: ${k} does not point at STAGING (${STAGING_REF}). Refusing to run.`); process.exit(2);
  }
}

// ── tiny helpers ──────────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.error('  ✗ FAIL:', msg); } };
const step = (t) => console.log(`\n== ${t}`);

function ask(q, hidden = false) {
  return new Promise((resolve) => {
    process.stdout.write(q);
    const stdin = process.stdin;
    let buf = '';
    if (hidden && stdin.isTTY) stdin.setRawMode(true);
    stdin.resume(); stdin.setEncoding('utf8');
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          if (hidden && stdin.isTTY) stdin.setRawMode(false);
          stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); return resolve(buf);
        }
        if (c === '\u0003') process.exit(130);
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1); else buf += c;
      }
    };
    stdin.on('data', onData);
  });
}

async function signIn(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`sign-in failed: ${j.error_description || j.msg || r.status}`);
  return j.access_token;
}

let TOKEN = '';
async function fn(name, body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST', headers: { apikey: ANON, authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const raw = await r.text();
  let j = {}; try { j = JSON.parse(raw); } catch { /* non-JSON */ }
  // Surface WHY it failed: our functions use {error}, the Supabase platform uses {message}/{msg}/{code},
  // and a crash can be plain text. Never leave a 5xx with an empty reason.
  if (r.status >= 400 && !j.error) j.error = [j.code, j.message || j.msg, j.error_description].filter(Boolean).join(': ') || raw.slice(0, 300) || '(empty body)';
  return { status: r.status, body: j };
}

async function connectDb() {
  const direct = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try { await direct.connect(); return direct; } catch { /* IPv6-only host unreachable -> pooler */ }
  const pass = DB_URL.match(/postgresql:\/\/[^:]+:([^@]+)@/)[1];
  const pooler = new pg.Client({ connectionString: `postgresql://postgres.${STAGING_REF}:${pass}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await pooler.connect(); return pooler;
}

// ── main ──────────────────────────────────────────────────────────────────────────────────
const email = (await ask('Staging admin email: ')).trim();
const password = await ask('Password (hidden): ', true);
const db = await connectDb();
await db.query('begin read only'); // every DB statement below is a SELECT
const created = [];
let createdRunId = '';        // the run this script made (for end-of-test cleanup)
let runFinalised = false;     // true once posted/paid/rolled back — those must not be cancelled
// declared HERE, not inside the try: the cleanup in `finally` reads them (a block-scoped `let` made that a ReferenceError)
let tdsEmpId = '', tdsExpectedMinor = 0n, ptLeftover = 0, esiEmpId = '', esiLines = 0;
let erEmpId = '', erOn = false, erPfTotal = 0n, erEsiTotal = 0n;   // the employer-share test employee + what the run holds for it
const pfExpectedMinor = 300000;   // ₹25,000 ceiling (from 2026-09-17) × 12%, for the Nov-2026 period this script uses

try {
  TOKEN = await signIn(email, password);
  console.log('signed in to STAGING');

  // CLEANUP_ONLY=1 — leftovers of an earlier run that died before its own cleanup: switch TDS off and deactivate every
  // still-active "Cycle …" test employee, then stop. Touches nothing else.
  if (process.env.CLEANUP_ONLY === '1') {
    step('cleanup only: leftover "Cycle …" test employees');
    const lst = await fn('pay-employee', { action: 'list' });
    const nameOf = (e) => (e.full_name && (e.full_name.en || e.full_name.hi)) || '';
    const left = (lst.body.employees || []).filter((e) => /^Cycle /.test(nameOf(e)) && !e.left_on);
    const day = new Date().toISOString().slice(0, 10);
    for (const e of left) {
      if (e.tds_code) { const off = await fn('pay-employee', { action: 'tds-set', employeeId: e.id, enabled: false }); console.log(`  - ${nameOf(e)}: TDS off -> ${off.status === 200 ? 'ok' : 'status ' + off.status + ' ' + (off.body.error || '')}`); }
      const d = await fn('pay-employee', { action: 'deactivate', employeeId: e.id, lastDay: day });
      console.log(`  - ${nameOf(e)} (${e.employee_code}): ${d.status === 200 ? 'deactivated' : d.body.code === 'PAY-EMP-SAMEDAY' ? 'left active — its structure changed today; run  $env:CLEANUP_ONLY=1  tomorrow' : 'status ' + d.status + ' ' + (d.body.error || '')}`);
    }
    console.log(`\n${left.length} leftover test employee(s) handled.`);
    await db.query('rollback').catch(() => {}); await db.end().catch(() => {});
    process.exit(0);
  }

  step('0. pick a period inside an OPEN financial year (post_voucher refuses any other date)');
  const [suRow] = (await db.query(`select society_id::text sid from public.society_users where lower(email) = lower($1) and is_active = true limit 1`, [email])).rows;
  if (!suRow) throw new Error(`${email} is not an active society user on staging`);
  const SOC = suRow.sid;
  const fy = (await db.query(`select start_date::text s, end_date::text e from public.financial_years where society_id = $1 and status = 'open' order by start_date limit 1`, [SOC])).rows[0];
  ok(!!fy, `an open financial year exists (${fy ? fy.s + ' .. ' + fy.e : 'none'})`);
  if (!fy) throw new Error('no open financial year for this society');
  // a month is free when no run of it is already past draft (several drafts of one month are normal)
  const taken = new Set((await db.query(`select period::text p from pay_calc.payroll_run where state in ('verified','approved','locked','posted','paid')`)).rows.map((r) => r.p));
  let period = process.env.PERIOD || '';
  if (!period) {
    let start = new Date(fy.s + 'T00:00:00Z'); const end = new Date(fy.e + 'T00:00:00Z');
    // WITH_TDS: switching TDS on is history-safe — it applies from today — so the run must be THIS month or later.
    if (WITH_TDS || WITH_ER) { const n = new Date(); const cur = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)); if (cur > start) start = cur; }
    for (let d = new Date(start); d <= end && !period; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
      const p = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!taken.has(p)) period = p;
    }
  }
  ok(period && !taken.has(period), `period ${period} is inside the open year and has no verified/locked/posted/paid run`);
  if (!period || taken.has(period)) throw new Error('no free period in the open financial year');
  const [pYear, pMon] = period.split('-').map(Number);
  const monthsLeft = pMon >= 4 ? 12 - (pMon - 4) : 4 - pMon;   // April = 12 … March = 1 (the Salary page's own count)
  const PAID_FROM = process.env.PAID_FROM || '3302';   // staging chart: 3302 = Bank Accounts
  const today = new Date().toISOString().slice(0, 10);

  step('1. add 3 test employees');
  const stamp = Date.now().toString().slice(-6);
  const emps = [['Cycle Test A', 2500000], ['Cycle Test B', 3000000], ['Cycle Test C', 1800000]];
  for (const [i, [name, basicMinor]] of emps.entries()) {
    const t0 = Date.now();
    const r = await fn('pay-employee', { action: 'add', name, code: `CYC${stamp}${i + 1}`, type: 'permanent', basicMinor, dateOfJoin: '2025-01-01' });
    const addMs = Date.now() - t0;   // adding an employee was ~9 s on prod (≈70 round trips to a far database) — watch this number
    ok(r.status === 200 && r.body.ok !== false, `added ${name} (status ${r.status}${r.body.error ? ' ' + r.body.error : ''}) in ${(addMs / 1000).toFixed(1)} s`);
    if (r.body.employeeId) created.push(r.body.employeeId);
  }

  if (WITH_TDS) {
    step('1b. salary TDS — switch it on for one well-paid employee, and prove it refuses unverified law');
    const t = await fn('pay-employee', { action: 'add', name: 'Cycle TDS', code: `CYC${stamp}T`, type: 'permanent', basicMinor: 8000000, dateOfJoin: '2025-01-01' });
    ok(t.status === 200 && t.body.employeeId, `added Cycle TDS, basic ₹80,000 (status ${t.status}${t.body.error ? ' ' + t.body.error : ''})`);
    tdsEmpId = t.body.employeeId || '';
    if (tdsEmpId) created.push(tdsEmpId);
    const on = await fn('pay-employee', { action: 'tds-set', employeeId: tdsEmpId, enabled: true });
    ok(on.status === 200 && on.body.code === 'TDS' && on.body.changed === true, `TDS switched on (component ${on.body.code}, status ${on.status}${on.body.error ? ' ' + on.body.error : ''})`);
    ok(!on.body.lawWarning, `no law warning for the current month${on.body.lawWarning ? ': ' + on.body.lawWarning : ''}`);
    const on2 = await fn('pay-employee', { action: 'tds-set', employeeId: tdsEmpId, enabled: true });
    ok(on2.status === 200 && on2.body.changed === false, 'switching it on again changes nothing (idempotent)');
    const lst = await fn('pay-employee', { action: 'list' });
    const me = (lst.body.employees || []).find((e) => e.id === tdsEmpId);
    ok(!!me && me.tds_code === 'TDS', 'the employee list shows tds_code = TDS');
    // Professional Tax is MANUAL (no verified state slab): a fixed ₹200 a month, entered by the admin
    const ptAdd = await fn('pay-employee', { action: 'structure-add', employeeId: tdsEmpId, code: 'PT', basicMinor: 20000 });
    ok(ptAdd.status === 200 && ptAdd.body.code === 'PT', `PT ₹200 added to the structure by hand (status ${ptAdd.status}${ptAdd.body.error ? ' ' + ptAdd.body.error : ''})`);
    const stru = await fn('pay-employee', { action: 'structure-get', employeeId: tdsEmpId });
    const ptRow = (stru.body.components || []).find((c) => c.code === 'PT');
    ok(!!ptRow && ptRow.calc_method === 'fixed' && Number(ptRow.fixed_minor) === 20000, 'the structure shows PT as a FIXED ₹200 (no slab formula)');
    ok((stru.body.components || []).some((c) => c.code === 'TDS'), 'and the TDS component is still there (adding PT did not drop it)');
    // ₹80,000 basic → gross ₹1,28,000/month = ₹15.36 lakh/yr → ₹1,03,116 tax for FY 2026-27 (derived by hand: slabs 0/5/10/15% on ₹14.61 lakh + 4% cess)
    tdsExpectedMinor = BigInt(Math.round(103116 / monthsLeft)) * 100n;
    // a month no slab set covers (2031): the run must be REFUSED, name the employee, and create nothing
    const before = (await db.query(`select count(*)::int n from pay_calc.payroll_run where period::text = '2031-07'`)).rows[0].n;
    const refused = await fn('pay-run', { period: '2031-07' });
    ok(refused.status === 409 && refused.body.code === 'PAY-TAX-LAW', `a run for 2031-07 (no slab set covers it) is REFUSED (status ${refused.status}${refused.body.code ? ' ' + refused.body.code : ''})`);
    ok(String(refused.body.error || '').includes(`CYC${stamp}T`), 'the refusal names the employee whose TDS cannot be computed');
    const afterN = (await db.query(`select count(*)::int n from pay_calc.payroll_run where period::text = '2031-07'`)).rows[0].n;
    ok(afterN === before, 'and no run was created');
    // ESI (employee share): OFF for everyone by default; one small-wage employee gets it switched on. Basic ₹10,000 → earned gross ₹16,000 → 0.75% = ₹120.
    const ee = await fn('pay-employee', { action: 'add', name: 'Cycle ESI', code: `CYC${stamp}E`, type: 'permanent', basicMinor: 1000000, dateOfJoin: '2025-01-01' });
    ok(ee.status === 200 && ee.body.employeeId, `added Cycle ESI, basic ₹10,000 (status ${ee.status}${ee.body.error ? ' ' + ee.body.error : ''})`);
    esiEmpId = ee.body.employeeId || '';
    if (esiEmpId) created.push(esiEmpId);
    const eon = await fn('pay-employee', { action: 'esi-set', employeeId: esiEmpId, enabled: true });
    ok(eon.status === 200 && eon.body.code === 'ESI' && eon.body.changed === true, `ESI switched on (component ${eon.body.code}, status ${eon.status}${eon.body.error ? ' ' + eon.body.error : ''})`);
    ok(typeof eon.body.lawWarning === 'string' && /not yet confirmed/.test(eon.body.lawWarning), 'the switch says the ESI rates are not yet confirmed (honest about verified:false)');
    const eon2 = await fn('pay-employee', { action: 'esi-set', employeeId: esiEmpId, enabled: true });
    ok(eon2.status === 200 && eon2.body.changed === false, 'switching ESI on again changes nothing (idempotent)');
    const elst = await fn('pay-employee', { action: 'list' });
    ok(((elst.body.employees || []).find((e) => e.id === esiEmpId) || {}).esi_code === 'ESI', 'the employee list shows esi_code = ESI');
    const nm = (e) => (e.full_name && (e.full_name.en || e.full_name.hi)) || '';
    ok((elst.body.employees || []).filter((e) => e.esi_code && !/^Cycle ESI/.test(nm(e))).length === 0, 'ESI is on ONLY for the "Cycle ESI" test employee(s) — off for everyone else (default off)');
  }

  if (WITH_ER) {
    step('1c. employer PF/ESI share — switch it on for one employee, and prove the refusals');
    // The switch refuses unless the society has the employer-expense roles; say so plainly instead of failing blind.
    const roles = (await db.query(`select role from public.account_roles where society_id = $1 and role in ('pf.employer_expense','esi.employer_expense')`, [SOC])).rows.map((r) => r.role);
    const rolesOk = roles.includes('pf.employer_expense') && roles.includes('esi.employer_expense');
    console.log(`  roles on this staging society: ${roles.join(', ') || '(none)'}`);
    const er = await fn('pay-employee', { action: 'add', name: 'Cycle ER', code: `CYC${stamp}R`, type: 'permanent', basicMinor: 1000000, dateOfJoin: '2025-01-01' });
    ok(er.status === 200 && er.body.employeeId, `added Cycle ER, basic ₹10,000 (status ${er.status}${er.body.error ? ' ' + er.body.error : ''})`);
    erEmpId = er.body.employeeId || '';
    if (erEmpId) created.push(erEmpId);
    // ESI on first: the employer share follows the employee share, so this employee will carry both ER_PF and ER_ESI
    const es = await fn('pay-employee', { action: 'esi-set', employeeId: erEmpId, enabled: true });
    ok(es.status === 200 && es.body.code === 'ESI', `ESI switched on for Cycle ER (status ${es.status}${es.body.error ? ' ' + es.body.error : ''})`);
    // the daily-wage / no-PF-no-ESI refusal
    const ap = await fn('pay-employee', { action: 'add', name: 'Cycle ER NoStat', code: `CYC${stamp}N`, type: 'apprentice', basicMinor: 900000, dateOfJoin: '2025-01-01' });
    if (ap.body.employeeId) created.push(ap.body.employeeId);
    const apOn = await fn('pay-employee', { action: 'er-set', employeeId: ap.body.employeeId, enabled: true });
    ok(apOn.status === 400, `er-set is REFUSED for an employee with neither PF nor ESI (status ${apOn.status}${apOn.body.error ? ': ' + String(apOn.body.error).slice(0, 70) : ''})`);
    if (!rolesOk) {
      const refused = await fn('pay-employee', { action: 'er-set', employeeId: erEmpId, enabled: true });
      ok(refused.status === 409 && /pf\.employer_expense|esi\.employer_expense/.test(String(refused.body.error || '')), `roles are missing on staging, so er-set is REFUSED with the roles named (status ${refused.status})`);
      console.log('  ! the rest of the employer-share checks need the two roles. Add them on STAGING (SQL Editor, staging project only):');
      console.log("      insert into public.account_roles(society_id, role, account_id) values ('" + SOC + "','pf.employer_expense','5203'),('" + SOC + "','esi.employer_expense','5204') on conflict do nothing;");
      console.log('    then run this script again with  $env:WITH_ER=1');
    } else {
      const on = await fn('pay-employee', { action: 'er-set', employeeId: erEmpId, enabled: true });
      ok(on.status === 200 && on.body.enabled === true && (on.body.codes || []).includes('ER_PF') && (on.body.codes || []).includes('ER_ESI'), `er-set on: components ${(on.body.codes || []).join(', ')} (status ${on.status}${on.body.error ? ' ' + on.body.error : ''})`);
      ok(typeof on.body.lawWarning === 'string' && /not yet confirmed/.test(on.body.lawWarning), 'the switch says the employer rates are not yet confirmed (honest about verified:false)');
      const on2 = await fn('pay-employee', { action: 'er-set', employeeId: erEmpId, enabled: true });
      ok(on2.status === 200, 'switching it on again is harmless (idempotent)');
      const lst = await fn('pay-employee', { action: 'list' });
      const me = (lst.body.employees || []).find((e) => e.id === erEmpId) || {};
      ok(Array.isArray(me.er_codes) && me.er_codes.includes('ER_PF') && me.er_codes.includes('ER_ESI'), 'the employee list shows er_codes = ER_PF, ER_ESI');
      const nm2 = (e) => (e.full_name && (e.full_name.en || e.full_name.hi)) || '';
      ok((lst.body.employees || []).filter((e) => (e.er_codes || []).length && !/^Cycle ER/.test(nm2(e))).length === 0, 'the employer share is on ONLY for the "Cycle ER" test employee(s) — off for everyone else (default off)');
      erOn = true;
    }
  }

  step('2. compute the run');
  const run = await fn('pay-run', { period });
  ok(run.status === 200 && run.body.runId, `pay-run created ${run.body.runNo || ''} for ${period} (${run.body.employeeCount} payslips)${run.body.error ? ' ' + run.body.error : ''}`);
  if (!run.body.runId) throw new Error('run not created');
  const runId = run.body.runId;
  createdRunId = runId;
  ok(run.body.employeeCount >= 3, 'run covers at least the 3 new employees');
  const ps = (await db.query(`select count(*)::int n, coalesce(sum(gross_minor),0)::bigint g, coalesce(sum(net_minor),0)::bigint nt, coalesce(sum(deductions_minor),0)::bigint d from pay_calc.payslip where pay_run_id=$1`, [runId])).rows[0];
  ok(ps.n === run.body.employeeCount, `payslip rows (${ps.n}) = employeeCount`);
  ok(BigInt(ps.g) - BigInt(ps.d) === BigInt(ps.nt), 'every payslip: gross - deductions = net (in total)');
  if (WITH_TDS) {
    const tl = (await db.query(`select pl.computed_minor::bigint amt from pay_calc.payslip_line pl join pay_calc.payslip p on p.id = pl.payslip_id
      join pay_config.component_catalog cc on cc.id = pl.component_id where p.pay_run_id = $1 and p.employee_id = $2 and cc.code = 'TDS'`, [runId, tdsEmpId])).rows;
    ok(tl.length === 1 && BigInt(tl[0].amt) === tdsExpectedMinor,
      `the TDS payslip line is ₹${Number(tdsExpectedMinor) / 100} (₹1,03,116 for the year ÷ ${monthsLeft} months left)${tl.length ? ' — got ₹' + Number(tl[0].amt) / 100 : ' — NO TDS line'}`);
    const others = (await db.query(`select count(*)::int n from pay_calc.payslip_line pl join pay_calc.payslip p on p.id = pl.payslip_id
      join pay_config.component_catalog cc on cc.id = pl.component_id where p.pay_run_id = $1 and p.employee_id <> $2 and (cc.code = 'TDS' or cc.code like 'TDS\\_%') and pl.computed_minor > 0`, [runId, tdsEmpId])).rows[0].n;
    ok(others === 0, 'no other employee in the run got a TDS deduction');
    const ptl = (await db.query(`select pl.computed_minor::bigint amt from pay_calc.payslip_line pl join pay_calc.payslip p on p.id = pl.payslip_id
      join pay_config.component_catalog cc on cc.id = pl.component_id where p.pay_run_id = $1 and p.employee_id = $2 and cc.code = 'PT'`, [runId, tdsEmpId])).rows;
    ok(ptl.length === 1 && BigInt(ptl[0].amt) === 20000n, `the PT payslip line is exactly the ₹200 entered${ptl.length ? ' — got ₹' + Number(ptl[0].amt) / 100 : ' — NO PT line'}`);
    const ptOthers = (await db.query(`select e.employee_code c, coalesce(e.full_name->>'en', e.full_name->>'hi', '') nm from pay_calc.payslip_line pl join pay_calc.payslip p on p.id = pl.payslip_id
      join pay_core.employee e on e.id = p.employee_id
      join pay_config.component_catalog cc on cc.id = pl.component_id where p.pay_run_id = $1 and p.employee_id <> $2 and cc.code = 'PT' and pl.computed_minor > 0`, [runId, tdsEmpId])).rows;
    // a leftover "Cycle TDS" employee of an EARLIER run (could not be deactivated the same day) still has its own hand-entered PT — not a bug
    const ptReal = ptOthers.filter((r) => !/^(Cycle TDS|DEMO-R5)/.test(r.nm));   // test employees of earlier scripts that could not be deactivated the same day
    ok(ptReal.length === 0, `no other employee got a PT deduction (it is per employee, by hand)${ptReal.length ? ' — got: ' + ptReal.map((r) => r.nm + ' ' + r.c).join(', ') : ''}`);
    if (ptOthers.length) console.log(`  ! note: ${ptOthers.length} leftover "Cycle TDS" employee(s) from earlier runs also carry PT ₹200 (${ptOthers.map((r) => r.c).join(', ')}) — run CLEANUP_ONLY=1 tomorrow`);
    ptLeftover = ptOthers.length;
    const esl = (await db.query(`select p.employee_id, pl.computed_minor::bigint amt from pay_calc.payslip_line pl join pay_calc.payslip p on p.id = pl.payslip_id
      join pay_config.component_catalog cc on cc.id = pl.component_id where p.pay_run_id = $1 and (cc.code = 'ESI' or cc.code like 'ESI\\_%') and pl.computed_minor > 0`, [runId])).rows;
    esiLines = esl.length;   // a leftover "Cycle ESI" employee of an earlier run carries its own ₹120 too
    ok(esl.some((r) => r.employee_id === esiEmpId && BigInt(r.amt) === 12000n) && esl.every((r) => BigInt(r.amt) === 12000n), `ESI: the ESI employee's payslip line is ₹120 (0.75% of ₹16,000) and every ESI line is that same ₹120 — ${esl.length} line(s)`);
    // PF: this employee's basic is ₹80,000 → wage ₹96,000, far above the ceiling → PF is on the ceiling only (EPFO FAQ Q21)
    const pfl = (await db.query(`select pl.computed_minor::bigint amt from pay_calc.payslip_line pl join pay_calc.payslip p on p.id = pl.payslip_id
      join pay_config.component_catalog cc on cc.id = pl.component_id where p.pay_run_id = $1 and p.employee_id = $2 and cc.code = 'PF'`, [runId, tdsEmpId])).rows;
    ok(pfl.length === 0 || BigInt(pfl[0].amt) === BigInt(pfExpectedMinor), `PF on the ceiling, not on the whole wage: ₹${pfExpectedMinor / 100}${pfl.length ? ' — got ₹' + Number(pfl[0].amt) / 100 : ' — (no PF line on this structure, check skipped)'}`);
  }

  if (WITH_ER && erOn) {
    const erl = (await db.query(`select cc.code, pl.computed_minor::bigint amt, p.employee_id from pay_calc.payslip_line pl join pay_calc.payslip p on p.id = pl.payslip_id
      join pay_config.component_catalog cc on cc.id = pl.component_id where p.pay_run_id = $1 and (cc.code = 'ER_PF' or cc.code = 'ER_ESI' or cc.code like 'ER\\_ESI\\_%')`, [runId])).rows;
    const mine = erl.filter((r) => r.employee_id === erEmpId);
    // basic ₹10,000 -> PF wage ₹12,000 x 13% = ₹1,560 ; gross ₹16,000 x 3.25% = ₹520
    ok(mine.some((r) => r.code === 'ER_PF' && BigInt(r.amt) === 156000n), `employer PF line is ₹1,560 (13% of ₹12,000)${mine.length ? ' — got ' + mine.map((r) => r.code + ' ₹' + Number(r.amt) / 100).join(', ') : ' — NO employer lines were saved'}`);
    ok(mine.some((r) => r.code === 'ER_ESI' && BigInt(r.amt) === 52000n), 'employer ESI line is ₹520 (3.25% of ₹16,000)');
    ok(erl.every((r) => r.code === 'ER_PF' ? BigInt(r.amt) === 156000n : BigInt(r.amt) === 52000n), 'every employer line in the run is one of those two figures (no other employee got one)');
    erPfTotal = erl.filter((r) => r.code === 'ER_PF').reduce((t, r) => t + BigInt(r.amt), 0n);
    erEsiTotal = erl.filter((r) => r.code !== 'ER_PF').reduce((t, r) => t + BigInt(r.amt), 0n);
    // the employee's own pay did not change: his payslip nets to gross - deductions, and the employer lines are NOT in deductions
    const sl = (await db.query(`select gross_minor::bigint g, deductions_minor::bigint d, net_minor::bigint n from pay_calc.payslip where pay_run_id = $1 and employee_id = $2`, [runId, erEmpId])).rows[0];
    ok(!!sl && BigInt(sl.g) - BigInt(sl.d) === BigInt(sl.n), 'Cycle ER payslip: gross − deductions = net');
    ok(!!sl && BigInt(sl.d) === 120000n + 12000n, `his deductions are PF ₹1,200 + ESI ₹120 = ₹1,320 only — the employer share is NOT deducted from him${sl ? ' (got ₹' + Number(sl.d) / 100 + ')' : ''}`);
  }

  step('3. verify -> approve -> lock (and an invalid jump is refused)');
  const early = await fn('pay-post', { runId });
  ok(early.status >= 400, `post on a draft run is refused (status ${early.status})`);
  for (const [action, state] of [['verify', 'verified'], ['approve', 'approved'], ['lock', 'locked']]) {
    const r = await fn('pay-transition', { runId, action });
    ok(r.status === 200 && r.body.state === state, `${action} -> ${state}${r.body.error ? ' ' + r.body.error : ''}`);
  }
  const back = await fn('pay-transition', { runId, action: 'approve' });
  ok(back.status === 409, `approve on a locked run is refused (status ${back.status})`);

  // legs of a voucher as the DATABASE holds them (voucher_lines is what post_voucher writes), in paise
  const legsOf = async (voucherId) => (await db.query(
    `select account_id a, dr_minor::bigint dr, cr_minor::bigint cr, status s from public.voucher_lines where voucher_id = $1 order by line_no`, [voucherId])).rows;
  const sumLegs = (rows) => rows.reduce((t, r) => ({ dr: t.dr + BigInt(r.dr), cr: t.cr + BigInt(r.cr) }), { dr: 0n, cr: 0n });

  step('4. post to the ledger THROUGH post_voucher');
  const post = await fn('pay-post', { runId });
  ok(post.status === 200 && post.body.voucherId, `posted, voucher ${post.body.voucherNo || ''} (${post.body.status || ''})${post.body.error ? ' ' + post.body.error : ''}${post.body.code ? ' [' + post.body.code + ']' : ''}`);
  if (!post.body.voucherId) throw new Error('post failed');
  runFinalised = true;   // from here on the run has a ledger footprint — never cancel it in cleanup
  const accId = post.body.voucherId;
  ok(Math.abs(post.body.expense - (post.body.statutory + post.body.net)) < 0.005, `expense ${post.body.expense} = deductions ${post.body.statutory} + net ${post.body.net}`);
  const v1 = (await db.query(`select "voucherNo" no, type, "isDeleted" del, amount::numeric amt, date, "approvalStatus" ap from public.vouchers where id = $1 and society_id::text = $2`, [accId, SOC])).rows[0];
  ok(!!v1 && v1.del === false, 'the voucher row exists and is live');
  ok(v1 && v1.type === 'journal' && String(v1.date).startsWith(period), `type journal, dated in ${period} (${v1 && String(v1.date)})`);
  const l1 = await legsOf(accId), t1 = sumLegs(l1);
  ok(l1.length >= 2 && t1.dr > 0n && t1.dr === t1.cr, `voucher_lines balanced: ${l1.length} legs, Dr ${t1.dr} = Cr ${t1.cr} paise`);
  ok(v1 && Math.round(Number(v1.amt) * 100) === Number(t1.dr), 'voucher amount = ΣDr');
  if (WITH_TDS) {
    const leg = l1.find((r) => r.a === '2202');
    const ptLeg = l1.find((r) => r.a === '2207');
    ok(!!ptLeg && BigInt(ptLeg.cr) === BigInt(20000 * (1 + ptLeftover)), `the voucher credits Professional Tax payable 2207 with ₹200${ptLeg ? ' — got ₹' + Number(ptLeg.cr) / 100 : ' — NO 2207 leg'}`);
    const esiLeg = l1.find((r) => r.a === '2204');
    ok(!!esiLeg && BigInt(esiLeg.cr) === BigInt(12000 * esiLines) + erEsiTotal, `the voucher credits ESI payable 2204 with ₹${120 * esiLines}${esiLeg ? ' — got ₹' + Number(esiLeg.cr) / 100 : ' — NO 2204 leg (is esi.payable mapped on staging?)'}`);
    ok(!!leg && BigInt(leg.cr) === tdsExpectedMinor, `the voucher credits TDS payable 2202 with the run's TDS (₹${Number(tdsExpectedMinor) / 100})${leg ? ' — got ₹' + Number(leg.cr) / 100 : ' — NO 2202 leg'}`);
  }
  if (WITH_ER && erOn) {
    const pfEmp = (await db.query(`select coalesce(sum(pl.computed_minor),0)::bigint t from pay_calc.payslip_line pl join pay_calc.payslip p on p.id = pl.payslip_id join pay_config.component_catalog cc on cc.id = pl.component_id where p.pay_run_id = $1 and cc.code in ('PF','EPF')`, [runId])).rows[0].t;
    const esiEmp = (await db.query(`select coalesce(sum(pl.computed_minor),0)::bigint t from pay_calc.payslip_line pl join pay_calc.payslip p on p.id = pl.payslip_id join pay_config.component_catalog cc on cc.id = pl.component_id where p.pay_run_id = $1 and (cc.code = 'ESI' or cc.code like 'ESI\\_%')`, [runId])).rows[0].t;
    const sumOf = (acc, side) => l1.filter((r) => r.a === acc).reduce((t, r) => t + BigInt(r[side]), 0n);
    ok(sumOf('5203', 'dr') === erPfTotal && erPfTotal > 0n, `Dr 5203 PF (employer expense) = ₹${Number(erPfTotal) / 100}`);
    ok(sumOf('5204', 'dr') === erEsiTotal && erEsiTotal > 0n, `Dr 5204 ESI (employer expense) = ₹${Number(erEsiTotal) / 100}`);
    ok(sumOf('2203', 'cr') === BigInt(pfEmp) + erPfTotal, `Cr 2203 EPF payable = employee ₹${Number(pfEmp) / 100} + employer ₹${Number(erPfTotal) / 100} in ONE leg${l1.filter((r) => r.a === '2203').length === 1 ? '' : ' — but there are ' + l1.filter((r) => r.a === '2203').length + ' legs'}`);
    ok(sumOf('2204', 'cr') === BigInt(esiEmp) + erEsiTotal, `Cr 2204 ESI payable = employee ₹${Number(esiEmp) / 100} + employer ₹${Number(erEsiTotal) / 100}`);
    // the Dr side still balances with the employer expense on it
    ok(t1.dr === t1.cr, 'the voucher still balances with the employer share on it');
  }
  const e1 = (await db.query(`select event_type, sequence, payload from public.ledger_events where society_id::text = $1 and aggregate_type = 'voucher' and aggregate_id = $2 order by sequence`, [SOC, accId])).rows;
  ok(e1.length === 1 && e1[0].event_type === 'voucher.posted' && Number(e1[0].sequence) === 1, 'the JOURNAL has exactly one voucher.posted event (the old direct-DB path wrote none)');
  const ev1 = e1[0] ? (e1[0].payload.lines || []).reduce((t, x) => ({ dr: t.dr + (x.drCr === 'Dr' ? BigInt(x.amountMinor) : 0n), cr: t.cr + (x.drCr === 'Cr' ? BigInt(x.amountMinor) : 0n) }), { dr: 0n, cr: 0n }) : { dr: -1n, cr: -2n };
  ok(ev1.dr === t1.dr && ev1.cr === t1.cr, 'the event carries the same legs as the voucher');
  const ent1 = (await db.query(`select coalesce(sum(dr),0)::numeric dr, coalesce(sum(cr),0)::numeric cr from public.voucher_entries where "voucherId" = $1`, [accId])).rows[0];
  ok(Number(ent1.dr) > 0 && Number(ent1.dr) === Number(ent1.cr), `voucher_entries (the legacy mirror) balanced too: ${ent1.dr}`);
  const again = await fn('pay-post', { runId });
  ok(again.status === 409, `second post is refused (status ${again.status})`);
  const cnt = (await db.query(`select count(*)::int n from public.vouchers where id = $1`, [accId])).rows[0].n;
  ok(cnt === 1, 'still exactly ONE salary voucher');
  const links = (await db.query(`select count(*)::int n from pay_calc.posting_link where pay_run_id = $1`, [runId])).rows[0].n;
  ok(links === 1, 'exactly one posting_link for the run');

  step('5. pay salaries THROUGH post_voucher');
  const noFrom = await fn('pay-pay', { runId });
  ok(noFrom.status === 400, `pay without paidFrom is refused (status ${noFrom.status})`);
  const badFrom = await fn('pay-pay', { runId, paidFrom: '5201' });
  ok(badFrom.status === 400, `pay from a non-asset account (5201 Salary expense) is refused (status ${badFrom.status})`);
  const pay = await fn('pay-pay', { runId, paidFrom: PAID_FROM, paidDate: today });
  ok(pay.status === 200 && pay.body.voucherId, `paid, voucher ${pay.body.voucherNo || ''}${pay.body.error ? ' ' + pay.body.error : ''}${pay.body.code ? ' [' + pay.body.code + ']' : ''}`);
  const payId = pay.body.voucherId;
  if (payId) {
    const l2 = await legsOf(payId), t2 = sumLegs(l2);
    ok(l2.length === 2 && t2.dr > 0n && t2.dr === t2.cr, `payment voucher balanced: Dr ${t2.dr} = Cr ${t2.cr} paise`);
    ok(Math.abs(Number(t2.dr) / 100 - post.body.net) < 0.005, `payment amount ${Number(t2.dr) / 100} = net payable ${post.body.net}`);
    ok(l2.some((r) => r.a === PAID_FROM && BigInt(r.cr) > 0n), `credited the chosen account ${PAID_FROM} (not a made-up payroll account)`);
    const e2 = (await db.query(`select event_type from public.ledger_events where society_id::text = $1 and aggregate_id = $2`, [SOC, payId])).rows;
    ok(e2.length === 1 && e2[0].event_type === 'voucher.posted', 'the payment is in the journal too');
  }
  const pay2 = await fn('pay-pay', { runId, paidFrom: PAID_FROM, paidDate: today });
  ok(pay2.status === 409, `second pay is refused (status ${pay2.status})`);

  step('6. rollback THROUGH cancel_voucher and prove the books net to zero');
  const rb = await fn('pay-rollback', { runId });
  ok(rb.status === 200 && Array.isArray(rb.body.cancelled) && rb.body.cancelled.length === 2, `rolled back, ${rb.body.cancelled?.length ?? 0} voucher(s) cancelled${rb.body.error ? ' ' + rb.body.error : ''}${rb.body.code ? ' [' + rb.body.code + ']' : ''}`);
  const both = [accId, payId].filter(Boolean);
  const vs = (await db.query(`select id, "isDeleted" del from public.vouchers where id = any($1::text[]) and society_id::text = $2`, [both, SOC])).rows;
  ok(vs.length === both.length && vs.every((v) => v.del === true), 'both vouchers are marked cancelled (kept for audit, not deleted)');
  const ents = (await db.query(`select count(*)::int n from public.voucher_entries where "voucherId" = any($1::text[])`, [both])).rows[0].n;
  ok(ents === 0, 'their voucher_entries are gone (no ghost balances)');
  const evs = (await db.query(`select aggregate_id, event_type, payload from public.ledger_events where society_id::text = $1 and aggregate_id = any($2::text[]) order by aggregate_id, sequence`, [SOC, both])).rows;
  ok(both.every((id) => evs.some((e) => e.aggregate_id === id && e.event_type === 'voucher.cancelled')), 'the journal has a voucher.cancelled event for each');
  const net = new Map();
  for (const e of evs) for (const x of (e.payload.lines || [])) net.set(x.accountId, (net.get(x.accountId) || 0n) + (x.drCr === 'Dr' ? 1n : -1n) * BigInt(x.amountMinor));
  const nonZero = [...net.entries()].filter(([, v]) => v !== 0n);
  ok(net.size > 0 && nonZero.length === 0, `every account nets to zero across posted + cancelled journal events (${net.size} accounts)`);
  const fin = (await db.query(`select state::text s from pay_calc.payroll_run where id = $1`, [runId])).rows[0].s;
  ok(fin === 'rolled_back', `run state is '${fin}'`);
  const rb2 = await fn('pay-rollback', { runId });
  ok(rb2.status === 409, `second rollback is refused (status ${rb2.status})`);
} catch (e) {
  failed++; console.error('  ✗ ABORTED:', String(e.message || e).replace(/postgres(ql)?:\/\/\S+/g, '<url>'));
} finally {
  await db.query('rollback').catch(() => {}); await db.end().catch(() => {});
  if (createdRunId && TOKEN && !runFinalised) {
    // the run was left draft/verified/approved/locked (never posted) — cancel it so the period is free again
    const r = await fn('pay-transition', { runId: createdRunId, action: 'cancel' });
    console.log(`\ncleanup: cancel run ${createdRunId.slice(0, 8)} -> ${r.status === 200 ? 'cancelled' : 'status ' + r.status + ' ' + (r.body.error || '')}`);
  }
  if (WITH_TDS && tdsEmpId && TOKEN) {
    const off = await fn('pay-employee', { action: 'tds-set', employeeId: tdsEmpId, enabled: false });
    console.log(`\ncleanup: TDS switched off -> ${off.status === 200 ? 'ok' : 'status ' + off.status + ' ' + (off.body.error || '')}`);
  }
  if (WITH_ER && erEmpId && TOKEN) {
    const e1 = await fn('pay-employee', { action: 'er-set', employeeId: erEmpId, enabled: false });
    const e2 = await fn('pay-employee', { action: 'esi-set', employeeId: erEmpId, enabled: false });
    console.log(`\ncleanup: employer share off -> ${e1.status === 200 ? 'ok' : 'status ' + e1.status + ' ' + (e1.body.error || '')}; ESI off -> ${e2.status === 200 ? 'ok' : 'status ' + e2.status + ' ' + (e2.body.error || '')}`);
  }
  if (created.length && TOKEN) {
    step('cleanup: deactivate the 3 test employees');
    const today = new Date().toISOString().slice(0, 10);
    for (const id of created) { const r = await fn('pay-employee', { action: 'deactivate', employeeId: id, lastDay: today }); console.log('  -', id.slice(0, 8), r.status === 200 ? 'deactivated' : r.body.code === 'PAY-EMP-SAMEDAY' ? 'left active — its structure changed today; run  $env:CLEANUP_ONLY=1  tomorrow' : `status ${r.status}`); }
  }
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

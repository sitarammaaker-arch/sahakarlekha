// R5 parity check — the PAYROLL side, computed by the REAL server on STAGING ONLY.
//   add three demo employees (A / B / C) → attendance → pay-run for 2026-10 → read each payslip → compare with the
//   expected figures from the Salary page's own code (computed in advance, see docs/payroll/PAYROLL-CONSOLIDATION-PLAN.md §12).
// It NEVER posts, pays or approves: the run is computed (draft) and then CANCELLED, so no ledger entry is made.
//
// WHO RUNS IT: the human (hidden password prompt). Refuses to run unless SUPABASE_URL and DATABASE_URL in
// .env.staging.local point at the staging project ref. Writes only through the Edge Functions; the DB connection is READ-ONLY.
//
// Run:  node scripts/pay-r5-parity-staging.mjs          (PowerShell: make sure $env:CLEANUP_ONLY and $env:PERIOD are NOT set)

import fs from 'node:fs';
import pg from 'pg';

const STAGING_REF = 'ivmrlhjrqtwftdlxajxk';
const PROD_REF = 'rwffxupenwdtrmyabytk';
const PERIOD = '2026-10';   // fixed: this month has 31 days (the 30-day LOP basis is part of what is checked) and TDS applies from today

const env = Object.fromEntries(
  fs.readFileSync('.env.staging.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]),
);
const SUPABASE_URL = env.SUPABASE_URL, ANON = env.SUPABASE_ANON_KEY, DB_URL = env.DATABASE_URL;
if (!SUPABASE_URL || !ANON || !DB_URL) { console.error('STOP: .env.staging.local needs SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL'); process.exit(2); }
for (const [k, v] of [['SUPABASE_URL', SUPABASE_URL], ['DATABASE_URL', DB_URL]]) {
  if (v.includes(PROD_REF) || !v.includes(STAGING_REF)) { console.error(`STOP: ${k} does not point at STAGING (${STAGING_REF}). Refusing to run.`); process.exit(2); }
}
if (process.env.CLEANUP_ONLY || process.env.PERIOD) console.log('note: CLEANUP_ONLY / PERIOD are set in this window but are ignored by this script.');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.error('  ✗ FAIL:', msg); } };
const step = (t) => console.log(`\n== ${t}`);

function ask(q, hidden = false) {
  return new Promise((resolve) => {
    process.stdout.write(q);
    const stdin = process.stdin; let buf = '';
    if (hidden && stdin.isTTY) stdin.setRawMode(true);
    stdin.resume(); stdin.setEncoding('utf8');
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { if (hidden && stdin.isTTY) stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); return resolve(buf); }
        if (c === '\u0003') process.exit(130);
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1); else buf += c;
      }
    };
    stdin.on('data', onData);
  });
}
async function signIn(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`sign-in failed: ${j.error_description || j.msg || r.status}`);
  return j.access_token;
}
let TOKEN = '';
async function fn(name, body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, { method: 'POST', headers: { apikey: ANON, authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const raw = await r.text(); let j = {}; try { j = JSON.parse(raw); } catch { /* non-JSON */ }
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

// ── the three demo employees and what the SALARY page's own code gives for each (October 2026, rupees) ──────
// Payroll side, permanent type: DA = 20% and HRA = 40% of basic, PF = 12% × min(basic×120%, ₹25,000) × paid/30,
// loss of pay = 160% of basic × lopDays/30, TDS = cumulative rule on (basic+DA+HRA)×12, PT = a hand-entered fixed amount.
const DEMOS = [
  { key: 'A', name: 'DEMO-R5-A', basic: 80000, lop: 0, tds: true, pt: 200,
    expect: { gross: 128000, PF: 3000, LOP: 0, TDS: 17186, PT: 200, net: 107614 },
    salaryPage: { gross: 128000, PF: 3000, ESI: 0, TDS: 17186, PT: 200, net: 107614 } },
  { key: 'B', name: 'DEMO-R5-B', basic: 10000, lop: 0, tds: false, pt: 0,
    expect: { gross: 16000, PF: 1440, LOP: 0, TDS: 0, PT: 0, net: 14560 },
    salaryPage: { gross: 16000, PF: 1200, ESI: 120, TDS: 0, PT: 0, net: 14680 } },
  { key: 'C', name: 'DEMO-R5-C', basic: 20000, lop: 3, tds: false, pt: 0,
    expect: { gross: 32000, PF: 2592, LOP: 3200, TDS: 0, PT: 0, net: 26208 },
    salaryPage: { gross: 28903.23, PF: 2167.74, ESI: 0, TDS: 0, PT: 0, net: 26735.49 } },
];

const email = (await ask('Staging admin email: ')).trim();
const password = await ask('Password (hidden): ', true);
const db = await connectDb();
await db.query('begin read only');
const created = []; let createdRunId = ''; const tdsOn = [];
const stamp = Date.now().toString().slice(-6);

try {
  TOKEN = await signIn(email, password);
  console.log('signed in to STAGING');

  step(`0. the month ${PERIOD} must be free of any verified / locked / posted / paid run`);
  const taken = (await db.query(`select count(*)::int n from pay_calc.payroll_run where period::text = $1 and state in ('verified','approved','locked','posted','paid')`, [PERIOD])).rows[0].n;
  ok(taken === 0, `no run of ${PERIOD} is past draft (found ${taken})`);
  if (taken) throw new Error(`${PERIOD} already has a finished run on staging`);

  step('1. add the three demo employees (permanent, joined 2026-04-01)');
  for (const d of DEMOS) {
    const r = await fn('pay-employee', { action: 'add', name: d.name, code: `R5${d.key}${stamp}`, type: 'permanent', basicMinor: d.basic * 100, dateOfJoin: '2026-04-01' });
    ok(r.status === 200 && r.body.employeeId, `added ${d.name} — basic ₹${d.basic} (status ${r.status}${r.body.error ? ' ' + r.body.error : ''})`);
    d.id = r.body.employeeId; d.code = `R5${d.key}${stamp}`; if (d.id) created.push(d.id);
  }
  for (const d of DEMOS.filter((x) => x.tds)) {
    const on = await fn('pay-employee', { action: 'tds-set', employeeId: d.id, enabled: true });
    ok(on.status === 200 && on.body.code === 'TDS', `TDS switched on for ${d.name} (status ${on.status}${on.body.error ? ' ' + on.body.error : ''})`);
    if (on.status === 200) tdsOn.push(d.id);
  }
  for (const d of DEMOS.filter((x) => x.pt > 0)) {
    const pt = await fn('pay-employee', { action: 'structure-add', employeeId: d.id, code: 'PT', basicMinor: d.pt * 100 });
    ok(pt.status === 200 && pt.body.code === 'PT', `PT ₹${d.pt} added for ${d.name} (status ${pt.status}${pt.body.error ? ' ' + pt.body.error : ''})`);
  }
  for (const d of DEMOS.filter((x) => x.lop > 0)) {
    const at = await fn('pay-employee', { action: 'attendance', employeeId: d.id, period: PERIOD, lopDays: d.lop });
    ok(at.status === 200, `attendance for ${d.name}: ${d.lop} days loss of pay in ${PERIOD} (status ${at.status}${at.body.error ? ' ' + at.body.error : ''})`);
  }

  step(`2. compute the ${PERIOD} run (draft — nothing is posted)`);
  const run = await fn('pay-run', { period: PERIOD });
  ok(run.status === 200 && run.body.runId, `pay-run created ${run.body.runNo || ''} (${run.body.employeeCount} payslips)${run.body.error ? ' ' + run.body.error : ''}`);
  if (!run.body.runId) throw new Error('run not created');
  createdRunId = run.body.runId;

  step('3. compare each demo payslip with the expected figures');
  const rupees = (m) => Number(m) / 100;
  for (const d of DEMOS) {
    const slip = (await db.query(`select p.id, p.gross_minor::bigint g, p.deductions_minor::bigint d, p.net_minor::bigint n from pay_calc.payslip p where p.pay_run_id = $1 and p.employee_id = $2`, [createdRunId, d.id])).rows[0];
    if (!slip) { ok(false, `${d.name}: no payslip in the run`); continue; }
    const lines = (await db.query(`select cc.code, pl.computed_minor::bigint amt from pay_calc.payslip_line pl join pay_config.component_catalog cc on cc.id = pl.component_id where pl.payslip_id = $1`, [slip.id])).rows;
    const L = (c) => rupees(lines.filter((l) => l.code === c).reduce((s, l) => s + BigInt(l.amt), 0n));
    const got = { gross: rupees(slip.g), PF: L('PF'), LOP: L('LOP'), TDS: L('TDS'), PT: L('PT'), net: rupees(slip.n) };
    console.log(`\n  ${d.name}  (basic ₹${d.basic}${d.lop ? `, ${d.lop} days loss of pay` : ''})`);
    console.log('    ' + 'item'.padEnd(8) + 'Payroll (server)'.padStart(18) + 'expected'.padStart(12) + '   Salary page'.padStart(14));
    const sp = { gross: d.salaryPage.gross, PF: d.salaryPage.PF, LOP: '', TDS: d.salaryPage.TDS, PT: d.salaryPage.PT, net: d.salaryPage.net };
    for (const k of ['gross', 'PF', 'LOP', 'TDS', 'PT', 'net']) {
      const same = Math.abs(got[k] - d.expect[k]) < 0.005;
      console.log('    ' + k.padEnd(8) + String(got[k]).padStart(18) + String(d.expect[k]).padStart(12) + String(sp[k]).padStart(14) + (same ? '' : '   <-- differs'));
    }
    for (const k of ['gross', 'PF', 'LOP', 'TDS', 'PT', 'net']) ok(Math.abs(got[k] - d.expect[k]) < 0.005, `${d.name} ${k}: Payroll ${got[k]} = expected ${d.expect[k]}`);
  }
  console.log('\n  Known, accepted differences vs the Salary page (not errors): PF base (Payroll = basic + DA), no ESI / employer share in Payroll,');
  console.log('  30-day loss-of-pay basis (Salary uses the calendar month), and Payroll gross is the full pay with loss of pay shown as a deduction.');
} catch (e) {
  failed++; console.error('\nSTOPPED:', e.message);
} finally {
  await db.query('rollback').catch(() => {}); await db.end().catch(() => {});
  if (createdRunId && TOKEN) {
    const r = await fn('pay-transition', { runId: createdRunId, action: 'cancel' });
    console.log(`\ncleanup: cancel run ${createdRunId.slice(0, 8)} -> ${r.status === 200 ? 'cancelled (nothing was posted)' : 'status ' + r.status + ' ' + (r.body.error || '')}`);
  }
  if (TOKEN) for (const id of tdsOn) { const off = await fn('pay-employee', { action: 'tds-set', employeeId: id, enabled: false }); console.log(`cleanup: TDS off ${id.slice(0, 8)} -> ${off.status === 200 ? 'ok' : 'status ' + off.status}`); }
  if (created.length && TOKEN) {
    step('cleanup: deactivate the demo employees');
    const today = new Date().toISOString().slice(0, 10);
    for (const id of created) { const r = await fn('pay-employee', { action: 'deactivate', employeeId: id, lastDay: today }); console.log('  -', id.slice(0, 8), r.status === 200 ? 'deactivated' : r.body.code === 'PAY-EMP-SAMEDAY' ? 'left active — its structure changed today; run scripts/pay-cycle-staging.mjs with $env:CLEANUP_ONLY=1 tomorrow' : 'status ' + r.status + ' ' + (r.body.error || '')); }
  }
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

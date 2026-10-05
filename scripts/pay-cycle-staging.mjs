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

try {
  TOKEN = await signIn(email, password);
  console.log('signed in to STAGING');

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
    const start = new Date(fy.s + 'T00:00:00Z'), end = new Date(fy.e + 'T00:00:00Z');
    for (let d = new Date(start); d <= end && !period; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
      const p = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!taken.has(p)) period = p;
    }
  }
  ok(period && !taken.has(period), `period ${period} is inside the open year and has no verified/locked/posted/paid run`);
  if (!period || taken.has(period)) throw new Error('no free period in the open financial year');
  const PAID_FROM = process.env.PAID_FROM || '3302';   // staging chart: 3302 = Bank Accounts
  const today = new Date().toISOString().slice(0, 10);

  step('1. add 3 test employees');
  const stamp = Date.now().toString().slice(-6);
  const emps = [['Cycle Test A', 2500000], ['Cycle Test B', 3000000], ['Cycle Test C', 1800000]];
  for (const [i, [name, basicMinor]] of emps.entries()) {
    const r = await fn('pay-employee', { action: 'add', name, code: `CYC${stamp}${i + 1}`, type: 'permanent', basicMinor, dateOfJoin: '2025-01-01' });
    ok(r.status === 200 && r.body.ok !== false, `added ${name} (status ${r.status}${r.body.error ? ' ' + r.body.error : ''})`);
    if (r.body.employeeId) created.push(r.body.employeeId);
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
  if (created.length && TOKEN) {
    step('cleanup: deactivate the 3 test employees');
    const today = new Date().toISOString().slice(0, 10);
    for (const id of created) { const r = await fn('pay-employee', { action: 'deactivate', employeeId: id, lastDay: today }); console.log('  -', id.slice(0, 8), r.status === 200 ? 'deactivated' : `status ${r.status}`); }
  }
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

// First REAL end-to-end payroll run on staging (impure orchestrator, Node form).
// Seeds a minimal demo (society → employee → components → formulas → structure → assignment → rule),
// then runs the PURE pipeline against the fetched config (freezeViews → mapCatalog → assembleRun) and
// PERSISTS the result (run_snapshot + payslip + payslip_line + pay_event) via a superuser/service
// connection (RLS bypassed by design — the compute service). Finally reads back + verifies the net.
//
// Connects via the transaction pooler (the .env direct host is deprecated for IPv4). Seed is
// idempotent (fixed UUIDs, ON CONFLICT DO NOTHING); each run creates fresh run rows.
//
// Run (from the integrate worktree): node scripts/pay-run-staging.mjs

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const { freezeViews } = await import(pathToFileURL(path.resolve(process.cwd(), 'src/lib/pay/resolve/freeze.ts')).href);
const { mapCatalog } = await import(pathToFileURL(path.resolve(process.cwd(), 'src/lib/pay/orchestrator/mapCatalog.ts')).href);
const { assembleRun } = await import(pathToFileURL(path.resolve(process.cwd(), 'src/lib/pay/orchestrator/assembleRun.ts')).href);
const { makeMoney } = await import(pathToFileURL(path.resolve(process.cwd(), 'src/lib/pay/formula/evaluator.ts')).href);

const url = fs.readFileSync('.env.staging.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const pass = url.match(/postgresql:\/\/[^:]+:([^@]+)@/)[1];
const pooler = `postgresql://postgres.ivmrlhjrqtwftdlxajxk:${pass}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`;
const c = new pg.Client({ connectionString: pooler, ssl: { rejectUnauthorized: false } });

// fixed demo UUIDs (idempotent seed)
const U = (n) => `dede0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SOC = U(1), EMP = U(2), CREATOR = U(9);
const CB = { BASIC: U(11), DA: U(12), HRA: U(13), PF: U(14) };
const FC = { DA: U(21), HRA: U(22), PF: U(23) }, FV = { DA: U(31), HRA: U(32), PF: U(33) };
const CV = { BASIC: U(41), DA: U(42), HRA: U(43), PF: U(44) };
const TPL = U(51), SV = U(52), BND = { BASIC: U(61), DA: U(62), HRA: U(63), PF: U(64) };
const ASG = U(71), RULE_BASIC = U(81), RV_BASIC = U(82);
const PERIOD = '2026-04', PERIOD_MONTH = '2026-04-01', EFF = '2026-01-01';
const L = (en) => JSON.stringify({ hi: en, en });
const SFL = { DA: 'formula "DA" :: Money let b = BASIC in b * 20%', HRA: 'formula "HRA" :: Money let b = BASIC in b * 40%', PF: 'formula "PF" :: Money let b = BASIC in b * 12%' };

let pass_ = 0, fail_ = 0;
const ok = (cond, msg) => { if (cond) { pass_++; console.log('  ✓', msg); } else { fail_++; console.error('  ✗', msg); } };

await c.connect();
try {
  // ── 1. SEED (idempotent) ────────────────────────────────────────────────────────
  await c.query('begin');
  const ins = (sql, vals) => c.query(sql, vals);
  await ins(`insert into public.societies(id,name,registration_no,district,state) values($1,$2,$3,$4,$5) on conflict (id) do nothing`,
    [SOC, 'Demo Payroll Society', 'DEMO/2026/001', 'Rania', 'Haryana']);
  await ins(`insert into pay_core.employee(id,society_id,employee_code,full_name,date_of_join,employment_type,created_by) values($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
    [EMP, SOC, 'EMP001', L('Demo Employee'), EFF, 'permanent', CREATOR]);
  for (const code of ['BASIC', 'DA', 'HRA', 'PF']) {
    await ins(`insert into pay_config.component_catalog(id,society_id,code,display_name,created_by) values($1,$2,$3,$4,$5) on conflict (id) do nothing`,
      [CB[code], SOC, code, L(code), CREATOR]);
  }
  for (const code of ['DA', 'HRA', 'PF']) {
    await ins(`insert into pay_formula.formula_catalog(id,name,created_by) values($1,$2,$3) on conflict (id) do nothing`, [FC[code], code + ' formula', CREATOR]);
    await ins(`insert into pay_formula.formula_version(id,formula_id,expression_text,effective_from,created_by,status) values($1,$2,$3,$4,$5,'active') on conflict (id) do nothing`,
      [FV[code], FC[code], SFL[code], EFF, CREATOR]);
  }
  const cv = (code, kind, method, fref) => ins(
    `insert into pay_config.component_version(id,component_id,kind,calc_method,gl_symbolic_role,formula_ref,effective_from,created_by,status)
     values($1,$2,$3,$4::pay_core.calc_method,$5,$6,$7,$8,'active') on conflict (id) do nothing`,
    [CV[code], CB[code], kind, method, code.toLowerCase(), fref, EFF, CREATOR]);
  await cv('BASIC', 'earning', 'rule', null);
  await cv('DA', 'earning', 'formula', FV.DA);
  await cv('HRA', 'earning', 'formula', FV.HRA);
  await cv('PF', 'deduction', 'formula', FV.PF);
  await ins(`insert into pay_config.structure_template(id,code,display_name,created_by) values($1,$2,$3,$4) on conflict (id) do nothing`, [TPL, 'DEMO-STD', L('Demo Standard'), CREATOR]);
  await ins(`insert into pay_config.structure_version(id,structure_id,effective_from,created_by,status) values($1,$2,$3,$4,'active') on conflict (id) do nothing`, [SV, TPL, EFF, CREATOR]);
  for (const code of ['BASIC', 'DA', 'HRA', 'PF']) {
    await ins(`insert into pay_config.component_binding(id,structure_version_id,component_id,created_by) values($1,$2,$3,$4) on conflict (id) do nothing`, [BND[code], SV, CB[code], CREATOR]);
  }
  await ins(`insert into pay_config.structure_assignment(id,society_id,employee_id,structure_version_id,effective_from,created_by) values($1,$2,$3,$4,$5,$6) on conflict (id) do nothing`,
    [ASG, SOC, EMP, SV, EFF, CREATOR]);
  await ins(`insert into pay_rule.rule_catalog(id,key,kind,display_name) values($1,$2,$3::pay_core.rule_kind,$4) on conflict (id) do nothing`, [RULE_BASIC, 'BASIC', 'entitlement', L('Basic Pay entitlement')]);
  await ins(`insert into pay_rule.rule_value(id,rule_id,scope_level,value_json,effective_from,created_by,status) values($1,$2,$3::pay_core.scope_level,$4,$5,$6,'active') on conflict (id) do nothing`,
    [RV_BASIC, RULE_BASIC, 'country', '3000000', EFF, CREATOR]);
  await c.query('commit');
  console.log('SEED ok\n');

  // ── 2. FETCH the effective config for the employee ───────────────────────────────
  const comps = (await c.query(`
    select cc.code, cc.id as component_id, cv.kind, cv.calc_method, fv.expression_text, ao.fixed_minor, ao.fixed_currency
    from pay_config.structure_assignment sa
    join pay_config.component_binding cb on cb.structure_version_id = sa.structure_version_id
    join pay_config.component_catalog cc on cc.id = cb.component_id
    join lateral (select * from pay_config.component_version v where v.component_id = cc.id and v.status='active' and v.effective_from <= $2 order by v.effective_from desc limit 1) cv on true
    left join pay_formula.formula_version fv on fv.id = cv.formula_ref
    left join pay_config.assignment_override ao on ao.assignment_id = sa.id and ao.component_id = cc.id
    where sa.employee_id = $1 and sa.effective_to is null`, [EMP, PERIOD_MONTH])).rows;
  const rules = (await c.query(`select rc.key, rv.scope_level, rv.value_json, rv.effective_from from pay_rule.rule_value rv join pay_rule.rule_catalog rc on rc.id=rv.rule_id where rv.status='active'`)).rows;
  console.log(`fetched ${comps.length} components, ${rules.length} rules\n`);

  // ── 3. PURE pipeline ─────────────────────────────────────────────────────────────
  const chain = { orgType: 'pacs', orgId: SOC, branchId: 'b1', departmentId: 'd1', cadreId: 'c1', designationId: 'g1', employeeId: EMP };
  const freezeCtx = { chain, jurisdiction: 'IN-HR', asOf: PERIOD_MONTH };
  const catalogs = {
    rules: Object.fromEntries(rules.map((r) => [r.key, { candidates: [{ value: Number(r.value_json), scope: { level: r.scope_level }, effectiveFrom: r.effective_from, jurisdiction: '' }], required: true }])),
    policies: {}, config: {},
  };
  const ruleView = freezeViews(catalogs, freezeCtx).ruleView;
  const codeToId = Object.fromEntries(comps.map((r) => [r.code, r.component_id]));
  const spec = mapCatalog({
    currency: 'INR',
    ruleView,
    components: comps.map((r) => ({ code: r.code, kind: r.kind, calcMethod: r.calc_method, formulaSource: r.expression_text, overrideFixedMinor: r.fixed_minor, overrideCurrency: r.fixed_currency })),
  });
  const RUN = randomUUID(), runNo = 'DEMO-RUN-' + Date.now();
  const facts = { attendance: { paidDays: 30, lopDays: 0, otHours: 0 }, leave: [], loan: [], tax: { ytdByHead: {}, monthsRemaining: 12, regime: 'new' } };
  const assembled = assembleRun({
    societyId: SOC, runId: RUN, sequence: 1,
    freeze: { catalogs, ctx: freezeCtx },
    formula: { sources: spec.formulaSources, typeBase: { vars: { BASIC: 'Money' }, fns: {} } },
    employees: [{ employeeId: EMP, calc: { facts, currency: 'INR', fixedComponents: spec.fixedComponents, fns: {} }, aggregate: { classification: spec.classification, clamps: spec.clamps } }],
    producer: { kind: 'human', actorEmail: 'hr@demo.test' },
  }, { eventId: randomUUID(), occurredAt: new Date().toISOString() });

  const slip = assembled.payslips[0].payslip;
  console.log('COMPUTED payslip:', slip.earnings.map((l) => `${l.code}=${l.amount.minor}`).join(' '), '| ded', slip.deductions.map((l) => `${l.code}=${l.amount.minor}`).join(' '), '| net', slip.netPay.minor, '\n');

  // ── 4. PERSIST (run_snapshot + payslip + lines + pay_event) ───────────────────────
  await c.query('begin');
  await c.query(`insert into pay_calc.payroll_run(id,society_id,period,period_month,run_no,currency,created_by) values($1,$2,$3,$4,$5,$6,$7)`, [RUN, SOC, PERIOD, PERIOD_MONTH, runNo, 'INR', CREATOR]);
  await c.query(`insert into pay_calc.run_snapshot(pay_run_id,resolved_rules_json,formula_plan_json,config_resolution_json) values($1,$2,$3,$4)`,
    [RUN, JSON.stringify(assembled.frozenViews.ruleView), JSON.stringify(assembled.plan), JSON.stringify({ config: assembled.frozenViews.configView, policy: assembled.frozenViews.policyView })]);
  const PSLIP = randomUUID();
  await c.query(`insert into pay_calc.payslip(id,society_id,pay_run_id,employee_id,period_month,payslip_no,gross_minor,deductions_minor,net_minor,currency,paid_days,lop_days,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [PSLIP, SOC, RUN, EMP, PERIOD_MONTH, 'PS-' + runNo, slip.grossEarnings.minor, slip.grossDeductions.minor, slip.netPay.minor, 'INR', 30, 0, CREATOR]);
  let seq = 1;
  for (const line of [...slip.earnings, ...slip.deductions]) {
    await c.query(`insert into pay_calc.payslip_line(society_id,payslip_id,period_month,component_id,computed_minor,currency,sequence) values($1,$2,$3,$4,$5,$6,$7)`,
      [SOC, PSLIP, PERIOD_MONTH, codeToId[line.code], line.amount.minor, 'INR', seq++]);
  }
  const ev = assembled.event;
  await c.query(`insert into pay_calc.pay_event(society_id,aggregate_type,aggregate_id,sequence,event_type,producer_kind,actor_email,occurred_at,payload) values($1,$2,$3,$4,$5::pay_core.pay_event_type,$6::pay_core.producer_kind,$7,$8,$9)`,
    [SOC, 'pay_run', RUN, ev.sequence, ev.eventType, ev.producerKind, ev.actorEmail, ev.occurredAt, JSON.stringify(ev.payload)]);
  await c.query('commit');
  console.log('PERSIST ok (run', runNo + ')\n');

  // ── 5. VERIFY (read back) ─────────────────────────────────────────────────────────
  const back = (await c.query(`select gross_minor,deductions_minor,net_minor from pay_calc.payslip where id=$1 and period_month=$2`, [PSLIP, PERIOD_MONTH])).rows[0];
  const lineCount = (await c.query(`select count(*)::int n, sum(computed_minor)::bigint s from pay_calc.payslip_line where payslip_id=$1 and period_month=$2`, [PSLIP, PERIOD_MONTH])).rows[0];
  const evBack = (await c.query(`select event_type,sequence,payload from pay_calc.pay_event where aggregate_id=$1`, [RUN])).rows[0];

  ok(Number(back.net_minor) === slip.netPay.minor, `persisted net_minor (${back.net_minor}) == computed (${slip.netPay.minor})`);
  ok(Number(back.gross_minor) === 4800000 && Number(back.net_minor) === 4440000, 'BASIC 3000000 + DA 600000 + HRA 1200000 = gross 4800000; − PF 360000 = net 4440000');
  ok(lineCount.n === 4, `4 payslip lines persisted (BASIC, DA, HRA, PF) — BASIC (fixed/rule) INCLUDED`);
  ok(Number(back.deductions_minor) === 360000, 'deductions = PF 360000');
  ok(evBack && evBack.event_type === 'calculated' && Number(evBack.sequence) === 1, "a WORM 'calculated' pay_event persisted at sequence 1");

  console.log(`\n${fail_ === 0 ? 'PASS' : 'FAIL'}  pay run-staging — ${pass_} passed, ${fail_} failed`);
  process.exit(fail_ === 0 ? 0 : 1);
} catch (e) {
  try { await c.query('rollback'); } catch { /* ignore */ }
  console.error('FATAL:', e.message);
  if (e.detail) console.error('detail:', e.detail);
  process.exit(1);
} finally {
  await c.end();
}

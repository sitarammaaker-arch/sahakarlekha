/**
 * pay-run — compute + persist a payroll run for the caller's society (Deno Edge Function).
 *
 * The SERVER computes (never the client): it fetches the society's config, runs the PURE pipeline
 * (freezeViews → mapCatalog → assembleRun, bundled in _shared/pay-core.mjs — the exact code the Node
 * tests prove), and persists run_snapshot + payslip + payslip_line + a WORM 'calculated' pay_event.
 * Reproducible + tamper-proof: the browser only asks "run <period>"; the numbers are the server's.
 *
 * Auth: the caller's verified JWT → society_users → their society + role (admin/accountant only). A
 * caller can only ever run their OWN society's payroll. Writes go over a direct DB connection
 * (SUPABASE_DB_URL) because PostgREST cannot reach the pay_* schemas; the connection is the service
 * boundary, so the aal2 RLS gate (which guards interactive user sessions) does not apply here.
 *
 * Deno runtime — NOT the app's TypeScript.  Deploy:  supabase functions deploy pay-run
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import { freezeViews, mapCatalog, assembleRun, makeMoney } from '../_shared/pay-core.mjs';

const corsFor = (req: Request) => ({
  'access-control-allow-origin': '*',
  'access-control-allow-headers': req.headers.get('access-control-request-headers') ?? 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
});
const json = (status: number, body: unknown, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' }, CORS);

  const supaUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const dbUrl = Deno.env.get('PAY_DB_URL') ?? Deno.env.get('SUPABASE_DB_URL') ?? '';

  // 1. verify the caller's JWT
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!jwt) return json(401, { error: 'missing bearer token' }, CORS);
  const { data: { user } } = await createClient(supaUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } }).auth.getUser();
  if (!user?.email) return json(401, { error: 'invalid session' }, CORS);

  let period: string;
  try { period = (await req.json())?.period; } catch { return json(400, { error: 'bad JSON body' }, CORS); }
  if (!/^\d{4}-\d{2}$/.test(period ?? '')) return json(400, { error: 'period "YYYY-MM" required' }, CORS);
  const periodMonth = `${period}-01`;

  const sql = postgres(dbUrl, { prepare: false, max: 3 });
  try {
    // 2. resolve the caller's society + role (a caller runs only their own society)
    const [su] = await sql`select id, society_id, role, name from public.society_users where email = ${user.email} and is_active = true limit 1`;
    if (!su) return json(403, { error: 'not a society user' }, CORS);
    if (!['admin', 'accountant'].includes(su.role)) return json(403, { error: 'only admin / accountant may run payroll' }, CORS);
    const societyId = su.society_id as string;

    // 2b. one run per period — refuse a duplicate up front with a clear message (the DB index
    // `run_one_open` also blocks it, but as a cryptic 500). Matches this function's scope: no
    // branch/department split, accrual basis. A cancelled/rolled-back run does NOT block a redo.
    const [dup] = await sql`
      select run_no, state::text from pay_calc.payroll_run
      where society_id = ${societyId} and period = ${period}
        and scope_branch_id is null and scope_department_id is null and pay_basis = 'accrual'
        and state not in ('cancelled','rolled_back') limit 1`;
    if (dup) return json(409, { error: `is avdhi (${period}) ka payroll pehle se hai — run ${dup.run_no} (${dup.state}). Dobara chalane ke liye pehle use cancel karein.` }, CORS);

    // 3. employees with an active salary-structure assignment
    const employees = await sql`
      select e.id, e.employee_code, sa.id as assignment_id, sa.structure_version_id
      from pay_core.employee e
      join pay_config.structure_assignment sa on sa.employee_id = e.id and sa.effective_to is null
      where e.society_id = ${societyId}`;
    if (!employees.length) return json(400, { error: 'no employees have a salary structure assigned' }, CORS);

    // 4. rules → freeze (BASIC etc. resolve by component-code convention)
    const rules = await sql`select rc.key, rv.scope_level, rv.value_json from pay_rule.rule_value rv join pay_rule.rule_catalog rc on rc.id = rv.rule_id where rv.status = 'active'`;
    // editable statutory rates (admin-owned, sourced) → injected as scalar vars the formulas use
    const stat = await sql`select key, value_num from pay_config.statutory_setting where society_id = ${societyId}`;
    const scalars: Record<string, number> = { pf_rate: 12, ...Object.fromEntries(stat.map((r: Record<string, unknown>) => [r.key, Number(r.value_num)])) };
    const catalogs = {
      rules: Object.fromEntries(rules.map((r: Record<string, unknown>) => [r.key, { candidates: [{ value: Number(r.value_json), scope: { level: r.scope_level }, effectiveFrom: '2026-01-01', jurisdiction: '' }], required: true }])),
      policies: {}, config: {},
    };
    const chain = { orgType: 'pacs', orgId: societyId, branchId: 'b1', departmentId: 'd1', cadreId: 'c1', designationId: 'g1', employeeId: '' };
    const freezeCtx = { chain, jurisdiction: 'IN', asOf: periodMonth };
    const ruleView = freezeViews(catalogs, freezeCtx).ruleView;

    // 5. per-employee: effective components → mapCatalog → calc request
    // per-employee attendance (default a full 30-day month when none is recorded)
    const codeToId: Record<string, string> = {};
    const emReqs: Record<string, unknown>[] = [];
    const sourcesByCode: Record<string, string> = {};
    const fixedCodes = new Set<string>();
    for (const emp of employees) {
      const comps = await sql`
        select cc.code, cc.id as component_id, cv.kind, cv.calc_method, fv.expression_text, ao.fixed_minor, ao.fixed_currency
        from pay_config.structure_assignment sa
        join pay_config.component_binding cb on cb.structure_version_id = sa.structure_version_id
        join pay_config.component_catalog cc on cc.id = cb.component_id
        join lateral (select * from pay_config.component_version v where v.component_id = cc.id and v.status = 'active' and v.effective_from <= ${periodMonth} order by v.effective_from desc limit 1) cv on true
        left join pay_formula.formula_version fv on fv.id = cv.formula_ref
        left join pay_config.assignment_override ao on ao.assignment_id = sa.id and ao.component_id = cc.id
        where sa.employee_id = ${emp.id} and sa.effective_to is null`;
      comps.forEach((c: Record<string, unknown>) => { codeToId[c.code as string] = c.component_id as string; });
      const spec = mapCatalog({
        currency: 'INR', ruleView,
        components: comps.map((c: Record<string, unknown>) => ({ code: c.code, kind: c.kind, calcMethod: c.calc_method, formulaSource: c.expression_text, overrideFixedMinor: c.fixed_minor == null ? null : Number(c.fixed_minor), overrideCurrency: c.fixed_currency })),
      });
      for (const s of spec.formulaSources) sourcesByCode[s.code] = s.source;
      for (const k of Object.keys(spec.fixedComponents)) fixedCodes.add(k);
      const [att] = await sql`select paid_days, lop_days from pay_calc.attendance where society_id = ${societyId} and employee_id = ${emp.id} and period_month = ${periodMonth} limit 1`;
      const paidDays = att ? Number(att.paid_days) : 30, lopDays = att ? Number(att.lop_days) : 0;
      const facts = { attendance: { paidDays, lopDays, otHours: 0 }, leave: [], loan: [], tax: { ytdByHead: {}, monthsRemaining: 12, regime: 'new' } };
      emReqs.push({ employeeId: emp.id, empCode: emp.employee_code, paidDays, lopDays, calc: { facts, currency: 'INR', fixedComponents: spec.fixedComponents, fns: {}, scalars }, aggregate: { classification: spec.classification, clamps: spec.clamps } });
    }

    // 5b. Employees now have HETEROGENEOUS per-employee structures, but assembleRun compiles ONE shared
    // plan and runs it for everyone. So an employee who has BASIC but not (say) HRA would still get HRA
    // computed, and one without BASIC would make a BASIC-referencing formula refuse. Reconcile both:
    // mark every plan-formula code an employee does NOT own as 'info' (excluded from the payslip, never
    // PAY-CAL-601), and inject BASIC=0 where the shared plan needs it but the structure omits it (so it
    // computes 0 and is then excluded — never a PAY-DSL-REF refusal).
    const planFormulaCodes = Object.keys(sourcesByCode);
    for (const r of emReqs) {
      const cls = r.aggregate.classification as Record<string, string>;
      for (const code of planFormulaCodes) if (cls[code] === undefined) cls[code] = 'info';
      const fc = r.calc.fixedComponents as Record<string, unknown>;
      // inject 0 for every fixed component the shared plan might reference (BASIC, DAILY_RATE, …) that
      // this employee's structure omits, so a cross-structure formula computes 0 instead of refusing.
      // NEVER inject a code the plan itself computes: another employee may have pinned that component
      // to a fixed amount (which puts it in fixedCodes), and injecting 0 here would silently zero this
      // employee's computed value — a fixed value outranks a computed one in the payslip pool.
      for (const code of fixedCodes) {
        if (fc[code] === undefined && !planFormulaCodes.includes(code)) fc[code] = makeMoney(0, 'INR');
      }
    }

    // 6. assemble the run (one shared plan; typeBase declares fixed components + fact vars)
    const typeBase = { vars: { ...Object.fromEntries([...fixedCodes].map((c) => [c, 'Money'])), ...Object.fromEntries(Object.keys(scalars).map((k) => [k, 'Number'])), attendance: 'Map', tax: 'Map', leaveBalance: 'Map', loanRecovery: 'Money', loanRecoveries: 'List' }, fns: {} };
    const runId = crypto.randomUUID();
    const assembled = assembleRun({
      societyId, runId, sequence: 1,
      freeze: { catalogs, ctx: freezeCtx },
      formula: { sources: Object.entries(sourcesByCode).map(([code, source]) => ({ code, source })), typeBase },
      employees: emReqs.map((r) => ({ employeeId: r.employeeId, calc: r.calc, aggregate: r.aggregate })),
      producer: { kind: 'human', actorEmail: user.email },
    }, { eventId: crypto.randomUUID(), occurredAt: new Date().toISOString() });

    // 7. persist (one transaction): run + snapshot + payslips + lines + WORM event
    const runNo = `PR-${period}-${String(Date.now()).slice(-6)}`;
    await sql.begin(async (tx: postgres.TransactionSql) => {
      await tx`insert into pay_calc.payroll_run(id,society_id,period,period_month,run_no,currency,created_by) values(${runId},${societyId},${period},${periodMonth},${runNo},'INR',${su.id})`;
      await tx`insert into pay_calc.run_snapshot(pay_run_id,resolved_rules_json,formula_plan_json,config_resolution_json) values(${runId},${JSON.stringify(assembled.frozenViews.ruleView)},${JSON.stringify(assembled.plan)},${JSON.stringify({ config: assembled.frozenViews.configView, policy: assembled.frozenViews.policyView })})`;
      for (let i = 0; i < assembled.payslips.length; i++) {
        const ps = assembled.payslips[i];
        const req0 = emReqs.find((r) => r.employeeId === ps.employeeId)!;
        const slipId = crypto.randomUUID();
        await tx`insert into pay_calc.payslip(id,society_id,pay_run_id,employee_id,period_month,payslip_no,gross_minor,deductions_minor,net_minor,currency,paid_days,lop_days,created_by)
          values(${slipId},${societyId},${runId},${ps.employeeId},${periodMonth},${`PS-${runNo}-${req0.empCode}`},${ps.payslip.grossEarnings.minor},${ps.payslip.grossDeductions.minor},${ps.payslip.netPay.minor},'INR',${req0.paidDays},${req0.lopDays},${su.id})`;
        let seq = 1;
        for (const line of [...ps.payslip.earnings, ...ps.payslip.deductions]) {
          await tx`insert into pay_calc.payslip_line(society_id,payslip_id,period_month,component_id,computed_minor,currency,sequence) values(${societyId},${slipId},${periodMonth},${codeToId[line.code]},${line.amount.minor},'INR',${seq++})`;
        }
      }
      const ev = assembled.event;
      await tx`insert into pay_calc.pay_event(society_id,aggregate_type,aggregate_id,sequence,event_type,producer_kind,actor_email,occurred_at,payload)
        values(${societyId},'pay_run',${runId},${ev.sequence},${ev.eventType}::pay_core.pay_event_type,${ev.producerKind}::pay_core.producer_kind,${ev.actorEmail},${ev.occurredAt},${JSON.stringify(ev.payload)})`;
    });

    return json(200, { ok: true, runId, runNo, employeeCount: assembled.payslips.length, period }, CORS);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    // backstop for the pre-check race: if two runs for the same period land together, the DB index
    // `run_one_open` blocks the second — surface it as the same friendly 409, not a raw 500.
    if (msg.includes('run_one_open')) return json(409, { error: `is avdhi (${period}) ka payroll pehle se hai. Dobara chalane ke liye pehle use cancel karein.` }, CORS);
    return json(500, { error: msg }, CORS);
  } finally {
    await sql.end();
  }
});

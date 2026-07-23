/**
 * pay-employee — list / add employees + their salary, for the caller's society (Deno Edge Function).
 *
 * The browser cannot reach the pay_* schemas, so this server function is the write path for payroll
 * master data. On the first "add", it AUTO-ENSURES a standard salary structure for the society
 * (BASIC fixed + DA/HRA/PF formulas) so a society can start with zero setup; each employee gets that
 * structure with their own BASIC amount (a per-employee assignment_override). After adding employees,
 * `pay-run` computes their payslips.
 *
 * Auth: verified JWT → society_users → society + role (admin/accountant). A caller only ever touches
 * their own society. Writes go over a direct DB connection (PostgREST can't reach pay_*).
 *
 * Deploy:  supabase functions deploy pay-employee   (+ PAY_DB_URL secret)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';

const corsFor = (req: Request) => ({
  'access-control-allow-origin': '*',
  'access-control-allow-headers': req.headers.get('access-control-request-headers') ?? 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
});
const json = (s: number, b: unknown, c: Record<string, string>) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'content-type': 'application/json' } });
const L = (en: string) => JSON.stringify({ hi: en, en });
const EFF = '2026-01-01';
const SFL: Record<string, string> = {
  DA: 'formula "DA" :: Money let b = BASIC in b * 20%',
  HRA: 'formula "HRA" :: Money let b = BASIC in b * 40%',
  PF: 'formula "PF" :: Money let b = BASIC in b * (pf_rate / 100)',
  // Loss of Pay: deduct the full-pay-equivalent (BASIC + DA 20% + HRA 40% = 160% of BASIC) for absent days.
  LOP: 'formula "LOP" :: Money let b = BASIC in b * 160% * (attendance.lopDays / 30)',
  // Daily wages: the day rate (a hidden input component) times the days actually worked.
  DAILY_WAGE: 'formula "DAILY_WAGE" :: Money let r = DAILY_RATE in r * attendance.paidDays',
};

// Society-wide component catalog (shared DEFINITIONS; per-employee independence comes from each
// employee having their OWN structure + overrides — Phase 2 will let those overrides diverge freely).
const COMPONENTS: Record<string, { kind: string; method: string; formula: string | null; label: string }> = {
  BASIC:        { kind: 'earning',   method: 'fixed',   formula: null,    label: 'Basic' },
  DA:           { kind: 'earning',   method: 'formula', formula: SFL.DA,  label: 'DA' },
  HRA:          { kind: 'earning',   method: 'formula', formula: SFL.HRA, label: 'HRA' },
  PF:           { kind: 'deduction', method: 'formula', formula: SFL.PF,  label: 'PF' },
  LOP:          { kind: 'deduction', method: 'formula', formula: SFL.LOP, label: 'Loss of Pay' },
  DEP_ALLOW:    { kind: 'earning',   method: 'fixed',   formula: null,    label: 'Deputation Allowance' },
  CONSOLIDATED: { kind: 'earning',   method: 'fixed',   formula: null,    label: 'Consolidated Pay' },
  STIPEND:      { kind: 'earning',   method: 'fixed',   formula: null,    label: 'Stipend' },
  // Daily wages: DAILY_RATE is a hidden input (kind 'employer_contrib' → 'info', excluded from the
  // payslip); DAILY_WAGE = rate × days-worked is the visible earning.
  DAILY_RATE:   { kind: 'employer_contrib', method: 'fixed',   formula: null,           label: 'Daily Rate (per day)' },
  DAILY_WAGE:   { kind: 'earning',          method: 'formula', formula: SFL.DAILY_WAGE, label: 'Daily Wages' },
};

// Each employment TYPE → the components its structure binds + which one the entered amount fills +
// which extra components default to 0 (editable later). Keys are the seeded pay_core.employment_type
// codes. muster = daily wages (the entered amount is the DAILY RATE; DAILY_WAGE = rate × days worked).
const TYPE_STRUCTURE: Record<string, { components: string[]; primary: string; zero: string[] }> = {
  permanent:  { components: ['BASIC', 'DA', 'HRA', 'PF', 'LOP'], primary: 'BASIC', zero: [] },
  deputation: { components: ['BASIC', 'DA', 'DEP_ALLOW', 'LOP'], primary: 'BASIC', zero: ['DEP_ALLOW'] },
  contract:   { components: ['CONSOLIDATED'], primary: 'CONSOLIDATED', zero: [] },
  honorary:   { components: ['CONSOLIDATED'], primary: 'CONSOLIDATED', zero: [] },
  muster:     { components: ['DAILY_RATE', 'DAILY_WAGE'], primary: 'DAILY_RATE', zero: [] },
  probation:  { components: ['BASIC', 'DA', 'HRA', 'PF', 'LOP'], primary: 'BASIC', zero: [] },       // like permanent
  seasonal:   { components: ['BASIC', 'DA', 'PF', 'LOP'], primary: 'BASIC', zero: [] },               // monthly, PF, no HRA
  fixedterm:  { components: ['BASIC', 'DA', 'PF', 'LOP'], primary: 'BASIC', zero: [] },               // statutory for the term
  apprentice: { components: ['STIPEND'], primary: 'STIPEND', zero: [] },                              // stipend, no statutory
  parttime:   { components: ['CONSOLIDATED'], primary: 'CONSOLIDATED', zero: [] },
  consultant: { components: ['CONSOLIDATED'], primary: 'CONSOLIDATED', zero: [] },                    // retainer fee (194J TDS later)
  casual:     { components: ['DAILY_RATE', 'DAILY_WAGE'], primary: 'DAILY_RATE', zero: [] },          // like muster
};

// The seeded pay_core.employment_type rows the structures above rely on (FK). Idempotent — the table
// is an open taxonomy (is_system), so we top it up on demand rather than via a fresh migration.
const EMP_TYPE_SEED: [string, string, string][] = [
  ['permanent', 'स्थायी', 'Permanent'], ['deputation', 'प्रतिनियुक्ति', 'Deputation'],
  ['muster', 'मस्टर / दैनिक श्रमिक', 'Muster Labour'], ['contract', 'संविदा', 'Contract'],
  ['honorary', 'मानद', 'Honorary'], ['probation', 'परिवीक्षाधीन', 'Probationer'],
  ['seasonal', 'मौसमी', 'Seasonal'], ['fixedterm', 'नियत-अवधि', 'Fixed-term'],
  ['apprentice', 'प्रशिक्षु', 'Apprentice'], ['parttime', 'अंशकालिक', 'Part-time'],
  ['consultant', 'सलाहकार', 'Consultant'], ['casual', 'आकस्मिक', 'Casual'],
];
async function ensureEmploymentTypes(tx: postgres.TransactionSql) {
  for (const [code, hi, en] of EMP_TYPE_SEED) {
    await tx`insert into pay_core.employment_type(code,label) values(${code},${JSON.stringify({ hi, en })}) on conflict do nothing`;
  }
}

// Idempotent: ensure every society component + the default statutory rates exist. Returns { code: id }.
async function ensureSocietyComponents(tx: postgres.TransactionSql, societyId: string, creator: string) {
  const ids: Record<string, string> = {};
  for (const [code, def] of Object.entries(COMPONENTS)) {
    const [existing] = await tx`select id from pay_config.component_catalog where society_id = ${societyId} and code = ${code} limit 1`;
    if (existing) { ids[code] = existing.id as string; continue; }
    const [c] = await tx`insert into pay_config.component_catalog(society_id,code,display_name,created_by) values(${societyId},${code},${L(def.label)},${creator}) returning id`;
    ids[code] = c.id;
    let formulaRef: string | null = null;
    if (def.method === 'formula' && def.formula) {
      const [fc] = await tx`insert into pay_formula.formula_catalog(name,created_by) values(${`${code} formula [${societyId}]`},${creator}) returning id`;
      const [fv] = await tx`insert into pay_formula.formula_version(formula_id,expression_text,effective_from,created_by,status) values(${fc.id},${def.formula},${EFF},${creator},'active') returning id`;
      formulaRef = fv.id;
    }
    await tx`insert into pay_config.component_version(component_id,kind,calc_method,gl_symbolic_role,formula_ref,effective_from,created_by,status)
      values(${ids[code]},${def.kind},${def.method}::pay_core.calc_method,${code.toLowerCase()},${formulaRef},${EFF},${creator},'active')`;
  }
  const seedRates: [string, number, string][] = [
    ['pf_rate', 12, 'PF employee contribution %'],
    ['employer_pf_rate', 12, 'PF employer contribution % (EPS + EPF split)'],
    ['eps_rate', 8.33, 'EPS (pension) contribution % of EPS wages'],
    ['edli_rate', 0.5, 'EDLI contribution %'],
    ['eps_wage_ceiling', 15000, 'EPS / EDLI wage ceiling (₹, whole rupees)'],
  ];
  for (const [k, v, lbl] of seedRates) {
    await tx`insert into pay_config.statutory_setting(society_id,key,value_num,label,source,created_by)
      values(${societyId},${k},${v},${lbl},'Statutory default — confirm for your establishment',${creator})
      on conflict (society_id,key) do nothing`;
  }
  return ids;
}

// Create a per-employee salary structure for the type. Each employee gets their OWN template
// (EMP-<code>) so it can be edited independently later. Returns the version + which override to fill.
async function createEmployeeStructure(tx: postgres.TransactionSql, societyId: string, empCode: string, type: string, creator: string, compIds: Record<string, string>) {
  const spec = TYPE_STRUCTURE[type];
  const [st] = await tx`insert into pay_config.structure_template(society_id,code,display_name,created_by) values(${societyId},${`EMP-${empCode}`},${L(`Salary — ${empCode}`)},${creator}) returning id`;
  const [sv] = await tx`insert into pay_config.structure_version(structure_id,effective_from,created_by,status) values(${st.id},${EFF},${creator},'active') returning id`;
  for (const code of spec.components) {
    await tx`insert into pay_config.component_binding(structure_version_id,component_id,created_by) values(${sv.id},${compIds[code]},${creator})`;
  }
  return { versionId: sv.id as string, primaryComponentId: compIds[spec.primary], zeroComponentIds: spec.zero.map((c) => compIds[c]) };
}

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' }, CORS);

  const supaUrl = Deno.env.get('SUPABASE_URL') ?? '', anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const dbUrl = Deno.env.get('PAY_DB_URL') ?? Deno.env.get('SUPABASE_DB_URL') ?? '';
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!jwt) return json(401, { error: 'missing bearer token' }, CORS);
  const { data: { user } } = await createClient(supaUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } }).auth.getUser();
  if (!user?.email) return json(401, { error: 'invalid session' }, CORS);

  let body: { action?: string; name?: string; code?: string; basicMinor?: number; type?: string; employeeId?: string; period?: string; lopDays?: number; key?: string; value?: number; label?: string; source?: string; uan?: string; pan?: string; esicIp?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'bad JSON' }, CORS); }

  const sql = postgres(dbUrl, { prepare: false, max: 3 });
  try {
    const [su] = await sql`select id, society_id, role from public.society_users where email = ${user.email} and is_active = true limit 1`;
    if (!su) return json(403, { error: 'not a society user' }, CORS);
    if (!['admin', 'accountant'].includes(su.role)) return json(403, { error: 'only admin / accountant' }, CORS);
    const societyId = su.society_id as string;

    if (body.action === 'list') {
      const rows = await sql`
        select e.id, e.employee_code, e.full_name, e.date_of_join,
               si.uan, si.pan, si.esic_ip,
               e.employment_type,
               (select ao.fixed_minor from pay_config.structure_assignment sa
                  join pay_config.assignment_override ao on ao.assignment_id = sa.id
                  join pay_config.component_catalog cc on cc.id = ao.component_id and cc.code in ('BASIC','CONSOLIDATED','DAILY_RATE','STIPEND')
                where sa.employee_id = e.id and sa.effective_to is null order by cc.code limit 1) as basic_minor
        from pay_core.employee e
        left join pay_core.statutory_identity si on si.employee_id = e.id
        where e.society_id = ${societyId} order by e.employee_code`;
      return json(200, { employees: rows }, CORS);
    }

    if (body.action === 'add') {
      const name = (body.name ?? '').trim(), code = (body.code ?? '').trim();
      const type = (body.type ?? 'permanent').trim();
      const basicMinor = Number(body.basicMinor);
      if (!name || !code) return json(400, { error: 'name and code required' }, CORS);
      if (!TYPE_STRUCTURE[type]) return json(400, { error: `type must be one of: ${Object.keys(TYPE_STRUCTURE).join(', ')}` }, CORS);
      if (!Number.isFinite(basicMinor) || basicMinor <= 0) return json(400, { error: 'amount must be a positive number (paise)' }, CORS);

      const out = await sql.begin(async (tx: postgres.TransactionSql) => {
        const compIds = await ensureSocietyComponents(tx, societyId, su.id);
        await ensureEmploymentTypes(tx);
        const [dup] = await tx`select 1 from pay_core.employee where society_id = ${societyId} and employee_code = ${code} limit 1`;
        if (dup) throw new Error(`employee code '${code}' already exists`);
        const [emp] = await tx`insert into pay_core.employee(society_id,employee_code,full_name,date_of_join,employment_type,created_by)
          values(${societyId},${code},${L(name)},${EFF},${type},${su.id}) returning id`;
        const { versionId, primaryComponentId, zeroComponentIds } = await createEmployeeStructure(tx, societyId, code, type, su.id, compIds);
        const [asg] = await tx`insert into pay_config.structure_assignment(society_id,employee_id,structure_version_id,effective_from,created_by)
          values(${societyId},${emp.id},${versionId},${EFF},${su.id}) returning id`;
        await tx`insert into pay_config.assignment_override(assignment_id,component_id,fixed_minor,fixed_currency,reason,created_by)
          values(${asg.id},${primaryComponentId},${basicMinor},'INR','initial salary',${su.id})`;
        for (const zid of zeroComponentIds) {
          await tx`insert into pay_config.assignment_override(assignment_id,component_id,fixed_minor,fixed_currency,reason,created_by)
            values(${asg.id},${zid},0,'INR','default (edit later)',${su.id})`;
        }
        return { employeeId: emp.id };
      });
      return json(200, { ok: true, employeeId: out.employeeId, code, type }, CORS);
    }

    if (body.action === 'attendance') {
      const empId = body.employeeId ?? '';
      if (!/^\d{4}-\d{2}$/.test(body.period ?? '')) return json(400, { error: 'period "YYYY-MM" required' }, CORS);
      const lop = Number(body.lopDays);
      if (!Number.isFinite(lop) || lop < 0 || lop > 31) return json(400, { error: 'lopDays must be 0–31' }, CORS);
      const periodMonth = `${body.period}-01`;
      const paid = 30 - lop;
      const [owner] = await sql`select 1 from pay_core.employee where id = ${empId} and society_id = ${societyId} limit 1`;
      if (!owner) return json(404, { error: 'employee not found in your society' }, CORS);
      await sql`insert into pay_calc.attendance(society_id,employee_id,period_month,paid_days,lop_days,created_by)
        values(${societyId},${empId},${periodMonth},${paid},${lop},${su.id})
        on conflict (society_id,employee_id,period_month) do update set paid_days = ${paid}, lop_days = ${lop}, updated_at = now(), updated_by = ${su.id}`;
      return json(200, { ok: true, employeeId: empId, period: body.period, paidDays: paid, lopDays: lop }, CORS);
    }

    // ── Per-employee salary structure: read it, and edit any component's value ──────────────
    if (body.action === 'structure-get') {
      const empId = body.employeeId ?? '';
      const rows = await sql`
        select cc.code, cc.display_name, cv.kind, cv.calc_method::text as calc_method,
               fv.expression_text, ao.fixed_minor, sa.effective_from
        from pay_config.structure_assignment sa
        join pay_config.component_binding cb on cb.structure_version_id = sa.structure_version_id
        join pay_config.component_catalog cc on cc.id = cb.component_id
        join lateral (select * from pay_config.component_version v where v.component_id = cc.id and v.status = 'active' order by v.effective_from desc limit 1) cv on true
        left join pay_formula.formula_version fv on fv.id = cv.formula_ref
        left join pay_config.assignment_override ao on ao.assignment_id = sa.id and ao.component_id = cc.id
        where sa.employee_id = ${empId} and sa.society_id = ${societyId} and sa.effective_to is null
        order by cv.sequence, cc.code`;
      return json(200, { components: rows }, CORS);
    }

    // Change ONE component's value for ONE employee. History-safe: unless the assignment started
    // today (a same-day correction), the current assignment is CLOSED and a new one opened carrying
    // every override forward — so the employee's pay timeline is preserved, never overwritten.
    if (body.action === 'structure-set') {
      const empId = body.employeeId ?? '', code = (body.code ?? '').trim();
      const valueMinor = Number(body.basicMinor);
      if (!code) return json(400, { error: 'component code required' }, CORS);
      if (!Number.isFinite(valueMinor) || valueMinor < 0) return json(400, { error: 'value must be a non-negative number (paise)' }, CORS);
      const out = await sql.begin(async (tx: postgres.TransactionSql) => {
        const [asg] = await tx`select id, structure_version_id, effective_from from pay_config.structure_assignment
          where employee_id = ${empId} and society_id = ${societyId} and effective_to is null limit 1`;
        if (!asg) throw new Error('no active salary structure for this employee');
        const [comp] = await tx`select cc.id from pay_config.component_catalog cc
          join pay_config.component_binding cb on cb.component_id = cc.id and cb.structure_version_id = ${asg.structure_version_id}
          where cc.society_id = ${societyId} and cc.code = ${code} limit 1`;
        if (!comp) throw new Error(`component '${code}' is not in this employee's structure`);
        const [{ same }] = await tx`select (${asg.effective_from}::date >= current_date) as same`;
        if (same) {
          await tx`insert into pay_config.assignment_override(assignment_id,component_id,fixed_minor,fixed_currency,reason,created_by)
            values(${asg.id},${comp.id},${valueMinor},'INR','edited',${su.id})
            on conflict (assignment_id,component_id) do update set fixed_minor = ${valueMinor}, override_formula_ref = null`;
          return { versioned: false };
        }
        await tx`update pay_config.structure_assignment set effective_to = current_date, updated_at = now(), updated_by = ${su.id} where id = ${asg.id}`;
        const [nw] = await tx`insert into pay_config.structure_assignment(society_id,employee_id,structure_version_id,effective_from,created_by)
          values(${societyId},${empId},${asg.structure_version_id},current_date,${su.id}) returning id`;
        // carry every override forward (exactly one of fixed_minor / override_formula_ref must be set)
        await tx`insert into pay_config.assignment_override(assignment_id,component_id,fixed_minor,fixed_currency,override_formula_ref,reason,created_by)
          select ${nw.id}, ao.component_id,
                 case when ao.component_id = ${comp.id} then ${valueMinor} else ao.fixed_minor end,
                 coalesce(ao.fixed_currency,'INR'),
                 case when ao.component_id = ${comp.id} then null else ao.override_formula_ref end,
                 'carried forward', ${su.id}
          from pay_config.assignment_override ao where ao.assignment_id = ${asg.id}`;
        await tx`insert into pay_config.assignment_override(assignment_id,component_id,fixed_minor,fixed_currency,reason,created_by)
          values(${nw.id},${comp.id},${valueMinor},'INR','edited',${su.id}) on conflict (assignment_id,component_id) do nothing`;
        return { versioned: true };
      });
      return json(200, { ok: true, employeeId: empId, code, value: valueMinor, versioned: out.versioned }, CORS);
    }

    if (body.action === 'update') {
      const empId = body.employeeId ?? '';
      const basicMinor = Number(body.basicMinor);
      if (!Number.isFinite(basicMinor) || basicMinor <= 0) return json(400, { error: 'basicMinor must be a positive number (paise)' }, CORS);
      const rows = await sql`
        update pay_config.assignment_override ao set fixed_minor = ${basicMinor}
        from pay_config.structure_assignment sa, pay_config.component_catalog cc
        where ao.assignment_id = sa.id and ao.component_id = cc.id and cc.code in ('BASIC','CONSOLIDATED','DAILY_RATE','STIPEND')
          and sa.employee_id = ${empId} and sa.effective_to is null and sa.society_id = ${societyId}
        returning ao.id`;
      if (!rows.length) return json(404, { error: 'employee / basic override not found in your society' }, CORS);
      return json(200, { ok: true, employeeId: empId, basicMinor }, CORS);
    }

    if (body.action === 'deactivate') {
      const empId = body.employeeId ?? '';
      const [owner] = await sql`select 1 from pay_core.employee where id = ${empId} and society_id = ${societyId} limit 1`;
      if (!owner) return json(404, { error: 'employee not found in your society' }, CORS);
      // end the active assignment → excluded from future runs (past runs/payslips are untouched)
      const rows = await sql`update pay_config.structure_assignment set effective_to = current_date, updated_at = now(), updated_by = ${su.id}
        where employee_id = ${empId} and society_id = ${societyId} and effective_to is null returning id`;
      return json(200, { ok: true, employeeId: empId, ended: rows.length }, CORS);
    }

    if (body.action === 'identity-set') {
      const empId = body.employeeId ?? '';
      const uan = (body.uan ?? '').trim(), pan = (body.pan ?? '').trim().toUpperCase(), esicIp = (body.esicIp ?? '').trim();
      if (uan && !/^\d{12}$/.test(uan)) return json(400, { error: 'UAN must be 12 digits' }, CORS);
      if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return json(400, { error: 'PAN must be like ABCDE1234F' }, CORS);
      const [owner] = await sql`select 1 from pay_core.employee where id = ${empId} and society_id = ${societyId} limit 1`;
      if (!owner) return json(404, { error: 'employee not found in your society' }, CORS);
      await sql`insert into pay_core.statutory_identity(society_id,employee_id,uan,pan,esic_ip,created_by)
        values(${societyId},${empId},${uan || null},${pan || null},${esicIp || null},${su.id})
        on conflict (employee_id) do update set
          uan = ${uan || null}, pan = ${pan || null}, esic_ip = ${esicIp || null}, updated_at = now(), updated_by = ${su.id}`;
      return json(200, { ok: true, employeeId: empId }, CORS);
    }

    if (body.action === 'statutory-list') {
      const rows = await sql`select key, value_num, label, source from pay_config.statutory_setting where society_id = ${societyId} order by key`;
      return json(200, { settings: rows }, CORS);
    }

    if (body.action === 'statutory-set') {
      const key = (body.key ?? '').trim();
      const value = Number(body.value);
      if (!/^[a-z0-9_]+$/.test(key)) return json(400, { error: 'invalid key' }, CORS);
      if (!Number.isFinite(value) || value < 0) return json(400, { error: 'value must be a non-negative number' }, CORS);
      await sql`insert into pay_config.statutory_setting(society_id,key,value_num,label,source,created_by)
        values(${societyId},${key},${value},${body.label ?? null},${body.source ?? null},${su.id})
        on conflict (society_id,key) do update set value_num = ${value}, label = coalesce(${body.label ?? null}, pay_config.statutory_setting.label), source = ${body.source ?? null}, updated_at = now(), updated_by = ${su.id}`;
      return json(200, { ok: true, key, value }, CORS);
    }

    return json(400, { error: "action must be 'list' / 'add' / 'attendance' / 'update' / 'deactivate' / 'identity-set' / 'structure-get' / 'structure-set' / 'statutory-list' / 'statutory-set'" }, CORS);
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) }, CORS);
  } finally {
    await sql.end();
  }
});

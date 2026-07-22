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
};

// Ensure the society has the STANDARD structure; returns { versionId, basicComponentId }.
async function ensureStandardConfig(tx: postgres.TransactionSql, societyId: string, creator: string) {
  const [existing] = await tx`
    select sv.id as version_id, cc.id as basic_id
    from pay_config.structure_template st
    join pay_config.structure_version sv on sv.structure_id = st.id and sv.status = 'active'
    join pay_config.component_catalog cc on cc.society_id = st.society_id and cc.code = 'BASIC'
    where st.society_id = ${societyId} and st.code = 'STANDARD' limit 1`;
  if (existing) return { versionId: existing.version_id as string, basicComponentId: existing.basic_id as string };

  const CODES = ['BASIC', 'DA', 'HRA', 'PF', 'LOP'];
  const comp: Record<string, string> = {};
  for (const code of CODES) {
    const [r] = await tx`insert into pay_config.component_catalog(society_id,code,display_name,created_by) values(${societyId},${code},${L(code)},${creator}) returning id`;
    comp[code] = r.id;
  }
  const cv = async (code: string, kind: string, method: string, formulaRef: string | null) =>
    tx`insert into pay_config.component_version(component_id,kind,calc_method,gl_symbolic_role,formula_ref,effective_from,created_by,status)
       values(${comp[code]},${kind},${method}::pay_core.calc_method,${code.toLowerCase()},${formulaRef},${EFF},${creator},'active')`;
  await cv('BASIC', 'earning', 'fixed', null);
  for (const code of ['DA', 'HRA', 'PF', 'LOP']) {
    const [fc] = await tx`insert into pay_formula.formula_catalog(name,created_by) values(${`${code} formula [${societyId}]`},${creator}) returning id`;
    const [fv] = await tx`insert into pay_formula.formula_version(formula_id,expression_text,effective_from,created_by,status) values(${fc.id},${SFL[code]},${EFF},${creator},'active') returning id`;
    await cv(code, (code === 'PF' || code === 'LOP') ? 'deduction' : 'earning', 'formula', fv.id);
  }
  const [st] = await tx`insert into pay_config.structure_template(society_id,code,display_name,created_by) values(${societyId},'STANDARD',${L('Standard salary')},${creator}) returning id`;
  const [sv] = await tx`insert into pay_config.structure_version(structure_id,effective_from,created_by,status) values(${st.id},${EFF},${creator},'active') returning id`;
  for (const code of CODES) {
    await tx`insert into pay_config.component_binding(structure_version_id,component_id,created_by) values(${sv.id},${comp[code]},${creator})`;
  }
  // seed the default statutory rates — the admin edits each with an authoritative source.
  // pf_rate feeds the run; the rest are used only when generating the PF ECR file (employer split).
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
  return { versionId: sv.id as string, basicComponentId: comp.BASIC };
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

  let body: { action?: string; name?: string; code?: string; basicMinor?: number; employeeId?: string; period?: string; lopDays?: number; key?: string; value?: number; label?: string; source?: string; uan?: string; pan?: string; esicIp?: string };
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
               (select ao.fixed_minor from pay_config.structure_assignment sa
                  join pay_config.assignment_override ao on ao.assignment_id = sa.id
                  join pay_config.component_catalog cc on cc.id = ao.component_id and cc.code = 'BASIC'
                where sa.employee_id = e.id and sa.effective_to is null limit 1) as basic_minor
        from pay_core.employee e
        left join pay_core.statutory_identity si on si.employee_id = e.id
        where e.society_id = ${societyId} order by e.employee_code`;
      return json(200, { employees: rows }, CORS);
    }

    if (body.action === 'add') {
      const name = (body.name ?? '').trim(), code = (body.code ?? '').trim();
      const basicMinor = Number(body.basicMinor);
      if (!name || !code) return json(400, { error: 'name and code required' }, CORS);
      if (!Number.isFinite(basicMinor) || basicMinor <= 0) return json(400, { error: 'basicMinor must be a positive number (paise)' }, CORS);

      const out = await sql.begin(async (tx: postgres.TransactionSql) => {
        const { versionId, basicComponentId } = await ensureStandardConfig(tx, societyId, su.id);
        const [dup] = await tx`select 1 from pay_core.employee where society_id = ${societyId} and employee_code = ${code} limit 1`;
        if (dup) throw new Error(`employee code '${code}' already exists`);
        const [emp] = await tx`insert into pay_core.employee(society_id,employee_code,full_name,date_of_join,employment_type,created_by)
          values(${societyId},${code},${L(name)},${EFF},'permanent',${su.id}) returning id`;
        const [asg] = await tx`insert into pay_config.structure_assignment(society_id,employee_id,structure_version_id,effective_from,created_by)
          values(${societyId},${emp.id},${versionId},${EFF},${su.id}) returning id`;
        await tx`insert into pay_config.assignment_override(assignment_id,component_id,fixed_minor,fixed_currency,reason,created_by)
          values(${asg.id},${basicComponentId},${basicMinor},'INR','initial salary',${su.id})`;
        return { employeeId: emp.id };
      });
      return json(200, { ok: true, employeeId: out.employeeId, code }, CORS);
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

    if (body.action === 'update') {
      const empId = body.employeeId ?? '';
      const basicMinor = Number(body.basicMinor);
      if (!Number.isFinite(basicMinor) || basicMinor <= 0) return json(400, { error: 'basicMinor must be a positive number (paise)' }, CORS);
      const rows = await sql`
        update pay_config.assignment_override ao set fixed_minor = ${basicMinor}
        from pay_config.structure_assignment sa, pay_config.component_catalog cc
        where ao.assignment_id = sa.id and ao.component_id = cc.id and cc.code = 'BASIC'
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

    return json(400, { error: "action must be 'list' / 'add' / 'attendance' / 'update' / 'deactivate' / 'identity-set' / 'statutory-list' / 'statutory-set'" }, CORS);
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) }, CORS);
  } finally {
    await sql.end();
  }
});

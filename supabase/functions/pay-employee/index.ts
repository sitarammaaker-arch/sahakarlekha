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
import { TDS_FORMULAS, assertVerifiedLaw, resolveParam } from '../_shared/pay-core.mjs';

// SEC-03 (migration 085): a token that still owes a 2FA code gets nothing. getUser() verifies the
// token; its payload is read only to refuse more (unreadable → pending).
const mfaPending = (t: string): boolean => {
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).mfa_pending === true; } catch { return true; }
};

const corsFor = (req: Request) => ({
  'access-control-allow-origin': '*',
  'access-control-allow-headers': req.headers.get('access-control-request-headers') ?? 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
});
const json = (s: number, b: unknown, c: Record<string, string>) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'content-type': 'application/json' } });
const L = (en: string) => JSON.stringify({ hi: en, en });
const EFF = '2026-01-01';
// P0 (payroll consolidation): salary rules used to start at the fixed EFF above, so pay-run refused every
// period before 2026-01 ("PAY-CMP-510 … refusing") — Apr–Dec 2025 of FY 2025-26 could not be run at all.
// Rules now start at the financial-year start (1 April) of the joining date, never LATER than EFF, so a
// society that has an employee from before 2026 can run every month since that FY began.
const fyStartOf = (isoDate: string): string => {
  const y = Number(isoDate.slice(0, 4)), m = Number(isoDate.slice(5, 7));
  return `${m >= 4 ? y : y - 1}-04-01`;
};
const rulesFloorFor = (joinDate: string): string => { const f = fyStartOf(joinDate); return f < EFF ? f : EFF; };
const SFL: Record<string, string> = {
  DA: 'formula "DA" :: Money let b = BASIC in b * 20%',
  HRA: 'formula "HRA" :: Money let b = BASIC in b * 40%',
  // PF wage base is basic + DA, per EPF & MP Act 1952 §6 ("basic wages, dearness allowance and
  // retaining allowance") — https://indiankanoon.org/doc/1123739/ — not basic alone. DA is 20% of
  // basic in this app, so the base is basic × 120%; this references only BASIC (a fixed component,
  // injected as 0 when absent) so it cannot pick up another structure's DA. And per EPFO practice PF
  // is on PAID days only — the non-contributory (unpaid) days reduce it proportionately, the same
  // (30 − lopDays)/30 fraction the LOP lines use. Retaining allowance: no such component here.
  PF: 'formula "PF" :: Money let b = BASIC in b * 120% * (pf_rate / 100) * ((30 - attendance.lopDays) / 30)',
  // Loss of Pay must deduct ONE DAY OF WHAT THIS EMPLOYEE ACTUALLY EARNS, so it differs by structure:
  //   LOP        basic + DA 20% + HRA 40% = 160% of basic   (permanent, probation)
  //   LOP_NOHRA  basic + DA 20%           = 120% of basic   (seasonal, fixed-term — no HRA)
  //   LOP_DEP    basic + DA 20% + the deputation allowance  (deputation)
  //   LOP_CONSOL the consolidated pay                       (contract, honorary, part-time, consultant)
  //   LOP_STIPEND the stipend                               (apprentice)
  // Each references only FIXED components (BASIC, DEP_ALLOW, CONSOLIDATED, STIPEND), which pay-run
  // injects as 0 for an employee who lacks them — so no variant can pick up a value from someone
  // else's structure. Daily-wage types need no LOP at all: they are paid per day actually worked.
  LOP: 'formula "LOP" :: Money let b = BASIC in b * 160% * (attendance.lopDays / 30)',
  LOP_NOHRA: 'formula "LOP_NOHRA" :: Money let b = BASIC in b * 120% * (attendance.lopDays / 30)',
  LOP_DEP: 'formula "LOP_DEP" :: Money let b = BASIC in (b * 120% + DEP_ALLOW) * (attendance.lopDays / 30)',
  LOP_CONSOL: 'formula "LOP_CONSOL" :: Money let c = CONSOLIDATED in c * (attendance.lopDays / 30)',
  LOP_STIPEND: 'formula "LOP_STIPEND" :: Money let s = STIPEND in s * (attendance.lopDays / 30)',
  // Daily wages: the day rate (a hidden input component) times the days actually worked.
  DAILY_WAGE: 'formula "DAILY_WAGE" :: Money let r = DAILY_RATE in r * attendance.paidDays',
  // Staff advance: `loanRecovery` is a fact the runtime supplies per employee (0 when none).
  LOAN_RECOVERY: 'formula "LOAN_RECOVERY" :: Money let r = loanRecovery in r',
};

// Society-wide component catalog (shared DEFINITIONS; per-employee independence comes from each
// employee having their OWN structure + overrides — Phase 2 will let those overrides diverge freely).
const COMPONENTS: Record<string, { kind: string; method: string; formula: string | null; label: string }> = {
  BASIC:        { kind: 'earning',   method: 'fixed',   formula: null,    label: 'Basic' },
  DA:           { kind: 'earning',   method: 'formula', formula: SFL.DA,  label: 'DA' },
  HRA:          { kind: 'earning',   method: 'formula', formula: SFL.HRA, label: 'HRA' },
  PF:           { kind: 'deduction', method: 'formula', formula: SFL.PF,  label: 'PF' },
  LOP:          { kind: 'deduction', method: 'formula', formula: SFL.LOP, label: 'Loss of Pay' },
  LOP_NOHRA:    { kind: 'deduction', method: 'formula', formula: SFL.LOP_NOHRA, label: 'Loss of Pay' },
  LOP_DEP:      { kind: 'deduction', method: 'formula', formula: SFL.LOP_DEP, label: 'Loss of Pay' },
  LOP_CONSOL:   { kind: 'deduction', method: 'formula', formula: SFL.LOP_CONSOL, label: 'Loss of Pay' },
  LOP_STIPEND:  { kind: 'deduction', method: 'formula', formula: SFL.LOP_STIPEND, label: 'Loss of Pay' },
  DEP_ALLOW:    { kind: 'earning',   method: 'fixed',   formula: null,    label: 'Deputation Allowance' },
  CONSOLIDATED: { kind: 'earning',   method: 'fixed',   formula: null,    label: 'Consolidated Pay' },
  STIPEND:      { kind: 'earning',   method: 'fixed',   formula: null,    label: 'Stipend' },
  // Daily wages: DAILY_RATE is a hidden input (kind 'employer_contrib' → 'info', excluded from the
  // payslip); DAILY_WAGE = rate × days-worked is the visible earning.
  DAILY_RATE:   { kind: 'employer_contrib', method: 'fixed',   formula: null,           label: 'Daily Rate (per day)' },
  DAILY_WAGE:   { kind: 'earning',          method: 'formula', formula: SFL.DAILY_WAGE, label: 'Daily Wages' },
  // Staff advance recovery. `loanRecovery` is a per-employee FACT (pay-run loads the active loan), so
  // unlike a formula that reads other components this can never leak across employees' structures.
  LOAN_RECOVERY: { kind: 'loan_recovery', method: 'formula', formula: SFL.LOAN_RECOVERY, label: 'Loan / Advance Recovery' },
};
// Salary TDS (P2): one component per structure family — the formulas are the tested ones in lib/pay/tax/salaryTds.ts.
// They sit in the society's catalog but are bound to NO structure until an admin turns TDS on for an employee
// (`tds-set`), so adding them changes no existing run.
for (const [code, formula] of Object.entries(TDS_FORMULAS as Record<string, string>)) {
  COMPONENTS[code] = { kind: 'deduction', method: 'formula', formula, label: 'TDS (salary, s.192)' };
}
// Which TDS component fits an employment type (it projects the pay THAT structure earns). Daily-wage types have no
// stable monthly pay to project, so they have none — their TDS, if ever due, is entered by hand.
const TDS_CODE_BY_TYPE: Record<string, string> = {
  permanent: 'TDS', probation: 'TDS',
  seasonal: 'TDS_NOHRA', fixedterm: 'TDS_NOHRA',
  deputation: 'TDS_DEP',
  contract: 'TDS_CONSOL', honorary: 'TDS_CONSOL', parttime: 'TDS_CONSOL', consultant: 'TDS_CONSOL',
  apprentice: 'TDS_STIPEND',
};

// Add or remove ONE component on ONE employee's structure, history-safely: the version past
// assignments point at is never mutated — a new structure_version is created (copy ± the component)
// and the employee re-assigned to it from today. Returns whether the assignment was versioned.
async function changeStructureComponent(
  tx: postgres.TransactionSql, societyId: string, empId: string, code: string,
  adding: boolean, compIds: Record<string, string>, creator: string, valueMinor: number,
) {
  const compId = compIds[code];
  const [asg] = await tx`select id, structure_version_id, effective_from from pay_config.structure_assignment
    where employee_id = ${empId} and society_id = ${societyId} and effective_to is null limit 1`;
  if (!asg) throw new Error('no active salary structure for this employee');
  const [bound] = await tx`select 1 from pay_config.component_binding where structure_version_id = ${asg.structure_version_id} and component_id = ${compId} limit 1`;
  if (adding && bound) throw new Error(`'${code}' is already in this employee's structure`);
  if (!adding && !bound) throw new Error(`'${code}' is not in this employee's structure`);
  if (!adding) {
    const [{ n }] = await tx`select count(*)::int as n from pay_config.component_binding where structure_version_id = ${asg.structure_version_id}`;
    if (Number(n) <= 1) throw new Error('cannot remove the last component — a structure needs at least one');
  }
  const [sv] = await tx`select structure_id from pay_config.structure_version where id = ${asg.structure_version_id}`;
  const [nv] = await tx`insert into pay_config.structure_version(structure_id,version,effective_from,created_by,status)
    select ${sv.structure_id}, coalesce(max(version),0)+1, current_date, ${creator}, 'active'
    from pay_config.structure_version where structure_id = ${sv.structure_id} returning id`;
  await tx`insert into pay_config.component_binding(structure_version_id,component_id,created_by)
    select ${nv.id}, cb.component_id, ${creator} from pay_config.component_binding cb
    where cb.structure_version_id = ${asg.structure_version_id}`;
  if (adding) {
    await tx`insert into pay_config.component_binding(structure_version_id,component_id,created_by) values(${nv.id},${compId},${creator}) on conflict do nothing`;
  } else {
    await tx`delete from pay_config.component_binding where structure_version_id = ${nv.id} and component_id = ${compId}`;
  }
  const [{ same }] = await tx`select (${asg.effective_from}::date >= current_date) as same`;
  let target = asg.id as string;
  if (same) {
    await tx`update pay_config.structure_assignment set structure_version_id = ${nv.id}, updated_at = now(), updated_by = ${creator} where id = ${asg.id}`;
  } else {
    await tx`update pay_config.structure_assignment set effective_to = current_date, updated_at = now(), updated_by = ${creator} where id = ${asg.id}`;
    const [nw] = await tx`insert into pay_config.structure_assignment(society_id,employee_id,structure_version_id,effective_from,created_by)
      values(${societyId},${empId},${nv.id},current_date,${creator}) returning id`;
    target = nw.id as string;
    await tx`insert into pay_config.assignment_override(assignment_id,component_id,fixed_minor,fixed_currency,override_formula_ref,reason,created_by)
      select ${target}, ao.component_id, ao.fixed_minor, coalesce(ao.fixed_currency,'INR'), ao.override_formula_ref, 'carried forward', ${creator}
      from pay_config.assignment_override ao where ao.assignment_id = ${asg.id}`;
  }
  if (!adding) {
    await tx`delete from pay_config.assignment_override where assignment_id = ${target} and component_id = ${compId}`;
  } else if (COMPONENTS[code].method === 'fixed') {
    await tx`insert into pay_config.assignment_override(assignment_id,component_id,fixed_minor,fixed_currency,reason,created_by)
      values(${target},${compId},${valueMinor},'INR','added',${creator})
      on conflict (assignment_id,component_id) do update set fixed_minor = ${valueMinor}, override_formula_ref = null`;
  }
  return { versioned: !same };
}

// Each employment TYPE → the components its structure binds + which one the entered amount fills +
// which extra components default to 0 (editable later). Keys are the seeded pay_core.employment_type
// codes. muster = daily wages (the entered amount is the DAILY RATE; DAILY_WAGE = rate × days worked).
const TYPE_STRUCTURE: Record<string, { components: string[]; primary: string; zero: string[] }> = {
  permanent:  { components: ['BASIC', 'DA', 'HRA', 'PF', 'LOP'], primary: 'BASIC', zero: [] },
  deputation: { components: ['BASIC', 'DA', 'DEP_ALLOW', 'LOP_DEP'], primary: 'BASIC', zero: ['DEP_ALLOW'] },
  contract:   { components: ['CONSOLIDATED', 'LOP_CONSOL'], primary: 'CONSOLIDATED', zero: [] },
  honorary:   { components: ['CONSOLIDATED', 'LOP_CONSOL'], primary: 'CONSOLIDATED', zero: [] },
  muster:     { components: ['DAILY_RATE', 'DAILY_WAGE'], primary: 'DAILY_RATE', zero: [] },
  probation:  { components: ['BASIC', 'DA', 'HRA', 'PF', 'LOP'], primary: 'BASIC', zero: [] },       // like permanent
  seasonal:   { components: ['BASIC', 'DA', 'PF', 'LOP_NOHRA'], primary: 'BASIC', zero: [] },          // monthly, PF, no HRA
  fixedterm:  { components: ['BASIC', 'DA', 'PF', 'LOP_NOHRA'], primary: 'BASIC', zero: [] },          // statutory for the term
  apprentice: { components: ['STIPEND', 'LOP_STIPEND'], primary: 'STIPEND', zero: [] },               // stipend, no statutory
  parttime:   { components: ['CONSOLIDATED', 'LOP_CONSOL'], primary: 'CONSOLIDATED', zero: [] },
  consultant: { components: ['CONSOLIDATED', 'LOP_CONSOL'], primary: 'CONSOLIDATED', zero: [] },      // retainer fee (194J TDS later)
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
// `floor` (optional, YYYY-MM-DD): the earliest period the rules must cover. NEW components start at it; an
// EXISTING component whose earliest active version starts later gets ONE extra, earlier version
// (active versions are immutable — PAY-BUS-260 — so we add a row, never edit one). The extra version
// copies the earliest one and ends the day before it, so the single open version (compver_one_active) is
// untouched and every period from `floor` on resolves. Idempotent: a second call finds nothing to add.
async function ensureSocietyComponents(tx: postgres.TransactionSql, societyId: string, creator: string, floor?: string) {
  const ids: Record<string, string> = {};
  const from = floor ?? EFF;
  for (const [code, def] of Object.entries(COMPONENTS)) {
    const [existing] = await tx`select id from pay_config.component_catalog where society_id = ${societyId} and code = ${code} limit 1`;
    if (existing) {
      ids[code] = existing.id as string;
      if (floor) {
        await tx`insert into pay_config.component_version(component_id,kind,calc_method,formula_ref,taxability,pf_wage,esi_wage,pt_base,gratuity_base,bonus_base,gl_symbolic_role,sequence,version,effective_from,effective_to,status,change_reason,created_by)
          select f.component_id,f.kind,f.calc_method,f.formula_ref,f.taxability,f.pf_wage,f.esi_wage,f.pt_base,f.gratuity_base,f.bonus_base,f.gl_symbolic_role,f.sequence,
                 (select max(version) + 1 from pay_config.component_version where component_id = f.component_id),
                 ${floor}::date, f.effective_from - 1, 'active', 'extended back to cover earlier periods (same rule as the earliest version)', ${creator}
          from (select distinct on (component_id) * from pay_config.component_version
                where component_id = ${existing.id as string} and status = 'active' order by component_id, effective_from asc) f
          where f.effective_from - 1 > ${floor}::date`;
      }
      continue;
    }
    const [c] = await tx`insert into pay_config.component_catalog(society_id,code,display_name,created_by) values(${societyId},${code},${L(def.label)},${creator}) returning id`;
    ids[code] = c.id;
    let formulaRef: string | null = null;
    if (def.method === 'formula' && def.formula) {
      const [fc] = await tx`insert into pay_formula.formula_catalog(name,created_by) values(${`${code} formula [${societyId}]`},${creator}) returning id`;
      const [fv] = await tx`insert into pay_formula.formula_version(formula_id,expression_text,effective_from,created_by,status) values(${fc.id},${def.formula},${from},${creator},'active') returning id`;
      formulaRef = fv.id;
    }
    await tx`insert into pay_config.component_version(component_id,kind,calc_method,gl_symbolic_role,formula_ref,effective_from,created_by,status)
      values(${ids[code]},${def.kind},${def.method}::pay_core.calc_method,${code.toLowerCase()},${formulaRef},${from},${creator},'active')`;
  }
  // The defaults come from the DATED parameter table (lib/rules/epfEsi.ts) for TODAY — the one place a statutory number
  // changes. They are still only DEFAULTS, still unverified, and still the society's to confirm and edit (statutory-set).
  const today = new Date().toISOString().slice(0, 10);
  const seedRates: [string, number, string][] = [
    ['pf_rate', resolveParam('pf.employeeRate', today).value, 'PF employee contribution %'],
    ['employer_pf_rate', resolveParam('epf.employerRate', today).value, 'PF employer contribution % (EPS + EPF split)'],
    ['eps_rate', resolveParam('eps.rate', today).value, 'EPS (pension) contribution % of EPS wages'],
    ['edli_rate', resolveParam('edli.rate', today).value, 'EDLI contribution %'],
    ['eps_wage_ceiling', resolveParam('pf.wageCeiling', today).value, 'EPS / EDLI wage ceiling (₹, whole rupees)'],
  ];
  for (const [k, v, lbl] of seedRates) {
    await tx`insert into pay_config.statutory_setting(society_id,key,value_num,label,source,created_by)
      values(${societyId},${k},${v},${lbl},'Statutory default — confirm for your establishment',${creator})
      on conflict (society_id,key) do nothing`;
  }
  await syncSocietyFormulas(tx, societyId);   // bring any drifted formula text up to the code's definition
  return ids;
}

// The formula TEXT lives in the DB (one formula_version per society component) and is written once,
// at component creation. When a formula here in SFL is corrected — as PF was, to basic+DA per §6 — an
// existing society keeps its old text and quietly computes the old way. This re-points each component's
// active formula to the current SFL text where it has drifted. In place, because a corrected formula
// is not a new policy with its own date; runs already locked keep the amounts they stored. Idempotent:
// once the text matches, it is a no-op. Returns the codes that changed.
async function syncSocietyFormulas(tx: postgres.TransactionSql, societyId: string): Promise<string[]> {
  const changed: string[] = [];
  for (const [code, def] of Object.entries(COMPONENTS)) {
    if (def.method !== 'formula' || !def.formula) continue;
    const want = SFL[code];
    if (!want) continue;
    const rows = await tx`
      update pay_formula.formula_version fv
        set expression_text = ${want}
      from pay_config.component_catalog cc
      join pay_config.component_version cv on cv.component_id = cc.id and cv.status = 'active'
      where cc.society_id = ${societyId} and cc.code = ${code}
        and fv.id = cv.formula_ref and fv.expression_text is distinct from ${want}
      returning fv.id`;
    if (rows.length) changed.push(code);
  }
  return changed;
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
  if (mfaPending(jwt)) return json(403, { error: '2FA required — finish the 2FA step and sign in again' }, CORS);
  const { data: { user } } = await createClient(supaUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } }).auth.getUser();
  if (!user?.email) return json(401, { error: 'invalid session' }, CORS);

  let body: { action?: string; name?: string; code?: string; basicMinor?: number; type?: string; employeeId?: string; period?: string; lopDays?: number; key?: string; value?: number; label?: string; source?: string; uan?: string; pan?: string; esicIp?: string; principal?: number; installment?: number; purpose?: string; loanId?: string; dateOfJoin?: string; enabled?: boolean };
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
               -- P2: the TDS component on the open structure, if TDS is turned on for this employee (else null)
               (select cc.code from pay_config.structure_assignment sa
                  join pay_config.component_binding cb on cb.structure_version_id = sa.structure_version_id
                  join pay_config.component_catalog cc on cc.id = cb.component_id and (cc.code = 'TDS' or cc.code like 'TDS\_%')
                where sa.employee_id = e.id and sa.effective_to is null limit 1) as tds_code,
               (select ao.fixed_minor from pay_config.structure_assignment sa
                  join pay_config.assignment_override ao on ao.assignment_id = sa.id
                  join pay_config.component_catalog cc on cc.id = ao.component_id and cc.code in ('BASIC','CONSOLIDATED','DAILY_RATE','STIPEND')
                where sa.employee_id = e.id and sa.effective_to is null order by cc.code limit 1) as basic_minor,
               -- the day they left, and what they were on then, so a FORMER employee is still a
               -- record you can open — a service record is asked for exactly when someone leaves
               (select sa.effective_to from pay_config.structure_assignment sa
                where sa.employee_id = e.id order by sa.effective_from desc limit 1) as left_on,
               (select ao.fixed_minor from pay_config.structure_assignment sa
                  join pay_config.assignment_override ao on ao.assignment_id = sa.id
                  join pay_config.component_catalog cc on cc.id = ao.component_id and cc.code in ('BASIC','CONSOLIDATED','DAILY_RATE','STIPEND')
                where sa.employee_id = e.id order by sa.effective_from desc, cc.code limit 1) as last_basic_minor
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
      // The joining date is a FACT about this person that prints on their payslip and service record —
      // it must come from the caller, not a fixed epoch. Defaults to today when not supplied.
      const joinDate = (body.dateOfJoin ?? '').trim() || new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) return json(400, { error: 'dateOfJoin must be YYYY-MM-DD' }, CORS);
      if (joinDate > new Date().toISOString().slice(0, 10)) return json(400, { error: 'dateOfJoin cannot be in the future' }, CORS);

      const out = await sql.begin(async (tx: postgres.TransactionSql) => {
        const compIds = await ensureSocietyComponents(tx, societyId, su.id, rulesFloorFor(joinDate));
        await ensureEmploymentTypes(tx);
        const [dup] = await tx`select 1 from pay_core.employee where society_id = ${societyId} and employee_code = ${code} limit 1`;
        if (dup) throw new Error(`employee code '${code}' already exists`);
        const [emp] = await tx`insert into pay_core.employee(society_id,employee_code,full_name,date_of_join,employment_type,created_by)
          values(${societyId},${code},${L(name)},${joinDate},${type},${su.id}) returning id`;
        const { versionId, primaryComponentId, zeroComponentIds } = await createEmployeeStructure(tx, societyId, code, type, su.id, compIds);
        // the salary structure takes effect the day they join, not some fixed epoch
        const [asg] = await tx`insert into pay_config.structure_assignment(society_id,employee_id,structure_version_id,effective_from,created_by)
          values(${societyId},${emp.id},${versionId},${joinDate},${su.id}) returning id`;
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

    // Attendance for ONE period across the whole society: every employee who would be paid, with what
    // is recorded for them. An employee with NO row is paid a full 30 days by default — the caller
    // needs to see that, otherwise an unrecorded absence is silently paid in full.
    if (body.action === 'attendance-list') {
      if (!/^\d{4}-\d{2}$/.test(body.period ?? '')) return json(400, { error: 'period "YYYY-MM" required' }, CORS);
      // EXACTLY who pay-run will pay for this period — anyone whose assignment overlaps it, which
      // includes somebody who has since left. Selecting only open assignments (what this did) left a
      // leaver off the list for their FINAL month, the one month their absence still had to be
      // recorded, and made the run dialog's "no attendance recorded" warning count the wrong people.
      const pStart = `${body.period}-01`;
      const pEnd = `${body.period}-${String(new Date(Date.UTC(Number(body.period.slice(0, 4)), Number(body.period.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;
      const rows = await sql`
        select e.id, e.employee_code, e.full_name, e.employment_type, a.paid_days, a.lop_days
        from pay_core.employee e
        left join pay_calc.attendance a
          on a.employee_id = e.id and a.society_id = ${societyId} and a.period_month = ${pStart}
        where e.society_id = ${societyId} and e.date_of_join <= ${pEnd}
          and exists (select 1 from pay_config.structure_assignment sa
                      where sa.employee_id = e.id and sa.society_id = ${societyId}
                        and sa.effective_from <= ${pEnd}
                        and (sa.effective_to is null or sa.effective_to >= ${pStart}))
        order by e.employee_code`;
      return json(200, { period: body.period, attendance: rows }, CORS);
    }

    if (body.action === 'attendance') {
      const empId = body.employeeId ?? '';
      if (!/^\d{4}-\d{2}$/.test(body.period ?? '')) return json(400, { error: 'period "YYYY-MM" required' }, CORS);
      // Two ways in, because the two kinds of employee are counted differently in real life: a monthly
      // employee has DAYS ABSENT, a daily wager has DAYS WORKED. Sending paidDays is the latter.
      const byPaid = body.paidDays !== undefined && body.paidDays !== null && body.paidDays !== '';
      const lop = byPaid ? Math.max(0, 30 - Number(body.paidDays)) : Number(body.lopDays);
      if (byPaid && (!Number.isFinite(Number(body.paidDays)) || Number(body.paidDays) < 0 || Number(body.paidDays) > 31)) {
        return json(400, { error: 'paidDays must be 0–31' }, CORS);
      }
      if (!Number.isFinite(lop) || lop < 0 || lop > 31) return json(400, { error: 'lopDays must be 0–31' }, CORS);
      const periodMonth = `${body.period}-01`;
      const paid = byPaid ? Number(body.paidDays) : 30 - lop;
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
      // The open assignment for somebody still employed, the last one they held otherwise — a former
      // employee's record has to be readable, and an empty structure is not "no structure", it is a
      // question the caller cannot tell apart from still loading.
      const [asg] = await sql`select id from pay_config.structure_assignment
        where employee_id = ${empId} and society_id = ${societyId}
        order by (effective_to is null) desc, effective_from desc limit 1`;
      if (!asg) return json(200, { components: [], ended: null }, CORS);
      const rows = await sql`
        select cc.code, cc.display_name, cv.kind, cv.calc_method::text as calc_method,
               fv.expression_text, ao.fixed_minor, sa.effective_from
        from pay_config.structure_assignment sa
        join pay_config.component_binding cb on cb.structure_version_id = sa.structure_version_id
        join pay_config.component_catalog cc on cc.id = cb.component_id
        join lateral (select * from pay_config.component_version v where v.component_id = cc.id and v.status = 'active' order by v.effective_from desc limit 1) cv on true
        left join pay_formula.formula_version fv on fv.id = cv.formula_ref
        left join pay_config.assignment_override ao on ao.assignment_id = sa.id and ao.component_id = cc.id
        where sa.id = ${asg.id}
        order by cv.sequence, cc.code`;
      return json(200, { components: rows }, CORS);
    }

    // Add or remove ONE component from ONE employee's structure (see changeStructureComponent).
    if (body.action === 'structure-add' || body.action === 'structure-remove') {
      const empId = body.employeeId ?? '', code = (body.code ?? '').trim();
      const adding = body.action === 'structure-add';
      const valueMinor = Number.isFinite(Number(body.basicMinor)) ? Math.max(0, Number(body.basicMinor)) : 0;
      if (!COMPONENTS[code]) return json(400, { error: `unknown component '${code}'` }, CORS);
      const out = await sql.begin(async (tx: postgres.TransactionSql) => {
        const compIds = await ensureSocietyComponents(tx, societyId, su.id);
        return await changeStructureComponent(tx, societyId, empId, code, adding, compIds, su.id, valueMinor);
      });
      return json(200, { ok: true, employeeId: empId, code, action: body.action, versioned: out.versioned }, CORS);
    }

    // ── Staff advances / loans ──────────────────────────────────────────────────────────────
    if (body.action === 'loan-list') {
      const rows = await sql`select id, principal_minor, installment_minor, recovered_minor, purpose, status, started_on, closed_on
        from pay_calc.employee_loan where society_id = ${societyId} and employee_id = ${body.employeeId ?? ''}
        order by started_on desc, created_at desc`;
      return json(200, { loans: rows }, CORS);
    }

    // Record an advance and make sure the employee's structure carries the recovery line, so the very
    // next run starts recovering it. One ACTIVE loan per employee (DB partial unique index).
    if (body.action === 'loan-add') {
      const empId = body.employeeId ?? '';
      const principal = Number(body.principal), installment = Number(body.installment);
      if (!Number.isFinite(principal) || principal <= 0) return json(400, { error: 'principal must be a positive number (paise)' }, CORS);
      if (!Number.isFinite(installment) || installment <= 0) return json(400, { error: 'installment must be a positive number (paise)' }, CORS);
      if (installment > principal) return json(400, { error: 'installment cannot exceed the principal' }, CORS);
      const [owner] = await sql`select 1 from pay_core.employee where id = ${empId} and society_id = ${societyId} limit 1`;
      if (!owner) return json(404, { error: 'employee not found in your society' }, CORS);
      const out = await sql.begin(async (tx: postgres.TransactionSql) => {
        const [existing] = await tx`select 1 from pay_calc.employee_loan where employee_id = ${empId} and status = 'active' limit 1`;
        if (existing) throw new Error('this employee already has an active advance — close it before adding another');
        const [loan] = await tx`insert into pay_calc.employee_loan(society_id,employee_id,principal_minor,installment_minor,purpose,created_by)
          values(${societyId},${empId},${principal},${installment},${body.purpose ?? null},${su.id}) returning id`;
        const compIds = await ensureSocietyComponents(tx, societyId, su.id);
        const [bound] = await tx`select 1 from pay_config.component_binding cb
          join pay_config.structure_assignment sa on sa.structure_version_id = cb.structure_version_id
          where sa.employee_id = ${empId} and sa.effective_to is null and cb.component_id = ${compIds.LOAN_RECOVERY} limit 1`;
        if (!bound) await changeStructureComponent(tx, societyId, empId, 'LOAN_RECOVERY', true, compIds, su.id, 0);
        return { loanId: loan.id as string };
      });
      return json(200, { ok: true, loanId: out.loanId, employeeId: empId }, CORS);
    }

    // ── Salary TDS on / off for one employee (P2) ───────────────────────────────────────────────────────────────
    // Adds or removes the TDS component that fits the employee's structure. History-safe like every structure change:
    // the new structure applies from TODAY, so runs of past months stay exactly as they were. Admin only — it changes
    // what is withheld from a person's pay.
    if (body.action === 'tds-set') {
      if (su.role !== 'admin') return json(403, { error: 'only admin may turn salary TDS on or off' }, CORS);
      const empId = body.employeeId ?? '';
      const enable = body.enabled === true;
      const [emp] = await sql`select employment_type from pay_core.employee where id = ${empId} and society_id = ${societyId} limit 1`;
      if (!emp) return json(404, { error: 'employee not found in your society' }, CORS);
      const code = TDS_CODE_BY_TYPE[String(emp.employment_type)];
      if (!code) return json(400, { error: `TDS cannot be automated for '${emp.employment_type}' (daily-wage) — enter it by hand if it is ever due` }, CORS);
      const out = await sql.begin(async (tx: postgres.TransactionSql) => {
        const compIds = await ensureSocietyComponents(tx, societyId, su.id);
        const [bound] = await tx`select 1 from pay_config.component_binding cb
          join pay_config.structure_assignment sa on sa.structure_version_id = cb.structure_version_id
          where sa.employee_id = ${empId} and sa.effective_to is null and cb.component_id = ${compIds[code]} limit 1`;
        if (enable && !bound) await changeStructureComponent(tx, societyId, empId, code, true, compIds, su.id, 0);
        if (!enable && bound) await changeStructureComponent(tx, societyId, empId, code, false, compIds, su.id, 0);
        return { changed: enable ? !bound : !!bound };
      });
      // Say it NOW if the law for the current month is not verified — the run would refuse; better to know at the switch.
      let lawWarning: string | null = null;
      if (enable) { try { assertVerifiedLaw('new', `${new Date().toISOString().slice(0, 7)}-01`); } catch (e) { lawWarning = String((e as Error)?.message ?? e); } }
      return json(200, { ok: true, employeeId: empId, code, enabled: enable, changed: out.changed, lawWarning }, CORS);
    }

    if (body.action === 'loan-close') {
      const rows = await sql`update pay_calc.employee_loan set status = 'closed', closed_on = current_date, updated_at = now(), updated_by = ${su.id}
        where id = ${body.loanId ?? ''} and society_id = ${societyId} and status = 'active' returning id`;
      if (!rows.length) return json(404, { error: 'no active advance with that id' }, CORS);
      return json(200, { ok: true, loanId: body.loanId }, CORS);
    }

    // The employee's PAY HISTORY: every structure assignment they have ever held, newest first, with
    // the amounts that applied in that window. Nothing here is reconstructed — the timeline exists
    // because `structure-set` closes one assignment and opens the next instead of overwriting.
    if (body.action === 'history-get') {
      const empId = body.employeeId ?? '';
      const rows = await sql`
        select sa.id, sa.effective_from, sa.effective_to, sa.created_at,
               cc.code, cc.display_name, ao.fixed_minor
        from pay_config.structure_assignment sa
        left join pay_config.assignment_override ao on ao.assignment_id = sa.id
        left join pay_config.component_catalog cc on cc.id = ao.component_id
        where sa.employee_id = ${empId} and sa.society_id = ${societyId}
        order by sa.effective_from desc, sa.created_at desc, cc.code`;
      const byAsg = new Map<string, { id: string; from: unknown; to: unknown; values: unknown[] }>();
      for (const r of rows as Record<string, unknown>[]) {
        const id = String(r.id);
        if (!byAsg.has(id)) byAsg.set(id, { id, from: r.effective_from, to: r.effective_to, values: [] });
        if (r.code) byAsg.get(id)!.values.push({ code: r.code, name: r.display_name, minor: r.fixed_minor });
      }
      return json(200, { history: [...byAsg.values()] }, CORS);
    }

    // UNPIN: drop a pinned amount so the component goes back to being computed by its formula. The
    // counterpart to structure-set — without it, an admin who pins a formula component by mistake has
    // no way back except deleting and re-adding it. Same history rules as structure-set.
    if (body.action === 'structure-unset') {
      const empId = body.employeeId ?? '', code = (body.code ?? '').trim();
      if (!code) return json(400, { error: 'component code required' }, CORS);
      const out = await sql.begin(async (tx: postgres.TransactionSql) => {
        const [asg] = await tx`select id, structure_version_id, effective_from from pay_config.structure_assignment
          where employee_id = ${empId} and society_id = ${societyId} and effective_to is null limit 1`;
        if (!asg) throw new Error('no active salary structure for this employee');
        const [comp] = await tx`select cc.id, cv.calc_method::text as calc_method from pay_config.component_catalog cc
          join pay_config.component_binding cb on cb.component_id = cc.id and cb.structure_version_id = ${asg.structure_version_id}
          join lateral (select * from pay_config.component_version v where v.component_id = cc.id and v.status = 'active' order by v.effective_from desc limit 1) cv on true
          where cc.society_id = ${societyId} and cc.code = ${code} limit 1`;
        if (!comp) throw new Error(`component '${code}' is not in this employee's structure`);
        // a 'fixed' component has no formula to fall back to — it must keep an amount
        if (String(comp.calc_method) === 'fixed') throw new Error(`'${code}' has no formula — it needs an amount. Edit it instead, or remove the component.`);
        const [{ same }] = await tx`select (${asg.effective_from}::date >= current_date) as same`;
        if (same) {
          await tx`delete from pay_config.assignment_override where assignment_id = ${asg.id} and component_id = ${comp.id}`;
          return { versioned: false };
        }
        await tx`update pay_config.structure_assignment set effective_to = current_date, updated_at = now(), updated_by = ${su.id} where id = ${asg.id}`;
        const [nw] = await tx`insert into pay_config.structure_assignment(society_id,employee_id,structure_version_id,effective_from,created_by)
          values(${societyId},${empId},${asg.structure_version_id},current_date,${su.id}) returning id`;
        await tx`insert into pay_config.assignment_override(assignment_id,component_id,fixed_minor,fixed_currency,override_formula_ref,reason,created_by)
          select ${nw.id}, ao.component_id, ao.fixed_minor, coalesce(ao.fixed_currency,'INR'), ao.override_formula_ref, 'carried forward', ${su.id}
          from pay_config.assignment_override ao
          where ao.assignment_id = ${asg.id} and ao.component_id <> ${comp.id}`;
        return { versioned: true };
      });
      return json(200, { ok: true, employeeId: empId, code, unpinned: true, versioned: out.versioned }, CORS);
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
      const [owner] = await sql`select date_of_join from pay_core.employee where id = ${empId} and society_id = ${societyId} limit 1`;
      if (!owner) return json(404, { error: 'employee not found in your society' }, CORS);
      // The LAST WORKING DAY, because pay-run pays for the days served up to it — leaving it at
      // "today" over-pays anyone whose removal is recorded late and under-pays one recorded early.
      const last = (body.lastDay ?? '').trim();
      if (last) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) return json(400, { error: 'lastDay must be YYYY-MM-DD' }, CORS);
        const doj = String(owner.date_of_join instanceof Date
          ? owner.date_of_join.toLocaleDateString('en-CA') : owner.date_of_join).slice(0, 10);
        if (last < doj) return json(400, { error: `last working day cannot be before the joining date (${doj})` }, CORS);
        if (Date.parse(`${last}T00:00:00Z`) > Date.now()) return json(400, { error: 'last working day cannot be in the future' }, CORS);
      }
      // An assignment must END after it BEGAN (assignment_eff_ck: effective_to > effective_from). A structure change —
      // turning TDS on, adding an advance, editing a component — starts a new assignment TODAY, so ending it today (or
      // earlier) cannot be stored. Say so plainly instead of surfacing a raw constraint error as a 500.
      const [open] = await sql`select effective_from::text as f from pay_config.structure_assignment
        where employee_id = ${empId} and society_id = ${societyId} and effective_to is null limit 1`;
      const endsOn = last || new Date().toISOString().slice(0, 10);
      if (open && endsOn <= String(open.f).slice(0, 10)) {
        return json(409, {
          error: `इस कर्मचारी की वेतन-संरचना ${String(open.f).slice(0, 10)} को बदली गई है, इसलिए आख़िरी कार्य-दिवस उससे बाद का होना चाहिए — कल फिर कोशिश करें। / The salary structure was changed on ${String(open.f).slice(0, 10)}; the last working day must be after it — try again tomorrow.`,
          code: 'PAY-EMP-SAMEDAY', structureChangedOn: String(open.f).slice(0, 10),
        }, CORS);
      }
      // end the active assignment → paid up to that day, out of every run after it
      const rows = last
        ? await sql`update pay_config.structure_assignment set effective_to = ${last}::date, updated_at = now(), updated_by = ${su.id}
            where employee_id = ${empId} and society_id = ${societyId} and effective_to is null returning id`
        : await sql`update pay_config.structure_assignment set effective_to = current_date, updated_at = now(), updated_by = ${su.id}
            where employee_id = ${empId} and society_id = ${societyId} and effective_to is null returning id`;
      return json(200, { ok: true, employeeId: empId, ended: rows.length, lastDay: last || null }, CORS);
    }

    // Correct a joining date. Every employee added before this shipped carries a hard-coded epoch,
    // which is wrong on their payslip and service record — this is how those get fixed. Only the
    // employee FACT moves; the salary-assignment timeline is a different thing and is left alone.
    if (body.action === 'joining-set') {
      const empId = body.employeeId ?? '', d = (body.dateOfJoin ?? '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json(400, { error: 'dateOfJoin must be YYYY-MM-DD' }, CORS);
      if (d > new Date().toISOString().slice(0, 10)) return json(400, { error: 'dateOfJoin cannot be in the future' }, CORS);
      const rows = await sql`update pay_core.employee set date_of_join = ${d}, updated_at = now(), updated_by = ${su.id}
        where id = ${empId} and society_id = ${societyId} returning id`;
      if (!rows.length) return json(404, { error: 'employee not found in your society' }, CORS);
      return json(200, { ok: true, employeeId: empId, dateOfJoin: d }, CORS);
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

    // Bring this society's stored formula text up to the current code definition (e.g. the PF base
    // becoming basic+DA). Admin-only; idempotent — returns which formulas actually changed.
    if (body.action === 'sync-formulas') {
      if (su.role !== 'admin') return json(403, { error: 'only admin may sync statutory formulas' }, CORS);
      const changed = await sql.begin(async (tx: postgres.TransactionSql) => {
        // sync FIRST so the drift it heals is what gets reported — ensureSocietyComponents also
        // self-heals internally, so running it first would leave nothing for this call to report.
        const c = await syncSocietyFormulas(tx, societyId);
        await ensureSocietyComponents(tx, societyId, su.id);   // create any components not yet present
        return c;
      });
      return json(200, { ok: true, changed }, CORS);
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

    return json(400, { error: "action must be 'list' / 'add' / 'attendance' / 'attendance-list' / 'update' / 'deactivate' / 'identity-set' / 'joining-set' / 'structure-get' / 'structure-set' / 'structure-unset' / 'structure-add' / 'structure-remove' / 'history-get' / 'loan-list' / 'loan-add' / 'loan-close' / 'statutory-list' / 'statutory-set' / 'sync-formulas'" }, CORS);
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) }, CORS);
  } finally {
    await sql.end();
  }
});

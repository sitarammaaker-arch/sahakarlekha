-- =====================================================================================
-- Migration 113 — Platform seed data (reference taxonomies, standard components, skeletons)
-- -------------------------------------------------------------------------------------
-- PURPOSE      : Platform-owned rows that every tenant inherits (society_id NULL / reference).
--                NB: statutory RULE VALUES are seeded as SKELETONS with verified=false — the
--                actual dated rates MUST be attached with a real rule_source (Act/circular URL)
--                and flipped to verified=true only under a named human''s sign-off (Phase 5).
--                Seeding a "verified" rate from memory is FORBIDDEN (the 194Q lesson).
-- DEPENDENCIES : 100-108. Idempotent (on conflict do nothing).
-- ROLLBACK     : 999.
-- =====================================================================================

set search_path = pay_core, pay_config, pay_rule, pay_formula, pay_policy, public;

-- ── Component kinds ──────────────────────────────────────────────────────────────────
insert into pay_core.component_kind(code,label,affects_gross,is_system) values
 ('earning',          '{"hi":"आय","en":"Earning"}',                true,  true),
 ('deduction',        '{"hi":"कटौती","en":"Deduction"}',           true,  true),
 ('employer_contrib', '{"hi":"नियोक्ता अंशदान","en":"Employer Contribution"}', false, true),
 ('reimbursement',    '{"hi":"प्रतिपूर्ति","en":"Reimbursement"}', false, true),
 ('arrear',           '{"hi":"बकाया","en":"Arrear"}',              true,  true),
 ('loan_recovery',    '{"hi":"ऋण वसूली","en":"Loan Recovery"}',    false, true),
 ('terminal_benefit', '{"hi":"सेवांत लाभ","en":"Terminal Benefit"}', true, true)
on conflict do nothing;

-- ── Statutory heads (open; new head = a row) ─────────────────────────────────────────
insert into pay_core.statutory_head(code,label,liability_symbolic,is_employer_cost,is_system) values
 ('pf',          '{"hi":"भविष्य निधि","en":"Provident Fund"}',     'pf.payable',   true,  true),
 ('esi',         '{"hi":"ईएसआई","en":"ESI"}',                       'esi.payable',  true,  true),
 ('pt',          '{"hi":"वृत्ति कर","en":"Professional Tax"}',      'pt.payable',   false, true),
 ('tds',         '{"hi":"टीडीएस","en":"TDS (s.192)"}',              'tds.payable',  false, true),
 ('nps',         '{"hi":"एनपीएस","en":"NPS"}',                      'nps.payable',  true,  true),
 ('gpf',         '{"hi":"जीपीएफ","en":"GPF"}',                      'gpf.payable',  false, true),
 ('gis',         '{"hi":"जीआईएस","en":"GIS"}',                      'gis.payable',  false, true),
 ('bonus',       '{"hi":"बोनस","en":"Bonus"}',                      'bonus.payable',false, true),
 ('gratuity',    '{"hi":"उपदान","en":"Gratuity"}',                  'gratuity.payable', true, true),
 ('leave_encash','{"hi":"अवकाश नकदीकरण","en":"Leave Encashment"}',  'leave_encash.payable', false, true),
 ('lwf',         '{"hi":"श्रम कल्याण निधि","en":"Labour Welfare Fund"}','lwf.payable', false, true)
on conflict do nothing;

-- ── Payment modes / employment types / event types / return forms ────────────────────
insert into pay_core.payment_mode(code,label) values
 ('cash','{"hi":"नकद","en":"Cash"}'),('bank','{"hi":"बैंक","en":"Bank"}'),
 ('cheque','{"hi":"चेक","en":"Cheque"}'),('nach','{"hi":"नैच","en":"NACH"}'),
 ('treasury','{"hi":"कोषागार","en":"Treasury"}') on conflict do nothing;

insert into pay_core.employment_type(code,label) values
 ('permanent','{"hi":"स्थायी","en":"Permanent"}'),('contract','{"hi":"संविदा","en":"Contract"}'),
 ('muster','{"hi":"मस्टर श्रमिक","en":"Muster Labour"}'),('deputation','{"hi":"प्रतिनियुक्ति","en":"Deputation"}'),
 ('honorary','{"hi":"मानद","en":"Honorary"}') on conflict do nothing;

insert into pay_core.employment_event_type(code,label,is_terminal) values
 ('join','{"hi":"नियुक्ति","en":"Join"}',false),('confirm','{"hi":"पुष्टि","en":"Confirm"}',false),
 ('promote','{"hi":"पदोन्नति","en":"Promote"}',false),('transfer','{"hi":"स्थानांतरण","en":"Transfer"}',false),
 ('deputation_start','{"hi":"प्रतिनियुक्ति आरंभ","en":"Deputation Start"}',false),
 ('deputation_end','{"hi":"प्रतिनियुक्ति समाप्त","en":"Deputation End"}',false),
 ('suspend','{"hi":"निलंबन","en":"Suspend"}',false),('reinstate','{"hi":"बहाली","en":"Reinstate"}',false),
 ('retire','{"hi":"सेवानिवृत्ति","en":"Retire"}',true),('resign','{"hi":"त्यागपत्र","en":"Resign"}',true),
 ('terminate','{"hi":"समाप्ति","en":"Terminate"}',true),('death','{"hi":"मृत्यु","en":"Death"}',true)
on conflict do nothing;

insert into pay_core.return_form(code,label,statutory_head_code) values
 ('24Q','{"hi":"फॉर्म 24Q","en":"Form 24Q"}','tds'),
 ('ecr','{"hi":"ईपीएफ ईसीआर","en":"EPF ECR"}','pf'),
 ('esic','{"hi":"ईएसआईसी रिटर्न","en":"ESIC Return"}','esi'),
 ('pt','{"hi":"पीटी रिटर्न","en":"PT Return"}','pt'),
 ('form16','{"hi":"फॉर्म 16","en":"Form 16"}','tds'),
 ('form16a','{"hi":"फॉर्म 16A","en":"Form 16A"}','tds') on conflict do nothing;

-- ── Platform-standard pay components (society_id NULL) ───────────────────────────────
-- Seeds catalog + an initial active version. gl_symbolic_role feeds the posting binding (Phase 5).
do $$
declare v_sys uuid := '00000000-0000-0000-0000-000000000000';
declare c record; cid uuid;
begin
  for c in select * from (values
     ('BASIC','{"hi":"मूल वेतन","en":"Basic Pay"}','earning','fixed','salary.expense',true,true,true,true,true,10),
     -- DA/HRA are formula-driven, but their active formula_version is authored in Phase 6.
     -- Seed them as 'fixed' placeholders (a 'formula' method requires a non-null formula_ref,
     -- per constraint compver_formula_ck). Phase 6 supersedes with method='formula' + a real ref.
     ('DA',   '{"hi":"महंगाई भत्ता","en":"Dearness Allowance"}','earning','fixed','salary.expense',true,true,true,true,true,20),
     ('HRA',  '{"hi":"मकान किराया भत्ता","en":"House Rent Allowance"}','earning','fixed','salary.expense',false,true,false,false,false,30),
     ('PF_EE','{"hi":"पीएफ (कर्मचारी)","en":"PF (Employee)"}','deduction','rule','pf.payable',false,false,false,false,false,110),
     ('PF_ER','{"hi":"पीएफ (नियोक्ता)","en":"PF (Employer)"}','employer_contrib','rule','pf.employer.expense',false,false,false,false,false,120),
     ('ESI_EE','{"hi":"ईएसआई (कर्मचारी)","en":"ESI (Employee)"}','deduction','rule','esi.payable',false,false,false,false,false,130),
     ('PT',   '{"hi":"वृत्ति कर","en":"Professional Tax"}','deduction','rule','pt.payable',false,false,false,false,false,140),
     ('TDS',  '{"hi":"टीडीएस","en":"TDS (s.192)"}','deduction','rule','tds.payable',false,false,false,false,false,150)
   ) as t(code,label,kind,method,gl,pf,esi,pt,grat,bonus,seq)
  loop
    insert into pay_config.component_catalog(id,society_id,code,display_name,is_system,created_by)
      values (gen_random_uuid(), null, c.code, c.label::jsonb, true, v_sys)
      on conflict do nothing
      returning id into cid;
    if cid is null then select id into cid from pay_config.component_catalog where society_id is null and code=c.code; end if;
    insert into pay_config.component_version(id,component_id,kind,calc_method,taxability,
        pf_wage,esi_wage,pt_base,gratuity_base,bonus_base,gl_symbolic_role,sequence,
        version,effective_from,status,created_by)
      values (gen_random_uuid(), cid, c.kind, c.method::pay_core.calc_method, 'taxable',
              c.pf, c.esi, c.pt, c.grat, c.bonus, c.gl, c.seq, 1, '2026-04-01', 'active', v_sys)
      on conflict do nothing;
  end loop;
end$$;

-- ── Rule catalog keys (values attached with SOURCES in Phase 5) ──────────────────────
insert into pay_rule.rule_catalog(key,kind,display_name) values
 ('pf.rate.employee','rate','{"hi":"पीएफ दर (कर्मचारी)","en":"PF rate (employee)"}'),
 ('pf.rate.employer','rate','{"hi":"पीएफ दर (नियोक्ता)","en":"PF rate (employer)"}'),
 ('pf.wage.ceiling','threshold','{"hi":"पीएफ वेतन सीमा","en":"PF wage ceiling"}'),
 ('esi.rate.employee','rate','{"hi":"ईएसआई दर (कर्मचारी)","en":"ESI rate (employee)"}'),
 ('esi.rate.employer','rate','{"hi":"ईएसआई दर (नियोक्ता)","en":"ESI rate (employer)"}'),
 ('esi.gross.threshold','threshold','{"hi":"ईएसआई पात्रता सीमा","en":"ESI eligibility threshold"}'),
 ('pt.slab','slab','{"hi":"वृत्ति कर स्लैब","en":"Professional Tax slab"}'),
 ('tds.slab','slab','{"hi":"आयकर स्लैब","en":"Income-tax slab"}'),
 ('gratuity.formula','entitlement','{"hi":"उपदान सूत्र","en":"Gratuity formula"}')
on conflict do nothing;

-- ── Formula skeletons (society_id NULL; expressions validated & filled in Phase 5) ──
insert into pay_formula.formula_catalog(id,society_id,name,purpose,is_system,created_by) values
 (gen_random_uuid(),null,'DA_STANDARD','DA = da_rate() * BASIC',true,'00000000-0000-0000-0000-000000000000'),
 (gen_random_uuid(),null,'HRA_CITY','HRA = hra_pct(city) * BASIC',true,'00000000-0000-0000-0000-000000000000'),
 (gen_random_uuid(),null,'GRATUITY_15_26','Gratuity = round(15/26 * last_basic_da * years)',true,'00000000-0000-0000-0000-000000000000')
on conflict do nothing;

-- ── Org templates (registry only; bindings populated in Phase 5) ─────────────────────
insert into pay_config.template_registry(kind,code,display_name,jurisdiction) values
 ('org','central_govt','{"hi":"केंद्र सरकार","en":"Central Government"}','IN'),
 ('org','state_govt','{"hi":"राज्य सरकार","en":"State Government"}','IN'),
 ('org','pacs','{"hi":"पैक्स","en":"PACS"}','IN'),
 ('org','marketing_society','{"hi":"विपणन समिति","en":"Marketing Society"}','IN'),
 ('org','housing_society','{"hi":"आवास समिति","en":"Housing Society"}','IN'),
 ('org','private_company','{"hi":"निजी कंपनी","en":"Private Company"}','IN'),
 ('org','bank','{"hi":"बैंक","en":"Bank"}','IN'),
 ('org','university','{"hi":"विश्वविद्यालय","en":"University"}','IN'),
 ('org','ngo','{"hi":"एनजीओ","en":"NGO"}','IN')
on conflict do nothing;

// Plan-gated features (founder 2026-11-11): Payroll + Member Portal on Plus/Pro, Multi-Branch + consolidation on Pro.
// One list (src/lib/plans.ts PLAN_FEATURES) — this proves the app, the server (migration 161), the Member Portal
// gate and the pricing page all say the same thing.
// Run: node scripts/test-plan-features.mjs   (npm run test:plan-features)
import { readFileSync } from 'node:fs';
import { PLAN_FEATURES, planAllows, minPlanFor, PLAN_FEATURE_LABEL } from '../src/lib/plans.ts';
import { portalPlanAllowed } from '../src/lib/memberPortalHandout.ts';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (sql) => sql.replace(/--[^\n]*/g, '');
const ALL = ['starter', 'plus', 'pro', 'enterprise', 'legacy', 'trial'];

// ── 1. The rule ──────────────────────────────────────────────────────────────
ok(!planAllows('starter', 'payroll') && planAllows('plus', 'payroll') && planAllows('pro', 'payroll'), 'payroll: Plus and Pro, not Starter');
ok(!planAllows('starter', 'multiBranch') && !planAllows('plus', 'multiBranch') && planAllows('pro', 'multiBranch'), 'multi-branch: Pro only');
ok(!planAllows('starter', 'consolidation') && !planAllows('plus', 'consolidation') && planAllows('pro', 'consolidation'), 'consolidation: Pro only');
ok(!planAllows('starter', 'memberPortal') && planAllows('plus', 'memberPortal') && planAllows('pro', 'memberPortal'), 'member portal: Plus and Pro');
for (const f of Object.keys(PLAN_FEATURES)) {
  ok(['enterprise', 'legacy', 'trial'].every((p) => planAllows(p, f)), `${f}: enterprise, legacy and trial keep it`);
  ok(planAllows(undefined, f) && planAllows(null, f), `${f}: no plan read yet → allowed (never stricter)`);
  ok(PLAN_FEATURES[f].every((p) => ALL.includes(p)), `${f}: only known plans`);
  ok(PLAN_FEATURE_LABEL[f] && PLAN_FEATURE_LABEL[f].hi && PLAN_FEATURE_LABEL[f].en, `${f}: has a Hindi + English label`);
}
ok(minPlanFor('payroll') === 'plus' && minPlanFor('memberPortal') === 'plus' && minPlanFor('multiBranch') === 'pro' && minPlanFor('consolidation') === 'pro', 'the upgrade notice asks for the cheapest plan that has it');
// The Member Portal's own gate (064 mirror) agrees with PLAN_FEATURES for every plan.
ok(ALL.every((p) => portalPlanAllowed(p, 'active') === planAllows(p, 'memberPortal')), 'memberPortalHandout.portalPlanAllowed matches PLAN_FEATURES.memberPortal');

// ── 2. Migration 161 lists the same plans ────────────────────────────────────
{
  const up = read('supabase/migrations/161_plan_feature_gates.sql');
  const down = read('supabase/migrations/161_plan_feature_gates_down.sql');
  const c = code(up);
  for (const [f, plans] of Object.entries(PLAN_FEATURES)) {
    const m = c.match(new RegExp(`when '${f}'\\s+then v_plan in \\(([^)]*)\\)`));
    const sqlPlans = m ? m[1].split(',').map((x) => x.trim().replace(/'/g, '')).sort() : [];
    ok(JSON.stringify(sqlPlans) === JSON.stringify([...plans].sort()), `161 plan_allows('${f}') = PLAN_FEATURES (${sqlPlans.join(',')})`);
  }
  ok(/if not found then return true; end if;/.test(c) && /else false/.test(c), 'no subscription row → allowed; an unknown feature → refused');
  ok(/before insert on pay_core\.employee/.test(c) && /before insert on pay_calc\.payroll_run/.test(c), 'server refuses a new payroll employee and a new payroll run');
  ok(!/before (insert|update|delete)[^;]*on public\.(employees|salary_records|branches)/.test(c), 'no trigger on the tables backup restore writes (stated in the header)');
  ok(!/before update|before delete/.test(c), 'INSERT only — existing payroll rows stay editable');
  ok(/plan_allows\(new\.society_id::text, 'payroll'\)/.test(c), 'the trigger reads the row\'s own society (uuid cast to text)');
  ok(/revoke execute on function public\.plan_allows\(text, text\) from public, anon;/.test(c) && /revoke execute on function public\.tg_require_plan_payroll\(\) from public, anon, authenticated;/.test(c), 'no anonymous execution');
  ok(/values \('161', 'plan_feature_gates'\)/.test(c) && /delete from public\.app_migrations where version = '161'/.test(down), '161 ledger insert / down delete');
  ok(/drop trigger if exists trg_plan_payroll on pay_core\.employee;/.test(down) && /drop function if exists public\.plan_allows\(text, text\);/.test(down), 'down removes triggers and functions');
}

// ── 3. App wiring ────────────────────────────────────────────────────────────
{
  const cat = read('src/lib/navigation/moduleCatalog.ts');
  const tag = (route, f) => new RegExp(`route: '${route.replace(/\//g, '\\/')}',[^\\n]*requiredPlanFeature: '${f}'`).test(cat);
  ok(tag('/salary', 'payroll') && tag('/payroll', 'payroll'), 'both salary pages are tagged payroll');
  ok(tag('/branches', 'multiBranch') && tag('/multi-society-consolidation', 'consolidation'), 'branches and consolidation are tagged');
  ok((cat.match(/requiredPlanFeature: '/g) || []).length === 4, 'exactly four modules are plan-gated');

  const guard = read('src/components/CapabilityGuard.tsx');
  ok(/const planFeature = module\?\.requiredPlanFeature;/.test(guard) && /!isSuperAdmin && !planLoading && !planAllows\(plan, planFeature\)/.test(guard) && /<PlanUpgradeNotice feature=\{planFeature\} \/>/.test(guard), 'route guard shows the upgrade notice (not while loading, not for super-admin)');

  const dc = read('src/contexts/DataContext.tsx');
  ok(/const guardPlanFeature = useCallback\(\(feature: PlanFeature\): boolean => \{/.test(dc) && /if \(planAllows\(plan, feature\)\) return false;/.test(dc), 'DataContext has the plan guard');
  const startOf = (name) => dc.indexOf(`const ${name} = useCallback(`);
  const firstLines = (name) => dc.slice(startOf(name), startOf(name) + 400);
  ok(/guardPlanFeature\('multiBranch'\)/.test(firstLines('addBranch')), 'addBranch refuses before its optimistic update');
  ok(/guardPlanFeature\('payroll'\)/.test(firstLines('addEmployee')) && /guardPlanFeature\('payroll'\)/.test(firstLines('addSalaryRecord')), 'addEmployee and addSalaryRecord refuse before their optimistic update');
  for (const n of ['addBranch', 'addEmployee', 'addSalaryRecord']) {
    const body = dc.slice(startOf(n), startOf(n) + 6000);
    const firstChange = body.search(/set[A-Z][A-Za-z]*State\(|Ref\.current = \[/);
    ok(firstChange > 0 && body.indexOf('guardPlanFeature(') > 0 && body.indexOf('guardPlanFeature(') < firstChange, `${n}: the plan check comes before any local state change (RULE 1)`);
  }

  const hub = read('src/pages/NavHub.tsx');
  ok(/planNeeded\(m\.requiredPlanFeature\)/.test(hub), 'hub cards show which plan a locked page needs');

  const notice = read('src/components/PlanUpgradeNotice.tsx');
  ok(/to="\/user-management"/.test(notice) && /minPlanFor\(feature\)/.test(notice) && /PLAN_CATALOG\[need\]\.price/.test(notice), 'the notice names the plan and its price from the catalogue and links to where it is bought');
}

// ── 4. The pricing page says the same thing ──────────────────────────────────
{
  const pr = read('src/pages/Pricing.tsx');
  const row = (label) => { const m = pr.match(new RegExp(`feature: '${label}[^']*', starter: (true|false), plus: (true|false), pro: (true|false)`)); return m ? m.slice(1).map((x) => x === 'true') : null; };
  const want = (f) => ['starter', 'plus', 'pro'].map((p) => planAllows(p, f));
  ok(JSON.stringify(row('वेतन \\(Payroll\\)')) ===JSON.stringify(want('payroll')), 'comparison: वेतन (Payroll) row matches PLAN_FEATURES');
  ok(JSON.stringify(row('Member Portal')) === JSON.stringify(want('memberPortal')), 'comparison: Member Portal row matches');
  ok(JSON.stringify(row('Multi-Branch')) === JSON.stringify(want('multiBranch')), 'comparison: Multi-Branch row matches');
  ok(JSON.stringify(row('कई समितियों की संयुक्त रिपोर्ट')) === JSON.stringify(want('consolidation')), 'comparison: consolidation row matches');
  ok(!/Payroll · Multi-Branch/.test(pr) && !/payroll व multi-branch हर plan/.test(pr), 'no leftover "payroll / branches on every plan" claim');
}

console.log(`plan-features: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

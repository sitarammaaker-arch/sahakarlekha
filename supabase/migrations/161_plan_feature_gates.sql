-- 161 · Payroll is a Plus / Pro feature — enforced by the database too (2026-11-11).
--
-- WHY: founder 2026-11-11 — features now differ by plan:
--     payroll        Plus, Pro (and enterprise / legacy / trial)
--     multi-branch   Pro       (and enterprise / legacy / trial)
--     consolidation  Pro       (and enterprise / legacy / trial)
--   The app shows an upgrade notice instead of those pages and refuses the save (src/lib/plans.ts
--   PLAN_FEATURES). This migration adds the server half for the payroll engine, whose writes go through the
--   pay-* Edge Functions on a direct database connection: a new payroll employee or a new payroll run is
--   refused for a plan without payroll. No Edge Function needs a redeploy — the trigger sits under them.
-- NOT here (stated, not hidden):
--   • the older salary pages (public.employees / public.salary_records) and branches (public.branches) are
--     gated in the app only. Their rows are also written by backup RESTORE through the same client, and a
--     trigger would make a Starter society's restore of an older backup fail half-way.
--   • consolidation merges uploaded backup files in the browser; there is no server write to gate.
-- RULE (mirrors PLAN_FEATURES — scripts/test-plan-features.mjs compares the lists):
--   no subscriptions row → allowed (never stricter than before billing existed); otherwise the plan must be
--   in the feature's list. INSERT only: existing payroll rows stay editable, so nothing already entered is
--   trapped.
-- Undo: 161_plan_feature_gates_down.sql.

begin;

create or replace function public.plan_allows(p_society_id text, p_feature text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_plan text;
begin
  select plan into v_plan from public.subscriptions where society_id = p_society_id;
  if not found then return true; end if;
  return case p_feature
    when 'payroll'       then v_plan in ('plus', 'pro', 'enterprise', 'legacy', 'trial')
    when 'multiBranch'   then v_plan in ('pro', 'enterprise', 'legacy', 'trial')
    when 'consolidation' then v_plan in ('pro', 'enterprise', 'legacy', 'trial')
    when 'memberPortal'  then v_plan in ('plus', 'pro', 'enterprise', 'legacy', 'trial')
    else false
  end;
end;
$$;

revoke execute on function public.plan_allows(text, text) from public, anon;
grant execute on function public.plan_allows(text, text) to authenticated, service_role;

create or replace function public.tg_require_plan_payroll()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.plan_allows(new.society_id::text, 'payroll') then
    raise exception 'Payroll आपके plan में शामिल नहीं है — Plus या Pro plan लें (User Management) / Payroll is part of the Plus and Pro plans'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_require_plan_payroll() from public, anon, authenticated;

drop trigger if exists trg_plan_payroll on pay_core.employee;
create trigger trg_plan_payroll
  before insert on pay_core.employee
  for each row execute function public.tg_require_plan_payroll();

drop trigger if exists trg_plan_payroll on pay_calc.payroll_run;
create trigger trg_plan_payroll
  before insert on pay_calc.payroll_run
  for each row execute function public.tg_require_plan_payroll();

insert into public.app_migrations (version, name) values ('161', 'plan_feature_gates')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: fn = true | triggers = 2 | anon_exec = false | mig = 1 | legacy_ok = true | starter_no = false):
--   select (select count(*) = 1 from pg_proc where proname = 'plan_allows') as fn,
--          (select count(*) from pg_trigger where tgname = 'trg_plan_payroll' and not tgisinternal) as triggers,
--          has_function_privilege('anon', 'public.plan_allows(text, text)', 'execute') as anon_exec,
--          (select count(*) from public.app_migrations where version = '161') as mig,
--          public.plan_allows('no-such-society', 'payroll') as legacy_ok,
--          (select bool_and(public.plan_allows(society_id, 'payroll')) from public.subscriptions where plan = 'starter') is not true as starter_no;

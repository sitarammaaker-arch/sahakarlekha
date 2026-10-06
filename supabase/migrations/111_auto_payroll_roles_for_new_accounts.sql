-- 111 · a NEW society's standard payroll accounts get their payroll role automatically (R4 follow-up).
--
-- WHY: Payroll books ONLY through the posting service and finds its heads in public.account_roles
-- (salary.expense, salary.payable, pf.payable, esi.payable, tds.payable, professional_tax.payable,
-- employee.advance). account_roles was seeded once, by hand (M1-4c) — a society registered afterwards has
-- NO roles, so its first Payroll run is refused ("no ledger head for …"), and the app has no screen to map
-- one (roles are mapped by seed scripts only). Found on prod 2026-10-06: three societies created after the
-- first seed had none of the six payroll roles.
--
-- WHAT: after an account row is INSERTED, IF it is exactly one of the seven standard payroll accounts —
-- same id AND same name AND same type — add the matching role for that society (never overwrite one that
-- is already mapped). Exactly the rule used by hand on 2026-10-06, so it is certain, never a guess:
--   - an account that has the standard id but a different name is NOT mapped (e.g. 2207 is "Property Tax
--     Payable" in the housing chart — mapping it as professional tax would book salary PT into property tax);
--   - an account with an app-generated (UUID) id is NOT mapped (a society that made its own "Salary Payable A/c"
--     keeps a choice that only a person can make);
--   - group accounts are not mapped.
--
-- DELIBERATELY NOT HERE: a backfill. Existing societies were filled by hand and the remaining gaps are
-- decisions (duplicate accounts, no account at all). Also not here: the non-payroll roles (cash, bank, GST …) —
-- a separate decision; this trigger only ever writes the seven payroll roles.
--
-- Idempotent. Undo: 111_auto_payroll_roles_for_new_accounts_down.sql (rows it wrote stay — they are valid).

begin;

create or replace function public.tg_payroll_role_for_new_account()
returns trigger language plpgsql security definer
set search_path = public as $fn$
declare r text;
begin
  if coalesce(new."isGroup", false) then return new; end if;
  r := case
    when new.id = '5201' and new.name = 'Salary'                   and new.type = 'expense'   then 'salary.expense'
    when new.id = '2103' and new.name = 'Salary Payable'           and new.type = 'liability' then 'salary.payable'
    when new.id = '2203' and new.name = 'EPF Payable'              and new.type = 'liability' then 'pf.payable'
    when new.id = '2204' and new.name = 'ESI Payable'              and new.type = 'liability' then 'esi.payable'
    when new.id = '2202' and new.name = 'TDS Payable'              and new.type = 'liability' then 'tds.payable'
    when new.id = '2207' and new.name = 'Professional Tax Payable' and new.type = 'liability' then 'professional_tax.payable'
    when new.id = '3315' and new.name = 'Advance to Employees'     and new.type = 'asset'     then 'employee.advance'
    else null
  end;
  if r is null then return new; end if;
  insert into public.account_roles (society_id, role, account_id, updated_by, updated_at)
  values (new.society_id::text, r, new.id, 'auto (migration 111)', now())
  on conflict (society_id, role) do nothing;
  return new;
end;
$fn$;
revoke execute on function public.tg_payroll_role_for_new_account() from public, anon, authenticated;

drop trigger if exists trg_payroll_role_for_new_account on public.accounts;
create trigger trg_payroll_role_for_new_account
  after insert on public.accounts
  for each row execute function public.tg_payroll_role_for_new_account();

insert into public.app_migrations (version, name) values ('111', 'auto_payroll_roles_for_new_accounts')
  on conflict (version) do nothing;

commit;

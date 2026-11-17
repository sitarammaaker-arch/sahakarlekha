-- 175 · one salary path per month (audit PAY-02, 2026-11-17).
--
-- A society can book salary two ways: the Salary page (public.salary_records, each slip posts its own
-- accrual voucher) and Payroll (pay_calc.payroll_run, posted by the pay-post Edge Function). Nothing
-- stopped both for the same month, and it has happened: a practice society has one month (October 2026)
-- expensed through BOTH (payroll run accrual + four slip accruals).
--
-- This migration adds the database half of the rule "one month, one path":
--   salary_records BEFORE INSERT / UPDATE OF month — a NEW slip (or a slip moved to another month) is
--   refused when that society already has a payroll run for the month in state approved / locked /
--   posted / paid. Editing a slip that already exists is not blocked (its row id is already there).
-- The other half is in pay-post (Edge Function): it refuses to post a run for a month that already has
-- Salary-page slips with a live accrual voucher.
--
-- The Salary page saves the accrual voucher first and the slip second; when this trigger refuses the
-- slip, the page's existing error path removes the slip and cancels that accrual voucher (RULE 1).
--
-- Not client-callable (a trigger). Idempotent. Skipped when the payroll schema is not installed.
-- Undo: 175_salary_one_path_per_month_down.sql.

begin;

create or replace function public._salary_slip_refuse_if_payroll_run()
returns trigger language plpgsql security definer
set search_path = public as $fn$
declare run_no text;
begin
  if tg_op = 'UPDATE' and new.month is not distinct from old.month then
    return new;
  end if;
  if tg_op = 'INSERT' and exists (select 1 from public.salary_records s where s.id = new.id) then
    return new;   -- upsert of an existing slip (an edit), not a new one
  end if;
  if new.month is null or new.month !~ '^\d{4}-\d{2}$' then
    return new;
  end if;
  select r.run_no into run_no
    from pay_calc.payroll_run r
   where r.society_id::text = new.society_id::text
     and r.period::text = new.month
     and r.state::text in ('approved', 'locked', 'posted', 'paid')
   limit 1;
  if run_no is not null then
    raise exception using
      errcode = 'P0001',
      message = format('इस महीने (%s) का वेतन Payroll run %s से पहले ही बन चुका है — Salary पर्ची से दोबारा नहीं बनेगा। / Salary for %s is already in payroll run %s.',
                       new.month, run_no, new.month, run_no),
      hint = 'PAY-02: one salary path per month';
  end if;
  return new;
end;
$fn$;
revoke execute on function public._salary_slip_refuse_if_payroll_run() from public, anon, authenticated;

do $t$
begin
  if to_regclass('pay_calc.payroll_run') is null then
    raise notice '175: pay_calc.payroll_run not installed — trigger not created';
    return;
  end if;
  drop trigger if exists salary_slip_refuse_if_payroll_run on public.salary_records;
  create trigger salary_slip_refuse_if_payroll_run
    before insert or update of month on public.salary_records
    for each row execute function public._salary_slip_refuse_if_payroll_run();
end $t$;

insert into public.app_migrations (version, name) values ('175', 'salary_one_path_per_month')
  on conflict (version) do nothing;

commit;

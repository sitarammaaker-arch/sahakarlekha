-- 088 · a NEW society gets its open financial_years row automatically (Phase-2 B2 prerequisite).
--
-- WHY: financial_years rows were written only by migration 073's one-time backfill. A society that
-- registers afterwards has NO row, and every server posting (post_voucher & co.) refuses a voucher
-- with no_open_fy_for_date — so the posting service could not be switched on for new societies.
--
-- WHAT: after a society_settings row is inserted (or its "financialYear" label is set), IF that society
-- has NO financial_years row at all, insert ONE 'open' row for that label — exactly 073's backfill rule
-- (dates from the label, 1 Apr YYYY – 31 Mar YYYY+1; an invalid label is skipped).
--
-- DELIBERATELY NOT HERE: a society that already has FY rows and changes its label (year rollover).
-- Whether vouchers may still be posted into the previous year until it is closed is a business rule
-- for the FY-close design (roadmap Phase C) — this trigger never touches an existing society's years.
--
-- Idempotent. Undo: 088_financial_year_for_new_society_down.sql.

begin;

create or replace function public.tg_financial_year_for_new_society()
returns trigger language plpgsql security definer
set search_path = public as $fn$
declare lbl text := new."financialYear"; y int;
begin
  if lbl is null or lbl !~ '^\d{4}-\d{2}$' then return new; end if;
  y := substr(lbl, 1, 4)::int;
  if substr(lbl, 6, 2)::int <> (y + 1) % 100 then return new; end if;
  if exists (select 1 from public.financial_years f where f.society_id = new.society_id::text) then return new; end if;
  insert into public.financial_years (society_id, fy_label, start_date, end_date, status)
  values (new.society_id::text, lbl, make_date(y, 4, 1), make_date(y + 1, 3, 31), 'open')
  on conflict (society_id, fy_label) do nothing;
  return new;
end;
$fn$;
revoke execute on function public.tg_financial_year_for_new_society() from public, anon, authenticated;

drop trigger if exists trg_financial_year_for_new_society on public.society_settings;
create trigger trg_financial_year_for_new_society
  after insert or update of "financialYear" on public.society_settings
  for each row execute function public.tg_financial_year_for_new_society();

insert into public.app_migrations (version, name) values ('088', 'financial_year_for_new_society')
  on conflict (version) do nothing;

commit;

-- 073 · financial_years — the Financial Year as a real record (Phase-3 S1 · M1-2 · RM-03).
--
-- WHY: today a society's FY is a text label on society_settings ("2026-27") plus ~10 scattered
-- fields, so only ONE year's state exists at a time and rollover forgets the previous year
-- (Phase-1 R01/R03). The target design gives every voucher line an fy_id; this table is that
-- anchor. See the Phase-3 design, section A-4.
--
-- WHAT THIS DOES
--   1. Creates public.financial_years with the design's columns and invariants:
--      - label 'YYYY-YY' consistent with start_date; end_date after start_date
--      - unique (society_id, fy_label); no two FYs of a society overlap (exclusion constraint)
--      - at most ONE 'open' and ONE 'closing' FY per society
--      - an 'audited' FY carries audited_at
--   2. RLS: a tenant may READ its own FYs. NO insert/update/delete policy — FY rows are written
--      only by migrations now, and later by the server-side year-close function (S5).
--   3. Backfill (decision A, 2026-09-27): ONE 'open' row per society from its CURRENT
--      society_settings."financialYear" label — the same year the app shows today. Dates come
--      from the label (1 Apr YYYY – 31 Mar YYYY+1), NOT from "financialYearStart" (which holds
--      values like 'april'). A label that is not a valid 'YYYY-YY' is skipped (RM-02 lists them).
--      "periodLockDate" is copied only when it falls inside that FY.
--
-- ADDITIVE ONLY: no existing table, column or row is changed — society_settings keeps every FY
-- field, and no app code reads this table yet. Re-running is harmless (if not exists / on
-- conflict do nothing). Requires 072 (app_migrations): without it the final insert fails and
-- the whole migration rolls back.
--
-- Reversible: 073_financial_years_down.sql. btree_gist (for the overlap constraint) is left
-- installed by the down — it is a stock extension and harmless.

begin;

create extension if not exists btree_gist with schema extensions;

create table if not exists public.financial_years (
  id                uuid primary key default gen_random_uuid(),
  society_id        text not null,
  fy_label          text not null,
  start_date        date not null,
  end_date          date not null,
  status            text not null default 'open'
                      check (status in ('open', 'closing', 'closed', 'audited')),
  period_lock_date  date,
  closed_at         timestamptz,
  closed_by         uuid,
  close_authority   text,
  audited_at        timestamptz,
  audited_by        uuid,
  audit_reference   text,
  previous_fy_id    uuid references public.financial_years (id),
  net_result_minor  bigint,
  opening_event_id  text,
  created_at        timestamptz not null default now(),

  constraint financial_years_label_format check (
    fy_label ~ '^\d{4}-\d{2}$'
    and substr(fy_label, 6, 2)::int = (substr(fy_label, 1, 4)::int + 1) % 100
    and extract(year from start_date)::int = substr(fy_label, 1, 4)::int),
  constraint financial_years_dates check (end_date > start_date),
  constraint financial_years_period_lock_in_year check (
    period_lock_date is null or period_lock_date between start_date and end_date),
  constraint financial_years_audited_has_date check (status <> 'audited' or audited_at is not null),
  constraint financial_years_label_unique unique (society_id, fy_label),
  constraint financial_years_no_overlap exclude using gist (
    society_id with =, daterange(start_date, end_date, '[]') with &&)
);

create unique index if not exists financial_years_one_open
  on public.financial_years (society_id) where status = 'open';
create unique index if not exists financial_years_one_closing
  on public.financial_years (society_id) where status = 'closing';

alter table public.financial_years enable row level security;

drop policy if exists financial_years_tenant_select on public.financial_years;
create policy financial_years_tenant_select on public.financial_years
  for select using (society_id::text = get_current_society_id());

revoke insert, update, delete, truncate on public.financial_years from anon, authenticated;
grant select on public.financial_years to authenticated;

comment on table public.financial_years is
  'One row per society financial year (RM-03). Read-only to tenants; written by migrations / the year-close function.';

-- Backfill: the current FY of every society, from its label (decision A).
insert into public.financial_years (society_id, fy_label, start_date, end_date, status, period_lock_date)
select s.society_id::text,
       s."financialYear",
       make_date(substr(s."financialYear", 1, 4)::int, 4, 1),
       make_date(substr(s."financialYear", 1, 4)::int + 1, 3, 31),
       'open',
       case
         when s."periodLockDate" ~ '^\d{4}-\d{2}-\d{2}$'
          and substr(s."periodLockDate", 1, 10)::date
              between make_date(substr(s."financialYear", 1, 4)::int, 4, 1)
                  and make_date(substr(s."financialYear", 1, 4)::int + 1, 3, 31)
         then substr(s."periodLockDate", 1, 10)::date
       end
from public.society_settings s
where s."financialYear" ~ '^\d{4}-\d{2}$'
  and substr(s."financialYear", 6, 2)::int = (substr(s."financialYear", 1, 4)::int + 1) % 100
on conflict (society_id, fy_label) do nothing;

insert into public.app_migrations (version, name) values ('073', 'financial_years')
  on conflict (version) do nothing;

commit;

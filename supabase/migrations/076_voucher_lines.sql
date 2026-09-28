-- 076 · voucher_lines + historical financial years (Phase-3 S2 · RM-04, decision A 2026-09-28).
--
-- WHY: the target design posts every voucher as LINES in one table, each line carrying its
-- financial year (fy_id), in paise. This creates that table EMPTY; the lines are back-filled from
-- the existing vouchers by scripts/s2-backfill-voucher-lines.mjs, which uses the app's own posting
-- rule (getVoucherLines / buildVoucherEntries — RULE 2), never a second SQL copy of it.
--
-- WHAT THIS DOES
--   1. Refuses (changes nothing) if any live voucher is dated AFTER its society's current FY —
--      that society's FY label must be fixed first (Society Settings), or its vouchers would have
--      no year to belong to.
--   2. Historical financial years (decision A): for every society, one row per earlier FY
--      ('YYYY-YY', 1 Apr – 31 Mar) in which it has live vouchers dated before its current FY,
--      status 'closed', close_authority 'backfill (S2): pre-M1 history'. No year-close ran for
--      them; the status only means "not open for posting".
--   3. public.voucher_lines (empty): id = voucher_entries' id (`<voucherId>-<lineId>`), voucher,
--      society, fy, line_no, account (composite FK to accounts), dr_minor / cr_minor in paise
--      (never both > 0), narration, dimensions, entry_date, status posted|reversed, source.
--      RLS: a tenant may READ its own lines; NO write policy (backfill now, posting service in S3).
--
-- ADDITIVE ONLY: no existing row changes (financial_years only gains closed historical rows).
-- Requires 072 (app_migrations) and 073 (financial_years). Reversible: 076_voucher_lines_down.sql.

begin;

-- Checked against the OPEN financial_years row (what the lines will use), not the settings label:
-- a label fixed after 073 ran does not move the FY row.
do $chk$
declare n int; list text; missing int;
begin
  select count(distinct v.society_id) into missing
  from public.vouchers v
  where not coalesce(v."isDeleted", false)
    and not exists (select 1 from public.financial_years f where f.society_id = v.society_id::text and f.status = 'open');
  if missing > 0 then
    raise exception '076: % societies with live vouchers have no open financial year — nothing changed', missing;
  end if;
  select count(*), string_agg(distinct cur.society_id || ' (' || cur.fy_label || ')', ', ')
    into n, list
  from public.vouchers v
  join public.financial_years cur on cur.society_id = v.society_id::text and cur.status = 'open'
  where not coalesce(v."isDeleted", false)
    and substr(v.date::text, 1, 10) > cur.end_date::text;
  if n > 0 then
    raise exception '076: % live vouchers are dated after their society''s open FY — fix that FY first (nothing changed): %', n, list;
  end if;
end $chk$;

-- 2. Historical FYs, one per earlier year that has live vouchers.
insert into public.financial_years (society_id, fy_label, start_date, end_date, status, closed_at, close_authority)
select distinct
       v.society_id::text,
       y::text || '-' || lpad(((y + 1) % 100)::text, 2, '0'),
       make_date(y, 4, 1),
       make_date(y + 1, 3, 31),
       'closed',
       now(),
       'backfill (S2): pre-M1 history'
from public.vouchers v
join public.financial_years cur on cur.society_id = v.society_id::text and cur.status = 'open'
cross join lateral (
  select case when substr(v.date::text, 6, 2)::int >= 4 then substr(v.date::text, 1, 4)::int
              else substr(v.date::text, 1, 4)::int - 1 end as y
) fyy
where not coalesce(v."isDeleted", false)
  and v.date::text ~ '^\d{4}-\d{2}-\d{2}'
  and substr(v.date::text, 1, 10)::date < cur.start_date
on conflict (society_id, fy_label) do nothing;

-- 3. voucher_lines (empty).
create table if not exists public.voucher_lines (
  id              text primary key,
  society_id      text not null,
  voucher_id      text not null references public.vouchers (id),
  fy_id           uuid not null references public.financial_years (id),
  line_no         int  not null check (line_no >= 1),
  account_id      text not null,
  dr_minor        bigint not null default 0,
  cr_minor        bigint not null default 0,
  narration       text,
  work_order_id   text,
  cost_centre_id  text,
  branch_id       text,
  entry_date      date not null,
  status          text not null default 'posted' check (status in ('posted', 'reversed')),
  source          text not null default 'backfill',
  created_at      timestamptz not null default now(),
  constraint voucher_lines_amounts check (dr_minor >= 0 and cr_minor >= 0 and not (dr_minor > 0 and cr_minor > 0)),
  constraint voucher_lines_voucher_line unique (voucher_id, line_no),
  constraint voucher_lines_account_fkey foreign key (account_id, society_id) references public.accounts (id, society_id)
);

create index if not exists voucher_lines_tb on public.voucher_lines (society_id, fy_id, account_id);
create index if not exists voucher_lines_voucher on public.voucher_lines (voucher_id);

alter table public.voucher_lines enable row level security;

drop policy if exists voucher_lines_tenant_select on public.voucher_lines;
create policy voucher_lines_tenant_select on public.voucher_lines
  for select using (society_id::text = get_current_society_id());

revoke insert, update, delete, truncate on public.voucher_lines from anon, authenticated;
grant select on public.voucher_lines to authenticated;

comment on table public.voucher_lines is
  'Posted voucher lines in paise, one row per Dr/Cr leg, each in its financial year (RM-04). Read-only to tenants.';

insert into public.app_migrations (version, name) values ('076', 'voucher_lines')
  on conflict (version) do nothing;

commit;

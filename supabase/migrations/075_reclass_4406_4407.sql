-- 075 · persist the 4406 / 4407 reclassification the app has only ever applied in memory
--       (Phase-3 M1-4b, approved 2026-09-27).
--
-- WHY: storage.ts ACCOUNT_PATCHES rewrites two accounts on every load, in LOCAL state only:
--   4407 Admission Fee    → income, under 4400 Other Income  (audit C-3: NCDC Annexure III P&L line)
--   4406 Patronage Rebate → equity appropriation, debit, under 1200  (audit C-4)
-- The database never received it. On 2026-09-27 (read-only check) 4407 was still equity under 1200
-- in 7 societies and 4406 still an expense under 5400 in 5, so anything reading the DB directly
-- (the /ask assistant's ai-ask function, SQL reports, a role map built from DB types) classified
-- them differently from the app. This makes the DB say what the app already shows.
--
-- WHAT CHANGES: only the CLASSIFICATION columns of accounts rows with id '4407' / '4406' that
-- still differ from the app's definition (type, parentId, subtype, openingBalanceType, isSystem
-- for 4407; name/nameHi to the app's labels). NOT touched: any amount, opening balance, voucher,
-- voucher_entries row or ledger event. Every account had ₹0 opening on 2026-09-27; the only
-- postings are Rania's 4407 (net ₹4,440 Cr), which the app already reports as income.
--
-- SAFETY
--   - Aborts (changes nothing) if any row it would change carries a non-zero opening balance.
--   - The previous values of every changed row go to account_reclass_log first; the down
--     restores exactly those.
--   - Re-running is harmless: a fixed row no longer matches, so nothing is logged or changed.
-- Requires 072 (app_migrations). Reversible: 075_reclass_4406_4407_down.sql.

begin;

create table if not exists public.account_reclass_log (
  id          bigserial primary key,
  migration   text not null,
  society_id  text not null,
  account_id  text not null,
  old_row     jsonb not null,
  logged_at   timestamptz not null default now()
);
alter table public.account_reclass_log enable row level security;
revoke all on public.account_reclass_log from anon, authenticated;
comment on table public.account_reclass_log is
  'Previous values of accounts rows changed by a reclassification migration (075+); read by its down.';

create temporary table m075_targets on commit drop as
select a.society_id, a.id
from public.accounts a
where (a.id = '4407' and (a.type, a."parentId", a.subtype, a."openingBalanceType", a."isSystem")
         is distinct from ('income', '4400', 'other_income', 'credit', false))
   or (a.id = '4406' and (a.type, a."parentId", a.subtype, a."openingBalanceType")
         is distinct from ('equity', '1200', 'reserve', 'debit'));

do $$
begin
  if exists (select 1 from public.accounts a join m075_targets t on t.society_id = a.society_id and t.id = a.id
             where coalesce(a."openingBalance", 0) <> 0) then
    raise exception '075: a 4406/4407 row to be reclassified carries a non-zero opening balance — review it before reclassifying; nothing was changed';
  end if;
end $$;

insert into public.account_reclass_log (migration, society_id, account_id, old_row)
select '075', a.society_id, a.id, to_jsonb(a)
from public.accounts a join m075_targets t on t.society_id = a.society_id and t.id = a.id;

update public.accounts a
set type = 'income', "parentId" = '4400', subtype = 'other_income', "openingBalanceType" = 'credit',
    "isSystem" = false, name = 'Admission Fee', "nameHi" = 'प्रवेश शुल्क'
from m075_targets t
where t.society_id = a.society_id and t.id = a.id and a.id = '4407';

update public.accounts a
set type = 'equity', "parentId" = '1200', subtype = 'reserve', "openingBalanceType" = 'debit',
    name = 'Patronage Rebate (Appropriation)', "nameHi" = 'संरक्षण छूट (अधिशेष वितरण)'
from m075_targets t
where t.society_id = a.society_id and t.id = a.id and a.id = '4406';

insert into public.app_migrations (version, name) values ('075', 'reclass_4406_4407')
  on conflict (version) do nothing;

commit;

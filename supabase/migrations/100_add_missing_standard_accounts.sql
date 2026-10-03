-- 100 · add the standard accounts the posting engines write to but some societies' charts lack
--       (COA critical-fix step E · proposed 2026-10-03 · NOT yet run anywhere — review the preview first).
--
-- WHY: the engines post to fixed account ids (GST Payable 2201, ESI Payable 2204, Vehicle 3104, Plant 3105,
-- Trading Goods 3403, Depreciation 5503/5504, Wages Payable 2109, Overdue Interest Reserve 2211, …). A society
-- whose chart does not have the id gets, with the posting service on, an FK error from post_voucher
-- (voucher_lines → accounts) the first time the feature is used. A read-only production check on 2026-10-03
-- found these ids missing in societies whose type needs them (e.g. both PACS societies lack 2201 and 3105),
-- and no posting error logged yet — so this is prevention, not a repair of broken books.
-- The app's load path no longer writes template additions to the database (RM-01), so nothing else would add them.
--
-- WHAT CHANGES: INSERT only. For each society (with a society_settings row) and each account below that applies
-- to its society type, the account is inserted ONLY when
--   · no account with that id exists in that society, AND
--   · no account with the same name and type exists in that society (mirrors storage.ts migrateAccounts), AND
--   · its parent group exists in that society (a missing parent is skipped, never invented).
-- New accounts are leaves with ₹0 opening balance, isSystem=false (5150: true, as in storage.ts), jurisdiction copied
-- from the society's existing accounts.
-- 5503 is named 'Dep. - Vehicle' here (the CMS template calls it 'Vehicle'): several societies already have an
-- operating-expense head named 'Vehicle', and the same-name rule above would otherwise skip the depreciation head.
-- NOT touched: any existing account, amount, opening balance, voucher, voucher_entries / voucher_lines row, ledger
-- event or role mapping. FD (2108) is deliberately NOT added here: its id means "Advance Maintenance Collected" in
-- housing charts, so it is handled on demand, not by id.
--
-- SAFETY
--   - Every inserted (society, account) goes to account_seed_log, which the down reads.
--   - Re-running inserts nothing new (the id then exists).
--   - Review the per-society result first: scripts/preview-100-add-missing-standard-accounts.sql (read-only SELECT).
-- Requires 072 (app_migrations). Reversible: 100_add_missing_standard_accounts_down.sql (removes only unused rows).

begin;

create table if not exists public.account_seed_log (
  id          bigserial primary key,
  migration   text not null,
  society_id  text not null,
  account_id  text not null,
  logged_at   timestamptz not null default now()
);
alter table public.account_seed_log enable row level security;
revoke all on public.account_seed_log from anon, authenticated;
comment on table public.account_seed_log is
  'Accounts INSERTED by a seeding migration (100+), one row per society + account; read by its down.';

-- (ord, id, name, nameHi, type, subtype, openingBalanceType, isGroup, isSystem, parentId, society types — null = every type)
create temporary table m100_spec (
  ord int, id text, name text, name_hi text, type text, subtype text, nature text,
  is_group boolean, is_system boolean, parent_id text, society_types text[]
) on commit drop;
insert into m100_spec values
  (1,  '2201', 'GST Payable',                  'देय GST',                    'liability', 'statutory_liability', 'credit', false, false, '2200', array['pacs']),
  (2,  '2204', 'ESI Payable',                  'देय ESI',                    'liability', 'statutory_liability', 'credit', false, false, '2200', array['pacs','consumer']),
  (3,  '3104', 'Vehicle',                      'वाहन',                       'asset',     'fixed_asset',         'debit',  false, false, '3100', null::text[]),
  (4,  '3105', 'Plant & Machinery',            'संयंत्र एवं मशीनरी',         'asset',     'fixed_asset',         'debit',  false, false, '3100', array['pacs']),
  (5,  '3400', 'Inventory',                    'माल-सूची',                   'asset',     null,                  'debit',  true,  false, '3000', array['pacs']),
  (6,  '3403', 'Trading Goods',                'व्यापारिक माल',              'asset',     'inventory',           'debit',  false, false, '3400', array['pacs']),
  (7,  '4101', 'Fertilizer Sales',             'उर्वरक बिक्री',              'income',    'trading_income',      'credit', false, false, '4100', array['pacs']),
  (8,  '5101', 'Purchase',                     'क्रय',                       'expense',   'direct_expense',      'debit',  false, false, '5100', array['pacs']),
  (9,  '5503', 'Dep. - Vehicle',              'वाहन ह्रास',                 'expense',   'depreciation_expense','debit',  false, false, '5500', null::text[]),
  (10, '5504', 'Plant',                        'संयंत्र ह्रास',              'expense',   'depreciation_expense','debit',  false, false, '5500', null::text[]),
  (11, '2109', 'Wages Payable',                'देय मज़दूरी',                'liability', 'current_liability',   'credit', false, false, '2100', array['labour']),
  (12, '2211', 'Overdue Interest Reserve',     'अतिदेय ब्याज संचय',          'liability', 'current_liability',   'credit', false, false, '2100', array['pacs']),
  (13, '4106', 'Agricultural Implements Sales','कृषि यंत्र बिक्री',          'income',    'trading_income',      'credit', false, false, '4100', array['marketing_processing','multipurpose']),
  (14, '5110', 'Fertilizer Purchase',          'उर्वरक क्रय',                'expense',   'direct_expense',      'debit',  false, false, '5100', array['marketing_processing','multipurpose']),
  (15, '5150', 'Closing Stock (Trading A/c)',  'समापन माल (व्यापार खाता)',   'expense',   'closing_stock',       'credit', false, true,  '5100', array['marketing_processing','multipurpose']);

create temporary table m100_societies on commit drop as
select ss.society_id::text as sid, ss."societyType" as stype
from public.society_settings ss
where exists (select 1 from public.accounts a where a.society_id::text = ss.society_id::text);

do $$
declare r record;
begin
  for r in select * from m100_spec order by ord loop
    with ins as (
      insert into public.accounts
        (id, society_id, name, "nameHi", type, subtype, "openingBalance", "openingBalanceType", "isSystem", "parentId", "isGroup", jurisdiction)
      select r.id, s.sid, r.name, r.name_hi, r.type, r.subtype, 0, r.nature, r.is_system, r.parent_id, r.is_group,
             (select a2.jurisdiction from public.accounts a2 where a2.society_id::text = s.sid limit 1)
      from m100_societies s
      where (r.society_types is null or s.stype = any (r.society_types))
        and not exists (select 1 from public.accounts x where x.society_id::text = s.sid and x.id = r.id)
        and not exists (select 1 from public.accounts x where x.society_id::text = s.sid and lower(x.name) = lower(r.name) and x.type = r.type)
        and exists (select 1 from public.accounts p where p.society_id::text = s.sid and p.id = r.parent_id and coalesce(p."isGroup", false))
      returning society_id, id
    )
    insert into public.account_seed_log (migration, society_id, account_id)
    select '100', society_id, id from ins;
  end loop;
end $$;

insert into public.app_migrations (version, name) values ('100', 'add_missing_standard_accounts')
  on conflict (version) do nothing;

commit;

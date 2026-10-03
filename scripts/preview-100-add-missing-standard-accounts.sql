-- READ-ONLY preview of migration 100 (supabase/migrations/100_add_missing_standard_accounts.sql).
-- Shows, per society, which standard accounts the migration WOULD insert and which it would SKIP and why.
-- Run:  npx supabase db query --linked -f scripts/preview-100-add-missing-standard-accounts.sql -o json
-- It changes nothing (read-only transaction; the account list is a CTE, no table is created).
-- The account list below MUST equal the one in the migration (scripts/test-standard-accounts-migration.mjs checks it).
begin transaction read only;

with m100_spec(ord, id, name, name_hi, type, subtype, nature, is_group, is_system, parent_id, society_types) as (
  values
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
  (15, '5150', 'Closing Stock (Trading A/c)',  'समापन माल (व्यापार खाता)',   'expense',   'closing_stock',       'credit', false, true,  '5100', array['marketing_processing','multipurpose'])
),
soc as (
  select ss.society_id::text as sid, ss."societyType" as stype
  from public.society_settings ss
  where exists (select 1 from public.accounts a where a.society_id::text = ss.society_id::text)
),
cand as (
  select s.sid, s.stype, r.ord, r.id, r.name, r.parent_id,
    (r.society_types is null or s.stype = any (r.society_types)) as applies,
    exists (select 1 from public.accounts x where x.society_id::text = s.sid and x.id = r.id) as id_exists,
    exists (select 1 from public.accounts x where x.society_id::text = s.sid and lower(x.name) = lower(r.name) and x.type = r.type) as name_exists,
    exists (select 1 from public.accounts p where p.society_id::text = s.sid and p.id = r.parent_id and coalesce(p."isGroup", false)) as parent_exists,
    -- a parent that this same run would insert first (e.g. 3400 before 3403)
    exists (
      select 1 from m100_spec r2
      where r2.id = r.parent_id and r2.ord < r.ord and r2.is_group
        and (r2.society_types is null or s.stype = any (r2.society_types))
        and not exists (select 1 from public.accounts x where x.society_id::text = s.sid and x.id = r2.id)
        and not exists (select 1 from public.accounts x where x.society_id::text = s.sid and lower(x.name) = lower(r2.name) and x.type = r2.type)
    ) as parent_inserted_first
  from soc s cross join m100_spec r
)
select sid as society, coalesce(stype, '?') as society_type, id as account, name,
  case when not applies then 'skip: not for this society type'
       when id_exists then 'skip: id already exists'
       when name_exists then 'skip: same name+type already exists'
       when not (parent_exists or parent_inserted_first) then 'skip: parent group ' || parent_id || ' missing'
       else 'WOULD INSERT' end as outcome
from cand
where applies and not id_exists          -- hide the (large) not-applicable / already-fine rows
order by sid, ord;

rollback;

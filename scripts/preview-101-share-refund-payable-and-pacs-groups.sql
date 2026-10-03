-- READ-ONLY preview of migration 101 (supabase/migrations/101_share_refund_payable_and_pacs_groups.sql).
-- Shows, per society, which standard accounts the migration WOULD insert and which it would SKIP and why.
-- Run:  npx supabase db query --linked -f scripts/preview-101-share-refund-payable-and-pacs-groups.sql -o json
-- It changes nothing (read-only transaction; the account list is a CTE, no table is created).
-- The account list below MUST equal the one in the migration (scripts/test-share-refund-migration.mjs checks it).
begin transaction read only;

with m101_spec(ord, id, name, name_hi, type, subtype, nature, is_group, is_system, parent_id, society_types) as (
  values
  (1, '2111', 'Share Refund Payable',  'शेयर वापसी देय',     'liability', 'current_liability', 'credit', false, false, '2100', null::text[]),
  (2, '4100', 'Trading Income',        'व्यापारिक आय',       'income',    null,                'credit', true,  false, '4000', array['pacs']),
  (3, '5100', 'Direct Expenses',       'प्रत्यक्ष व्यय',     'expense',   null,                'debit',  true,  false, '5000', array['pacs'])
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
      select 1 from m101_spec r2
      where r2.id = r.parent_id and r2.ord < r.ord and r2.is_group
        and (r2.society_types is null or s.stype = any (r2.society_types))
        and not exists (select 1 from public.accounts x where x.society_id::text = s.sid and x.id = r2.id)
        and not exists (select 1 from public.accounts x where x.society_id::text = s.sid and lower(x.name) = lower(r2.name) and x.type = r2.type)
    ) as parent_inserted_first
  from soc s cross join m101_spec r
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
